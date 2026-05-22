declare module "mammoth/mammoth.browser" {
  export function extractRawText(opts: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages?: unknown[] }>;
}
