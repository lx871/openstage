import type { Block, MessageRole } from './domain.js'
import type { Id, IsoDate, UnknownRecord } from './base.js'

export type EventKind =
  | 'conversation.created'
  | 'message.created'
  | 'message.edited'
  | 'message.deleted'
  | 'message.reordered'
  | 'branch.path.changed'
  | 'state.snapshot.created'
  | 'generation.started'
  | 'generation.completed'
  | 'generation.aborted'
  | 'character.imported'
  | 'world.info.imported'
  | 'chat.imported'
  | 'memory.created'
  | 'raw.imported'

export interface DomainEvent {
  id: Id
  kind: EventKind
  seq?: number
  at: IsoDate
  conversationId?: Id
  actor?: string
  data: UnknownRecord
}

export type Command =
  | {
      type: 'createConversation'
      conversationId?: Id
      characterIds: Id[]
      greetingMessageId?: Id
      at?: IsoDate
    }
  | {
      type: 'appendMessages'
      conversationId: Id
      parentId: Id | null
      messages: Array<{
        id?: Id
        role: MessageRole
        speakerId?: Id
        displayName?: string
        blocks: Block[]
        metaTrigger?: 'normal' | 'continue' | 'swipe' | 'regenerate' | 'import'
        stateSnapshotId?: Id
        at?: IsoDate
      }>
      at?: IsoDate
    }
  | { type: 'setBranch'; conversationId: Id; path: Id[]; at?: IsoDate }
  | { type: 'editMessage'; conversationId: Id; messageId: Id; blocks: Block[]; at?: IsoDate }
  | { type: 'deleteMessage'; conversationId: Id; messageId: Id; at?: IsoDate }
  | {
      type: 'saveStateSnapshot'
      conversationId: Id
      parentSnapshotId: Id | null
      deltas: { scope: 'global' | 'character' | 'conversation'; key: string; op: 'set' | 'unset' | 'increment' | 'append'; value?: unknown }[]
      cursor: Id | null
      snapshotId?: Id
      at?: IsoDate
    }
  | { type: 'importCharacter'; character: UnknownRecord; path?: string; at?: IsoDate }
  | { type: 'importWorldInfo'; name?: string; entries: UnknownRecord[]; path?: string; at?: IsoDate }
  | { type: 'importChat'; src: 'jsonl' | 'txt'; conversationId?: Id; characterId?: Id; payload: UnknownRecord; path?: string; at?: IsoDate }
  | { type: 'importRaw'; kind: string; payload: unknown; path?: string; at?: IsoDate }

export interface ChatSnapshot {
  conversation: UnknownRecord
  messages: UnknownRecord[]
}

export interface ConversationLoaded {
  conversation: UnknownRecord
  messages: UnknownRecord
}

export interface EventSink {
  append(event: DomainEvent): Promise<void>
}

export interface EventSource {
  stream(opts?: { conversationId?: Id; fromSeq?: number; kind?: EventKind }): AsyncIterable<DomainEvent>
  latestSeq(): Promise<number>
}

export interface CommandResult {
  ok: boolean
  seq: number
  events: DomainEvent[]
  error?: string
  projection?: unknown
  state?: UnknownRecord
}

export interface ChatStore {
  load(conversationId: Id): Promise<ConversationSnapshot | null>
  execute(cmd: Command): Promise<CommandResult>
  replay(conversationId: Id): Promise<ConversationSnapshot | null>
}

export interface ConversationSnapshot {
  conversation: ConversationState
  messages: MessageRecord[]
}

export interface ConversationState extends UnknownRecord {
  id: string
  characterIds: string[]
  roots: string[]
  activePath: string[]
  stateSnapshotId: string
  createdAt: string
  updatedAt: string
}

export interface MessageRecord extends UnknownRecord {
  id: string
  conversationId?: string
  parentId: string | null
  role: MessageRole
  contentBlocks?: Block[]
  rawText?: string
  meta?: { createdAt: string; trigger?: string }
  visibility?: 'prompt' | 'ui-only' | 'prompt-filtered'
  children?: string[]
  alternateIds?: string[]
  stateSnapshotId?: string
  displayName?: string
  speakerId?: string
}