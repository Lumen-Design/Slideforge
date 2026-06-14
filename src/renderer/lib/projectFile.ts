import type { PresentationProject, ProjectFile } from '../types/presentation'

export const PROJECT_FILE_VERSION = 1
export const PROJECT_EXTENSION = 'slideforge'

type SerializeInput = {
  project: PresentationProject
  sourceText: string
  docxImages: string[]
  resolution: { width: number; height: number }
}

/** Serialize the current project state into a pretty-printed .slideforge JSON string. */
export function serializeProject(input: SerializeInput): string {
  const file: ProjectFile = {
    version: PROJECT_FILE_VERSION,
    project: input.project,
    sourceText: input.sourceText,
    docxImages: input.docxImages,
    resolution: input.resolution
  }
  return JSON.stringify(file, null, 2)
}

/** Parse + validate a .slideforge file. Throws a friendly error on malformed input. */
export function parseProjectFile(json: string): ProjectFile {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unrecognized project file.')
  }
  const obj = data as Partial<ProjectFile>
  if (!obj.project || !Array.isArray(obj.project.slides)) {
    throw new Error('This file does not contain a SlideForge project.')
  }
  return {
    version: typeof obj.version === 'number' ? obj.version : PROJECT_FILE_VERSION,
    project: obj.project,
    sourceText: typeof obj.sourceText === 'string' ? obj.sourceText : '',
    docxImages: Array.isArray((obj as Partial<ProjectFile>).docxImages) ? (obj as Partial<ProjectFile>).docxImages! : [],
    resolution:
      obj.resolution && typeof obj.resolution.width === 'number' && typeof obj.resolution.height === 'number'
        ? obj.resolution
        : { width: 1920, height: 1080 }
  }
}

/** Derive a default file name from the project name. */
export function defaultFileName(projectName: string): string {
  const safe = projectName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()
  return `${safe || 'Untitled Project'}.${PROJECT_EXTENSION}`
}
