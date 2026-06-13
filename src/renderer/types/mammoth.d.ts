// Minimal typings for mammoth's browser bundle (which ships no types for this subpath).
declare module 'mammoth/mammoth.browser' {
  export interface ExtractResult {
    value: string
    messages: { type: string; message: string }[]
  }
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>
}
