import { uuid } from '@openstage/contracts'
import type { MemoryRecord, MemoryQuery } from './types.js'

export class MemoryStore {
  private records: MemoryRecord[] = []

  add(record: Omit<MemoryRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): MemoryRecord {
    const entry: MemoryRecord = {
      id: record.id ?? uuid(),
      createdAt: record.createdAt ?? new Date().toISOString(),
      ...record,
    }
    this.records.push(entry)
    return entry
  }

  query(q: MemoryQuery): MemoryRecord[] {
    let out = this.records
    if (q.tier) out = out.filter((r) => r.tier === q.tier)
    if (q.key) out = out.filter((r) => r.key === q.key || r.subject === q.key)
    if (q.text) {
      const needle = q.text.toLowerCase()
      out = out.filter((r) => r.text.toLowerCase().includes(needle))
    }
    if (q.topK !== undefined) out = out.slice(0, q.topK)
    return out
  }

  all(): MemoryRecord[] { return [...this.records] }
  clear(): void { this.records = [] }
}
