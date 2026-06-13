import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import { SlideCanvas } from './SlidePreview'

type PresentModeProps = {
  open: boolean
  startIndex: number
  onClose: () => void
}

/**
 * Full-screen presentation/review mode. Steps through slides with the keyboard so the
 * deck can be proofed exactly as it will export. Selection in the editor follows along.
 */
export default function PresentMode({ open, startIndex, onClose }: PresentModeProps): JSX.Element | null {
  const slides = useProjectStore((s) => s.project.slides)
  const resolution = useProjectStore((s) => s.resolution)
  const selectSlide = useProjectStore((s) => s.selectSlide)
  const [idx, setIdx] = useState(startIndex)
  const [showHint, setShowHint] = useState(true)

  // Reset to the starting slide each time present mode opens.
  useEffect(() => {
    if (open) {
      setIdx(Math.max(0, Math.min(startIndex, slides.length - 1)))
      setShowHint(true)
      const t = setTimeout(() => setShowHint(false), 2500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open, startIndex, slides.length])

  const go = useCallback(
    (delta: number) => {
      setIdx((i) => {
        const next = Math.max(0, Math.min(slides.length - 1, i + delta))
        if (slides[next]) selectSlide(slides[next].id)
        return next
      })
    },
    [slides, selectSlide]
  )

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          go(1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          go(-1)
          break
        case 'Home':
          e.preventDefault()
          setIdx(0)
          break
        case 'End':
          e.preventDefault()
          setIdx(slides.length - 1)
          break
        case 'Escape':
        case 'F5':
          e.preventDefault()
          onClose()
          break
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, go, onClose, slides.length])

  if (!open || slides.length === 0) return null
  const slide = slides[Math.max(0, Math.min(idx, slides.length - 1))]
  const aspect = resolution.width / resolution.height

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black">
      {/* Slide stage */}
      <div
        className="max-h-[92vh] max-w-[96vw] overflow-hidden shadow-2xl"
        style={{ aspectRatio: `${resolution.width} / ${resolution.height}`, width: `min(96vw, calc(92vh * ${aspect}))` }}
      >
        {slide && <SlideCanvas slide={slide} width={1920} height={Math.round(1920 / aspect)} />}
      </div>

      {/* Controls / counter */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-xs text-zinc-500">
        <span>
          {idx + 1} / {slides.length}
        </span>
        {showHint && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-zinc-300">
            ← → to navigate · Esc to exit
          </span>
        )}
        <button
          onClick={onClose}
          className="pointer-events-auto rounded bg-white/10 px-3 py-1 text-zinc-200 hover:bg-white/20"
        >
          Exit
        </button>
      </div>

      {/* Click zones for mouse navigation */}
      <button className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" aria-label="Previous" onClick={() => go(-1)} />
      <button className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize" aria-label="Next" onClick={() => go(1)} />
    </div>
  )
}
