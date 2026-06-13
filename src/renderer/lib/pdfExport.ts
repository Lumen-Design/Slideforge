import { jsPDF } from 'jspdf'
import type { ExportFile, Slide } from '../types/presentation'
import { SLIDE_H } from './templates'
import { renderSlideToCanvas, slideIsTransparent, EXPORT_W, EXPORT_H } from './imageExport'

/** ArrayBuffer → base64 in chunks (avoids blowing the call stack on large buffers). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'presentation'
}

/**
 * Export all slides to a single PDF. Each slide is rendered through the shared canvas
 * renderer (so it looks exactly like the preview) and placed as one full-bleed page.
 * Pages use the 16:9 slide point space (960 x 540 pt).
 */
export async function exportSlidesToPdf(
  slides: Slide[],
  projectName: string,
  res: { width: number; height: number } = { width: EXPORT_W, height: EXPORT_H }
): Promise<ExportFile[]> {
  // Page height fixed to the 540pt reference; width follows the project's aspect ratio.
  const aspect = res.width / res.height
  const pageH = SLIDE_H
  const pageW = SLIDE_H * aspect
  const orientation = pageW >= pageH ? 'landscape' : 'portrait'

  const doc = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH], compress: true })

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) doc.addPage([pageW, pageH], orientation)
    const canvas = await renderSlideToCanvas(slides[i], res.width, res.height)
    // Transparent slides → PNG so the page's white paper shows through; others → JPEG.
    if (slideIsTransparent(slides[i])) {
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')
    } else {
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST')
    }
  }

  const base64 = arrayBufferToBase64(doc.output('arraybuffer'))
  return [
    {
      folder: 'pdf',
      fileName: `${sanitizeFileName(projectName)}.pdf`,
      base64
    }
  ]
}
