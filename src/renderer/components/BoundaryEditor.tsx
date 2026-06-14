import { useMemo, useState, useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { slidesFromBoundaries } from '../lib/slideSplitter'
import { makeSlide } from '../lib/templates'

type BoundaryEditorProps = {
  open: boolean
  onClose: () => void
}

const IMAGE_PAT = /^__IMAGE_(\d+)__$/

function isImageLine(line: string): boolean {
  return IMAGE_PAT.test(line)
}

function imageIndexFromLine(line: string): number {
  const m = line.match(IMAGE_PAT)
  return m ? parseInt(m[1]) : -1
}

/** A line is a fixed boundary point if it is an image marker or immediately follows one. */
function isFixedBoundary(lines: string[], i: number): boolean {
  if (isImageLine(lines[i])) return true
  if (i > 0 && isImageLine(lines[i - 1])) return true
  return false
}

/** Default slide starts: index 0, each paragraph start, plus forced breaks around image markers. */
function defaultStarts(lines: string[]): Set<number> {
  const starts = new Set<number>([0])
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() !== '' && lines[i - 1].trim() === '') starts.add(i)
    if (isImageLine(lines[i])) starts.add(i)
    if (i > 0 && isImageLine(lines[i - 1]) && lines[i].trim() !== '') starts.add(i)
  }
  return starts
}

/** Build the full slide list from lines + starts + docxImages — same logic as apply(). */
function computeSlides(
  lines: string[],
  starts: Set<number>,
  docxImages: string[]
): number {
  let count = 0
  let runStart = 0

  const flushRun = (from: number, to: number): void => {
    const runLines = lines.slice(from, to)
    if (!runLines.some((l) => l.trim() !== '')) return
    const runStarts = new Set(
      [...starts].filter((s) => s >= from && s < to).map((s) => s - from)
    )
    runStarts.add(0)
    count += slidesFromBoundaries(runLines, runStarts, 42).length
  }

  for (let i = 0; i < lines.length; i++) {
    if (isImageLine(lines[i])) {
      flushRun(runStart, i)
      const imgIdx = imageIndexFromLine(lines[i])
      if (docxImages[imgIdx]) count++
      runStart = i + 1
    }
  }
  flushRun(runStart, lines.length)
  return count
}

/**
 * Manual boundary editor: shows source text line-by-line and lets the user click any
 * non-empty line to toggle a slide break. DOCX image markers are shown as thumbnails
 * and are always fixed-position slides that cannot be moved or removed.
 */
