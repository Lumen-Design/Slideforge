import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutType, PresentationProject, ProjectFile, Slide } from '../types/presentation'
import { applyPreset, makeSlide, uid } from '../lib/templates'
import {
  applyStyle,
  deleteTemplate as deleteTemplateRecord,
  loadTemplates,
  persistTemplates,
  templateFromSlide,
  type StyleTemplate
} from '../lib/styleTemplates'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString()
}

/** Re-number slide positions to match array order (call after any structural change). */
function reindex(slides: Slide[]): Slide[] {
  return slides.map((s, i) => (s.position === i ? s : { ...s, position: i }))
}

function emptyProject(name = 'Untitled Project'): PresentationProject {
  const ts = nowIso()
  return {
    id: uid(),
    name,
    sourceFileName: '',
    slides: [],
    selectedPreset: 'fullscreen',
    createdAt: ts,
    updatedAt: ts
  }
}

/** Combine several slides' content into one title + body (titles fold inline as needed). */
function combineSlides(slides: Slide[]): { title: string; body: string } {
  const title = slides.map((s) => s.title.trim()).find((t) => t.length > 0) ?? ''
  const parts: string[] = []
  slides.forEach((s) => {
    if (s.title.trim() && s.title.trim() !== title) parts.push(s.title.trim())
    if (s.body.trim()) parts.push(s.body.trim())
  })
  return { title, body: parts.join('\n') }
}

/** Split one slide's body into two halves; returns [first, second] (second has no title). */
function splitOne(slide: Slide): [Slide] | [Slide, Slide] {
  const lines = slide.body.split('\n')
  if (lines.length < 2) return [slide]
  const mid = Math.ceil(lines.length / 2)
  const first: Slide = { ...slide, body: lines.slice(0, mid).join('\n') }
  const second: Slide = { ...slide, id: uid(), title: '', body: lines.slice(mid).join('\n') }
  return [first, second]
}

// ---------------------------------------------------------------------------
// Undo / redo history
// ---------------------------------------------------------------------------

// A restorable snapshot of everything the user would expect undo to bring back.
type Snapshot = {
  project: PresentationProject
  selectedSlideId: string | null
  selectedSlideIds: string[]
  sourceText: string
}

// Edits sharing a tag within this window collapse into one undo step (so holding a key
// or dragging a slider doesn't create a hundred history entries).
const COALESCE_MS = 700
const HISTORY_LIMIT = 100

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

