// Auto slide splitter.
//
// Rules (from the spec):
//   - max 8 lines per slide
//   - max 42 characters per line (long lines are word-wrapped)
//   - preserve paragraph breaks (a blank line between paragraphs becomes a blank line
//     on the slide, or a slide break when there is no room)
//   - detect headings: short lines, ALL CAPS, or lines ending with a colon. A heading
//     becomes the title of a new slide and the following paragraphs fill its body.

export type SplitOptions = {
  maxLines: number
  maxChars: number
}

/** How the importer cuts a document into slides. */
export type SplitMode = 'smart' | 'paragraph' | 'line' | 'heading' | 'indent'

export const SPLIT_MODES: { mode: SplitMode; label: string; description: string }[] = [
  { mode: 'smart', label: 'Smart (auto)', description: 'Headings + 8 lines / 42 chars per slide.' },
  { mode: 'paragraph', label: 'Per paragraph', description: 'One slide per blank-line paragraph.' },
  { mode: 'line', label: 'Per line', description: 'One slide for every non-empty line.' },
  { mode: 'heading', label: 'Per heading', description: 'New slide at each heading (CAPS / colon / short).' },
  { mode: 'indent', label: 'Per indent', description: 'New slide at each non-indented line; indented lines attach.' }
]

export const DEFAULT_SPLIT_OPTIONS: SplitOptions = {
  maxLines: 8,
  maxChars: 42
}

/** A layout-agnostic slice of content produced by the splitter. */
export type RawSlide = {
  title: string
  body: string
}

/** Word-wrap a single logical line to at most `maxChars` characters per output line. */
export function wrapLine(line: string, maxChars: number): string[] {
  const trimmed = line.trim()
  if (trimmed.length === 0) return ['']
  if (trimmed.length <= maxChars) return [trimmed]

  const words = trimmed.split(/\s+/)
  const out: string[] = []
  let current = ''

  for (const word of words) {
    // Hard-split a single word that is itself longer than the line budget.
    let w = word
    while (w.length > maxChars) {
      if (current.length > 0) {
        out.push(current)
        current = ''
      }
      out.push(w.slice(0, maxChars))
      w = w.slice(maxChars)
    }

    if (current.length === 0) {
      current = w
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w
    } else {
      out.push(current)
      current = w
    }
  }

  if (current.length > 0) out.push(current)
  return out
}

/** A paragraph counts as a heading when it is a single short / ALL-CAPS / colon line. */
export function isHeading(paragraph: string, maxChars: number): boolean {
  const lines = paragraph
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // Headings are single physical lines.
  if (lines.length !== 1) return false
  const line = lines[0]
  if (line.length === 0) return false

  // Ends with a colon → label / heading (e.g. "Reading:").
  if (line.endsWith(':')) return true

  // ALL CAPS (and actually contains letters).
  const hasLetters = /[a-z]/i.test(line)
  if (hasLetters && line === line.toUpperCase()) return true

  // Short line heuristic.
  const shortThreshold = Math.min(30, Math.floor(maxChars * 0.6))
  if (line.length <= shortThreshold) return true

  return false
}

type Accumulator = {
  title: string
  lines: string[]
}

/**
 * Split raw document text into a sequence of RawSlides honoring all four rules above.
 */
export function splitTextIntoSlides(
  text: string,
  options: SplitOptions = DEFAULT_SPLIT_OPTIONS
): RawSlide[] {
  const { maxLines, maxChars } = options
  const normalized = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ')

  // Paragraphs are separated by one or more blank lines.
  const paragraphs = normalized
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/[ \t]+$/gm, ''))
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const slides: RawSlide[] = []
  let current: Accumulator | null = null

  const flush = (): void => {
    if (!current) return
    // Drop a trailing blank separator line if present.
    while (current.lines.length > 0 && current.lines[current.lines.length - 1] === '') {
      current.lines.pop()
    }
    if (current.title.length > 0 || current.lines.length > 0) {
      slides.push({ title: current.title, body: current.lines.join('\n') })
    }
    current = null
  }

  const startSlide = (title: string): Accumulator => {
    const acc: Accumulator = { title, lines: [] }
    current = acc
    return acc
  }

  /** Append a paragraph's wrapped lines into the current slide, breaking on overflow. */
  const addParagraph = (wrapped: string[]): void => {
    if (!current) startSlide('')
    let acc = current as Accumulator

    // Paragraph separator: keep the blank line if it fits, otherwise start a fresh
    // continuation slide (which inherits no title so it reads as a continuation).
    if (acc.lines.length > 0) {
      if (acc.lines.length + 1 < maxLines) {
        acc.lines.push('')
      } else {
        flush()
        acc = startSlide('')
      }
    }

    for (const line of wrapped) {
      if (acc.lines.length >= maxLines) {
        flush()
        acc = startSlide('')
      }
      acc.lines.push(line)
    }
  }

  for (const paragraph of paragraphs) {
    if (isHeading(paragraph, maxChars)) {
      flush()
      const headingText = paragraph.replace(/\s+/g, ' ').trim()
      startSlide(headingText)
    } else {
      const wrapped = paragraph
        .split('\n')
        .flatMap((physicalLine) => wrapLine(physicalLine, maxChars))
      addParagraph(wrapped)
    }
  }

  flush()
  return slides
}

