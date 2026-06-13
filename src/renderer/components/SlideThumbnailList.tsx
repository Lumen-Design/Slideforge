import { useState, type MouseEvent } from 'react'
import { useProjectStore } from '../store/projectStore'
import { SlideCanvas } from './SlidePreview'

/**
 * Left-panel scrollable list of slide thumbnails. Supports:
 *  - click to select, ⌘/Ctrl-click to toggle, Shift-click to range-select
 *  - HTML5 drag-and-drop reordering
 *  - a bulk action bar when more than one slide is selected
 */
export default function SlideThumbnailList(): JSX.Element {
  const slides = useProjectStore((s) => s.project.slides)
  const resolution = useProjectStore((s) => s.resolution)
  const selectedId = useProjectStore((s) => s.selectedSlideId)
  const selectedIds = useProjectStore((s) => s.selectedSlideIds)
  const selectSlide = useProjectStore((s) => s.selectSlide)
  const toggleInSelection = useProjectStore((s) => s.toggleSlideInSelection)
  const selectRangeTo = useProjectStore((s) => s.selectRangeTo)
  const reorderSlides = useProjectStore((s) => s.reorderSlides)
  const addSlide = useProjectStore((s) => s.addSlide)
  const deleteSlides = useProjectStore((s) => s.deleteSlides)
  const duplicateSlides = useProjectStore((s) => s.duplicateSlides)
  const splitSlides = useProjectStore((s) => s.splitSlides)
  const mergeSlidesInto = useProjectStore((s) => s.mergeSlidesInto)
  const buildFromSlides = useProjectStore((s) => s.buildFromSlides)
  const clearSelection = useProjectStore((s) => s.clearSelection)

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const selectedSet = new Set(selectedIds)
  const multi = selectedIds.length > 1
  const aspect = resolution.width / resolution.height
  const thumbH = 180
  const thumbW = Math.round(thumbH * aspect)

  const handleClick = (e: MouseEvent, id: string): void => {
    if (e.metaKey || e.ctrlKey) toggleInSelection(id)
    else if (e.shiftKey) selectRangeTo(id)
    else selectSlide(id)
  }

  const handleDrop = (toIndex: number): void => {
    if (dragIndex !== null && dragIndex !== toIndex) reorderSlides(dragIndex, toIndex)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-forge-700 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Slides {slides.length > 0 && `(${slides.length})`}
        </span>
        <button
          onClick={addSlide}
          className="rounded bg-forge-700 px-2 py-1 text-xs text-zinc-200 hover:bg-forge-600"
          title="Add blank slide"
        >
          + Add
        </button>
      </div>

      {/* Bulk action bar */}
      {multi && (
        <div className="flex flex-wrap items-center gap-1 border-b border-forge-700 bg-forge-800 px-2 py-2">
          <span className="mr-1 w-full text-[11px] font-medium text-forge-accent">{selectedIds.length} selected</span>
          <BulkBtn label="Merge" onClick={() => mergeSlidesInto(selectedIds, 'replace')} title="Combine into one slide (removes the originals)" />
          <BulkBtn label="Merge → new" onClick={() => mergeSlidesInto(selectedIds, 'new')} title="Combine into a new slide and keep the originals" />
          <BulkBtn label="Build" onClick={() => buildFromSlides(selectedIds)} title="Make cumulative slides that build on each other" />
          <BulkBtn label="Duplicate" onClick={() => duplicateSlides(selectedIds)} />
          <BulkBtn label="Split" onClick={() => splitSlides(selectedIds)} />
          <BulkBtn label="Delete" danger onClick={() => deleteSlides(selectedIds)} />
          <BulkBtn label="Clear" onClick={clearSelection} />
        </div>
      )}

      <div className="forge-scroll flex-1 overflow-y-auto p-2">
        {slides.length === 0 ? (
          <div className="mt-10 px-3 text-center text-sm text-zinc-600">
            No slides yet. Import a TXT, PDF or DOCX to generate slides automatically.
          </div>
        ) : (
          <ul className="space-y-2">
            {slides.map((slide, index) => {
              const isSelected = selectedSet.has(slide.id)
              const isPrimary = slide.id === selectedId
              const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
              return (
                <li
                  key={slide.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverIndex(index)
                  }}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setOverIndex(null)
                  }}
                  onClick={(e) => handleClick(e, slide.id)}
                  className={[
                    'group relative cursor-pointer rounded-md border p-1.5 transition-colors',
                    isSelected
                      ? isPrimary
                        ? 'border-forge-accent bg-forge-700'
                        : 'border-forge-accent/60 bg-forge-700/60'
                      : 'border-forge-700 bg-forge-800 hover:border-forge-500',
                    isOver ? 'ring-2 ring-forge-accent' : ''
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-[11px] font-medium text-zinc-500">
                      {index + 1}
                    </span>
                    <div
                      className="w-full overflow-hidden rounded border border-black/50"
                      style={{
                        aspectRatio: `${resolution.width} / ${resolution.height}`,
                        backgroundImage: CHECKER,
                        backgroundSize: '14px 14px'
                      }}
                    >
                      <SlideCanvas slide={slide} width={thumbW} height={thumbH} />
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1 pl-7">
                    <span className="truncate text-[11px] text-zinc-400">
                      {slide.title.trim() || slide.body.split('\n')[0] || 'Empty'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSlides([slide.id])
                      }}
                      className="hidden shrink-0 rounded px-1 text-[11px] text-zinc-500 hover:text-red-400 group-hover:block"
                      title="Delete slide"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// Subtle checkerboard so transparent slides read as transparent in the thumbnail.
const CHECKER =
  'linear-gradient(45deg, #1a1a1d 25%, transparent 25%), linear-gradient(-45deg, #1a1a1d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1d 75%), linear-gradient(-45deg, transparent 75%, #1a1a1d 75%)'

function BulkBtn({ label, onClick, danger, title }: { label: string; onClick: () => void; danger?: boolean; title?: string }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'rounded px-2 py-1 text-[11px] font-medium',
        danger ? 'bg-red-950/50 text-red-300 hover:bg-red-900/50' : 'bg-forge-700 text-zinc-200 hover:bg-forge-600'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
