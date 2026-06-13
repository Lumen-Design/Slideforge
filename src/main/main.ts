import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeImage } from 'electron'
import { join, dirname } from 'path'
import { promises as fs, existsSync } from 'fs'
import type { WriteExportPayload, WriteExportResult, ExportFile } from '../renderer/types/presentation'

const APP_NAME = 'SlideForge'

// Branding: set the product name as early as possible so menus, the About panel and
// userData paths use "SlideForge" rather than "Electron".
app.setName(APP_NAME)

// ---------------------------------------------------------------------------
// Window lifecycle
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null

/** Resolve a bundled asset path that works in dev and in a packaged build. */
function assetPath(...parts: string[]): string {
  const candidates = [
    join(app.getAppPath(), ...parts),
    join(process.resourcesPath ?? '', ...parts),
    join(__dirname, '..', '..', ...parts)
  ]
  return candidates.find((p) => existsSync(p)) ?? candidates[0]
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0a0b',
    title: 'SlideForge for ProPresenter',
    icon: assetPath('build', 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the user's browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL during `dev`; in production we load
  // the built HTML file from the out/renderer directory.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// IPC handlers — the only bridge between renderer and the file system
// ---------------------------------------------------------------------------

/** Open a native file picker for TXT/PDF and return the chosen file's bytes as base64. */
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import document',
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['txt', 'pdf', 'docx'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Word', extensions: ['docx'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, fileName: '', ext: '', base64: '' }
  }

  const filePath = result.filePaths[0]
  const buffer = await fs.readFile(filePath)
  const fileName = filePath.split(/[\\/]/).pop() ?? 'document'
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()

  return {
    canceled: false,
    fileName,
    ext,
    base64: buffer.toString('base64')
  }
})

/** Open a native directory picker for choosing the export destination. */
ipcMain.handle('dialog:chooseDirectory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose export location',
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, path: null }
  }
  return { canceled: false, path: result.filePaths[0] }
})

/**
 * Write an export bundle to disk. Creates ProjectName/{pptx,pdf,images,txt}/ as needed
 * and writes each file. Binary files arrive base64-encoded; text files arrive as strings.
 */
ipcMain.handle(
  'export:write',
  async (_event, payload: WriteExportPayload): Promise<WriteExportResult> => {
    const written: string[] = []
    try {
      const safeName = sanitizeFolderName(payload.projectName) || 'SlideForge Project'
      const rootPath = join(payload.outputDir, safeName)
      await fs.mkdir(rootPath, { recursive: true })

      for (const file of payload.files) {
        const targetPath = join(rootPath, file.folder, file.fileName)
        await fs.mkdir(dirname(targetPath), { recursive: true })
        await writeExportFile(targetPath, file)
        written.push(targetPath)
      }

      return { success: true, rootPath, written }
    } catch (err) {
      return {
        success: false,
        rootPath: '',
        written,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
)

/** Reveal a file or folder in the OS file manager (Finder/Explorer). */
ipcMain.handle('shell:openPath', async (_event, targetPath: string) => {
  await shell.openPath(targetPath)
})

// --- Project file persistence ---

/** Native "Save As" dialog for a .slideforge project file. */
ipcMain.handle('project:showSaveDialog', async (_event, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Save SlideForge Project',
    defaultPath: defaultName,
    filters: [{ name: 'SlideForge Project', extensions: ['slideforge'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true, path: null }
  return { canceled: false, path: result.filePath }
})

ipcMain.handle('fs:writeTextFile', async (_event, { filePath, content }: { filePath: string; content: string }) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:readTextFile', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (err) {
    return { success: false, content: '', error: err instanceof Error ? err.message : String(err) }
  }
})

/** Native open dialog for a .slideforge project; returns its text content. */
ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open SlideForge Project',
    properties: ['openFile'],
    filters: [{ name: 'SlideForge Project', extensions: ['slideforge'] }]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, path: null, content: '' }
  }
  const filePath = result.filePaths[0]
  const content = await fs.readFile(filePath, 'utf-8')
  return { canceled: false, path: filePath, content }
})

/** Native image picker; returns the chosen image as a base64 data URL. */
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose background image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, dataUrl: '' }
  }
  const filePath = result.filePaths[0]
  const ext = (filePath.split('.').pop() ?? 'png').toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : ext
  const buffer = await fs.readFile(filePath)
  return { canceled: false, dataUrl: `data:image/${mime};base64,${buffer.toString('base64')}` }
})

async function writeExportFile(targetPath: string, file: ExportFile): Promise<void> {
  if (typeof file.base64 === 'string') {
    await fs.writeFile(targetPath, Buffer.from(file.base64, 'base64'))
  } else {
    await fs.writeFile(targetPath, file.text ?? '', 'utf-8')
  }
}

/** Strip characters that are illegal in folder names across macOS/Windows. */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Application menu (gives the macOS menu bar proper SlideForge-branded menus)
// ---------------------------------------------------------------------------

function sendMenuAction(action: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu:action', action)
  if (!BrowserWindow.getFocusedWindow()) mainWindow?.webContents.send('menu:action', action)
}

function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: `About ${APP_NAME}` },
              { type: 'separator' },
              { role: 'hide', label: `Hide ${APP_NAME}` },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: `Quit ${APP_NAME}` }
            ]
          }
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+Shift+N', click: () => sendMenuAction('new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('saveAs') },
        { type: 'separator' },
        { label: 'Import Document…', accelerator: 'CmdOrCtrl+I', click: () => sendMenuAction('import') },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => sendMenuAction('export') },
        ...(isMac ? [] : ([{ type: 'separator' }, { role: 'quit' }] as Electron.MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // Custom so ⌘Z/⌘⇧Z drive the app's own slide-level undo, not DOM undo.
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendMenuAction('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => sendMenuAction('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Present', accelerator: 'F5', click: () => sendMenuAction('present') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ role: 'close' as const }] : [])]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  // Dock icon (macOS) and About panel branding for the running dev/prod process.
  const iconImage = nativeImage.createFromPath(assetPath('build', 'icon.png'))
  if (process.platform === 'darwin' && app.dock && !iconImage.isEmpty()) {
    app.dock.setIcon(iconImage)
  }
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    credits: 'Lumen Design',
    copyright: `© ${new Date().getFullYear()} Lumen Design`
  })

  buildApplicationMenu()
  createWindow()

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked and none are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
