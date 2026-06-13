import type { LayoutType, Slide, TextAlign } from '../types/presentation'

// ---------------------------------------------------------------------------
// Reference coordinate space
// ---------------------------------------------------------------------------
// Every preset is described in a fixed 960 x 540 point space — exactly a 16:9
// PowerPoint slide (13.333in x 7.5in at 72pt/in). The preview, the JPG exporter,
// the PPTX exporter and the PDF exporter all map from this same space, which is
// what makes "the preview is accurate to the export" literally true.
export const SLIDE_W = 960
export const SLIDE_H = 540

// Curated, broadly-available font families. These render in the canvas preview/exports and
// map directly to PowerPoint fontFace strings.
export const DEFAULT_FONT = 'Arial'
export const FONT_OPTIONS: string[] = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Trebuchet MS',
  'Tahoma',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact'
]

export type Region = { x: number; y: number; w: number; h: number } // fractions 0..1
export type VAlign = 'top' | 'center' | 'bottom'

export type PresetMeta = {
  type: LayoutType
  label: string
  description: string
  defaults: Pick<
    Slide,
    | 'backgroundColor'
    | 'textColor'
    | 'fontSize'
    | 'textAlign'
    | 'boxEnabled'
    | 'boxColor'
    | 'boxOpacity'
  >
}

// Default style for each preset. Picking a preset stamps these onto a slide.
export const PRESETS: Record<LayoutType, PresetMeta> = {
  fullscreen: {
    type: 'fullscreen',
    label: 'Full Screen Text',
    description: 'Centered large text on a solid black background.',
    defaults: {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      fontSize: 46,
      textAlign: 'center',
      boxEnabled: false,
      boxColor: '#000000',
      boxOpacity: 0.5
    }
  },
  lyricsBox: {
    type: 'lyricsBox',
    label: 'Lyrics With Black Box',
    description: 'Lyrics sit near the bottom inside a translucent black box.',
    defaults: {
      backgroundColor: '#0a0a0a',
      textColor: '#ffffff',
      fontSize: 40,
      textAlign: 'center',
      boxEnabled: true,
      boxColor: '#000000',
      boxOpacity: 0.55
    }
  },
  scripture: {
    type: 'scripture',
    label: 'Scripture',
    description: 'Reference at the top, verse body centered below.',
    defaults: {
      backgroundColor: '#000000',
      textColor: '#f5f5f5',
      fontSize: 36,
      textAlign: 'center',
      boxEnabled: false,
      boxColor: '#000000',
      boxOpacity: 0.5
    }
  },
  announcement: {
    type: 'announcement',
    label: 'Announcements',
    description: 'Large title with smaller supporting body text.',
    defaults: {
      backgroundColor: '#111827',
      textColor: '#ffffff',
      fontSize: 30,
      textAlign: 'center',
      boxEnabled: false,
      boxColor: '#000000',
      boxOpacity: 0.5
    }
  },
  pdfImage: {
    type: 'pdfImage',
    label: 'PDF Page Image',
    description: 'Each PDF page rendered as a full-slide image.',
    defaults: {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      fontSize: 32,
      textAlign: 'center',
      boxEnabled: false,
      boxColor: '#000000',
      boxOpacity: 0.5
    }
  }
}

export const PRESET_ORDER: LayoutType[] = [
  'fullscreen',
  'lyricsBox',
  'scripture',
  'announcement',
  'pdfImage'
]

// The structural blueprint of a layout: which elements show, where they sit, and how
// the title is scaled relative to the body. Expressed in fractions of the slide.
export type LayoutSpec = {
  showTitle: boolean
  showBody: boolean
  showBox: boolean
  isImage: boolean
  titleRegion: Region
  bodyRegion: Region
  boxRegion: Region
  titleAlign: TextAlign
  titleVAlign: VAlign
  bodyVAlign: VAlign
  /** Title font size = body fontSize * titleScale. */
  titleScale: number
  /** Body font size = slide.fontSize * bodyScale (lets a preset shrink supporting text). */
  bodyScale: number
}

