import { useEffect, useRef } from 'react'
import type { Slide } from '../types/presentation'
import { renderSlideToCanvas } from '../lib/imageExport'
import { useProjectStore } from '../store/projectStore'

// Checkerboard shown behind the canvas so transparent slides read as transparent.
const CHECKER =
  'linear-gradient(45deg, #17171a 25%, transparent 25%), linear-gradient(-45deg, #17171a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #17171a 75%), linear-gradient(-45deg, transparent 75%, #17171a 75%)'

type SlideCanvasProps = {
  slide: Slide
  /** Internal render resolution (kept 16:9). CSS scales the canvas to its container. */
  width: number
  height: number
  className?: string
}

/**
 * Renders a slide to a real <canvas> using the shared export renderer, guaranteeing the
 * on-screen pixels match the exported JPG/PDF exactly. Re-renders whenever the slide
 * object changes (the store always produces a new object on edit) or the size changes.
 */
export function SlideCanvas({ slide, width, height, className }: SlideCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    // renderSlideToCanvas is async only because image-mode slides decode an image.
    renderSlideToCanvas(slide, width, height, canvas).catch(() => {
      if (cancelled) return
      // On failure, paint a neutral background so we never show a torn frame.
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = slide.backgroundColor
        ctx.fillRect(0, 0, width, height)
      }
    })
    return () => {
      cancelled = true
    }
  }, [slide, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

type SlidePreviewProps = {
  slide: Slide | null
  index: number
  total: number
}

/** The large center-stage preview, locked to the project's aspect ratio. */
export default function SlidePreview({ slide, index, total }: SlidePreviewProps): JSX.Element {
  const resolution = useProjectStore((s) => s.resolution)
  const aspect = resolution.width / resolution.height
  const canvasH = 720
  const canvasW = Math.round(canvasH * aspect)

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-[960px]">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
          <span>
            Live Preview · {resolution.width}×{resolution.height}
          </span>
          {slide && (
            <span>
              Slide {index + 1} of {total}
            </span>
          )}
        </div>

        <div
          className="relative w-full overflow-hidden rounded-lg border border-forge-600 shadow-2xl ring-1 ring-black/40"
          style={{
            aspectRatio: `${resolution.width} / ${resolution.height}`,
            backgroundColor: '#000',
            backgroundImage: CHECKER,
            backgroundSize: '24px 24px'
          }}
        >
          {slide ? (
            <SlideCanvas slide={slide} width={canvasW} height={canvasH} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-center text-zinc-600">
              <p className="text-lg font-medium text-zinc-400">No slide selected</p>
              <p className="mt-1 text-sm">Import a document or add a slide to begin.</p>
            </div>
          )}
        </div>

        {slide && (
          <p className="mt-3 truncate text-center text-sm text-zinc-500">
            {slide.title.trim() || slide.body.split('\n')[0] || 'Empty slide'}
          </p>
        )}
      </div>
    </div>
  )
}
