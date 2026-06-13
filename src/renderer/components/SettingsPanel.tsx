import { useState, type ReactNode } from 'react'
import { useProjectStore } from '../store/projectStore'
import { PRESET_ORDER, PRESETS, FONT_OPTIONS, DEFAULT_FONT, defaultTitleSize } from '../lib/templates'
import { TRANSPARENT } from '../lib/styleTemplates'
import type { LayoutType, TextAlign } from '../types/presentation'
import { openImageFile } from '../lib/platform'

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="border-b border-forge-700 px-4 py-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded border border-forge-600 bg-forge-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-forge-accent'

export default function SettingsPanel(): JSX.Element {
  const selectedPreset = useProjectStore((s) => s.project.selectedPreset)
  const applyPresetToAll = useProjectStore((s) => s.applyPresetToAll)
  const selectedId = useProjectStore((s) => s.selectedSlideId)
  const selectedIds = useProjectStore((s) => s.selectedSlideIds)
  const slide = useProjectStore((s) => s.project.slides.find((x) => x.id === selectedId) ?? null)
  const update = useProjectStore((s) => s.updateSelectedSlide)
  const splitSlide = useProjectStore((s) => s.splitSlide)
  const mergeWithNext = useProjectStore((s) => s.mergeWithNext)
  const duplicateSlide = useProjectStore((s) => s.duplicateSlide)
  const deleteSlide = useProjectStore((s) => s.deleteSlide)
  const pullNextIntoNotes = useProjectStore((s) => s.pullNextIntoNotes)
  const autoFillNotesFromNext = useProjectStore((s) => s.autoFillNotesFromNext)
  const clearAllNotes = useProjectStore((s) => s.clearAllNotes)
  const buildFromLines = useProjectStore((s) => s.buildFromLines)
  const makePlainForThemes = useProjectStore((s) => s.makePlainForThemes)
  // selection-aware bulk actions
  const mergeSlidesInto = useProjectStore((s) => s.mergeSlidesInto)
  const buildFromSlides = useProjectStore((s) => s.buildFromSlides)
  const duplicateSlides = useProjectStore((s) => s.duplicateSlides)
  const splitSlides = useProjectStore((s) => s.splitSlides)
  const deleteSlides = useProjectStore((s) => s.deleteSlides)

  // templates
  const templates = useProjectStore((s) => s.templates)
  const saveTemplateFromSlide = useProjectStore((s) => s.saveTemplateFromSlide)
  const deleteTemplate = useProjectStore((s) => s.deleteTemplate)
  const applyTemplateToSlides = useProjectStore((s) => s.applyTemplateToSlides)

  const [savingName, setSavingName] = useState<string | null>(null)

  const targetIds = selectedIds.length > 0 ? selectedIds : slide ? [slide.id] : []
  const isTransparent = slide?.backgroundColor === TRANSPARENT

  return (
    <div className="forge-scroll h-full overflow-y-auto">
      {/* Preset selector — applies to the whole deck */}
      <Section title="Layout Preset">
        <div className="grid grid-cols-1 gap-1.5">
          {PRESET_ORDER.map((preset: LayoutType) => {
            const meta = PRESETS[preset]
            const active = preset === selectedPreset
            return (
              <button
                key={preset}
                onClick={() => applyPresetToAll(preset)}
                className={[
                  'rounded border px-3 py-2 text-left transition-colors',
                  active ? 'border-forge-accent bg-forge-700' : 'border-forge-700 bg-forge-800 hover:border-forge-500'
                ].join(' ')}
              >
                <div className="text-sm font-medium text-zinc-100">{meta.label}</div>
                <div className="text-[11px] leading-tight text-zinc-500">{meta.description}</div>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-zinc-600">Selecting a preset restyles every slide.</p>
      </Section>

      {/* Style templates */}
      <Section title="Style Templates">
        <p className="text-[11px] text-zinc-600">
          Apply to {targetIds.length} selected slide{targetIds.length === 1 ? '' : 's'}. Includes a
          transparent text template for keying.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex items-center overflow-hidden rounded border border-forge-700 bg-forge-800"
            >
              <button
                onClick={() => applyTemplateToSlides(t.id, targetIds)}
                disabled={targetIds.length === 0}
                className="px-2 py-1 text-xs text-zinc-200 hover:bg-forge-600 disabled:opacity-40"
                title={`Apply "${t.name}"`}
              >
                {t.name}
              </button>
              <button
                onClick={() => deleteTemplate(t.id)}
                className="px-1.5 py-1 text-[11px] text-zinc-600 hover:bg-red-900/40 hover:text-red-300"
                title="Delete template"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {savingName === null ? (
          <button
            onClick={() => setSavingName('')}
            disabled={!slide}
            className="w-full rounded border border-dashed border-forge-600 px-3 py-1.5 text-xs text-zinc-400 hover:border-forge-accent hover:text-forge-accent disabled:opacity-40"
          >
            + Save current slide's style as template
          </button>
        ) : (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && slide && savingName.trim()) {
                  saveTemplateFromSlide(savingName, slide.id)
                  setSavingName(null)
                } else if (e.key === 'Escape') setSavingName(null)
              }}
              placeholder="Template name…"
              className={inputClass}
            />
            <button
              onClick={() => {
                if (slide && savingName.trim()) saveTemplateFromSlide(savingName, slide.id)
                setSavingName(null)
              }}
              className="rounded bg-forge-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-forge-accentHover"
            >
              Save
            </button>
          </div>
        )}
      </Section>

      {!slide ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-600">
          Select a slide to edit its content and style.
        </div>
      ) : (
        <>
          {selectedIds.length > 1 && (
            <div className="border-b border-forge-700 bg-forge-800/60 px-4 py-2 text-[11px] text-forge-accent">
              Editing slide {slide.position + 1}. {selectedIds.length} slides selected for templates &
              bulk actions.
            </div>
          )}

          {/* Content editing */}
          <Section title="Content">
            <Field label="Title / Reference">
              <input className={inputClass} value={slide.title} onChange={(e) => update({ title: e.target.value })} placeholder="Optional heading" />
            </Field>
            <Field label="Body">
              <textarea
                className={`${inputClass} h-28 resize-none font-mono text-[13px] leading-snug`}
                value={slide.body}
                onChange={(e) => update({ body: e.target.value })}
                placeholder="Slide text…"
              />
            </Field>
            <Field label="Notes (speaker / ProPresenter)">
              <textarea className={`${inputClass} h-16 resize-none`} value={slide.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Optional notes" />
            </Field>
            <button
              onClick={() => pullNextIntoNotes(slide.id)}
              className="w-full rounded border border-forge-700 bg-forge-800 px-3 py-1.5 text-xs text-zinc-200 hover:border-forge-500"
            >
              ⤵ Pull next slide's text into notes
            </button>
          </Section>

          {/* Appearance (slide-level) */}
          <Section title="Appearance">
            <Field label="Layout">
              <select className={inputClass} value={slide.layoutType} onChange={(e) => update({ layoutType: e.target.value as LayoutType })}>
                {PRESET_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRESETS[p].label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Transparent background (keyable)</span>
              <input
                type="checkbox"
                checked={isTransparent}
                onChange={(e) => update({ backgroundColor: e.target.checked ? TRANSPARENT : '#000000' })}
                className="h-4 w-4 accent-forge-accent"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Background">
                {isTransparent ? (
                  <div className="rounded border border-forge-600 bg-forge-900 px-2 py-1.5 text-xs text-zinc-500">Transparent</div>
                ) : (
                  <ColorInput value={slide.backgroundColor} onChange={(c) => update({ backgroundColor: c })} />
                )}
              </Field>
              <Field label="Text color">
                <ColorInput value={slide.textColor} onChange={(c) => update({ textColor: c })} />
              </Field>
            </div>

            {/* Background image */}
            <div className="space-y-2 rounded border border-forge-700 bg-forge-800/40 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Background image</span>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      const dataUrl = await openImageFile()
                      if (dataUrl) {
                        update({ backgroundImage: dataUrl, backgroundFit: slide.backgroundFit ?? 'cover' })
                      }
                    }}
                    className="rounded bg-forge-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-forge-600"
                  >
                    {slide.backgroundImage ? 'Replace…' : 'Choose…'}
                  </button>
                  {slide.backgroundImage && (
                    <button
                      onClick={() => update({ backgroundImage: undefined })}
                      className="rounded bg-forge-700 px-2 py-1 text-[11px] text-zinc-400 hover:bg-red-900/40 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {slide.backgroundImage && (
                <>
                  <div className="flex gap-1">
                    {(['cover', 'contain'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => update({ backgroundFit: f })}
                        className={[
                          'flex-1 rounded border px-2 py-1 text-[11px] capitalize',
                          (slide.backgroundFit ?? 'cover') === f
                            ? 'border-forge-accent bg-forge-700 text-zinc-100'
                            : 'border-forge-700 bg-forge-800 text-zinc-400 hover:border-forge-500'
                        ].join(' ')}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <Field label={`Dim — ${Math.round((slide.backgroundDim ?? 0) * 100)}%`}>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={slide.backgroundDim ?? 0}
                      onChange={(e) => update({ backgroundDim: Number(e.target.value) })}
                      className="w-full accent-forge-accent"
                    />
                  </Field>
                </>
              )}
            </div>

            <button
              onClick={() => makePlainForThemes(targetIds)}
              title="Make transparent with no box, so it imports as clean editable text you can theme in ProPresenter"
              className="w-full rounded border border-forge-700 bg-forge-800 px-3 py-2 text-xs text-zinc-200 hover:border-forge-accent hover:text-forge-accent"
            >
              ✦ Plain text for theming{targetIds.length > 1 ? ` (${targetIds.length} slides)` : ''}
            </button>
          </Section>

          {/* Title / Reference styling (kept above the body) */}
          <Section title="Title / Reference">
            <Field label="Title font">
              <select
                className={inputClass}
                value={slide.titleFontFamily ?? slide.fontFamily ?? DEFAULT_FONT}
                onChange={(e) => update({ titleFontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={`Title size — ${slide.titleFontSize ?? defaultTitleSize(slide)}px${
                slide.titleFontSize == null ? ' (auto)' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={14}
                  max={160}
                  step={1}
                  value={slide.titleFontSize ?? defaultTitleSize(slide)}
                  onChange={(e) => update({ titleFontSize: Number(e.target.value) })}
                  className="w-full accent-forge-accent"
                />
                <button
                  onClick={() => update({ titleFontSize: undefined })}
                  className="shrink-0 rounded border border-forge-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-forge-500"
                  title="Reset title size to match the preset"
                >
                  Auto
                </button>
              </div>
            </Field>
            <Field label="Title position">
              <div className="flex gap-1">
                {(['above', 'below'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => update({ titlePosition: p })}
                    className={[
                      'flex-1 rounded border px-2 py-1.5 text-xs capitalize',
                      (slide.titlePosition ?? 'above') === p
                        ? 'border-forge-accent bg-forge-700 text-zinc-100'
                        : 'border-forge-700 bg-forge-800 text-zinc-400 hover:border-forge-500'
                    ].join(' ')}
                  >
                    {p} body
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Title alignment">
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => update({ titleAlign: a })}
                    className={[
                      'flex-1 rounded border px-2 py-1.5 text-xs capitalize',
                      slide.titleAlign === a
                        ? 'border-forge-accent bg-forge-700 text-zinc-100'
                        : 'border-forge-700 bg-forge-800 text-zinc-400 hover:border-forge-500'
                    ].join(' ')}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* Body styling */}
          <Section title="Body">
            <Field label="Body font">
              <select
                className={inputClass}
                value={slide.fontFamily ?? DEFAULT_FONT}
                onChange={(e) => update({ fontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Body size — ${slide.fontSize}px`}>
              <input type="range" min={14} max={96} step={1} value={slide.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} className="w-full accent-forge-accent" />
            </Field>
            <Field label="Text alignment">
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => update({ textAlign: a })}
                    className={[
                      'flex-1 rounded border px-2 py-1.5 text-xs capitalize',
                      slide.textAlign === a ? 'border-forge-accent bg-forge-700 text-zinc-100' : 'border-forge-700 bg-forge-800 text-zinc-400 hover:border-forge-500'
                    ].join(' ')}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Line spacing — ${(slide.lineSpacing ?? 1.22).toFixed(2)}×`}>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={slide.lineSpacing ?? 1.22}
                  onChange={(e) => update({ lineSpacing: Number(e.target.value) })}
                  className="w-full accent-forge-accent"
                />
                <button
                  onClick={() => update({ lineSpacing: undefined })}
                  className="shrink-0 rounded border border-forge-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-forge-500"
                  title="Reset line spacing to default"
                >
                  Auto
                </button>
              </div>
            </Field>
          </Section>

          {/* Box controls */}
          <Section title="Text Box">
            <label className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Box behind text</span>
              <input type="checkbox" checked={slide.boxEnabled} onChange={(e) => update({ boxEnabled: e.target.checked })} className="h-4 w-4 accent-forge-accent" />
            </label>
            {slide.boxEnabled && (
              <>
                <label className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Separate box per line</span>
                  <input
                    type="checkbox"
                    checked={slide.boxPerLine ?? false}
                    onChange={(e) => update({ boxPerLine: e.target.checked })}
                    className="h-4 w-4 accent-forge-accent"
                  />
                </label>
                <Field label="Box color">
                  <ColorInput value={slide.boxColor} onChange={(c) => update({ boxColor: c })} />
                </Field>
                <Field label={`Box opacity — ${Math.round(slide.boxOpacity * 100)}%`}>
                  <input type="range" min={0} max={1} step={0.05} value={slide.boxOpacity} onChange={(e) => update({ boxOpacity: Number(e.target.value) })} className="w-full accent-forge-accent" />
                </Field>
              </>
            )}
          </Section>

          {/* Structural actions — operate on the whole selection when 2+ are selected */}
          {selectedIds.length > 1 ? (
            <Section title={`Actions · ${selectedIds.length} selected`}>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton onClick={() => mergeSlidesInto(selectedIds, 'replace')} label="Merge into one" />
                <ActionButton onClick={() => mergeSlidesInto(selectedIds, 'new')} label="Merge → new" />
                <ActionButton onClick={() => buildFromSlides(selectedIds)} label="Build (cumulative)" />
                <ActionButton onClick={() => splitSlides(selectedIds)} label="Split each" />
                <ActionButton onClick={() => duplicateSlides(selectedIds)} label="Duplicate" />
                <ActionButton onClick={() => deleteSlides(selectedIds)} label="Delete" danger />
              </div>
              <p className="text-[11px] text-zinc-600">
                “Merge into one” combines all selected and removes the originals. “Merge → new” keeps
                them. “Build” makes cumulative slides that add up.
              </p>
            </Section>
          ) : (
            <Section title="Slide Actions">
              <div className="grid grid-cols-2 gap-2">
                <ActionButton onClick={() => splitSlide(slide.id)} label="Split" />
                <ActionButton onClick={() => mergeWithNext(slide.id)} label="Merge ↓" />
                <ActionButton onClick={() => duplicateSlide(slide.id)} label="Duplicate" />
                <ActionButton onClick={() => deleteSlide(slide.id)} label="Delete" danger />
              </div>
              <ActionButton
                onClick={() => buildFromLines(slide.id)}
                label="Build from lines (one per line, cumulative)"
                full
                disabled={slide.body.split('\n').filter((l) => l.trim().length > 0).length < 2}
              />
              <p className="text-[11px] text-zinc-600">
                Select multiple slides (⌘/Shift-click) to merge or build across slides.
              </p>
            </Section>
          )}

          {/* Deck-wide tools */}
          <Section title="Deck Tools">
            <ActionButton onClick={autoFillNotesFromNext} label="Auto-fill all notes from next slide" full />
            <ActionButton onClick={clearAllNotes} label="Clear all notes" full />
            <ActionButton
              onClick={() => makePlainForThemes(useProjectStore.getState().project.slides.map((x) => x.id))}
              label="Plain text for theming — all slides"
              full
            />
          </Section>
        </>
      )}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (c: string) => void }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-forge-600 bg-transparent" />
      <input className={`${inputClass} font-mono text-xs`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ActionButton({ onClick, label, danger, full, disabled }: { onClick: () => void; label: string; danger?: boolean; full?: boolean; disabled?: boolean }): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        full ? 'w-full' : '',
        'rounded border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'border-red-900 bg-red-950/40 text-red-300 hover:bg-red-900/40' : 'border-forge-700 bg-forge-800 text-zinc-200 hover:border-forge-500'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