// ---------------------------------------------------------------------------
// Mode-based segmentation
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/ /g, ' ')
}

function toParagraphs(text: string): string[] {
  return normalize(text)
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/[ \t]+$/gm, '').trim())
    .filter((p) => p.length > 0)
}

/** Per-paragraph: each blank-line-separated block becomes a single slide. */
function splitByParagraph(text: string, maxChars: number): RawSlide[] {
  return toParagraphs(text).map((p) => {
    const wrapped = p.split('\n').flatMap((line) => wrapLine(line, maxChars))
    return { title: '', body: wrapped.join('\n') }
  })
}

/** Per-line: every non-empty physical line becomes its own slide. */
function splitByLine(text: string, maxChars: number): RawSlide[] {
  return normalize(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => ({ title: '', body: wrapLine(line, maxChars).join('\n') }))
}

/** Per-heading: a new slide starts at every heading; following lines are its body. */
function splitByHeading(text: string, maxChars: number): RawSlide[] {
  const lines = normalize(text)
    .split('\n')
    .map((l) => l.trimEnd())
  const slides: RawSlide[] = []
  let current: { title: string; body: string[] } | null = null

  const flush = (): void => {
    if (current && (current.title || current.body.length)) {
      slides.push({ title: current.title, body: current.body.join('\n') })
    }
    current = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) continue
    if (isHeading(line, maxChars)) {
      flush()
      current = { title: line.replace(/\s+/g, ' '), body: [] }
    } else {
      if (!current) current = { title: '', body: [] }
      current.body.push(...wrapLine(line, maxChars))
    }
  }
  flush()
  return slides
}

/** Per-indent: a non-indented line starts a slide; indented lines attach to it as body. */
function splitByIndent(text: string, maxChars: number): RawSlide[] {
  const lines = normalize(text).split('\n')
  const slides: RawSlide[] = []
  let current: { title: string; body: string[] } | null = null

  const flush = (): void => {
    if (current && (current.title || current.body.length)) {
      slides.push({ title: current.title, body: current.body.join('\n') })
    }
    current = null
  }

  for (const raw of lines) {
    if (raw.trim().length === 0) continue
    const isIndented = /^[ \t]+/.test(raw)
    const content = raw.trim()
    if (!isIndented) {
      // Top-level line → start a new slide, using the line as its title.
      flush()
      current = { title: content.replace(/\s+/g, ' '), body: [] }
    } else {
      if (!current) current = { title: '', body: [] }
      current.body.push(...wrapLine(content, maxChars))
    }
  }
  flush()
  return slides
}

/**
 * Build slides from explicit, user-chosen boundaries. `lines` is the source split by
 * newline; `startIndices` is the set of line indices where a new slide begins (index 0
 * always starts the first slide). Blank lines are preserved within a slide but trimmed
 * at its edges.
 */
export function slidesFromBoundaries(
  lines: string[],
  startIndices: Set<number>,
  maxChars: number
): RawSlide[] {
  const slides: RawSlide[] = []
  let bucket: string[] = []

  const flush = (): void => {
    while (bucket.length && bucket[0].trim() === '') bucket.shift()
    while (bucket.length && bucket[bucket.length - 1].trim() === '') bucket.pop()
    if (bucket.length) {
      const wrapped = bucket.flatMap((l) => wrapLine(l, maxChars))
      slides.push({ title: '', body: wrapped.join('\n') })
    }
    bucket = []
  }

  lines.forEach((line, i) => {
    if (i !== 0 && startIndices.has(i)) flush()
    bucket.push(line)
  })
  flush()
  return slides
}

/** Dispatch to the chosen segmentation strategy. */
export function splitByMode(
  text: string,
  mode: SplitMode,
  options: SplitOptions = DEFAULT_SPLIT_OPTIONS
): RawSlide[] {
  switch (mode) {
    case 'paragraph':
      return splitByParagraph(text, options.maxChars)
    case 'line':
      return splitByLine(text, options.maxChars)
    case 'heading':
      return splitByHeading(text, options.maxChars)
    case 'indent':
      return splitByIndent(text, options.maxChars)
    case 'smart':
    default:
      return splitTextIntoSlides(text, options)
  }
}
