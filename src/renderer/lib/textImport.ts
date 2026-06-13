import type { LayoutType, Slide } from '../types/presentation'
import { makeSlide } from './templates'
import {
  splitByMode,
  DEFAULT_SPLIT_OPTIONS,
  type SplitMode,
  type SplitOptions
} from './slideSplitter'

// ---------------------------------------------------------------------------
// TXT import
// ---------------------------------------------------------------------------

/** Decode a base64 payload (from the native open dialog) into a UTF-8 string. */
export function base64ToText(base64: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

/** Read a dropped File object as plain text (browser File API — no Node required). */
export async function readFileAsText(file: File): Promise<string> {
  return await file.text()
}

/**
 * Turn raw document text into styled Slides using the auto-splitter and the chosen preset.
 */
export function buildSlidesFromText(
  text: string,
  preset: LayoutType,
  mode: SplitMode = 'smart',
  options: SplitOptions = DEFAULT_SPLIT_OPTIONS
): Slide[] {
  const raw = splitByMode(text, mode, options)
  if (raw.length === 0) {
    // Always yield at least one (empty) slide so the editor has something to show.
    return [makeSlide(preset, 0, { body: text.trim() })]
  }
  return raw.map((r, index) => makeSlide(preset, index, { title: r.title, body: r.body }))
}
