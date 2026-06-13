import { contextBridge, ipcRenderer } from 'electron'
import type { WriteExportPayload } from '../renderer/types/presentation'

// Expose a minimal, typed, promise-based API to the renderer. The renderer can never
// reach Node or Electron internals directly — every privileged action funnels through
// these explicitly whitelisted IPC channels.
const api = {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  chooseDirectory: () => ipcRenderer.invoke('dialog:chooseDirectory'),
  writeExport: (payload: WriteExportPayload) => ipcRenderer.invoke('export:write', payload),
  openPath: (targetPath: string) => ipcRenderer.invoke('shell:openPath', targetPath),
  // --- project files ---
  showSaveDialog: (defaultName: string) => ipcRenderer.invoke('project:showSaveDialog', defaultName),
  writeTextFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:writeTextFile', { filePath, content }),
  openProject: () => ipcRenderer.invoke('project:open'),
  readTextFile: (filePath: string) => ipcRenderer.invoke('fs:readTextFile', filePath),
  // --- image picker (for slide backgrounds) ---
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  // --- native menu → renderer actions ---
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_e: unknown, action: string): void => callback(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