type ProjectState = {
  project: PresentationProject
  selectedSlideId: string | null // the "active" slide shown in the editor/preview
  selectedSlideIds: string[] // full multi-selection (always includes the active slide)
  sourceText: string // raw imported text, retained for the boundary editor
  templates: StyleTemplate[]
  resolution: { width: number; height: number } // output canvas size (e.g. LED wall)
  currentFilePath: string | null // path of the saved .slideforge file (null if unsaved)
  dirty: boolean // unsaved changes since last save/open/new
  isImporting: boolean
  importError: string | null
  isExporting: boolean

  // history (underscore-prefixed = internal)
  _past: Snapshot[]
  _future: Snapshot[]
  _lastTag: string | null
  _lastTs: number
  pushSnapshot: (tag: string) => void
  undo: () => void
  redo: () => void

  selectedSlide: () => Slide | null

  // lifecycle
  resetProject: () => void
  clearAllSlides: () => void
  setProjectName: (name: string) => void
  setImporting: (v: boolean) => void
  setImportError: (msg: string | null) => void
  setExporting: (v: boolean) => void

  // import
  loadSlides: (
    slides: Slide[],
    sourceFileName: string,
    preset: LayoutType,
    sourceText?: string
  ) => void
  replaceSlides: (slides: Slide[]) => void
  setSourceText: (text: string) => void
  setResolution: (width: number, height: number) => void

  // project file persistence
  loadProjectData: (data: ProjectFile, filePath: string | null) => void
  markSaved: (filePath: string) => void
  setCurrentFilePath: (filePath: string | null) => void

  // selection
  selectSlide: (id: string | null) => void
  toggleSlideInSelection: (id: string) => void
  selectRangeTo: (id: string) => void
  selectAll: () => void
  clearSelection: () => void

  // editing
  updateSlide: (id: string, patch: Partial<Slide>) => void
  updateSelectedSlide: (patch: Partial<Slide>) => void
  applyPresetToAll: (preset: LayoutType) => void

  // notes
  pullNextIntoNotes: (id: string) => void
  autoFillNotesFromNext: () => void
  clearAllNotes: () => void

  // structural (single)
  addSlide: () => void
  deleteSlide: (id: string) => void
  duplicateSlide: (id: string) => void
  reorderSlides: (fromIndex: number, toIndex: number) => void
  splitSlide: (id: string) => void
  mergeWithNext: (id: string) => void

  // structural (bulk — operate on the current multi-selection)
  deleteSlides: (ids: string[]) => void
  duplicateSlides: (ids: string[]) => void
  splitSlides: (ids: string[]) => void
  /** Merge several slides into one. 'replace' deletes the originals; 'new' keeps them. */
  mergeSlidesInto: (ids: string[], mode: 'replace' | 'new') => void
  /** Turn N slides into N cumulative "build" slides (each adds the next slide's content). */
  buildFromSlides: (ids: string[]) => void
  /** Turn one slide's lines into cumulative "build" slides (each adds the next line). */
  buildFromLines: (id: string) => void

  /** Strip box + background so slides import as clean, themeable text in ProPresenter. */
  makePlainForThemes: (ids: string[]) => void

  // templates
  saveTemplateFromSlide: (name: string, slideId: string) => void
  deleteTemplate: (templateId: string) => void
  applyTemplateToSlides: (templateId: string, ids: string[]) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
  project: emptyProject(),
  selectedSlideId: null,
  selectedSlideIds: [],
  sourceText: '',
  templates: loadTemplates(),
  resolution: { width: 1920, height: 1080 },
  currentFilePath: null,
  dirty: false,
  isImporting: false,
  importError: null,
  isExporting: false,

  _past: [],
  _future: [],
  _lastTag: null,
  _lastTs: 0,

  // Capture the current state onto the undo stack before a mutation runs. Consecutive
  // calls with the same tag inside COALESCE_MS are merged into the first snapshot.
  pushSnapshot: (tag) =>
    set((state) => {
      const now = Date.now()
      if (state._lastTag === tag && now - state._lastTs < COALESCE_MS) {
        return { _lastTs: now, dirty: true }
      }
      const snap: Snapshot = {
        project: state.project,
        selectedSlideId: state.selectedSlideId,
        selectedSlideIds: state.selectedSlideIds,
        sourceText: state.sourceText
      }
      const past = [...state._past, snap].slice(-HISTORY_LIMIT)
      return { _past: past, _future: [], _lastTag: tag, _lastTs: now, dirty: true }
    }),

  undo: () =>
    set((state) => {
      if (state._past.length === 0) return state
      const current: Snapshot = {
        project: state.project,
        selectedSlideId: state.selectedSlideId,
        selectedSlideIds: state.selectedSlideIds,
        sourceText: state.sourceText
      }
      const past = [...state._past]
      const prev = past.pop() as Snapshot
      return {
        ...prev,
        _past: past,
        _future: [current, ...state._future].slice(0, HISTORY_LIMIT),
        _lastTag: null,
        _lastTs: 0
      }
    }),

  redo: () =>
    set((state) => {
      if (state._future.length === 0) return state
      const current: Snapshot = {
        project: state.project,
        selectedSlideId: state.selectedSlideId,
        selectedSlideIds: state.selectedSlideIds,
        sourceText: state.sourceText
      }
      const [next, ...rest] = state._future
      return {
        ...next,
        _past: [...state._past, current].slice(-HISTORY_LIMIT),
        _future: rest,
        _lastTag: null,
        _lastTs: 0
      }
    }),

  selectedSlide: () => {
    const { project, selectedSlideId } = get()
    return project.slides.find((s) => s.id === selectedSlideId) ?? null
  },

  resetProject: () => {
    get().pushSnapshot('reset')
    set({
      project: emptyProject(),
      selectedSlideId: null,
      selectedSlideIds: [],
      sourceText: '',
      currentFilePath: null,
      dirty: false,
      importError: null,
      isImporting: false
    })
  },

  clearAllSlides: () => {
    get().pushSnapshot('clear')
    set((state) => ({
      project: { ...state.project, slides: [], sourceFileName: '', updatedAt: nowIso() },
      selectedSlideId: null,
      selectedSlideIds: [],
      sourceText: ''
    }))
  },

  setProjectName: (name) => {
    get().pushSnapshot('name')
    set((state) => ({ project: { ...state.project, name, updatedAt: nowIso() } }))
  },

  setImporting: (v) => set({ isImporting: v }),
  setImportError: (msg) => set({ importError: msg }),
  setExporting: (v) => set({ isExporting: v }),

  loadSlides: (slides, sourceFileName, preset, sourceText = '') => {
    get().pushSnapshot('import')
    set((state) => {
      const indexed = reindex(slides)
      const firstId = indexed.length > 0 ? indexed[0].id : null
      return {
        project: {
          ...state.project,
          sourceFileName,
          selectedPreset: preset,
          slides: indexed,
          updatedAt: nowIso()
        },
        sourceText,
        selectedSlideId: firstId,
        selectedSlideIds: firstId ? [firstId] : [],
        importError: null,
        isImporting: false
      }
    })
  },

  replaceSlides: (slides) => {
    get().pushSnapshot('boundaries')
    set((state) => {
      const indexed = reindex(slides)
      const firstId = indexed.length > 0 ? indexed[0].id : null
      return {
        project: { ...state.project, slides: indexed, updatedAt: nowIso() },
        selectedSlideId: firstId,
        selectedSlideIds: firstId ? [firstId] : []
      }
    })
  },

  setSourceText: (text) => set({ sourceText: text }),

  setResolution: (width, height) =>
    set({ resolution: { width: Math.round(width), height: Math.round(height) }, dirty: true }),

  // --- project file persistence ---
  loadProjectData: (data, filePath) =>
    set(() => {
      const slides = reindex(data.project.slides)
      const firstId = slides.length > 0 ? slides[0].id : null
      return {
        project: { ...data.project, slides },
        sourceText: data.sourceText,
        resolution: data.resolution,
        selectedSlideId: firstId,
        selectedSlideIds: firstId ? [firstId] : [],
        currentFilePath: filePath,
        dirty: false,
        importError: null,
        isImporting: false,
        _past: [],
        _future: [],
        _lastTag: null,
        _lastTs: 0
      }
    }),

  markSaved: (filePath) => set({ currentFilePath: filePath, dirty: false }),

  setCurrentFilePath: (filePath) => set({ currentFilePath: filePath }),

  // --- selection ---
  selectSlide: (id) => set({ selectedSlideId: id, selectedSlideIds: id ? [id] : [] }),

  toggleSlideInSelection: (id) =>
    set((state) => {
      const exists = state.selectedSlideIds.includes(id)
      if (exists) {
        const remaining = state.selectedSlideIds.filter((x) => x !== id)
        const primary =
          state.selectedSlideId === id ? (remaining[remaining.length - 1] ?? null) : state.selectedSlideId
        return { selectedSlideIds: remaining, selectedSlideId: primary }
      }
      return { selectedSlideIds: [...state.selectedSlideIds, id], selectedSlideId: id }
    }),

  selectRangeTo: (id) =>
    set((state) => {
      const slides = state.project.slides
      const anchorId = state.selectedSlideId ?? (slides[0]?.id ?? null)
      const a = slides.findIndex((s) => s.id === anchorId)
      const b = slides.findIndex((s) => s.id === id)
      if (a === -1 || b === -1) return { selectedSlideIds: [id], selectedSlideId: id }
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      return {
        selectedSlideIds: slides.slice(lo, hi + 1).map((s) => s.id),
        selectedSlideId: id
      }
    }),

  selectAll: () =>
    set((state) => ({
      selectedSlideIds: state.project.slides.map((s) => s.id),
      selectedSlideId: state.project.slides[state.project.slides.length - 1]?.id ?? null
    })),

  clearSelection: () => set({ selectedSlideIds: [], selectedSlideId: null }),

  // --- editing ---
  updateSlide: (id, patch) => {
    // Coalesce rapid edits to the same slide into one undo step.
    get().pushSnapshot(`edit:${id}`)
    set((state) => ({
      project: {
        ...state.project,
        slides: state.project.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        updatedAt: nowIso()
      }
    }))
  },

  updateSelectedSlide: (patch) => {
    const id = get().selectedSlideId
    if (id) get().updateSlide(id, patch)
  },

  applyPresetToAll: (preset) => {
    get().pushSnapshot('preset')
    set((state) => ({
      project: {
        ...state.project,
        selectedPreset: preset,
        slides: state.project.slides.map((s) => applyPreset(s, preset)),
        updatedAt: nowIso()
      }
    }))
  },

  // --- notes ---
  pullNextIntoNotes: (id) => {
    get().pushSnapshot('notes')
    set((state) => {
      const slides = state.project.slides
      const idx = slides.findIndex((s) => s.id === id)
      if (idx === -1 || idx >= slides.length - 1) return state
      const next = slides[idx + 1]
      const noteText = [next.title.trim(), next.body.trim()].filter(Boolean).join('\n')
      return {
        project: {
          ...state.project,
          slides: slides.map((s) => (s.id === id ? { ...s, notes: noteText } : s)),
          updatedAt: nowIso()
        }
      }
    })
  },

  autoFillNotesFromNext: () => {
    get().pushSnapshot('notes-all')
    set((state) => {
      const slides = state.project.slides
      return {
        project: {
          ...state.project,
          slides: slides.map((s, i) => {
            const next = slides[i + 1]
            const noteText = next ? [next.title.trim(), next.body.trim()].filter(Boolean).join('\n') : ''
            return { ...s, notes: noteText }
          }),
          updatedAt: nowIso()
        }
      }
    })
  },

  clearAllNotes: () => {
    get().pushSnapshot('notes-clear')
    set((state) => ({
      project: {
        ...state.project,
        slides: state.project.slides.map((s) => (s.notes ? { ...s, notes: '' } : s)),
        updatedAt: nowIso()
      }
    }))
  },

  // --- structural (single) ---
  addSlide: () => {
    get().pushSnapshot('add')
    set((state) => {
      const preset = state.project.selectedPreset
      const slide = makeSlide(preset, state.project.slides.length, { body: '' })
      const slides = reindex([...state.project.slides, slide])
      return {
        project: { ...state.project, slides, updatedAt: nowIso() },
        selectedSlideId: slide.id,
        selectedSlideIds: [slide.id]
      }
    })
  },

  deleteSlide: (id) => get().deleteSlides([id]),

  duplicateSlide: (id) => get().duplicateSlides([id]),

  reorderSlides: (fromIndex, toIndex) => {
    get().pushSnapshot('reorder')
    set((state) => {
      const slides = [...state.project.slides]
      if (
        fromIndex < 0 ||
        fromIndex >= slides.length ||
        toIndex < 0 ||
        toIndex >= slides.length ||
        fromIndex === toIndex
      ) {
        return state
      }
      const [moved] = slides.splice(fromIndex, 1)
      slides.splice(toIndex, 0, moved)
      return { project: { ...state.project, slides: reindex(slides), updatedAt: nowIso() } }
    })
  },

  splitSlide: (id) => get().splitSlides([id]),

  mergeWithNext: (id) => {
    get().pushSnapshot('merge')
    set((state) => {
      const idx = state.project.slides.findIndex((s) => s.id === id)
      if (idx === -1 || idx >= state.project.slides.length - 1) return state
      const a = state.project.slides[idx]
      const b = state.project.slides[idx + 1]
      const mergedTitle = a.title.trim() || b.title.trim()
      const parts = [
        a.body.trim(),
        b.title.trim() && b.title !== mergedTitle ? b.title.trim() : '',
        b.body.trim()
      ]
      const mergedBody = parts.filter((p) => p.length > 0).join('\n')
      const merged: Slide = { ...a, title: mergedTitle, body: mergedBody }
      const next = [...state.project.slides]
      next.splice(idx, 2, merged)
      return {
        project: { ...state.project, slides: reindex(next), updatedAt: nowIso() },
        selectedSlideId: merged.id,
        selectedSlideIds: [merged.id]
      }
    })
  },

  // --- structural (bulk) ---
  deleteSlides: (ids) => {
    if (ids.length) get().pushSnapshot('delete')
    set((state) => {
      const idSet = new Set(ids)
      if (idSet.size === 0) return state
      const firstIdx = state.project.slides.findIndex((s) => idSet.has(s.id))
      const slides = reindex(state.project.slides.filter((s) => !idSet.has(s.id)))
      const nextSelected =
        slides.length > 0 ? slides[Math.min(Math.max(firstIdx, 0), slides.length - 1)].id : null
      return {
        project: { ...state.project, slides, updatedAt: nowIso() },
        selectedSlideId: nextSelected,
        selectedSlideIds: nextSelected ? [nextSelected] : []
      }
    })
  },

  duplicateSlides: (ids) => {
    if (ids.length) get().pushSnapshot('duplicate')
    set((state) => {
      const idSet = new Set(ids)
      if (idSet.size === 0) return state
      const newIds: string[] = []
      const next: Slide[] = []
      for (const s of state.project.slides) {
        next.push(s)
        if (idSet.has(s.id)) {
          const copy: Slide = { ...s, id: uid() }
          next.push(copy)
          newIds.push(copy.id)
        }
      }
      return {
        project: { ...state.project, slides: reindex(next), updatedAt: nowIso() },
        selectedSlideIds: newIds,
        selectedSlideId: newIds[newIds.length - 1] ?? state.selectedSlideId
      }
    })
  },

  splitSlides: (ids) => {
    if (ids.length) get().pushSnapshot('split')
    set((state) => {
      const idSet = new Set(ids)
      if (idSet.size === 0) return state
      const resultIds: string[] = []
      const next: Slide[] = []
      for (const s of state.project.slides) {
        if (idSet.has(s.id)) {
          const pieces = splitOne(s)
          pieces.forEach((p) => {
            next.push(p)
            resultIds.push(p.id)
          })
        } else {
          next.push(s)
        }
      }
      return {
        project: { ...state.project, slides: reindex(next), updatedAt: nowIso() },
        selectedSlideIds: resultIds,
        selectedSlideId: resultIds[0] ?? state.selectedSlideId
      }
    })
  },

  mergeSlidesInto: (ids, mode) => {
    if (ids.length < 2) return
    get().pushSnapshot('merge')
    set((state) => {
      const idSet = new Set(ids)
      const ordered = state.project.slides.filter((s) => idSet.has(s.id))
      if (ordered.length < 2) return state
      const { title, body } = combineSlides(ordered)
      const merged: Slide = { ...ordered[0], id: uid(), title, body }
      const firstIdx = state.project.slides.findIndex((s) => s.id === ordered[0].id)

      let next: Slide[]
      if (mode === 'replace') {
        // Drop all selected, insert the merged slide where the first one was.
        next = state.project.slides.filter((s) => !idSet.has(s.id))
        next.splice(Math.max(0, firstIdx), 0, merged)
      } else {
        // Keep originals; place the merged copy after the last selected slide.
        const lastIdx = state.project.slides.reduce((acc, s, i) => (idSet.has(s.id) ? i : acc), 0)
        next = [...state.project.slides]
        next.splice(lastIdx + 1, 0, merged)
      }
      return {
        project: { ...state.project, slides: reindex(next), updatedAt: nowIso() },
        selectedSlideId: merged.id,
        selectedSlideIds: [merged.id]
      }
    })
  },

  buildFromSlides: (ids) => {
    if (ids.length < 1) return
    get().pushSnapshot('build')
    set((state) => {
      const idSet = new Set(ids)
      const ordered = state.project.slides.filter((s) => idSet.has(s.id))
      if (ordered.length < 1) return state
      // Cumulative builds: slide k contains the combined content of ordered[0..k].
      const builds: Slide[] = ordered.map((_, k) => {
        const { title, body } = combineSlides(ordered.slice(0, k + 1))
        return { ...ordered[0], id: uid(), title, body }
      })
      const firstIdx = state.project.slides.findIndex((s) => s.id === ordered[0].id)
      const next = state.project.slides.filter((s) => !idSet.has(s.id))
      next.splice(Math.max(0, firstIdx), 0, ...builds)
      return {
        project: { ...state.project, slides: reindex(next), updatedAt: nowIso() },
        selectedSlideIds: builds.map((b) => b.id),
        selectedSlideId: builds[0].id
      }
    })
  },

  buildFromLines: (id) => {
    get().pushSnapshot('build')
    set((state) => {
      const idx = state.project.slides.findIndex((s) => s.id === id)
      if (idx === -1) return state
      const slide = state.project.slides[idx]
      const lines = slide.body.split('\n').filter((l) => l.trim().length > 0)
      if (lines.length < 2) return state
      const builds: Slide[] = lines.map((_, k) => ({
        ...slide,
        id: uid(),
        body: lines.slice(0, k + 1).join('\n')
      }))
      const next = [...state.project.slides]
      next.splice(idx, 1, ...builds)
      return {
        project: { ...state.project, slides: reindex(next), updatedAt: nowIso() },
        selectedSlideIds: builds.map((b) => b.id),
        selectedSlideId: builds[0].id
      }
    })
  },

  makePlainForThemes: (ids) => {
    if (!ids.length) return
    get().pushSnapshot('plain')
    set((state) => {
      const idSet = new Set(ids)
      return {
        project: {
          ...state.project,
          slides: state.project.slides.map((s) =>
            idSet.has(s.id)
              ? {
                  ...s,
                  backgroundColor: 'transparent',
                  boxEnabled: false,
                  boxPerLine: false,
                  backgroundImage: undefined,
                  backgroundDim: undefined
                }
              : s
          ),
          updatedAt: nowIso()
        }
      }
    })
  },

  // --- templates ---
  saveTemplateFromSlide: (name, slideId) =>
    set((state) => {
      const slide = state.project.slides.find((s) => s.id === slideId)
      if (!slide) return state
      const templates = [...state.templates, templateFromSlide(name, slide)]
      persistTemplates(templates)
      return { templates }
    }),

  deleteTemplate: (templateId) =>
    set((state) => {
      const templates = deleteTemplateRecord(state.templates, templateId)
      persistTemplates(templates)
      return { templates }
    }),

  applyTemplateToSlides: (templateId, ids) => {
    if (ids.length) get().pushSnapshot('template')
    set((state) => {
      const tpl = state.templates.find((t) => t.id === templateId)
      if (!tpl || ids.length === 0) return state
      const idSet = new Set(ids)
      return {
        project: {
          ...state.project,
          slides: state.project.slides.map((s) =>
            idSet.has(s.id) ? applyStyle(s, tpl.style) : s
          ),
          updatedAt: nowIso()
        }
      }
    })
  }
    }),
    {
      name: 'slideforge-project-v1',
      partialize: (state) => ({
        project: state.project,
        sourceText: state.sourceText,
        resolution: state.resolution,
        currentFilePath: state.currentFilePath,
        dirty: state.dirty
      }),
      // Swallow storage errors (e.g. quota exceeded when slides contain large images)
      storage: {
        getItem: (key) => {
          try {
            const v = localStorage.getItem(key)
            return v ? (JSON.parse(v) as ReturnType<typeof JSON.parse>) : null
          } catch {
            return null
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, JSON.stringify(value))
          } catch {
            // quota exceeded or private browsing — skip silently
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key)
          } catch {
            // ignore
          }
        }
      }
    }
  )
)
