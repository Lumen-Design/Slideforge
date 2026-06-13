import { useRef, useState } from 'react'
import { useProjectStore } from '../store/projectStore'

type ImportDropzoneProps = {
  onFile: (file: File) => void
}

const ACCEPTED = ['txt', 'pdf', 'docx']

/** Drag-and-drop (and click-to-browse) import zone for TXT, PDF and DOCX documents. */
export default function ImportDropzone({ onFile }: ImportDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const isImporting = useProjectStore((s) => s.isImporting)
  const importError = useProjectStore((s) => s.importError)

  const accept = (file: File | undefined): void => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED.includes(ext)) {
      useProjectStore.getState().setImportError(`Unsupported file type: .${ext}. Use TXT, PDF or DOCX.`)
      return
    }
    useProjectStore.getState().setImportError(null)
    onFile(file)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          accept(e.dataTransfer.files[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-10 py-16 text-center transition-colors',
          dragActive
            ? 'border-forge-accent bg-forge-accent/5'
            : 'border-forge-500 bg-forge-900/40 hover:border-forge-accent hover:bg-forge-800/40'
        ].join(' ')}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-forge-700 text-3xl">
          📄
        </div>
        <p className="text-lg font-medium text-zinc-100">
          {isImporting ? 'Importing…' : 'Drop a TXT, PDF or DOCX here'}
        </p>
        <p className="mt-1 text-sm text-zinc-500">or click to browse your files</p>
        <p className="mt-4 text-xs text-zinc-600">
          You'll choose how to split it into slides on the next screen.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = '' // allow re-importing the same file
          }}
        />
      </div>

      {importError && (
        <p className="mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {importError}
        </p>
      )}
    </div>
  )
}
