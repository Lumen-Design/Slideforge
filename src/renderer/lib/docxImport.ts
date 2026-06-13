import * as mammoth from 'mammoth/mammoth.browser'

/**
 * Extract plain text from a .docx file. mammoth turns the document XML into clean text;
 * we keep paragraph breaks (mammoth emits one "\n" per paragraph) so the splitter's
 * paragraph/heading logic works the same as it does for TXT and PDF.
 */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  // mammoth needs an ArrayBuffer; hand it a fresh copy of just this view's bytes.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const result = await mammoth.extractRawText({ arrayBuffer: copy.buffer as ArrayBuffer })
  return result.value.replace(/\r\n?/g, '\n').trim()
}
