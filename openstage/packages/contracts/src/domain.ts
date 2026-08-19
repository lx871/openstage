import type { Id, IsoDate, UnknownRecord } from './base.js'

export const MESSAGE_ROLES = ['user', 'assistant', 'system', 'narrator'] as const
export type MessageRole = (typeof MESSAGE_ROLES)[number]

export const PROMPT_ROLES = ['system', 'user', 'assistant'] as const
export type PromptRole = (typeof PROMPT_ROLES)[number]

export type BlockType = 'text' | 'image' | 'audio' | 'custom'

export interface TextBlock {
  type: 'text'
  text: string
  /** 宏展开前的原始文本（用于 Inspector 显示来源链） */
  raw?: string
}

export interface ImageBlock {
  type: 'image'
  ref: string
  alt?: string
  promptInjection: 'all' | 'none' | 'system-user'
}

export interface AudioBlock {
  type: 'audio'
  ref: string
  transcript?: string
}

export interface CustomBlock {
  type: 'custom'
  kind: string
  payload: UnknownRecord
  /** 渲染是否走沙箱（外部 HTML/CSS 兼容） */
  sandboxed?: boolean
}

export type Block = TextBlock | ImageBlock | AudioBlock | CustomBlock

export interface MessageContent {
  text(trimTrailingWhitespace?: boolean): string
  textBlocks: TextBlock[]
  preview(max?: number): string
  rawText(): string
  clone(): MessageContent
}

export type MessageVisibility = 'prompt' | 'ui-only' | 'prompt-filtered'

export interface GenerationMeta {
  createdAt: IsoDate
  model?: string
  usage?: UnknownRecord
  /** 生成时的全部采样参数快照，用于复现/审计 */
  generationParams?: UnknownRecord
  trigger: 'normal' | 'continue' | 'swipe' | 'regenerate' | 'impersonate' | 'quiet' | 'summary' | 'import'
  parentAlternativeId?: Id
}

export interface StateDelta {
  scope: 'global' | 'character' | 'conversation'
  key: string
  op: 'set' | 'unset' | 'increment' | 'append'
  value?: unknown
  opId: Id
}

export interface StateSnapshotHeader {
  kind: 'delta' | 'full'
  parentSnapshotId: Id | null
  revision: number
  createdAt: IsoDate
  cursor: Id | null
}

export interface StateSnapshot {
  id: Id
  header: StateSnapshotHeader
  deltas: StateDelta[]
  full?: { global: Record<string, unknown>; character: Record<string, unknown>; conversation: Record<string, unknown> }
}

export interface MessageNode {
  id: Id
  conversationId: Id
  parentId: Id | null
  role: MessageRole
  speakerId?: Id
  displayName?: string
  content: MessageContent
  visibility: MessageVisibility
  meta: GenerationMeta
  stateSnapshotId?: Id
  alternateIds: Id[]
  children: Id[]
}

export interface Conversation {
  id: Id
  characterIds: Id[]
  roots: Id[]
  activePath: Id[]
  stateSnapshotId: Id
  createdAt: IsoDate
  updatedAt: IsoDate
  importedFrom?: string
  rawPayload?: UnknownRecord
}

export interface ScopedState {
  global: Record<string, unknown>
  character: Record<string, unknown>
  conversation: Record<string, unknown>
}

export interface TwoDimensionalRelation {
  characterId: Id
  relation: string
  notes?: string
}

export interface IdentityDoc {
  name: string
  description: string
  personality: string
  scenario: string
  appearance?: string
  relationships?: TwoDimensionalRelation[]
  meta?: UnknownRecord
}

export interface StyleGuide {
  greetingCandidates: MessageContent[]
  exampleMessages: string[]
  exampleContext?: string
  format: string
  voice?: string
}

export interface PresentationDoc {
  guide: StyleGuide
  assets: Asset[]
}

export interface AgentBehavior {
  systemOverrides: Record<string, string>
  systemMessage?: string
  postHistoryInstructions?: string
  toolAuthorization: string[]
  stateSchema?: UnknownRecord
  generationProfile?: UnknownRecord
}

export interface Character {
  id: Id
  avatar?: string
  identity: IdentityDoc
  presentation: PresentationDoc
  behavior: AgentBehavior
  knowledgeEntryIds: Id[]
  importedFrom?: string
  unknownFields: UnknownRecord
  created: IsoDate
  updated: IsoDate
}

export interface Asset {
  id: Id
  kind: 'image' | 'audio' | 'video' | 'other'
  ref: string
  meta?: UnknownRecord
}

export interface AssetRef extends Asset {
  characterId: Id
}

export type ActivationMode = 'keyword' | 'semantic' | 'graph' | 'all' | 'none'

export interface KeywordRule {
  primary: string[]
  secondary: string[]
  combinator: 'AND' | 'OR' | 'AND_ANY' | 'NOT_ALL'
  caseSensitive: false | 'exact' | 'strict'
  wholeWord: boolean
  useRegex: boolean
}

export interface TimeWindowRule {
  sticky: boolean
  cooldownTurns?: number
  delayTurns?: number
  probability: number
  reinsert: 'after' | 'never' | 'afterText' | 'afterSeconds'
  reinsertSeconds?: number
}

export interface InjectionPlacement {
  position: 'beforeChar' | 'afterChar' | 'beforeExamples' | 'afterExamples' | 'beforeHistory' | 'afterHistory' | 'systemPrompt' | 'postHistoryInstructions'
  depth: number
  order: number
  force: boolean
}

export interface ActivationRules {
  mode: ActivationMode
  keyword: KeywordRule & { scanDepth?: number }
  time: TimeWindowRule
  injection: InjectionPlacement
  group?: { key: string; weight: number; groupOrder?: boolean }
}

export type KnowledgeEntryType = 'entity' | 'fact' | 'scene' | 'style' | 'misc'

export interface KnowledgeEntry {
  id: Id
  type: KnowledgeEntryType
  uid?: string
  enabled: boolean
  title?: string
  comment?: string
  content: string
  activation: ActivationRules
  relationTargets: Id[]
  prevSeq?: Id
  nextSeq?: Id
  importedFrom?: string
  unknownFields: UnknownRecord
}

export interface KnowledgeBase {
  id: Id
  name?: string
  entries: KnowledgeEntry[]
  vectorized: boolean
}

export interface MemoryEntry {
  id: Id
  kind: 'fact' | 'summary' | 'situation'
  subject?: string
  predicate?: string
  object?: string
  confidence?: number
  text: string
  sourceMessageIds: Id[]
  createdAt: IsoDate
}

/** 从底层消息数组引出固定 identity 的主键 hash */
export function messageKey(id: Id): string {
  return id
}

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function displayNameOfRole(role: MessageRole): string {
  switch (role) {
    case 'user':
      return 'user'
    case 'assistant':
      return 'assistant'
    case 'narrator':
      return 'narrator'
    case 'system':
      return 'system'
  }
}