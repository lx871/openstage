import fs from 'node:fs'
import path from 'node:path'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ENTRIES = 2000

export function assertFileSizeWithinLimit(filePath: string, maxBytes = MAX_IMPORT_BYTES): void {
  const stat = fs.statSync(filePath)
  if (stat.size > maxBytes) {
    throw Object.assign(new Error(`file too large: ${stat.size} bytes > limit ${maxBytes}`), { code: 'file_too_large' })
  }
}

export function assertWithinRoot(resolvedFile: string, rootDir: string): void {
  const rel = path.relative(path.resolve(rootDir), path.resolve(resolvedFile))
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw Object.assign(new Error(`path escapes allowed root: ${resolvedFile} not under ${rootDir}`), { code: 'path_escape' })
  }
}

export function assertSafeImportBuffer(buf: Uint8Array, maxBytes = MAX_IMPORT_BYTES): void {
  if (buf.byteLength > maxBytes) {
    throw Object.assign(new Error(`import buffer too large: ${buf.byteLength} > ${maxBytes}`), { code: 'file_too_large' })
  }
}

export function assertEntryCount(n: number, max = MAX_IMPORT_ENTRIES): void {
  if (n > max) throw Object.assign(new Error(`entry count ${n} exceeds limit ${max}`), { code: 'too_many_entries' })
}
