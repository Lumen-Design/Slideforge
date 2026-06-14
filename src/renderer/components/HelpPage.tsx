import type { ReactNode } from 'react'

type HelpPageProps = {
  open: boolean
  onClose: () => void
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forge-accent text-xs font-bold text-white">
        {n}
      </span>
      <div>
        <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
        <div className="mt-1 text-sm leading-relaxed text-zinc-400">{children}</div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }): JSX.Element {
  return (
    <section className="border-t border-forge-700 px-7 py-6 first:border-t-0">
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

const kbd = 'rounded bg-forge-700 px-1.5 py-0.5 font-medium text-zinc-200'

/** Full how-to-use guide for SlideForge, shown as a large scrollable modal. */
export default function HelpPage({ open, onClose }: HelpPageProps): JSX.Element | null {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-forge-600 bg-forge-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-forge-700 px-7 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">How to use SlideForge</h2>
            <p className="text-xs text-zinc-500">
              Turn a TXT, PDF or DOCX document into ProPresenter-ready slides in four steps.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-forge-700 hover:text-zinc-200"
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="forge-scroll min-h-0 flex-1 overflow-y-auto">
          {/* Quick start */}
          <Section title="Quick start" subtitle="The whole workflow, top to bottom.">
            <Step n={1} title="Import a document">
              Drag a <span className={kbd}>.txt</span>, <span className={kbd}>.pdf</span> or{' '}
              <span className={kbd}>.docx</span> onto the drop zone in the center, or click{' '}
              <span className={kbd}>Import</span> in the top bar. SlideForge reads the content and
              automatically splits it into slides. DOCX files with embedded images import those
              images as full-slide image slides automatically.
            </Step>
            <Step n={2} title="Pick a layout preset">
              In the right panel, choose one of the five presets. The preset restyles every slide so
              the whole deck looks consistent.
            </Step>
            <Step n={3} title="Edit & arrange">
              Select any slide thumbnail on the left to edit its text and style. Drag thumbnails to
              reorder, and use Split / Merge / Duplicate to fine-tune.
            </Step>
            <Step n={4} title="Export">
              Click <span className={kbd}>Export</span>, choose your formats, then click{' '}
              <span className={kbd}>Download ZIP</span>. SlideForge packages everything into a single
              ZIP file — unzip it and import the <span className="font-mono text-zinc-300">.pptx</span>{' '}
              into ProPresenter.
            </Step>
          </Section>

          {/* Importing */}
          <Section title="Importing documents" subtitle="TXT, PDF and DOCX are supported.">
            <div className="text-sm leading-relaxed text-zinc-400">
              <p>
                On import you choose a <span className="font-medium text-zinc-200">split mode</span>:
                <span className="text-zinc-200"> Smart</span> (headings + 8 lines / 42 chars),
                <span className="text-zinc-200"> Per paragraph</span>,
                <span className="text-zinc-200"> Per line</span>,
                <span className="text-zinc-200"> Per heading</span>, or
                <span className="text-zinc-200"> Per indent</span>.
              </p>
              <p className="mt-2">
                <span className="font-medium text-zinc-200">Set start points by hand:</span> choose{' '}
                <span className={kbd}>Import &amp; set start points</span> (or click{' '}
                <span className={kbd}>Edit slide boundaries</span> in the bottom bar later). Click a
                line to start a new slide above it, click an existing marker to remove it, or drag a
                marker to move it. Embedded DOCX images appear as fixed thumbnails in the editor and
                are always preserved as their own slide.
              </p>
              <p className="mt-2">
                <span className="font-medium text-zinc-200">PDF page images:</span> set{' '}
                <span className={kbd}>PDF mode</span> to <span className={kbd}>Page Images</span> to
                render each PDF page as a full-slide image instead of extracting text.
              </p>
            </div>
          </Section>

          {/* Presets */}
          <Section title="The five layout presets" subtitle="Set per deck from the right panel; override per slide under Style.">
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><span className="font-medium text-zinc-200">Full Screen Text</span> — centered large text on black.</li>
              <li><span className="font-medium text-zinc-200">Lyrics With Black Box</span> — text near the bottom inside a translucent box.</li>
              <li><span className="font-medium text-zinc-200">Scripture</span> — reference at the top, verse body centered below.</li>
              <li><span className="font-medium text-zinc-200">Announcements</span> — large title with smaller supporting body text.</li>
              <li><span className="font-medium text-zinc-200">PDF Page Image</span> — the full PDF page or embedded image as a slide.</li>
            </ul>
          </Section>

          {/* Editing */}
          <Section title="Editing slides" subtitle="Everything lives in the right-hand panel.">
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><span className="font-medium text-zinc-200">Content</span> — edit the title/reference, body, and speaker notes; "Pull next slide into notes" copies the next slide's text.</li>
              <li><span className="font-medium text-zinc-200">Style</span> — layout, font size, alignment, colors, and a <span className="text-zinc-200">Transparent background</span> toggle for keyable text.</li>
              <li><span className="font-medium text-zinc-200">Fonts</span> — separate fonts for body and title, plus an independent title size (or leave it on Auto).</li>
              <li><span className="font-medium text-zinc-200">Text Box</span> — a translucent box behind the text on any layout; "Separate box per line" boxes each line instead of the whole block.</li>
              <li><span className="font-medium text-zinc-200">Slide Actions</span> — Split, Merge with next, Duplicate, Delete, or "Build from lines" (one cumulative slide per line).</li>
              <li><span className="font-medium text-zinc-200">Reorder</span> — drag thumbnails into any order; <span className={kbd}>+ Add</span> inserts a blank slide.</li>
            </ul>
            <p className="text-xs text-zinc-500">
              The center preview is rendered by the same engine as the export, so what you see is
              exactly what you get.
            </p>
          </Section>

          {/* Power features */}
          <Section title="Multi-select, merge & builds" subtitle="Work on many slides at once.">
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><span className="font-medium text-zinc-200">Select</span> — click a thumbnail, <span className={kbd}>⌘/Ctrl-click</span> to toggle, <span className={kbd}>Shift-click</span> for a range, <span className={kbd}>⌘A</span> for all.</li>
              <li><span className="font-medium text-zinc-200">Merge</span> — combine selected slides into one (removes the originals).</li>
              <li><span className="font-medium text-zinc-200">Merge → new</span> — combine into a new slide and keep the originals.</li>
              <li><span className="font-medium text-zinc-200">Build</span> — turn the selected slides into cumulative slides that build on each other.</li>
              <li><span className="font-medium text-zinc-200">Bulk</span> — Duplicate, Split, Delete, or apply a template to the whole selection.</li>
              <li><span className="font-medium text-zinc-200">Undo / redo</span> — <span className={kbd}>⌘Z</span> / <span className={kbd}>⌘⇧Z</span>, or the ↶ ↷ buttons.</li>
            </ul>
          </Section>

          {/* Canvas size & templates */}
          <Section title="Canvas size & templates" subtitle="Match your output and save your looks.">
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><span className="font-medium text-zinc-200">Resolution</span> — the <span className={kbd}>1920×1080</span> button in the top bar sets the output size and aspect ratio (presets or custom, e.g. an LED wall). It drives the preview and every export.</li>
              <li><span className="font-medium text-zinc-200">Background image</span> — under Appearance, add an image behind the text per slide with cover/contain fit and a dim slider for legibility.</li>
              <li><span className="font-medium text-zinc-200">Templates</span> — save a slide's full style (fonts, colors, layout, box) as a reusable template, apply it to your selection, or delete any template. Includes a built-in <span className="text-zinc-200">Transparent Text</span> look.</li>
            </ul>
          </Section>

          {/* Files & presenting */}
          <Section title="Saving & presenting" subtitle="Keep your work and proof it.">
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><span className="font-medium text-zinc-200">Save / Open</span> — projects save as a <span className="font-mono text-zinc-300">.slideforge</span> file (<span className={kbd}>⌘S</span> downloads it; <span className={kbd}>⌘O</span> opens one). The top bar shows the file name and an amber dot for unsaved changes.</li>
              <li><span className="font-medium text-zinc-200">Auto-restore</span> — your work is automatically kept in the browser so a page refresh won't lose it.</li>
              <li><span className="font-medium text-zinc-200">New</span> — the <span className={kbd}>New</span> button starts a fresh project (prompts if you have unsaved changes).</li>
              <li><span className="font-medium text-zinc-200">Present</span> — the <span className={kbd}>Present</span> button opens a full-screen preview; use <span className={kbd}>← →</span> or Space to step, <span className={kbd}>Esc</span> to exit.</li>
            </ul>
          </Section>

          {/* Exporting */}
          <Section title="Exporting" subtitle="One project, any mix of formats.">
            <div className="text-sm leading-relaxed text-zinc-400">
              <p>
                Set a <span className="font-medium text-zinc-200">project name</span> (it becomes the
                ZIP folder name), tick any combination of{' '}
                <span className={kbd}>.pptx</span> · <span className={kbd}>.pdf</span> ·{' '}
                <span className={kbd}>JPG images</span> · <span className={kbd}>.txt</span>, then
                click <span className={kbd}>Download ZIP</span>. The ZIP contains:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-forge-700 bg-forge-950 bg-black/40 p-3 font-mono text-xs text-zinc-400">{`ProjectName.zip
  pptx/     PowerPoint deck (editable)
  pdf/      one page per slide
  images/   one JPG per slide
  txt/      plain text of all slides`}</pre>
              <p className="mt-2">
                Unzip the file, then bring the contents into ProPresenter — see the{' '}
                <span className="font-medium text-zinc-200">Import into ProPresenter</span> guide in
                the bottom bar.
              </p>
            </div>
          </Section>

          {/* ProPresenter */}
          <Section title="Into ProPresenter" subtitle="Two ways to bring it in.">
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <span className="font-medium text-zinc-200">Editable:</span>{' '}
                Unzip the export, then in ProPresenter choose{' '}
                <span className={kbd}>File → Import → PowerPoint as Presentation</span> and pick the{' '}
                <span className="font-mono text-zinc-300">.pptx</span> from the{' '}
                <span className="font-mono text-zinc-300">pptx/</span> folder.
              </li>
              <li>
                <span className="font-medium text-zinc-200">Pixel-perfect:</span>{' '}
                Choose <span className={kbd}>File → Import → PowerPoint as Images</span>, or drag the
                JPGs from the <span className="font-mono text-zinc-300">images/</span> folder straight
                onto a ProPresenter playlist.
              </li>
            </ul>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-forge-700 px-7 py-4">
          <span className="text-xs text-zinc-600">SlideForge for ProPresenter · Lumen Design</span>
          <button
            onClick={onClose}
            className="rounded bg-forge-accent px-4 py-2 text-sm font-medium text-white hover:bg-forge-accentHover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
