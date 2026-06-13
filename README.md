# SlideForge for ProPresenter

A polished desktop app (Electron + React + TypeScript) that turns **TXT** and **PDF**
documents into presentation slides ready for **ProPresenter**, with live preview and
multi-format export.

Built by **Lumen Design**.

## Features

**Phase 1**
- Drag-and-drop (or browse) import of TXT and PDF files
- Plain-text extraction
- Auto slide splitter — max 8 lines/slide, max 42 chars/line, preserves paragraph
  breaks, detects headings (short lines, ALL CAPS, or trailing colon)
- Live 16:9 slide preview that exactly matches the export
- Per-slide text editing
- `.pptx` export via pptxgenjs

**Phase 2**
- PDF text extraction and full-page **image mode** (pdfjs-dist canvas rendering)
- 5 layout presets: Full Screen Text · Lyrics With Black Box · Scripture ·
  Announcements · PDF Page Image
- Drag-to-reorder slides, plus split / merge / duplicate
- Style controls: layout, font size, colors, alignment, translucent text box
- Export dialog → any mix of `.pptx`, `.pdf`, JPG image folder, `.txt`, organized as
  `ProjectName/{pptx,pdf,images,txt}/`

## Architecture

- **Electron main** (`src/main/main.ts`) owns all file-system access. The renderer never
  touches Node directly — every privileged action goes through a typed `contextBridge`
  API exposed in `src/main/preload.ts` (`window.api`).
- **One render engine** (`src/renderer/lib/imageExport.ts` + `templates.ts`) drives the
  preview, the JPG export, and the PDF export, so what you see is what you get. The PPTX
  export maps the same layout geometry to native, editable PowerPoint objects.

## Develop

```bash
npm install
npm run dev        # launch with hot reload
npm run build      # production build into out/
npm start          # preview the production build
npm run typecheck  # strict TS check (main + renderer)
```

## Importing into ProPresenter

`File → Import →` **PowerPoint as Presentation** (editable) or **PowerPoint as Images**
(pixel-perfect). Or drag the exported JPGs straight onto a playlist.
