import type { ExportFile, Slide } from '../types/presentation'

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'presentation'
}

/**
 * Export every slide as plain text in a layout ProPresenter understands: each slide's
 * lines together, slides separated by a single blank line. No slide numbers and no
 * divider lines — ProPresenter treats a blank line as a slide break, so any extra markup
 * would create junk/blank slides on import.
 *
 * Blank lines *within* a slide are collapsed for the same reason (they would otherwise
 * split one SlideForge slide into several ProPresenter slides).
 */
export function exportSlidesToTxt(slides: Slide[], projectName: string): ExportFile[] {
  const blocks = slides.map((slide) => {
    const lines = [slide.title, slide.body]
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join('\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0) // drop internal blank lines
    return lines.join('\n')
  })

  // One blank line between slides; trailing newline at EOF.
  const content = blocks.filter((b) => b.length > 0).join('\n\n') + '\n'

  return [
    {
      folder: 'txt',
      fileName: `${sanitizeFileName(projectName)}.txt`,
      text: content
    }
  ]
}
