// Core domain types for SlideForge. These are intentionally exact to the spec so that
// every module (splitter, templates, exporters, store) speaks the same language.

export type LayoutType =
  | 'fullscreen'
  | 'lyricsBox'
  | 'scripture'
  | 'announcement'
  | 'pdfImage'

export type TextAlign = 'left' | 'center' | 'right'

export type Slide = {
  id: string
  title: string
  body: string
  notes: string
  layoutType: LayoutType
  backgroundColor: string
  textColor: string
  fontSize: number
  textAlign: TextAlign
  boxEnabled: boolean
  boxColor: string
  boxOpacity: number
  imageData?: string // base64 data URL for PDF image mode
  position: number
  // --- Optional style extensions (added after the original spec; all optional so existing
  //     slides remain valid). ---
  /** Body font family. Falls back to the default sans when unset. */
  fontFamily?: string
  /** Title/reference font family. Falls back to `fontFamily`, then the default. */
  titleFontFamily?: string
  /** Explicit title font size (px). When unset, derives from the layout's title scale. */
  titleFontSize?: number
  /** Draw a separate box behind each line instead of one box behind the whole block. */
  boxPerLine?: boolean
  /** Line spacing multiplier (e.g. 1.25). Falls back to the default when unset. */
  lineSpacing?: number
  /** Base64 data URL of a background image drawn behind the text. */
  backgroundImage?: string
  /** How the background image fills the slide. Defaults to 'cover'. */
  backgroundFit?: 'cover' | 'contain'
  /** Black overlay opacity over the background image (0–1) to darken it for legibility. */
  backgroundDim?: number
  /** Place the title/reference above or below the body. Defaults to 'above'. */
  titlePosition?: 'above' | 'below'
  /** Title/reference alignment, independent of the body. Falls back to the layout default. */
  titleAlign?: TextAlign
}

export type PresentationProject = {
  id: string
  name: string
  sourceFileName: string
  slides: Slide[]
  selectedPreset: LayoutType
  createdAt: string
  updatedAt: string
}

// What the export dialog collects from the user.
export type ExportFormats = {
  pptx: boolean
  pdf: boolean
  images: boolean
  txt: boolean
}

export type ExportRequest = {
  projectName: string
  outputDir: string
  formats: ExportFormats
}

// A single file the renderer asks the main process to write to disk. Binary payloads
// are passed as base64 so they can cross the IPC contextBridge boundary safely.
export type ExportFile = {
  /** Sub-folder under the project root, e.g. "pptx" | "pdf" | "images" | "txt". */
  folder: string
  /** File name including extension, e.g. "presentation.pptx". */
  fileName: string
  /** Raw text content (for txt). Mutually exclusive with base64. */
  text?: string
  /** Base64-encoded binary content (for pptx/pdf/images). */
  base64?: string
}

export type WriteExportPayload = {
  outputDir: string
  projectName: string
  files: ExportFile[]
}

export type WriteExportResult = {
  success: boolean
  rootPath: string
  written: string[]
  error?: string
}

// On-disk project file (.slideforge) — a JSON snapshot that round-trips a whole project.
export type ProjectFile = {
  version: number
  project: PresentationProject
  sourceText: string
  resolution: { width: number; height: number }
}