export default function BoundaryEditor({ open, onClose }: BoundaryEditorProps): JSX.Element | null {
  const sourceText = useProjectStore((s) => s.sourceText)
  const docxImages = useProjectStore((s) => s.docxImages)
  const preset = useProjectStore((s) => s.project.selectedPreset)
  const replaceSlides = useProjectStore((s) => s.replaceSlides)

  const lines = useMemo(() => sourceText.split('\n'), [sourceText])
  const [starts, setStarts] = useState<Set<number>>(() => defaultStarts(lines))
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  useEffect(() => {
    if (open) setStarts(defaultStarts(lines))
  }, [open, lines])

  const slideCount = useMemo(
    () => computeSlides(lines, starts, docxImages),
    [lines, starts, docxImages]
  )

  if (!open) return null

  const toggle = (i: number): void => {
    if (lines[i].trim() === '' || i === 0) return
    if (isFixedBoundary(lines, i)) return // image lines and post-image lines are fixed
    setStarts((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const moveBoundary = (from: number, to: number): void => {
    if (from === to || to === 0 || lines[to]?.trim() === '') return
    if (isFixedBoundary(lines, from) || isFixedBoundary(lines, to)) return
    setStarts((prev) => {
      const next = new Set(prev)
      next.delete(from)
      next.add(to)
      return next
    })
  }

  const apply = (): void => {
    const built: ReturnType<typeof makeSlide>[] = []
    let runStart = 0
    let slideIndex = 0

    const flushRun = (from: number, to: number): void => {
      const runLines = lines.slice(from, to)
      if (!runLines.some((l) => l.trim() !== '')) return
      const runStarts = new Set(
        [...starts].filter((s) => s >= from && s < to).map((s) => s - from)
      )
      runStarts.add(0)
      const raw = slidesFromBoundaries(runLines, runStarts, 42)
      raw.forEach((r) => {
        built.push(makeSlide(preset, slideIndex, { title: r.title, body: r.body }))
        slideIndex++
      })
    }

    for (let i = 0; i < lines.length; i++) {
      if (isImageLine(lines[i])) {
        flushRun(runStart, i)
        const imgIdx = imageIndexFromLine(lines[i])
        if (docxImages[imgIdx]) {
          built.push(makeSlide('pdfImage', slideIndex, { imageData: docxImages[imgIdx] }))
          slideIndex++
        }
        runStart = i + 1
      }
    }
    flushRun(runStart, lines.length)

    built.forEach((s, i) => { s.position = i })
    replaceSlides(built)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-forge-600 bg-forge-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-forge-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Adjust slide boundaries</h2>
            <p className="text-xs text-zinc-500">
              Click a line to start a new slide <span className="text-zinc-300">above it</span> — that
              line becomes the first line of the new slide. Click a line that{' '}
              <span className="text-zinc-300">already has a "New slide" marker to remove it</span>.
              Drag a marker to move it. Image slides are fixed and cannot be moved.{' '}
              {slideCount} slide{slideCount === 1 ? '' : 's'}.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
        </div>

        <div className="forge-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {sourceText.trim() === '' ? (
            <div className="px-3 py-10 text-center text-sm text-zinc-600">
              No source text available. Boundary editing works for TXT, PDF (text) and DOCX imports.
            </div>
          ) : (
            <ol className="font-mono text-[13px]">
              {lines.map((line, i) => {
                const imgIdx = imageIndexFromLine(line)
                const isImage = imgIdx >= 0

                // ── Image line: render thumbnail row ──────────────────────────
                if (isImage) {
                  return (
                    <li key={i}>
                      <div className="my-1 flex items-center gap-2">
                        <span className="h-px flex-1 bg-forge-accent/40" />
                        <span className="rounded bg-forge-accent/15 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-forge-accent/70">
                          Image slide (fixed)
                        </span>
                        <span className="h-px flex-1 bg-forge-accent/40" />
                      </div>
                      <div className="my-1.5 flex items-center gap-3 rounded border border-forge-600 bg-forge-800 px-3 py-2">
                        {docxImages[imgIdx] && (
                          <img
                            src={docxImages[imgIdx]}
                            alt=""
                            className="h-14 w-24 shrink-0 rounded object-contain bg-black"
                          />
                        )}
                        <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Embedded image — always its own slide
                        </span>
                      </div>
                    </li>
                  )
                }

                const isStart = starts.has(i)
                const isBlank = line.trim() === ''
                const isFixed = isFixedBoundary(lines, i)
                const isDropTarget = dragOver === i && dragFrom !== null && dragFrom !== i

                return (
                  <li
                    key={i}
                    onDragOver={(e) => {
                      if (dragFrom === null || isBlank || i === 0 || isFixed) return
                      e.preventDefault()
                      setDragOver(i)
                    }}
                    onDrop={() => {
                      if (dragFrom !== null) moveBoundary(dragFrom, i)
                      setDragFrom(null)
                      setDragOver(null)
                    }}
                    className={isDropTarget ? 'rounded ring-2 ring-forge-accent' : ''}
                  >
                    {isStart && i !== 0 && (
                      <div
                        draggable={!isFixed}
                        onDragStart={(e) => {
                          if (isFixed) { e.preventDefault(); return }
                          setDragFrom(i)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDragFrom(null)
                          setDragOver(null)
                        }}
                        className={[
                          'my-1 flex items-center gap-2',
                          isFixed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                        ].join(' ')}
                        title={isFixed ? 'This slide break is fixed' : 'Drag to move this slide break'}
                      >
                        <span className="h-px flex-1 bg-forge-accent/60" />
                        <span className="rounded bg-forge-accent/20 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-forge-accent">
                          {isFixed ? '— New slide' : '⋮⋮ New slide'}
                        </span>
                        <span className="h-px flex-1 bg-forge-accent/60" />
                      </div>
                    )}
                    <button
                      onClick={() => toggle(i)}
                      disabled={isBlank || isFixed}
                      className={[
                        'flex w-full items-start gap-3 rounded px-2 py-0.5 text-left',
                        isBlank || isFixed ? 'cursor-default' : 'cursor-pointer hover:bg-forge-800',
                        isStart ? 'text-zinc-100' : 'text-zinc-400'
                      ].join(' ')}
                    >
                      <span className="w-8 shrink-0 select-none text-right text-[11px] text-zinc-600">
                        {i + 1}
                      </span>
                      <span className="whitespace-pre-wrap break-words">
                        {isBlank ? <span className="text-zinc-700">·</span> : line}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-forge-700 px-6 py-4">
          <button
            onClick={() => setStarts(defaultStarts(lines))}
            className="text-xs text-zinc-400 underline-offset-2 hover:text-forge-accent hover:underline"
          >
            Reset to paragraphs
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded bg-forge-700 px-4 py-2 text-sm text-zinc-100 hover:bg-forge-600">
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={sourceText.trim() === ''}
              className="rounded bg-forge-accent px-5 py-2 text-sm font-medium text-white hover:bg-forge-accentHover disabled:opacity-40"
            >
              Rebuild {slideCount} slide{slideCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
