import pptxgen from 'pptxgenjs'
import type { ExportFile, Slide, TextAlign } from '../types/presentation'
import { getLayoutSpec, arrangeRegions, type Region, type VAlign } from './templates'

// pptx slide height in inches. 7.5in = 540pt, so the height maps 1:1 with the 540pt
// reference space and font sizes carry over directly as points regardless of width.
const PPT_H = 7.5

/** pptxgenjs expects hex colors without the leading '#'. */
function hex(color: string): string {
  return color.replace('#', '').toUpperCase()
}

/** Convert a fractional region into an inch-based pptx position box for a given slide size. */
function regionToInches(r: Region, pptW: number, pptH: number): { x: number; y: number; w: number; h: number } {
  return { x: r.x * pptW, y: r.y * pptH, w: r.w * pptW, h: r.h * pptH }
}

function valign(v: VAlign): 'top' | 'middle' | 'bottom' {
  return v === 'center' ? 'middle' : v
}

function align(a: TextAlign): 'left' | 'center' | 'right' {
  return a
}

/** Rough text width in inches (no font metrics available during generation). */
function estimateWidthIn(text: string, fontPt: number): number {
  return (fontPt * 0.52 * text.length) / 72
}

/**
 * Export all slides to a single .pptx using native, editable text + shapes — so the
 * slides stay fully editable in PowerPoint and, importantly, can have a ProPresenter
 * theme applied after import (a flattened image slide cannot accept a theme).
 */
