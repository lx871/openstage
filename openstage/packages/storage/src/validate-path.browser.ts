export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ENTRIES = 2000
export function assertFileSizeWithinLimit(_filePath: string, _maxBytes = MAX_IMPORT_BYTES): void {}
export function assertWithinRoot(_resolvedFile: string, _rootDir: string): void {}
export function assertSafeImportBuffer(buf: Uint8Array, maxBytes = MAX_IMPORT_BYTES): void {
  if (buf.byteLength > maxBytes) throw Object.assign(new Error(`import buffer too large: ${buf.byteLength} > ${maxBytes}`), { code: 'file_too_large' })
}
export function assertEntryCount(n: number, max = MAX_IMPORT_ENTRIES): void {
  if (n > max) throw Object.assign(new Error(`entry count ${n} exceeds limit ${max}`), { code: 'too_many_entries' })
}
