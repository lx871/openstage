import type { KnowledgeEntry, KnowledgeBase } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { knowledgeFromV2Entry } from '@openstage/domain'
import { assertEntryCount } from './validate-path.js'
import { objOf } from './codecs.js'

export function importWorldInfoJsonl(raw: string, name?: string): KnowledgeBase {
  if (raw.length > 5 * 1024 * 1024) throw Object.assign(new Error('world info too large'), { code: 'file_too_large' })
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  assertEntryCount(lines.length)
  const entries: KnowledgeEntry[] = []
  for (const line of lines) {
    let item: unknown
    try {
      item = JSON.parse(line)
    } catch {
      continue
    }
    const rec = objOf(item)
    const keys = rec['entries']
    if (Array.isArray(keys)) {
      for (const e of keys as unknown[]) {
        const entry = knowledgeFromV2Entry(entries.length + 1, objOf(e))
        if (entry) entries.push(entry)
      }
    } else {
      const entry = knowledgeFromV2Entry(entries.length + 1, rec)
      if (entry) entries.push(entry)
    }
  }
  return { id: uuid(), name, entries, vectorized: false }
}

export function importWorldInfoJson(raw: string, name?: string): KnowledgeBase {
  if (raw.length > 5 * 1024 * 1024) throw Object.assign(new Error('world info too large'), { code: 'file_too_large' })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = raw
  }
  const rec = objOf(parsed)
  const keys = rec['entries'] ?? rec['book']
  const entries: KnowledgeEntry[] = []
  if (Array.isArray(keys)) assertEntryCount(keys.length)
  if (Array.isArray(keys)) {
    for (const e of keys as unknown[]) {
      const entry = knowledgeFromV2Entry(entries.length + 1, objOf(e))
      if (entry) entries.push(entry)
    }
  } else if (typeof parsed === 'string') {
    return importWorldInfoJsonl(parsed, name)
  }
  return { id: uuid(), name, entries, vectorized: false }
}