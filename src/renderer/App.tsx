import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from './store/projectStore'
import ImportDropzone from './components/ImportDropzone'
import ImportDialog, { type ImportOptions } from './components/ImportDialog'
import SlideThumbnailList from './components/SlideThumbnailList'
import SlidePreview from './components/SlidePreview'
import SettingsPanel from './components/SettingsPanel'
import ExportDialog from './components/ExportDialog'
import ProPresenterHelp from './components/ProPresenterHelp'
import HelpPage from './components/HelpPage'
import BoundaryEditor from './components/BoundaryEditor'
import ProjectSettings from './components/ProjectSettings'
import PresentMode from './components/PresentMode'
import { buildSlidesFromText } from './lib/textImport'
import { buildSlidesFromPdfImages, fileToBytes, pdfToText } from './lib/pdfImport'
import { docxToText } from './lib/docxImport'
import { serializeProject, parseProjectFile, defaultFileName } from './lib/projectFile'
import { openImportFile, openProjectFile, saveProjectFile } from './lib/platform'

/** A document staged for import. */
type PendingImport = {
  fileName: string
  ext: string
  getBytes: () => Promise<Uint8Array>
}

export default function App(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const slides = project.slides
  const selectedId = useProjectStore((s) => s.selectedSlideId)
  const sourceText = useProjectStore((s) => s.sourceText)
  const resolution = useProjectStore((s) => s.resolution)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const resetProject = useProjectStore((s) => s.resetProject)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s._past.length > 0)
  const canRedo = useProjectStore((s) => s._future.length > 0)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const dirty = useProjectStore((s) => s.dirty)

  const [pending, setPending] = useState<PendingImport | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showBoundaries, setShowBoundaries] = useState(false)
  const [showProject, setShowProject] = useState(false)
  const [showPresent, setShowPresent] = useState(false)

  const fileLabel = currentFilePath ?? 'Untitled'

  const selectedSlide = useMemo(() => slides.find((s) => s.id === selectedId) ?? null, [slides, selectedId])
  const selectedIndex = useMemo(() => slides.findIndex((s) => s.id === selectedId), [slides, selectedId])

  // ---- Global keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      const mod = e.metaKey || e.ctrlKey
      const store = useProjectStore.getState()
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!typing) { e.preventDefault(); store.undo() }
      } else if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        if (!typing) { e.preventDefault(); store.redo() }
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault(); void saveProject()
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault(); void openProject()
      } else if (mod && e.key.toLowerCase() === 'a' && slides.length) {
        if (!typing) { e.preventDefault(); store.selectAll() }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedSlideIds.length) {
        if (!typing) { e.preventDefault(); store.deleteSlides(store.selectedSlideIds) }
      } else if (e.key === 'Escape') {
        store.clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length])

  /** Run the actual import once the user confirms options in the dialog. */
  const runImport = async (options: ImportOptions): Promise<void> => {
    if (!pending) return
    const { fileName, ext, getBytes } = pending
    setPending(null)
    const store = useProjectStore.getState()
    store.setImporting(true)
    store.setImportError(null)
    try {
      const bytes = await getBytes()
      if (ext === 'pdf' && options.pdfMode === 'image') {
        const built = await buildSlidesFromPdfImages(bytes)
        store.loadSlides(built, fileName, 'pdfImage', '')
        return
      }
      let text: string
      if (ext === 'pdf') text = await pdfToText(bytes)
      else if (ext === 'docx') text = await docxToText(bytes)
      else text = new TextDecoder('utf-8').decode(bytes)

      const built = buildSlidesFromText(text, options.preset, options.splitMode, {
        maxLines: options.maxLines,
        maxChars: options.maxChars
      })
      store.loadSlides(built, fileName, options.preset, text)
      if (options.editBoundaries && text.trim() !== '') setShowBoundaries(true)
    } catch (err) {
      store.setImportError(err instanceof Error ? err.message : 'Failed to import document.')
      store.setImporting(false)
    }
  }

  const stageFile = async (file: File): Promise<void> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    setPending({ fileName: file.name, ext, getBytes: () => fileToBytes(file) })
  }

  const stageFromDialog = async (): Promise<void> => {
    const res = await openImportFile()
    if (!res) return
    setPending({ fileName: res.fileName, ext: res.ext, getBytes: async () => res.bytes })
  }

  const newProject = (): void => {
    const d = useProjectStore.getState().dirty
    if (!d || window.confirm('Start a new project? Unsaved changes will be lost.')) {
      resetProject()
    }
  }

  /** Download the current project as a .slideforge file. */
  const saveProject = (): void => {
    const st = useProjectStore.getState()
    const content = serializeProject({ project: st.project, sourceText: st.sourceText, resolution: st.resolution })
    const fileName = defaultFileName(st.project.name)
    saveProjectFile(content, fileName)
    st.markSaved(fileName)
  }

  const loadFromContent = (content: string, fileName: string): void => {
    try {
      const data = parseProjectFile(content)
      useProjectStore.getState().loadProjectData(data, fileName)
    } catch (err) {
      window.alert(`Could not open project: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const openProject = async (): Promise<void> => {
    if (useProjectStore.getState().dirty && !window.confirm('Open another project? Unsaved changes will be lost.')) {
      return
    }
    const res = await openProjectFile()
    if (!res) return
    loadFromContent(res.content, res.fileName)
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-forge-black text-zinc-200">
      {/* ---------------- Top bar ---------------- */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-forge-700 bg-forge-900 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-forge-accent text-sm font-bold text-white">S</div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            SlideForge <span className="text-zinc-500">for ProPresenter</span>
          </span>
        </div>

        <div className="ml-4 flex items-center gap-2">
          <span className="text-xs text-zinc-500">Project</span>
          <input
            value={project.name}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-48 rounded border border-forge-600 bg-forge-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-forge-accent"
          />
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
            <span className="max-w-[140px] truncate">{fileLabel}{dirty ? ' •' : ''}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="mr-1 flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              className="flex h-8 w-8 items-center justify-center rounded text-zinc-300 hover:bg-forge-700 disabled:opacity-30"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              className="flex h-8 w-8 items-center justify-center rounded text-zinc-300 hover:bg-forge-700 disabled:opacity-30"
            >
              ↷
            </button>
          </div>
          <button
            onClick={() => setShowProject(true)}
            title="Project canvas & resolution"
            className="rounded border border-forge-600 px-2 py-1.5 text-xs text-zinc-300 hover:border-forge-accent hover:text-forge-accent"
          >
            {resolution.width}×{resolution.height}
          </button>
          <button onClick={() => setShowGuide(true)} title="How to use SlideForge" className="flex h-8 w-8 items-center justify-center rounded-full border border-forge-600 text-sm text-zinc-300 hover:border-forge-accent hover:text-forge-accent">
            ?
          </button>
          <button onClick={newProject} title="New project" className="rounded bg-forge-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-forge-600">
            New
          </button>
          <button onClick={openProject} title="Open project" className="rounded bg-forge-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-forge-600">
            Open
          </button>
          <button onClick={saveProject} title="Save project (⌘S)" className="rounded bg-forge-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-forge-600">
            Save
          </button>
          <button onClick={stageFromDialog} title="Import document" className="rounded bg-forge-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-forge-600">
            Import
          </button>
          <button onClick={() => setShowPresent(true)} disabled={slides.length === 0} title="Present (F5)" className="rounded bg-forge-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-forge-600 disabled:opacity-40">
            Present
          </button>
          <button onClick={() => setShowExport(true)} disabled={slides.length === 0} className="rounded bg-forge-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-forge-accentHover disabled:cursor-not-allowed disabled:opacity-40">
            Export
          </button>
        </div>
      </header>

      {/* ---------------- Main 3-panel layout ---------------- */}
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 border-r border-forge-700 bg-forge-900">
          <SlideThumbnailList />
        </aside>

        <main className="min-w-0 flex-1 bg-forge-black">
          {slides.length === 0 ? (
            <ImportDropzone onFile={stageFile} />
          ) : (
            <SlidePreview slide={selectedSlide} index={selectedIndex} total={slides.length} />
          )}
        </main>

        <aside className="w-80 shrink-0 border-l border-forge-700 bg-forge-900">
          <SettingsPanel />
        </aside>
      </div>

      {/* ---------------- Bottom bar ---------------- */}
      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-forge-700 bg-forge-900 px-4 text-xs text-zinc-500">
        <span>
          {project.sourceFileName ? (
            <>
              Source: <span className="text-zinc-400">{project.sourceFileName}</span>
            </>
          ) : (
            'No document imported'
          )}
        </span>
        <div className="flex items-center gap-4">
          {sourceText.trim() !== '' && (
            <button onClick={() => setShowBoundaries(true)} className="text-zinc-400 underline-offset-2 hover:text-forge-accent hover:underline">
              Edit slide boundaries
            </button>
          )}
          <button onClick={() => setShowGuide(true)} className="text-zinc-400 underline-offset-2 hover:text-forge-accent hover:underline">
            How to use SlideForge
          </button>
          <button onClick={() => setShowHelp(true)} className="text-zinc-400 underline-offset-2 hover:text-forge-accent hover:underline">
            Import into ProPresenter →
          </button>
        </div>
      </footer>

      {/* ---------------- Modals ---------------- */}
      <ImportDialog fileName={pending?.fileName ?? null} onCancel={() => setPending(null)} onConfirm={runImport} />
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <ProPresenterHelp open={showHelp} onClose={() => setShowHelp(false)} />
      <HelpPage open={showGuide} onClose={() => setShowGuide(false)} />
      <BoundaryEditor open={showBoundaries} onClose={() => setShowBoundaries(false)} />
      <ProjectSettings open={showProject} onClose={() => setShowProject(false)} />
      <PresentMode
        open={showPresent}
        startIndex={selectedIndex >= 0 ? selectedIndex : 0}
        onClose={() => setShowPresent(false)}
      />
    </div>
  )
}
