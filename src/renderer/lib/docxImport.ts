import JSZip from 'jszip'
import * as mammoth from 'mammoth/mammoth.browser'
import type { LayoutType, Slide } from '../types/presentation'
import { makeSlide } from './templates'
import { buildSlidesFromText } from './textImport'
import type { SplitMode, SplitOptions } from './slideSplitter'

type DocxSegment =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string }

/** Decode the five standard XML character entities. */
function xmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Extract plain text only from a .docx file using mammoth (better encoding/list support).
 */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const result = await mammoth.extractRawText({ arrayBuffer: copy.buffer as ArrayBuffer })
  return result.value.replace(/\r\n?/g, '\n').trim()
}

/**
 * Read the DOCX ZIP directly to extract paragraphs and embedded images in document order.
 * DOCX is a ZIP containing word/document.xml (content) and word/media/ (images).
 */
async function extractDocxSegments(bytes: Uint8Array): Promise<DocxSegment[]> {
  const zip = await JSZip.loadAsync(bytes)

  // --- Build rId → dataUrl map from word/_rels/document.xml.rels ---
  const imageMap = new Map<string, string>()
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('text')) ?? ''

  for (const m of relsXml.matchAll(
    /Relationship[^>]+Id="([^"]+)"[^>]+Type="[^"]*\/image"[^>]+Target="([^"]+)"/g
  )) {
    const rId = m[1]
    const rawTarget = m[2] // e.g. "media/image1.png" or "../media/image1.png"

    // Targets are relative to word/. Remove any leading "../" then prepend "word/".
    const normalized = rawTarget.replace(/^\.\.\//, '')
    const candidatePaths = [
      `word/${normalized}`,
      normalized,
      `word/media/${rawTarget.split('/').pop()}`
    ]

    for (const path of candidatePaths) {
      const file = zip.file(path)
      if (file) {
        const b64 = await file.async('base64')
        const ext = rawTarget.split('.').pop()?.toLowerCase() ?? 'png'
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'webp'
                ? 'image/webp'
                : 'image/png'
        imageMap.set(rId, `data:${mime};base64,${b64}`)
        break
      }
    }
  }

  if (imageMap.size === 0) return [] // No embedded images — caller will use mammoth text path

  // --- Parse word/document.xml paragraph by paragraph ---
  const docXml = (await zip.file('word/document.xml')?.async('text')) ?? ''
  const segments: DocxSegment[] = []
  let textLines: string[] = []

  const flushText = (): void => {
    const text = textLines.join('\n').trim()
    if (text) segments.push({ kind: 'text', text })
    textLines = []
  }

  for (const pm of docXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    const para = pm[0]

    // Find image rId references: r:embed covers modern DOCX, r:id inside v:imagedata covers VML
    const imageRIds = [
      ...[...para.matchAll(/r:embed="([^"]+)"/g)].map((x) => x[1]),
      ...[...para.matchAll(/<v:imagedata[^>]+r:id="([^"]+)"/g)].map((x) => x[1])
    ].filter((rId) => imageMap.has(rId))

    if (imageRIds.length > 0) {
      flushText()
      for (const rId of imageRIds) {
        segments.push({ kind: 'image', dataUrl: imageMap.get(rId)! })
      }
    } else {
      // Extract text from all <w:t> runs in this paragraph
      const parts = [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((x) =>
        xmlDecode(x[1])
      )
      const line = parts.join('').trim()
      if (line) textLines.push(line)
    }
  }

  flushText()
  return segments
}

/**
 * Build slides from a .docx, interleaving text slides and embedded-image slides in
 * document order. Falls back to pure mammoth text extraction when there are no images.
 */
export async function buildSlidesFromDocx(
  bytes: Uint8Array,
  preset: LayoutType,
  splitMode: SplitMode,
  splitOptions: SplitOptions
): Promise<{ slides: Slide[]; sourceText: string }> {
  let segments: DocxSegment[] = []
  try {
    segments = await extractDocxSegments(bytes)
  } catch {
    // ZIP parse failed — fall through to mammoth-only path
  }

  const hasImages = segments.some((s) => s.kind === 'image')

  if (!hasImages) {
    // Pure text: use mammoth for better fidelity
    const text = await docxToText(bytes)
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
  allSlides.forEach((s, i) => {
    s.position = i
  })

  return { slides: allSlides, sourceText: textParts.join('\n\n') }
}
