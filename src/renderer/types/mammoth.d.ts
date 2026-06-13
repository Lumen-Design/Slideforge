// Minimal typings for mammoth's browser bundle (which ships no types for this subpath).
declare module 'mammoth/mammoth.browser' {
  export interface ExtractResult {
    value: string
    messages: { type: string; message: string }[]
  }

  export interface MammothImage {
    contentType: string
    read(encoding: 'base64'): Promise<string>
    read(encoding: 'buffer'): Promise<ArrayBuffer>
  }

  export interface ConvertOptions {
    convertImage?: (image: MammothImage) => Promise<Record<string, string>>
    styleMap?: string[]
  }

  export const images: {
    imgElement(
      handler: (image: MammothImage) => Promise<Record<string, string>>
    ): (image: MammothImage) => Promise<Record<string, string>>
  }

  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: ConvertOptions): Promise<ExtractResult>
}
