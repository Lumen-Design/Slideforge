import JSZip from 'jszip'
import type { ExportFile } from '../types/presentation'

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    let settled = false
    const settle = (v: File | null): void => {
      if (!settled) { settled = true; resolve(v) }
    }
    input.addEventListener('change', () => settle(input.files?.[0] ?? null))
    // Detect dialog dismissal — browsers fire window 'focus' after the picker closes
    window.addEventListener('focus', () => setTimeout(() => settle(null), 300), { once: true })
    input.click()
  })
}

export async function openImportFile(): Promise<{ fileName: string; ext: string; bytes: Uint8Array } | null> {
  const file = await pickFile('.txt,.pdf,.docx')
  if (!file) return null
  const bytes = new Uint8Array(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return { fileName: file.name, ext, bytes }
}

export async function openProjectFile(): Promise<{ content: string; fileName: string } | null> {
  const file = await pickFile('.slideforge')
  if (!file) return null
  return { content: await file.text(), fileName: file.name }
}

export async function openImageFile(): Promise<string | null> {
  const file = await pickFile('image/png,image/jpeg,image/gif,image/webp')
  if (!file) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export function saveProjectFile(content: string, fileName: string): void {
  downloadBlob(new Blob([content], { type: 'application/json' }), fileName)
}

export async function exportToZip(files: ExportFile[], projectName: string): Promise<void> {
  const zip = new JSZip()
  const root = zip.folder(sanitize(projectName))!
  for (const f of files) {
    const folder = root.folder(f.folder)!
    if (f.base64 != null) {
      folder.file(f.fileName, f.base64, { base64: true })
    } else if (f.text != null) {
      folder.file(f.fileName, f.text)
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${sanitize(projectName)}.zip`)
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'export'
}
