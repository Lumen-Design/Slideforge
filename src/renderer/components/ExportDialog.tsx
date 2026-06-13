import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { ExportFile, ExportFormats } from '../types/presentation'
import { exportSlidesToPptx } from '../lib/pptxExport'
import { exportSlidesToPdf } from '../lib/pdfExport'
import { exportSlidesToImages } from '../lib/imageExport'
import { exportSlidesToTxt } from '../lib/txtExport'
import { exportToZip } from '../lib/platform'

type ExportDialogProps = {
  open: boolean
  onClose: () => void
}

type Status = 'idle' | 'working' | 'done' | 'error'

const FORMAT_LABELS: { key: keyof ExportFormats; label: string; hint: string }[] = [
  { key: 'pptx', label: 'PowerPoint (.pptx)', hint: 'Editable slides for ProPresenter' },
  { key: 'pdf', label: 'PDF (.pdf)', hint: 'One page per slide' },
  { key: 'images', label: 'Images (JPG)', hint: 'One image per slide' },
  { key: 'txt', label: 'Plain text (.txt)', hint: 'All slide text' }
]

export default function ExportDialog({ open, onClose }: ExportDialogProps): JSX.Element | null {
  const project = useProjectStore((s) => s.project)
  const resolution = useProjectStore((s) => s.resolution)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const setExporting = useProjectStore((s) => s.setExporting)

  const [formats, setFormats] = useState<ExportFormats>({
    pptx: true,
    pdf: false,
    images: false,
    txt: false
  })
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  if (!open) return null

  const slides = project.slides
  const anyFormat = Object.values(formats).some(Boolean)
  const canExport = anyFormat && slides.length > 0 && status !== 'working'

  const toggle = (key: keyof ExportFormats): void =>
    setFormats((f) => ({ ...f, [key]: !f[key] }))

  const runExport = async (): Promise<void> => {
    setStatus('working')
    setExporting(true)
    setMessage('Rendering slides…')
    try {
      const files: ExportFile[] = []
      const aspect = resolution.width / resolution.height
      if (formats.pptx) {
        setMessage('Building PowerPoint…')
        files.push(...(await exportSlidesToPptx(slides, project.name, aspect)))
      }
      if (formats.pdf) {
        setMessage('Building PDF…')
        files.push(...(await exportSlidesToPdf(slides, project.name, resolution)))
      }
      if (formats.images) {
        setMessage('Rendering images…')
        files.push(...(await exportSlidesToImages(slides, resolution)))
      }
      if (formats.txt) {
        files.push(...exportSlidesToTxt(slides, project.name))
      }

      setMessage('Packaging ZIP…')
      await exportToZip(files, project.name)

      setStatus('done')
      setMessage(`Downloaded ${project.name}.zip with ${files.length} file${files.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  const reset = (): void => {
    setStatus('idle')
    setMessage('')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-forge-600 bg-forge-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-forge-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Export Presentation</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            ✕
          </button>
        </div>

        <div className="forge-scroll max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Project name */}
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Project name</label>
            <input
              className="w-full rounded border border-forge-600 bg-forge-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-forge-accent"
              value={project.name}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          {/* Formats */}
          <div>
            <label className="mb-2 block text-xs text-zinc-400">Formats to export</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_LABELS.map(({ key, label, hint }) => (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={[
                    'rounded border px-3 py-2 text-left transition-colors',
                    formats[key]
                      ? 'border-forge-accent bg-forge-700'
                      : 'border-forge-700 bg-forge-800 hover:border-forge-500'
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-100">{label}</span>
                    <span
                      className={[
                        'flex h-4 w-4 items-center justify-center rounded-sm border text-[10px]',
                        formats[key]
                          ? 'border-forge-accent bg-forge-accent text-white'
                          : 'border-forge-500'
                      ].join(' ')}
                    >
                      {formats[key] ? '✓' : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">{hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Download note */}
          <div className="rounded border border-forge-700 bg-forge-800/40 px-3 py-2 text-[11px] text-zinc-400">
            Exports will be downloaded as <span className="font-mono text-zinc-300">{project.name || 'export'}.zip</span> containing a sub-folder for each selected format.
          </div>

          {/* Status */}
          {status !== 'idle' && (
            <div
              className={[
                'rounded-lg border px-4 py-3 text-sm',
                status === 'error'
                  ? 'border-red-900 bg-red-950/40 text-red-300'
                  : status === 'done'
                    ? 'border-green-900 bg-green-950/30 text-green-300'
                    : 'border-forge-600 bg-forge-800 text-zinc-300'
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                {status === 'working' && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                )}
                <span>{message}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-forge-700 px-6 py-4">
          <span className="text-xs text-zinc-600">
            {slides.length} slide{slides.length === 1 ? '' : 's'} ready
          </span>
          <div className="flex gap-2">
            {status === 'done' ? (
              <button
                onClick={reset}
                className="rounded bg-forge-700 px-4 py-2 text-sm text-zinc-100 hover:bg-forge-600"
              >
                Export again
              </button>
            ) : (
              <button
                onClick={runExport}
                disabled={!canExport}
                className="rounded bg-forge-accent px-5 py-2 text-sm font-medium text-white hover:bg-forge-accentHover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === 'working' ? 'Exporting…' : 'Export & Download'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
