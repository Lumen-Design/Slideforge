import type { ExportFile, Slide } from '../types/presentation'
import { resolveLayout, rgba, type PixelRegion, type VAlign } from './templates'

// Full-HD render target for exported stills. 16:9 to match the reference slide space.
export const EXPORT_W = 1920
export const EXPORT_H = 1080

const FONT_FAMILY = 'Arial, Helvetica, sans-serif'

/** Load an <img> from a data URL / blob URL and resolve once decoded. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode slide image'))
    img.src = src
  })
}

/**
 * Word-wrap text inside a pixel width using the canvas's own font metrics. Honors any
 * explicit "\n" line breaks already present (e.g. from the splitter) and wraps each.
 */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    if (para.trim().length === 0) {
      out.push('')
      continue
    }
    const words = para.split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line.length === 0 ? word : line + ' ' + word
      if (ctx.measureText(candidate).width <= maxWidth || line.length === 0) {
        line = candidate
      } else {
        out.push(line)
        line = word
      }
    }
    if (line.length > 0) out.push(line)
  }
  return out
}

/** Vertical start offset (top of first line) for a block of `count` lines in a region. */
function verticalStart(rect: PixelRegion, blockHeight: number, vAlign: VAlign): number {
  switch (vAlign) {
    case 'top':
      return rect.y
    case 'bottom':
      return rect.y + Math.max(0, rect.h - blockHeight)
    case 'center':
    default:
      return rect.y + Math.max(0, (rect.h - blockHeight) / 2)
  }
}

/** A laid-out text block: the wrapped lines, where to paint them, and a tight bounding box. */
type TextBlock = {
  lines: string[]
  x: number
  startY: number
  step: number
  align: CanvasTextAlign
  fontPx: number
  family: string
  color: string
  bold: boolean
  bounds: PixelRegion
}

/** Wrap + position text within a region and compute the tight box that surrounds it. */
function layoutText(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: PixelRegion,
  fontPx: number,
  family: string,
  color: string,
  bold: boolean,
  hAlign: CanvasTextAlign,
  vAlign: VAlign,
  lineHeight: number
): TextBlock | null {
  if (!text.trim()) return null
  ctx.font = `${bold ? '700' : '400'} ${fontPx}px ${family}`

  const lines = wrapCanvasText(ctx, text, rect.w)
  const step = fontPx * lineHeight
  const blockHeight = lines.length * step
  const startY = verticalStart(rect, blockHeight, vAlign)
  const x = hAlign === 'left' ? rect.x : hAlign === 'right' ? rect.x + rect.w : rect.x + rect.w / 2

  const maxW = Math.min(rect.w, Math.max(...lines.map((l) => ctx.measureText(l).width)))
  const boundsX = hAlign === 'left' ? rect.x : hAlign === 'right' ? rect.x + rect.w - maxW : x - maxW / 2

  return {
    lines,
    x,
    startY,
    step,
    align: hAlign,
    fontPx,
    family,
    color,
    bold,
    bounds: { x: boundsX, y: startY, w: maxW, h: blockHeight }
  }
}

/** Paint a previously laid-out text block. */
function paintBlock(ctx: CanvasRenderingContext2D, b: TextBlock): void {
  ctx.font = `${b.bold ? '700' : '400'} ${b.fontPx}px ${b.family}`
  ctx.fillStyle = b.color
  ctx.textBaseline = 'top'
  ctx.textAlign = b.align
  b.lines.forEach((line, i) => ctx.fillText(line, b.x, b.startY + i * b.step))
}

/** Tight, per-line rectangles for a block (used by the "box behind each line" option). */
function lineRects(ctx: CanvasRenderingContext2D, b: TextBlock): PixelRegion[] {
  ctx.font = `${b.bold ? '700' : '400'} ${b.fontPx}px ${b.family}`
  const rects: PixelRegion[] = []
  b.lines.forEach((line, i) => {
    if (line.trim().length === 0) return
    const w = ctx.measureText(line).width
    const x = b.align === 'left' ? b.x : b.align === 'right' ? b.x - w : b.x - w / 2
    rects.push({ x, y: b.startY + i * b.step, w, h: b.fontPx })
  })
  return rects
}

