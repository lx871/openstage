import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Command, CommandResult, ConversationSnapshot, DomainEvent } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { applyEvent, createProjection, projectionToSnapshotLike as projectionToSnapshot } from '@openstage/domain'
import { EventStore } from './event-store.js'

export interface SqliteEventStoreOptions {
  file: string
  inMemory?: boolean
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  at TEXT NOT NULL,
  conversation_id TEXT,
  actor TEXT,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_conv ON events (conversation_id, seq);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  character_ids_json TEXT NOT NULL,
  greeting_message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  scopes_json TEXT,
  at TEXT NOT NULL
);
`

const require = createRequire(import.meta.url)

export class SqliteEventStore {
  private db: import('better-sqlite3').Database
  private readonly mem: EventStore
  readonly filePath: string

  constructor(opts: SqliteEventStoreOptions) {
    const filePath = opts.file
    if (!opts.inMemory) {
      fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true })
      const Database = require('better-sqlite3') as typeof import('better-sqlite3')
      this.db = new Database(path.resolve(filePath))
    } else {
      const Database = require('better-sqlite3') as typeof import('better-sqlite3')
      this.db = new Database(':memory:')
    }
    this.db.exec(SCHEMA)
    this.mem = new EventStore()
    this.filePath = path.resolve(filePath)
  }

  latestSeq(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM events').get() as { s: number }
    return row.s
  }

  async execute(cmd: Command): Promise<CommandResult> {
    const result = await this.mem.execute(cmd)
    if (!result.ok) return result
    const tx = this.db.transaction((batch: DomainEvent[]) => {
      const stmt = this.db.prepare(
        'INSERT INTO events (id, kind, at, conversation_id, actor, data_json) VALUES (@id, @kind, @at, @conversation_id, @actor, @data_json)',
      )
      for (const e of batch) {
        stmt.run({
          id: e.id,
          kind: e.kind,
          at: e.at,
          conversation_id: e.conversationId ?? null,
          actor: e.actor ?? null,
          data_json: JSON.stringify(e.data),
        })
      }
    })
    try {
      tx(result.events)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('UNIQUE constraint failed')) {
        return { ok: false, seq: this.latestSeq(), events: [], error: `duplicate event id: ${msg}` }
      }
      throw err
    }
    return result
  }

  async load(conversationId: string): Promise<ConversationSnapshot | null> {
    return this.replay(conversationId)
  }

  async replay(conversationId: string): Promise<ConversationSnapshot | null> {
    const events = this.stream(conversationId)
    if (!events.length) return null
    const proj = createProjection(conversationId)
    for (const e of events) applyEvent(proj, e)
    return projectionToSnapshot(proj)
  }

  stream(conversationId?: string, fromSeq?: number): DomainEvent[] {
    let sql = 'SELECT seq, id, kind, at, conversation_id, actor, data_json FROM events'
    const where: string[] = []
    const params: Record<string, unknown> = {}
    if (conversationId !== undefined) {
      where.push('conversation_id = @c')
      params.c = conversationId
    }
    if (fromSeq !== undefined) {
      where.push('seq >= @s')
      params.s = fromSeq
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY seq ASC'
    const rows = this.db.prepare(sql).all(params) as Array<{
      seq: number
      id: string
      kind: DomainEvent['kind']
      at: string
      conversation_id: string | null
      actor: string | null
      data_json: string
    }>
    return rows.map((r) => ({
      seq: r.seq,
      id: r.id,
      kind: r.kind,
      at: r.at,
      conversationId: r.conversation_id ?? undefined,
      actor: r.actor ?? undefined,
      data: JSON.parse(r.data_json),
    }))
  }

  close(): void {
    try {
      this.db.close()
    } catch {}
  }
}

export { uuid }
