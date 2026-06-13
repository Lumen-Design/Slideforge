import * as mammoth from 'mammoth/mammoth.browser'
import type { LayoutType, Slide } from '../types/presentation'
import { makeSlide } from './templates'
import { buildSlidesFromText } from './textImport'
import type { SplitMode, SplitOptions } from './slideSplitter'

type DocxSegment =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string }

/**
 * Extract plain text only from a .docx file (used as a fallback / for the boundary editor).
 */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const result = await mammoth.extractRawText({ arrayBuffer: copy.buffer as ArrayBuffer })
  return result.value.replace(/\r\n?/g, '\n').trim()
}

/**
 * Extract content from a .docx file as ordered segments of text blocks and embedded images.
 * Walks the converted HTML in document order so images appear between the surrounding text.
 */
async function docxToSegments(bytes: Uint8Array): Promise<DocxSegment[]> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)

  const result = await mammoth.convertToHtml(
    { arrayBuffer: copy.buffer as ArrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read('base64')
        return { src: `data:${image.contentType};base64,${base64}` }
      })
    }
  )

  const doc = new DOMParser().parseFromString(result.value, 'text/html')
  const segments: DocxSegment[] = []
  let textLines: string[] = []

  const flushText = (): void => {
    const text = textLines.join('\n').trim()
    if (text) segments.push({ kind: 'text', text })
    textLines = []
  }

  for (const el of Array.from(doc.body.children)) {
    const imgs = el.querySelectorAll('img')
    if (imgs.length > 0) {
      // Any text content in this element goes before the image
      const inlineText = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (inlineText) textLines.push(inlineText)
      flushText()
      for (const img of Array.from(imgs)) {
        if (img.src.startsWith('data:')) {
          segments.push({ kind: 'image', dataUrl: img.src })
        }
      }
    } else {
      const line = el.textContent?.replace(/\r?\n/g, ' ').trim() ?? ''
      if (line) textLines.push(line)
    }
  }
  flushText()

  return segments
}

/**
 * Build slides from a .docx, interleaving text slides and embedded-image slides in
 * document order. If the file has no images, behaves identically to the text-only path.
 */
export async function buildSlidesFromDocx(
  bytes: Uint8Array,
  preset: LayoutType,
  splitMode: SplitMode,
  splitOptions: SplitOptions
): Promise<{ slides: Slide[]; sourceText: string }> {
  const segments = await docxToSegments(bytes)

  const hasImages = segments.some((s) => s.kind === 'image')
  if (!hasImages) {
    const text = segments
      .filter((s): s is Extract<DocxSegment, { kind: 'text' }> => s.kind === 'text')
      .map((s) => s.text)
      .join('\n\n')
    return { slides: buildSlidesFromText(text, preset, splitMode, splitOptions), sourceText: text }
  }

  const allSlides: Slide[] = []
  const textParts: string[] = []

  for (const seg of segments) {
    if (seg.kind === 'text') {
      textParts.push(seg.text)
      allSlides.push(...buildSlidesFromText(seg.text, preset, splitMode, splitOptions))
    } else {
      allSlides.push(makeSlide('pdfImage', 0, { imageData: seg.dataUrl }))
    }
  }

  // Re-number positions to match final array order
  allSlides.forEach((s, i) => { s.position = i })

  return { slides: allSlides, sourceText: textParts.join('\n\n') }
}
