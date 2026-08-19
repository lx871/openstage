import type { Command, CommandResult, ConversationSnapshot, DomainEvent, EventKind, MessageRecord, UnknownRecord } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { snapshotMessagesToTree, projectionToSnapshotLike, type ScopedState } from '@openstage/domain'
import { createProjection, applyEvent } from '@openstage/domain'

export interface ProjectionState {
  conversationId: string
  characterIds: string[]
  tree: ReturnType<typeof snapshotMessagesToTree>
  currentSnapshotId: string
  snapshots: Map<string, ScopedState>
}

export class EventStore {
  readonly events: DomainEvent[] = []
  private readonly initialSnapshotId: string

  constructor(events: DomainEvent[] = []) {
    this.events = events
    this.initialSnapshotId = uuid()
  }

  latestSeq(): number {
    return this.events.length
  }

  /** Append one or more events atomically (in-memory). */
  appendBatch(batch: DomainEvent[]): void {
    let seq = this.events.length + 1
    for (const e of batch) {
      if (e.seq === undefined) e.seq = seq++
      this.events.push(e)
    }
  }

  async execute(cmd: Command): Promise<CommandResult> {
    const batch = this.materialize(cmd)
    if (!batch.length) return { ok: false, seq: this.events.length, events: [], error: `no events for ${cmd.type}` }
    this.appendBatch(batch)
    const convId = firstConversationId(batch)
    const projection = convId ? this.replayProjection(convId) : null
    return {
      ok: true,
      seq: this.events.length,
      events: batch,
      projection,
      state: (projection?.tree.state ?? undefined) as UnknownRecord | undefined,
    }
  }

  async replay(conversationId: string): Promise<ConversationSnapshot | null> {
    const p = this.replayProjection(conversationId)
    return p ? projectionToSnapshotLike(p) : null
  }

  async load(conversationId: string): Promise<ConversationSnapshot | null> {
    return this.replay(conversationId)
  }

  replayProjection(conversationId: string): ProjectionState | null {
    const filtered = this.events
      .filter((e) => e.conversationId === conversationId)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    if (!filtered.length) return null
    const proj = createProjection(conversationId)
    for (const e of filtered) applyEvent(proj, e)
    return proj as unknown as ProjectionState
  }

  stream(conversationId?: string, fromSeq?: number): DomainEvent[] {
    return this.events.filter((e) => {
      if (conversationId && e.conversationId !== conversationId) return false
      if (fromSeq !== undefined && (e.seq ?? 0) < fromSeq) return false
      return true
    })
  }

  private materialize(cmd: Command): DomainEvent[] {
    const at = cmd.at ?? new Date().toISOString()
    switch (cmd.type) {
      case 'createConversation': {
        const id = cmd.conversationId ?? uuid()
        return [
          {
            id: uuid(), kind: 'conversation.created', at, conversationId: id, actor: 'cli',
            data: { characterIds: cmd.characterIds ?? [], greetingMessageId: cmd.greetingMessageId ?? null },
          },
        ]
      }
      case 'appendMessages': {
        const eid = uuid()
        const out: DomainEvent[] = [
          {
            id: eid, kind: 'message.created', at, conversationId: cmd.conversationId, actor: 'cli',
            data: {
              messageId: uuid(),
              parentId: cmd.parentId ?? null,
              role: cmd.messages[0]?.role ?? 'user',
              speakerId: cmd.messages[0]?.speakerId,
              displayName: cmd.messages[0]?.displayName,
              blocks: cmd.messages[0]?.blocks ?? [],
              metaTrigger: cmd.messages[0]?.metaTrigger,
              at: cmd.messages[0]?.at ?? at,
            },
          },
        ]
        if (cmd.messages.length > 1) {
          let cursor: string | null = cmd.parentId ?? null
          for (let i = 1; i < cmd.messages.length; i++) {
            const m = cmd.messages[i]!
            out.push({
              id: uuid(), kind: 'message.created', at, conversationId: cmd.conversationId, actor: 'cli',
              data: {
                messageId: uuid(),
                parentId: cursor,
                role: m.role,
                speakerId: m.speakerId,
                displayName: m.displayName,
                blocks: m.blocks,
                metaTrigger: m.metaTrigger,
                at: m.at ?? at,
              },
            })
            cursor = out[out.length - 1]!.data.messageId as string
          }
        }
        return out
      }
      case 'setBranch':
        return [{ id: uuid(), kind: 'branch.path.changed', at, conversationId: cmd.conversationId, actor: 'cli', data: { path: cmd.path } }]
      case 'saveStateSnapshot':
        return [{ id: uuid(), kind: 'state.snapshot.created', at, conversationId: cmd.conversationId, actor: 'cli', data: { deltas: cmd.deltas, cursor: cmd.cursor ?? null } }]
      case 'importCharacter':
      case 'importWorldInfo':
      case 'importChat':
      case 'importRaw':
      case 'editMessage':
      case 'deleteMessage':
        return []
    }
  }
}

function firstConversationId(batch: DomainEvent[]): string | undefined {
  return batch.find((e) => e.conversationId)?.conversationId
}

export { uuid }
export type { EventKind, MessageRecord, CommandResult, ConversationSnapshot }