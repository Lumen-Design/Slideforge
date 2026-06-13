import type { Slide } from '../types/presentation'
import { uid } from './templates'

// A style template is a reusable snapshot of a single slide's *look* (not its text).
// Applying one overwrites only the style fields, leaving title/body/notes/image intact.
export type SlideStyle = Pick<
  Slide,
  | 'layoutType'
  | 'backgroundColor'
  | 'textColor'
  | 'fontSize'
  | 'textAlign'
  | 'boxEnabled'
  | 'boxColor'
  | 'boxOpacity'
  | 'fontFamily'
  | 'titleFontFamily'
  | 'titleFontSize'
  | 'boxPerLine'
  | 'lineSpacing'
  | 'titlePosition'
  | 'titleAlign'
>

export type StyleTemplate = {
  id: string
  name: string
  builtin: boolean
  style: SlideStyle
}

const STORAGE_KEY = 'slideforge.styleTemplates.v1'

// The special background value that means "no fill" — used for keyable / overlay text.
export const TRANSPARENT = 'transparent'

/** Templates seeded on first run. The user can edit or delete any of them afterward. */
function defaultTemplates(): StyleTemplate[] {
  return [
    {
      id: uid(),
      name: 'Transparent Text',
      builtin: true,
      style: {
        layoutType: 'fullscreen',
        backgroundColor: TRANSPARENT,
        textColor: '#ffffff',
        fontSize: 48,
        textAlign: 'center',
        boxEnabled: false,
        boxColor: '#000000',
        boxOpacity: 0.5
      }
    },
    {
      id: uid(),
      name: 'White on Black',
      builtin: true,
      style: {
        layoutType: 'fullscreen',
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontSize: 46,
        textAlign: 'center',
        boxEnabled: false,
        boxColor: '#000000',
        boxOpacity: 0.5
      }
    },
    {
      id: uid(),
      name: 'Lower-Third Box',
      builtin: true,
      style: {
        layoutType: 'lyricsBox',
        backgroundColor: TRANSPARENT,
        textColor: '#ffffff',
        fontSize: 40,
        textAlign: 'center',
        boxEnabled: true,
        boxColor: '#000000',
        boxOpacity: 0.55
      }
    }
  ]
}

export function loadTemplates(): StyleTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = defaultTemplates()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as StyleTemplate[]
    return Array.isArray(parsed) ? parsed : defaultTemplates()
  } catch {
    return defaultTemplates()
  }
}

export function persistTemplates(templates: StyleTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // localStorage may be unavailable; templates simply won't persist this session.
  }
}

/** Capture the style of a slide into a new named template. */
export function templateFromSlide(name: string, slide: Slide): StyleTemplate {
  return {
    id: uid(),
    name: name.trim() || 'Untitled Template',
    builtin: false,
    style: {
      layoutType: slide.layoutType,
      backgroundColor: slide.backgroundColor,
      textColor: slide.textColor,
      fontSize: slide.fontSize,
      textAlign: slide.textAlign,
      boxEnabled: slide.boxEnabled,
      boxColor: slide.boxColor,
      boxOpacity: slide.boxOpacity,
      fontFamily: slide.fontFamily,
      titleFontFamily: slide.titleFontFamily,
      titleFontSize: slide.titleFontSize,
      boxPerLine: slide.boxPerLine,
      lineSpacing: slide.lineSpacing,
      titlePosition: slide.titlePosition,
      titleAlign: slide.titleAlign
    }
  }
}

/** Remove a template by id, returning a new array. Any template may be deleted. */
export function deleteTemplate(templates: StyleTemplate[], id: string): StyleTemplate[] {
  return templates.filter((t) => t.id !== id)
}

/** Apply a template's style to a slide, preserving its content. */
export function applyStyle(slide: Slide, style: SlideStyle): Slide {
  return { ...slide, ...style }
}