const MARGIN = 0.06

/**
 * Resolve the structural blueprint for a slide based purely on its layout type.
 * This is deliberately style-free (no colors) — colors live on the slide itself so the
 * user can override them in the settings panel.
 */
export function getLayoutSpec(layoutType: LayoutType): LayoutSpec {
  switch (layoutType) {
    case 'fullscreen':
      return {
        showTitle: true,
        showBody: true,
        showBox: false,
        isImage: false,
        titleRegion: { x: MARGIN, y: 0.08, w: 1 - MARGIN * 2, h: 0.16 },
        bodyRegion: { x: MARGIN, y: 0.12, w: 1 - MARGIN * 2, h: 0.76 },
        boxRegion: { x: 0, y: 0, w: 1, h: 1 },
        titleAlign: 'center',
        titleVAlign: 'top',
        bodyVAlign: 'center',
        titleScale: 0.55,
        bodyScale: 1
      }
    case 'lyricsBox':
      // Lyrics anchored to a translucent box across the lower third. The title is shown
      // only when present (so a reference survives when a lyric template is applied).
      return {
        showTitle: true,
        showBody: true,
        showBox: true,
        isImage: false,
        titleRegion: { x: MARGIN, y: 0.05, w: 1 - MARGIN * 2, h: 0.12 },
        bodyRegion: { x: 0.08, y: 0.6, w: 0.84, h: 0.34 },
        boxRegion: { x: 0.05, y: 0.56, w: 0.9, h: 0.4 },
        titleAlign: 'center',
        titleVAlign: 'top',
        bodyVAlign: 'center',
        titleScale: 0.5,
        bodyScale: 1
      }
    case 'scripture':
      return {
        showTitle: true,
        showBody: true,
        showBox: false,
        isImage: false,
        titleRegion: { x: MARGIN, y: 0.08, w: 1 - MARGIN * 2, h: 0.14 },
        bodyRegion: { x: 0.1, y: 0.24, w: 0.8, h: 0.6 },
        boxRegion: { x: 0, y: 0, w: 1, h: 1 },
        titleAlign: 'center',
        titleVAlign: 'top',
        bodyVAlign: 'center',
        titleScale: 0.7,
        bodyScale: 1
      }
    case 'announcement':
      return {
        showTitle: true,
        showBody: true,
        showBox: false,
        isImage: false,
        titleRegion: { x: MARGIN, y: 0.16, w: 1 - MARGIN * 2, h: 0.26 },
        bodyRegion: { x: 0.1, y: 0.46, w: 0.8, h: 0.42 },
        boxRegion: { x: 0, y: 0, w: 1, h: 1 },
        titleAlign: 'center',
        titleVAlign: 'center',
        bodyVAlign: 'top',
        titleScale: 1.7,
        bodyScale: 0.78
      }
    case 'pdfImage':
      return {
        showTitle: false,
        showBody: false,
        showBox: false,
        isImage: true,
        titleRegion: { x: 0, y: 0, w: 1, h: 1 },
        bodyRegion: { x: 0, y: 0, w: 1, h: 1 },
        boxRegion: { x: 0, y: 0, w: 1, h: 1 },
        titleAlign: 'center',
        titleVAlign: 'top',
        bodyVAlign: 'center',
        titleScale: 1,
        bodyScale: 1
      }
  }
}

/**
 * Apply the slide's title position (above/below) to a layout's title & body regions by
 * mirroring them vertically within their combined span. Shared by the canvas renderer and
 * the PPTX exporter so both agree.
 */
