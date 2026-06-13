import * as pdfjs from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
// Bundle pdf.js's worker as a real Web Worker. Using workerPort with a Vite-built worker
// is the most reliable way to make pdf.js run off the main thread in an Electron renderer,
// both in `dev` and from the packaged file:// build.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import type { LayoutType, Slide } from '../types/presentation'
import { makeSlide } from './templates'
import {
  splitByMode,
  DEFAULT_SPLIT_OPTIONS,
  type SplitMode,
  type SplitOptions
} from './slideSplitter'

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()

/** Decode a base64 string into the byte array pdf.js expects. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/** Load a PDF document from raw bytes. The caller owns destroying it via `.destroy()`. */
async function loadDocument(data: Uint8Array): Promise<pdfjs.PDFDocumentProxy> {
  // pdf.js may transfer/detach the buffer, so hand it a private copy.
  const loadingTask = pdfjs.getDocument({ data: data.slice() })
  return await loadingTask.promise
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/**
 * Extract readable text from every page. pdf.js exposes `hasEOL` on text items, which we
 * use to reconstruct line breaks; pages are separated by a blank line so the splitter
 * treats them as paragraph boundaries.
 */
export async function pdfToText(data: Uint8Array): Promise<string> {
  const doc = await loadDocument(data)
  try {
    const pages: string[] = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      let pageText = ''
      for (const item of content.items) {
        // Only TextItem entries carry `str`/`hasEOL`; skip TextMarkedContent markers.
        if (!('str' in item)) continue
        const t = item as TextItem
        pageText += t.str
        if (t.hasEOL) pageText += '\n'
        else if (t.str.length > 0) pageText += ' '
      }
      pages.push(pageText.replace(/[ \t]+\n/g, '\n').trim())
      page.cleanup()
    }
    return pages.join('\n\n')
  } finally {
    await doc.destroy()
  }
}

// ---------------------------------------------------------------------------
// Image rendering (one JPEG/PNG per page)
// ---------------------------------------------------------------------------

const IMAGE_TARGET_WIDTH = 1600 // px — sharp enough for full-screen projection

/**
 * Render each PDF page to a canvas and return a base64 data URL per page. The data URL is
 * stored directly on a slide's `imageData` and re-used for both the preview and export.
 */
export async function pdfToImages(data: Uint8Array): Promise<string[]> {
  const doc = await loadDocument(data)
  const images: string[] = []
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = IMAGE_TARGET_WIDTH / baseViewport.width
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not acquire a 2D canvas context for PDF rendering')

      // White backdrop so transparent PDFs do not render with a black/relic background.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport }).promise
      images.push(canvas.toDataURL('image/jpeg', 0.92))
      page.cleanup()
    }
    return images
  } finally {
    await doc.destroy()
  }
}

// ---------------------------------------------------------------------------
// Slide builders
// ---------------------------------------------------------------------------

export async function buildSlidesFromPdfText(
  data: Uint8Array,
  preset: LayoutType,
  mode: SplitMode = 'smart',
  options: SplitOptions = DEFAULT_SPLIT_OPTIONS
): Promise<Slide[]> {
  const text = await pdfToText(data)
  const raw = splitByMode(text, mode, options)
  if (raw.length === 0) {
    return [makeSlide(preset, 0, { body: text.trim() })]
  }
  return raw.map((r, index) => makeSlide(preset, index, { title: r.title, body: r.body }))
}

/** Build one full-bleed image slide per PDF page. */
export async function buildSlidesFromPdfImages(data: Uint8Array): Promise<Slide[]> {
  const images = await pdfToImages(data)
  return images.map((dataUrl, index) =>
    makeSlide('pdfImage', index, {
      title: `Page ${index + 1}`,
      imageData: dataUrl
    })
  )
}
