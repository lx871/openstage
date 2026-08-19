import type { Command, CommandResult, ConversationSnapshot, DomainEvent } from '@openstage/contracts'
import { EventStore } from './event-store.js'

export interface SqliteEventStoreOptions { file: string; inMemory?: boolean }

export class SqliteEventStore {
  private mem = new EventStore()
  readonly filePath: string
  constructor(opts: SqliteEventStoreOptions) { this.filePath = opts.file }
  latestSeq(): number { return this.mem.latestSeq() }
  execute(cmd: Command): Promise<CommandResult> { return this.mem.execute(cmd) }
  stream(conversationId?: string, fromSeq?: number): DomainEvent[] { return this.mem.stream(conversationId, fromSeq) }
  async load(id: string): Promise<ConversationSnapshot | null> { return this.mem.replay(id) }
  async replay(id: string): Promise<ConversationSnapshot | null> { return this.mem.replay(id) }
  close(): void {}
}
export const uuid = 'browser-stub'