/** Union of two pixel regions (ignoring nulls). */
function unionBounds(a: PixelRegion | null, b: PixelRegion | null): PixelRegion | null {
  if (!a) return b
  if (!b) return a
  const x1 = Math.min(a.x, b.x)
  const y1 = Math.min(a.y, b.y)
  const x2 = Math.max(a.x + a.w, b.x + b.w)
  const y2 = Math.max(a.y + a.h, b.y + b.h)
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Draw an image fitted ('contain') or filling ('cover') and centered within the canvas. */
function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  mode: 'cover' | 'contain'
): void {
  const ratio = mode === 'cover' ? Math.max(W / img.width, H / img.height) : Math.min(W / img.width, H / img.height)
  const dw = img.width * ratio
  const dh = img.height * ratio
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

/**
 * Render a single slide to a canvas at WxH. This is THE renderer — the preview component,
 * the JPG exporter and the PDF exporter all go through it so output matches the preview.
 */
export async function renderSlideToCanvas(
  slide: Slide,
  W: number,
  H: number,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const target = canvas ?? document.createElement('canvas')
  target.width = W
  target.height = H
  const ctx = target.getContext('2d')
  if (!ctx) throw new Error('Could not acquire a 2D canvas context')

  const layout = resolveLayout(slide, W, H)

  // Background. A "transparent" slide is left unfilled so it can be keyed/overlaid; the
  // preview shows a checkerboard behind the canvas to make the transparency visible.
  ctx.clearRect(0, 0, W, H)
  if (slide.backgroundColor !== 'transparent') {
    ctx.fillStyle = slide.backgroundColor
    ctx.fillRect(0, 0, W, H)
  }

  // PDF image mode: fill black then draw the page image contained.
  if (layout.spec.isImage) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    if (slide.imageData) {
      const img = await loadImage(slide.imageData)
      drawFittedImage(ctx, img, W, H, 'contain')
    }
    return target
  }

  // Background image (text layouts only) — drawn behind the text, with optional dimming.
  if (slide.backgroundImage) {
    try {
      const bgImg = await loadImage(slide.backgroundImage)
      drawFittedImage(ctx, bgImg, W, H, slide.backgroundFit ?? 'cover')
      const dim = slide.backgroundDim ?? 0
      if (dim > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${dim})`
        ctx.fillRect(0, 0, W, H)
      }
    } catch {
      // Ignore a broken image; the solid background already painted above stands in.
    }
  }

  // Resolve font families (title falls back to body font, then the default).
  const bodyFamily = slide.fontFamily || FONT_FAMILY
  const titleFamily = slide.titleFontFamily || slide.fontFamily || FONT_FAMILY
  const lh = slide.lineSpacing ?? layout.lineHeight

  // Lay out title and body first so a box can be sized to the actual text.
  const titleBlock =
    layout.spec.showTitle && slide.title.trim()
      ? layoutText(
          ctx,
          slide.title,
          layout.titleRect,
          layout.titleFontPx,
          titleFamily,
          slide.textColor,
          true,
          toCanvasAlign(slide.titleAlign ?? layout.spec.titleAlign),
          layout.spec.titleVAlign,
          lh
        )
      : null

  const bodyBlock =
    layout.spec.showBody && slide.body.trim()
      ? layoutText(
          ctx,
          slide.body,
          layout.bodyRect,
          layout.bodyFontPx,
          bodyFamily,
          slide.textColor,
          false,
          toCanvasAlign(slide.textAlign),
          layout.spec.bodyVAlign,
          lh
        )
      : null

  // Translucent box behind the text — works on ANY layout when enabled.
  if (slide.boxEnabled) {
    const padX = layout.bodyFontPx * 0.6
    // Per-line boxes use tighter vertical padding so the gap between lines stays visible.
    const padY = layout.bodyFontPx * (slide.boxPerLine ? 0.12 : 0.3)
    const fillBox = (r: PixelRegion): void => {
      const box = {
        x: Math.max(0, r.x - padX),
        y: Math.max(0, r.y - padY),
        w: Math.min(W, r.w + padX * 2),
        h: Math.min(H, r.h + padY * 2)
      }
      ctx.fillStyle = rgba(slide.boxColor, slide.boxOpacity)
      const radius = Math.min(16 * layout.scale, box.h / 2, box.w / 2)
      roundRect(ctx, box.x, box.y, box.w, box.h, radius)
      ctx.fill()
    }

    if (slide.boxPerLine) {
      // A separate box behind each individual line of text.
      const rects = [
        ...(titleBlock ? lineRects(ctx, titleBlock) : []),
        ...(bodyBlock ? lineRects(ctx, bodyBlock) : [])
      ]
      rects.forEach(fillBox)
    } else {
      // One box hugging the whole text block (title + body union).
      const textBounds = unionBounds(titleBlock?.bounds ?? null, bodyBlock?.bounds ?? null)
      if (textBounds) fillBox(textBounds)
    }
  }

  if (titleBlock) paintBlock(ctx, titleBlock)
  if (bodyBlock) paintBlock(ctx, bodyBlock)

  return target
}

function toCanvasAlign(a: Slide['textAlign']): CanvasTextAlign {
  return a
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Whether a slide has no background fill (keyable / overlay output). */
export function slideIsTransparent(slide: Slide): boolean {
  return slide.backgroundColor === 'transparent'
}

/**
 * Render a slide to a data URL, choosing PNG (with alpha) for transparent slides and
 * JPEG otherwise. Returns the URL plus the matching file extension/mime.
 */
export async function slideToDataUrl(
  slide: Slide,
  W: number = EXPORT_W,
  H: number = EXPORT_H
): Promise<{ dataUrl: string; ext: 'png' | 'jpg' }> {
  const canvas = await renderSlideToCanvas(slide, W, H)
  if (slideIsTransparent(slide)) {
    return { dataUrl: canvas.toDataURL('image/png'), ext: 'png' }
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), ext: 'jpg' }
}

/** Strip the "data:...;base64," prefix, leaving raw base64 suitable for disk writing. */
export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

/**
 * Build the image export bundle: one numbered file per slide under images/. Transparent
 * slides are written as PNG (preserving alpha); all others as JPG. Rendered at the
 * project's output resolution (e.g. a large LED wall size).
 */
export async function exportSlidesToImages(
  slides: Slide[],
  res: { width: number; height: number } = { width: EXPORT_W, height: EXPORT_H }
): Promise<ExportFile[]> {
  const files: ExportFile[] = []
  const pad = String(slides.length).length
  for (let i = 0; i < slides.length; i++) {
    const { dataUrl, ext } = await slideToDataUrl(slides[i], res.width, res.height)
    files.push({
      folder: 'images',
      fileName: `slide-${String(i + 1).padStart(pad, '0')}.${ext}`,
      base64: dataUrlToBase64(dataUrl)
    })
  }
  return files
}
