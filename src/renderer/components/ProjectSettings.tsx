import { useState, useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'

type ProjectSettingsProps = {
  open: boolean
  onClose: () => void
}

const PRESETS: { label: string; w: number; h: number; note: string }[] = [
  { label: '1080p', w: 1920, h: 1080, note: '16:9 HD' },
  { label: '720p', w: 1280, h: 720, note: '16:9' },
  { label: '4K UHD', w: 3840, h: 2160, note: '16:9' },
  { label: 'WUXGA', w: 1920, h: 1200, note: '16:10' },
  { label: 'Ultrawide', w: 3840, h: 1080, note: '32:9 wall' },
  { label: 'Square', w: 1080, h: 1080, note: '1:1' }
]

/** Project-level output canvas / resolution settings (drives preview + every export). */
export default function ProjectSettings({ open, onClose }: ProjectSettingsProps): JSX.Element | null {
  const resolution = useProjectStore((s) => s.resolution)
  const setResolution = useProjectStore((s) => s.setResolution)

  const [w, setW] = useState(resolution.width)
  const [h, setH] = useState(resolution.height)

  // Sync the local fields whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setW(resolution.width)
      setH(resolution.height)
    }
  }, [open, resolution.width, resolution.height])

  if (!open) return null

  const apply = (nw: number, nh: number): void => {
    setW(nw)
    setH(nh)
    setResolution(nw, nh)
  }

  const aspect = h > 0 ? (w / h).toFixed(3) : '—'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-forge-600 bg-forge-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-forge-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Project canvas &amp; resolution</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <p className="text-xs text-zinc-500">
            Sets the output size for the preview and all exports. Use a custom size for an LED wall
            so slides (and notes) fill the whole surface at the right aspect ratio.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const active = p.w === w && p.h === h
              return (
                <button
                  key={p.label}
                  onClick={() => apply(p.w, p.h)}
                  className={[
                    'rounded border px-2 py-2 text-center transition-colors',
                    active ? 'border-forge-accent bg-forge-700' : 'border-forge-700 bg-forge-800 hover:border-forge-500'
                  ].join(' ')}
                >
                  <div className="text-sm font-medium text-zinc-100">{p.label}</div>
                  <div className="text-[10px] text-zinc-500">{p.w}×{p.h}</div>
                  <div className="text-[10px] text-zinc-600">{p.note}</div>
                </button>
              )
            })}
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Custom (pixels)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={120}
                max={16384}
                value={w}
                onChange={(e) => setW(Number(e.target.value) || 0)}
                className="w-full rounded border border-forge-600 bg-forge-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-forge-accent"
              />
              <span className="text-zinc-500">×</span>
              <input
                type="number"
                min={120}
                max={16384}
                value={h}
                onChange={(e) => setH(Number(e.target.value) || 0)}
                className="w-full rounded border border-forge-600 bg-forge-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-forge-accent"
              />
              <button
                onClick={() => apply(Math.max(120, w), Math.max(120, h))}
                className="shrink-0 rounded bg-forge-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-forge-accentHover"
              >
                Set
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-600">Aspect ratio: {aspect} : 1</p>
          </div>
        </div>

        <div className="flex justify-end border-t border-forge-700 px-6 py-4">
          <button onClick={onClose} className="rounded bg-forge-700 px-4 py-2 text-sm text-zinc-100 hover:bg-forge-600">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
