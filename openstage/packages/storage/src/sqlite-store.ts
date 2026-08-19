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

let sqlite: import('better-sqlite3').Database | null = null

function loadSqlite(): import('better-sqlite3').Database {
  if (sqlite === null) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    sqlite = new Database(':memory:')
  }
  return sqlite
}

/**
 * SQLite-backed event store built on the same command materializer as the
 * in-memory EventStore; the only difference is events land in a table.
 */
export class SqliteEventStore {
  private db: import('better-sqlite3').Database
  private readonly mem: EventStore

  constructor(opts: SqliteEventStoreOptions) {
    this.db = loadSqlite()
    this.db.exec(SCHEMA)
    this.mem = new EventStore()
    void opts
  }

  latestSeq(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM events').get() as { s: number }
    return row.s
  }

  async execute(cmd: Command): Promise<CommandResult> {
    const result = await this.mem.execute(cmd)
    if (result.ok) await this.appendBatch(result.events)
    return result
  }

  private async appendBatch(batch: DomainEvent[]): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO events (id, kind, at, conversation_id, actor, data_json) VALUES (@id, @kind, @at, @conversation_id, @actor, @data_json)',
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
    let sql = 'SELECT * FROM events'
    const where: string[] = []
    const params: Record<string, unknown> = {}
    if (conversationId) {
      where.push('conversation_id = @c')
      params.c = conversationId
    }
    if (fromSeq !== undefined) {
      where.push('seq >= @s')
      params.s = fromSeq
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY seq ASC'
    const rows = this.db.prepare(sql).all(params) as Array<{ id: string; kind: DomainEvent['kind']; at: string; conversation_id: string | null; actor: string | null; data_json: string }>
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      at: r.at,
      conversationId: r.conversation_id ?? undefined,
      actor: r.actor ?? undefined,
      data: JSON.parse(r.data_json),
    }))
  }
}

export { uuid }