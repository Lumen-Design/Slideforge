type ProPresenterHelpProps = {
  open: boolean
  onClose: () => void
}

/** Modal explaining how to bring SlideForge output into ProPresenter. */
export default function ProPresenterHelp({ open, onClose }: ProPresenterHelpProps): JSX.Element | null {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-forge-600 bg-forge-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-100">Import into ProPresenter</h2>
        <p className="mt-1 text-sm text-zinc-400">
          SlideForge exports standard files ProPresenter understands natively.
        </p>

        <ol className="mt-4 space-y-3 text-sm text-zinc-300">
          <li className="flex gap-3">
            <span className="font-mono text-forge-accent">1.</span>
            <span>
              In ProPresenter, choose{' '}
              <span className="rounded bg-forge-700 px-1.5 py-0.5 font-medium">File → Import</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-forge-accent">2.</span>
            <span>
              Select{' '}
              <span className="rounded bg-forge-700 px-1.5 py-0.5 font-medium">
                PowerPoint as Presentation
              </span>{' '}
              to keep text editable, or{' '}
              <span className="rounded bg-forge-700 px-1.5 py-0.5 font-medium">
                PowerPoint as Images
              </span>{' '}
              for pixel-perfect slides.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-forge-accent">3.</span>
            <span>
              Pick the exported <span className="font-mono text-zinc-200">.pptx</span> file from your
              project's <span className="font-mono text-zinc-200">pptx/</span> folder.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-forge-accent">4.</span>
            <span>
              Prefer images? Drag the JPGs from the{' '}
              <span className="font-mono text-zinc-200">images/</span> folder straight onto a
              playlist.
            </span>
          </li>
        </ol>

        <div className="mt-5 rounded-lg border border-forge-700 bg-forge-800 p-3 text-xs text-zinc-400">
          Tip: “PowerPoint as Images” always looks exactly like the SlideForge preview, since both
          are rendered from the same engine.
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-forge-accent px-4 py-2 text-sm font-medium text-white hover:bg-forge-accentHover"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
