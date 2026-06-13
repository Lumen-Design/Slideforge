// Dev-only branding helper.
//
// When running `electron-vite dev`, Electron launches the stock `Electron.app` bundle, so
// the macOS menu-bar app name and Dock tile read "Electron" no matter what `app.setName`
// says. This script patches the *local* Electron.app (in node_modules) so the dev app
// presents as "SlideForge" with the project icon. It's idempotent and safe to re-run; it
// no-ops on non-macOS. Packaged builds get their name/icon from electron-builder instead.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const APP_NAME = 'SlideForge'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

if (process.platform !== 'darwin') {
  process.exit(0)
}

const appBundle = join(root, 'node_modules', 'electron', 'dist', 'Electron.app')
const plist = join(appBundle, 'Contents', 'Info.plist')
const icnsTarget = join(appBundle, 'Contents', 'Resources', 'electron.icns')
const icnsSource = join(root, 'build', 'icon.icns')

if (!existsSync(plist)) {
  console.log('[brand-dev] Electron.app not found yet; skipping.')
  process.exit(0)
}

const plistBuddy = '/usr/libexec/PlistBuddy'

function setKey(key, value) {
  try {
    execFileSync(plistBuddy, ['-c', `Set :${key} ${value}`, plist])
  } catch {
    // Key may not exist yet — add it.
    try {
      execFileSync(plistBuddy, ['-c', `Add :${key} string ${value}`, plist])
    } catch (err) {
      console.log(`[brand-dev] could not set ${key}:`, err.message)
    }
  }
}

setKey('CFBundleName', APP_NAME)
setKey('CFBundleDisplayName', APP_NAME)

if (existsSync(icnsSource)) {
  try {
    copyFileSync(icnsSource, icnsTarget)
  } catch (err) {
    console.log('[brand-dev] could not copy icon:', err.message)
  }
}

// Re-register the bundle so LaunchServices (and the Dock) pick up the new name/icon
// instead of a stale "Electron" cache.
const lsregister =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
if (existsSync(lsregister)) {
  try {
    execFileSync(lsregister, ['-f', appBundle])
  } catch (err) {
    console.log('[brand-dev] lsregister failed:', err.message)
  }
}

console.log(`[brand-dev] Electron.app branded as ${APP_NAME}.`)
