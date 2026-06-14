import JSZip from 'jszip'
import * as mammoth from 'mammoth/mammoth.browser'
import type { LayoutType, Slide } from '../types/presentation'
import { makeSlide } from './templates'
import { buildSlidesFromText } from './textImport'
import type { SplitMode, SplitOptions } from './slideSplitter'

type DocxSegment =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string }

function xmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/** Parse attributes from a single XML element string into a key→value map. */
function xmlAttrs(el: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of el.matchAll(/[\s\n]+([\w:]+)=["']([^"']*)["']/g)) {
    map.set(m[1], m[2])
  }
  return map
}

export async function docxToText(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const result = await mammoth.extractRawText({ arrayBuffer: copy.buffer as ArrayBuffer })
  return result.value.replace(/\r\n?/g, '\n').trim()
}

async function extractDocxSegments(bytes: Uint8Array): Promise<DocxSegment[]> {
  // Slice to a clean ArrayBuffer to avoid JSZip receiving a SharedArrayBuffer view
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const zip = await JSZip.loadAsync(buffer)

  // --- Build rId → dataUrl from word/_rels/document.xml.rels ---
  const imageMap = new Map<string, string>()
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('text')) ?? ''

  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const attrs = xmlAttrs(m[0])
    const type = attrs.get('Type') ?? ''
    if (!type.includes('/image')) continue
    const rId = attrs.get('Id')
    const rawTarget = attrs.get('Target')
    if (!rId || !rawTarget) continue

    const normalized = rawTarget.replace(/^\.\.\//, '')
    const candidates = [
      `word/${normalized}`,
      normalized,
      `word/media/${rawTarget.split('/').pop() ?? ''}`
    ]

    for (const path of candidates) {
      const file = zip.file(path)
      if (file) {
        const b64 = await file.async('base64')
        const ext = rawTarget.split('.').pop()?.toLowerCase() ?? 'png'
        const mime =
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
          : 'image/png'
        imageMap.set(rId, `data:${mime};base64,${b64}`)
        break
      }
    }
  }

  if (imageMap.size === 0) return []

  // --- Walk word/document.xml paragraph by paragraph ---
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

    // r:embed = modern DOCX image reference; r:id inside v:imagedata = legacy VML
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
    // ZIP extraction failed; fall through to mammoth text-only path
  }

  const hasImages = segments.some((s) => s.kind === 'image')

  if (!hasImages) {
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

  allSlides.forEach((s, i) => { s.position = i })
  return { slides: allSlides, sourceText: textParts.join('\n\n') }
}