export async function exportSlidesToPptx(
  slides: Slide[],
  projectName: string,
  aspect = 16 / 9
): Promise<ExportFile[]> {
  const pptW = PPT_H * aspect // width follows the project's aspect ratio
  const pptH = PPT_H

  const pptx = new pptxgen()
  pptx.defineLayout({ name: 'FORGE_CUSTOM', width: pptW, height: pptH })
  pptx.layout = 'FORGE_CUSTOM'
  pptx.author = 'SlideForge'
  pptx.title = projectName

  for (const slide of slides) {
    const spec = getLayoutSpec(slide.layoutType)
    const s = pptx.addSlide()

    if (slide.notes.trim()) s.addNotes(slide.notes)

    // --- PDF image mode: full-bleed contained image on a black background ---
    if (spec.isImage) {
      s.background = { color: '000000' }
      if (slide.imageData) {
        s.addImage({ data: slide.imageData, x: 0, y: 0, w: pptW, h: pptH, sizing: { type: 'contain', w: pptW, h: pptH } })
      }
      continue
    }

    // Background fill. Transparent slides get a fully-transparent fill so a ProPresenter
    // theme's background shows through — and they stay editable TEXT slides, so a theme
    // still applies on import (a flattened image would not).
    if (slide.backgroundColor === 'transparent') {
      s.background = { color: 'FFFFFF', transparency: 100 }
    } else {
      s.background = { color: hex(slide.backgroundColor) }
    }
    if (slide.backgroundImage) s.background = { data: slide.backgroundImage }

    // Fonts/sizes (title can override family + size independently of the body).
    const bodyFace = slide.fontFamily || 'Arial'
    const titleFace = slide.titleFontFamily || slide.fontFamily || 'Arial'
    const titleSize = slide.titleFontSize ?? Math.round(slide.fontSize * spec.titleScale)
    const bodySize = Math.round(slide.fontSize * spec.bodyScale)
    const titleColor = hex(slide.textColor)
    const boxFill = {
      color: hex(slide.boxColor),
      transparency: Math.round((1 - slide.boxOpacity) * 100) // pptx transparency = % transparent
    }

    const showTitle = spec.showTitle && slide.title.trim().length > 0
    const showBody = spec.showBody && slide.body.trim().length > 0
    const { titleRegion, bodyRegion } = arrangeRegions(spec, slide.titlePosition)
    const titleAlign = slide.titleAlign ?? spec.titleAlign

    // Dim overlay over a background image, for text legibility.
    if (slide.backgroundImage && (slide.backgroundDim ?? 0) > 0) {
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: pptW, h: pptH,
        fill: { color: '000000', transparency: Math.round((1 - (slide.backgroundDim ?? 0)) * 100) }
      })
    }

    // --- "Box behind each line": a rounded, text-hugging box behind each line ---
    if (slide.boxEnabled && slide.boxPerLine) {
      // Title (single boxed line) at the top of its region.
      if (showTitle) {
        const treg = regionToInches(titleRegion, pptW, pptH)
        const w = Math.min(treg.w, estimateWidthIn(slide.title.trim(), titleSize) + 0.25)
        const h = (titleSize * 1.25) / 72
        const x = titleAlign === 'left' ? treg.x : titleAlign === 'right' ? treg.x + treg.w - w : treg.x + (treg.w - w) / 2
        s.addShape(pptx.ShapeType.roundRect, { x, y: treg.y, w, h, rectRadius: h * 0.45, fill: boxFill })
        s.addText(slide.title, { x, y: treg.y, w, h, fontSize: titleSize, fontFace: titleFace, bold: true, color: titleColor, align: 'center', valign: 'middle' })
      }
      if (showBody) {
        const lines = slide.body.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
        const reg = regionToInches(bodyRegion, pptW, pptH)
        const rowStep = (bodySize * (slide.lineSpacing ?? 1.22)) / 72
        const totalH = lines.length * rowStep
        const startY =
          spec.bodyVAlign === 'center' ? reg.y + Math.max(0, (reg.h - totalH) / 2)
          : spec.bodyVAlign === 'bottom' ? reg.y + Math.max(0, reg.h - totalH)
          : reg.y
        lines.forEach((line, i) => {
          const w = Math.min(reg.w, estimateWidthIn(line, bodySize) + 0.25)
          const x = slide.textAlign === 'left' ? reg.x : slide.textAlign === 'right' ? reg.x + reg.w - w : reg.x + (reg.w - w) / 2
          const y = startY + i * rowStep
          const h = rowStep * 0.86
          s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: h * 0.45, fill: boxFill })
          s.addText(line, { x, y, w, h, fontSize: bodySize, fontFace: bodyFace, color: titleColor, align: 'center', valign: 'middle' })
        })
      }
      continue
    }

    // --- Single rounded box behind the whole text block ---
    if (slide.boxEnabled) {
      const regions = [showTitle ? titleRegion : null, showBody ? bodyRegion : null].filter(
        (r): r is NonNullable<typeof r> => r !== null
      )
      const union = regions.length
        ? regions.reduce((acc, r) => ({
            x: Math.min(acc.x, r.x),
            y: Math.min(acc.y, r.y),
            w: Math.max(acc.x + acc.w, r.x + r.w) - Math.min(acc.x, r.x),
            h: Math.max(acc.y + acc.h, r.y + r.h) - Math.min(acc.y, r.y)
          }))
        : bodyRegion
      s.addShape(pptx.ShapeType.roundRect, { ...regionToInches(union, pptW, pptH), rectRadius: 0.12, fill: boxFill })
    }

    // --- Title ---
    if (showTitle) {
      s.addText(slide.title, {
        ...regionToInches(titleRegion, pptW, pptH),
        fontSize: titleSize, fontFace: titleFace, bold: true, color: titleColor,
        align: align(titleAlign), valign: valign(spec.titleVAlign), wrap: true, shrinkText: true
      })
    }

    // --- Body ---
    if (showBody) {
      s.addText(slide.body, {
        ...regionToInches(bodyRegion, pptW, pptH),
        fontSize: bodySize, fontFace: bodyFace, color: hex(slide.textColor),
        align: align(slide.textAlign), valign: valign(spec.bodyVAlign), wrap: true, shrinkText: true,
        lineSpacingMultiple: slide.lineSpacing ?? 1.1
      })
    }
  }

  const base64 = (await pptx.write({ outputType: 'base64' })) as string
  return [{ folder: 'pptx', fileName: `${sanitizeFileName(projectName)}.pptx`, base64 }]
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'presentation'
}