export function arrangeRegions(
  spec: LayoutSpec,
  titlePosition?: 'above' | 'below'
): { titleRegion: Region; bodyRegion: Region } {
  let titleRegion = spec.titleRegion
  let bodyRegion = spec.bodyRegion
  if (titlePosition === 'below' && spec.showTitle && spec.showBody) {
    const top = Math.min(titleRegion.y, bodyRegion.y)
    const bottom = Math.max(titleRegion.y + titleRegion.h, bodyRegion.y + bodyRegion.h)
    titleRegion = { ...titleRegion, y: top + bottom - (titleRegion.y + titleRegion.h) }
    bodyRegion = { ...bodyRegion, y: top + bottom - (bodyRegion.y + bodyRegion.h) }
  }
  return { titleRegion, bodyRegion }
}

export type PixelRegion = { x: number; y: number; w: number; h: number }

export type ResolvedLayout = {
  spec: LayoutSpec
  scale: number // pixels per reference point (canvasHeight / SLIDE_H)
  titleRect: PixelRegion
  bodyRect: PixelRegion
  boxRect: PixelRegion
  titleFontPx: number
  bodyFontPx: number
  lineHeight: number
}

/**
 * Map a slide's layout into concrete pixel rectangles and font sizes for a canvas of
 * size (canvasW x canvasH). Used identically by the preview (canvasH = preview height)
 * and the JPG exporter (canvasH = 1080), guaranteeing they match.
 */
export function resolveLayout(slide: Slide, canvasW: number, canvasH: number): ResolvedLayout {
  const spec = getLayoutSpec(slide.layoutType)
  const scale = canvasH / SLIDE_H

  const toRect = (r: Region): PixelRegion => ({
    x: r.x * canvasW,
    y: r.y * canvasH,
    w: r.w * canvasW,
    h: r.h * canvasH
  })

  const bodyFontPx = slide.fontSize * spec.bodyScale * scale
  // An explicit per-slide title size overrides the preset's title scale.
  const titlePt = slide.titleFontSize ?? slide.fontSize * spec.titleScale
  const titleFontPx = titlePt * scale

  const { titleRegion, bodyRegion } = arrangeRegions(spec, slide.titlePosition)

  return {
    spec,
    scale,
    titleRect: toRect(titleRegion),
    bodyRect: toRect(bodyRegion),
    boxRect: toRect(spec.boxRegion),
    titleFontPx,
    bodyFontPx,
    lineHeight: 1.22
  }
}

/** The title size a slide uses by default (preset title scale × body size), for UI display. */
export function defaultTitleSize(slide: Slide): number {
  return Math.round(slide.fontSize * getLayoutSpec(slide.layoutType).titleScale)
}

/** Apply a preset's default styling to a slide, returning a new slide object. */
export function applyPreset(slide: Slide, preset: LayoutType): Slide {
  const meta = PRESETS[preset]
  return {
    ...slide,
    layoutType: preset,
    ...meta.defaults
  }
}

/** Produce the style defaults for a freshly created slide of a given preset. */
export function presetDefaults(preset: LayoutType): PresetMeta['defaults'] {
  return { ...PRESETS[preset].defaults }
}

/** Generate a unique id (crypto.randomUUID is available in the Chromium renderer). */
export function uid(): string {
  return crypto.randomUUID()
}

/**
 * Build a full Slide from partial content, stamping preset style defaults and identity.
 * `position` is 0-based and also seeds an empty title/body/notes when omitted.
 */
export function makeSlide(
  preset: LayoutType,
  position: number,
  content?: Partial<Pick<Slide, 'title' | 'body' | 'notes' | 'imageData'>>
): Slide {
  const defaults = presetDefaults(preset)
  return {
    id: uid(),
    title: content?.title ?? '',
    body: content?.body ?? '',
    notes: content?.notes ?? '',
    layoutType: preset,
    imageData: content?.imageData,
    position,
    ...defaults
  }
}

/** Convert "#rrggbb" to an {r,g,b} triple (0-255). Falls back to black on bad input. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  const int = parseInt(m[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

/** rgba() string helper for translucent boxes. */
export function rgba(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
