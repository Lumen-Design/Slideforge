import { useMemo, useState } from 'react'
import { SPLIT_MODES, type SplitMode } from '../lib/slideSplitter'
import { PRESET_ORDER, PRESETS } from '../lib/templates'
import type { LayoutType } from '../types/presentation'
import { useProjectStore } from '../store/projectStore'

export type ImportOptions = {
  splitMode: SplitMode
  maxLines: number
  maxChars: number
  pdfMode: 'text' | 'image'
  preset: LayoutType
  /** Open the manual boundary editor immediately after importing (text imports only). */
  editBoundaries: boolean
}

type ImportDialogProps = {
  fileName: string | null // null = closed
  onCancel: () => void
  onConfirm: (options: ImportOptions) => void
}

/** Collects segmentation + layout options before an import actually runs. */
export default function ImportDialog({ fileName, onCancel, onConfirm }: ImportDialogProps): JSX.Element | null {
  const currentPreset = useProjectStore((s) => s.project.selectedPreset)
  const ext = useMemo(() => fileName?.split('.').pop()?.toLowerCase() ?? '', [fileName])
  const isPdf = ext === 'pdf'

  const [splitMode, setSplitMode] = useState<SplitMode>('smart')
  const [maxLines, setMaxLines] = useState(8)
  const [maxChars, setMaxChars] = useState(42)
  const [pdfMode, setPdfMode] = useState<'text' | 'image'>('text')
  const [preset, setPreset] = useState<LayoutType>(
    currentPreset === 'pdfImage' ? 'fullscreen' : currentPreset
  )

  if (!fileName) return null

  const imageMode = isPdf && pdfMode === 'image'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={onCancel}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-forge-600 bg-forge-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-forge-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Import options</h2>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{fileName}</p>
        </div>

        <div className="forge-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* PDF handling */}
          {isPdf && (
            <div>
              <label className="mb-2 block text-xs text-zinc-400">PDF handling</label>
              <div className="grid grid-cols-2 gap-2">
                <Choice active={pdfMode === 'text'} onClick={() => setPdfMode('text')} title="Extract text" hint="Auto-split into slides" />
                <Choice active={pdfMode === 'image'} onClick={() => setPdfMode('image')} title="Page images" hint="One image per page" />
              </div>
            </div>
          )}

          {/* Split mode — hidden in PDF image mode (no text to split) */}
          {!imageMode && (
            <div>
              <label className="mb-2 block text-xs text-zinc-400">Split into slides</label>
              <div className="space-y-1.5">
                {SPLIT_MODES.map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => setSplitMode(m.mode)}
                    className={[
                      'flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors',
                      splitMode === m.mode
                        ? 'border-forge-accent bg-forge-700'
                        : 'border-forge-700 bg-forge-800 hover:border-forge-500'
                    ].join(' ')}
                  >
                    <span>
                      <span className="block text-sm font-medium text-zinc-100">{m.label}</span>
                      <span className="block text-[11px] text-zinc-500">{m.description}</span>
                    </span>
                    <span
                      className={[
                        'h-3.5 w-3.5 shrink-0 rounded-full border',
                        splitMode === m.mode ? 'border-forge-accent bg-forge-accent' : 'border-forge-500'
                      ].join(' ')}
                    />
                  </button>
                ))}
              </div>

              {splitMode === 'smart' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField label="Max lines / slide" value={maxLines} min={1} max={20} onChange={setMaxLines} />
                  <NumberField label="Max chars / line" value={maxChars} min={10} max={120} onChange={setMaxChars} />
                </div>
              )}
              {splitMode !== 'smart' && splitMode !== 'line' && (
                <div className="mt-3">
                  <NumberField label="Max chars / line (wrap)" value={maxChars} min={10} max={120} onChange={setMaxChars} />
                </div>
              )}
            </div>
          )}

          {/* Preset (style applied to generated slides) */}
          {!imageMode && (
            <div>
              <label className="mb-2 block text-xs text-zinc-400">Layout preset</label>
              <select
                className="w-full rounded border border-forge-600 bg-forge-900 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-forge-accent"
                value={preset}
                onChange={(e) => setPreset(e.target.value as LayoutType)}
              >
                {PRESET_ORDER.filter((p) => p !== 'pdfImage').map((p) => (
                  <option key={p} value={p}>
                    {PRESETS[p].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-600">
                You can restyle everything later, including transparent text templates.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-forge-700 px-6 py-4">
          <button onClick={onCancel} className="rounded bg-forge-700 px-4 py-2 text-sm text-zinc-100 hover:bg-forge-600">
            Cancel
          </button>
          <div className="flex gap-2">
            {!imageMode && (
              <button
                onClick={() => onConfirm({ splitMode, maxLines, maxChars, pdfMode, preset, editBoundaries: true })}
                className="rounded border border-forge-500 px-4 py-2 text-sm text-zinc-100 hover:border-forge-accent hover:text-forge-accent"
                title="Import, then set slide start points by hand"
              >
                Import &amp; set start points →
              </button>
            )}
            <button
              onClick={() => onConfirm({ splitMode, maxLines, maxChars, pdfMode, preset, editBoundaries: false })}
              className="rounded bg-forge-accent px-5 py-2 text-sm font-medium text-white hover:bg-forge-accentHover"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Choice({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded border px-3 py-2 text-left transition-colors',
        active ? 'border-forge-accent bg-forge-700' : 'border-forge-700 bg-forge-800 hover:border-forge-500'
      ].join(' ')}
    >
      <div className="text-sm font-medium text-zinc-100">{title}</div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </button>
  )
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full rounded border border-forge-600 bg-forge-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-forge-accent"
      />
    </label>
  )
}
