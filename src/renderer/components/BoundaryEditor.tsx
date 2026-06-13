import { useMemo, useState, useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { slidesFromBoundaries } from '../lib/slideSplitter'
import { makeSlide } from '../lib/templates'

type BoundaryEditorProps = {
  open: boolean
  onClose: () => void
}

/** Compute sensible default slide starts: index 0 plus each paragraph start (line after a blank). */
function defaultStarts(lines: string[]): Set<number> {
  const starts = new Set<number>([0])
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() !== '' && lines[i - 1].trim() === '') starts.add(i)
  }
  return starts
}

/**
 * Manual boundary editor: shows the imported source text line-by-line and lets the user
 * click any non-empty line to toggle whether a new slide starts there. Applying rebuilds
 * the deck from those boundaries (keeping the current preset's style).
 */
export default function BoundaryEditor({ open, onClose }: BoundaryEditorProps): JSX.Element | null {
  const sourceText = useProjectStore((s) => s.sourceText)
  const preset = useProjectStore((s) => s.project.selectedPreset)
  const replaceSlides = useProjectStore((s) => s.replaceSlides)

  const lines = useMemo(() => sourceText.split('\n'), [sourceText])
  const [starts, setStarts] = useState<Set<number>>(() => defaultStarts(lines))
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Re-seed defaults whenever the editor is opened on a new source.
  useEffect(() => {
    if (open) setStarts(defaultStarts(lines))
  }, [open, lines])

  const slideCount = useMemo(() => {
    // Count non-empty segments the same way slidesFromBoundaries does.
    return slidesFromBoundaries(lines, starts, 42).length
  }, [lines, starts])

  if (!open) return null

  const toggle = (i: number): void => {
    if (lines[i].trim() === '' || i === 0) return // blank lines and the first line aren't toggleable
    setStarts((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  /** Move an existing boundary from line `from` to line `to` (used by drag-and-drop). */
  const moveBoundary = (from: number, to: number): void => {
    if (from === to || to === 0 || lines[to]?.trim() === '') return
    setStarts((prev) => {
      const next = new Set(prev)
      next.delete(from)
      next.add(to)
      return next
    })
  }

  const apply = (): void => {
    const raw = slidesFromBoundaries(lines, starts, 42)
    const built = raw.map((r, index) => makeSlide(preset, index, { title: r.title, body: r.body }))
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
              <span className="text-zinc-300">already has a “New slide” marker to remove it</span>.
              Drag a marker to move it. {slideCount} slide{slideCount === 1 ? '' : 's'}.
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
                const isStart = starts.has(i)
                const isBlank = line.trim() === ''
                const isDropTarget = dragOver === i && dragFrom !== null && dragFrom !== i
                return (
                  <li
                    key={i}
                    onDragOver={(e) => {
                      if (dragFrom === null || isBlank || i === 0) return
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
                        draggable
                        onDragStart={(e) => {
                          setDragFrom(i)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDragFrom(null)
                          setDragOver(null)
                        }}
                        className="my-1 flex cursor-grab items-center gap-2 active:cursor-grabbing"
                        title="Drag to move this slide break"
                      >
                        <span className="h-px flex-1 bg-forge-accent/60" />
                        <span className="rounded bg-forge-accent/20 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-forge-accent">
                          ⋮⋮ New slide
                        </span>
                        <span className="h-px flex-1 bg-forge-accent/60" />
                      </div>
                    )}
                    <button
                      onClick={() => toggle(i)}
                      disabled={isBlank}
                      className={[
                        'flex w-full items-start gap-3 rounded px-2 py-0.5 text-left',
                        isBlank ? 'cursor-default' : 'cursor-pointer hover:bg-forge-800',
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
