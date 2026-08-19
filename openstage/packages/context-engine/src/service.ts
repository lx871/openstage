import type { Block, Character, Command, CommandResult, KnowledgeEntry, UnknownRecord } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import type { EventStore, KnowledgeRepo, SqliteEventStore } from '@openstage/storage'
import { entriesForCharacter } from '@openstage/storage'
import { compilePrompt, type CompileInput, type DialogueLine } from '@openstage/context-engine'

export interface ConversationServiceDeps {
  store: EventStore | SqliteEventStore
  knowledge: KnowledgeRepo
  characters: Map<string, Character>
  defaultCharName?: string
}

export interface CreateConversationInput {
  characterId: string
  greeting?: string
  preset?: unknown
  person?: string
  contextTokens?: number
  reserveOutput?: number
  conversationId?: string
}

export interface SendInput {
  conversationId: string
  content: string
  preset?: unknown
  systemOverride?: string
  postHistoryInstructions?: string
  contextTokens?: number
  reserveOutput?: number
}

export interface GenerateResponse {
  ok: boolean
  block?: Block
  trace?: ReturnType<typeof compilePrompt>['plan']
  usage?: UnknownRecord
  error?: string
}

export class ConversationService {
  constructor(private deps: ConversationServiceDeps) {}

  getStore() {
    return this.deps.store
  }

  async create(input: CreateConversationInput): Promise<CommandResult> {
    const conversationId = input.conversationId ?? uuid()
    const result = await this.deps.store.execute({
      type: 'createConversation',
      conversationId,
      characterIds: [input.characterId],
    })
    return result
  }

  async greeting(conversationId: string): Promise<string> {
    const snap = await this.deps.store.replay(conversationId)
    const charId = snap?.conversation.characterIds[0]
    const character = charId ? this.deps.characters.get(charId) : undefined
    return character?.presentation.guide.greetingCandidates[0]?.text() ?? `你好，我是${character?.identity.name ?? '角色'}。`
  }

  async append(conversationId: string, role: 'user' | 'assistant', text: string, name?: string): Promise<CommandResult> {
    const snap = await this.deps.store.replay(conversationId)
    const tip = snipTip(snap?.messages ?? [], snap?.conversation.activePath ?? [])
    return this.deps.store.execute({
      type: 'appendMessages',
      conversationId,
      parentId: tip,
      messages: [{ role, displayName: name, blocks: [{ type: 'text', text }], metaTrigger: 'normal' }],
    })
  }

  async send(input: SendInput): Promise<GenerateResponse> {
    const snap = await this.deps.store.replay(input.conversationId)
    const charId = snap?.conversation.characterIds[0]
    const character = charId ? this.deps.characters.get(charId) : undefined
    if (!character) return { ok: false, error: `character not found: ${charId}` }

    const dialogue = await this.buildDialogue(input.conversationId)
    const knowledge = entriesForCharacter(this.deps.knowledge, character)
    const compiled = this.compile({
      conversationId: input.conversationId,
      character,
      knowledge,
      dialogue,
      preset: input.preset,
      systemOverride: input.systemOverride,
      postHistoryInstructions: input.postHistoryInstructions,
      contextTokens: input.contextTokens,
      reserveOutput: input.reserveOutput,
    })

    // P0 offline gateway: deterministic reflective reply before wiring real HTTP.
    const lastUser = [...dialogue].reverse().find((l) => l.role === 'user')
    const reply = `（${character.identity.name} 收到：${lastUser?.content.slice(0, 60) ?? ''}）${character.presentation.guide.exampleMessages[0] ?? ''}`.trim()
    return { ok: true, block: { type: 'text', text: reply || `（${character.identity.name} 没有应答。）` }, trace: compiled.plan, usage: { prompt: compiled.plan.blocks.filter((b) => b.included).reduce((a, b) => a + b.tokenCount, 0) } }
  }

  async buildDialogue(conversationId: string): Promise<DialogueLine[]> {
    const snap = await this.deps.store.replay(conversationId)
    if (!snap) return []
    const active = new Set([...(snap.conversation.activePath ?? []), ...(snap.messages.filter((m) => m.parentId === null).map((m) => m.id))])
    const pathOrder = new Map(snap.conversation.activePath.map((id, i) => [id, i]))
    return snap.messages
      .filter((m) => active.has(m.id))
      .sort((a, b) => {
        const ai = pathOrder.get(a.id) ?? 100000
        const bi = pathOrder.get(b.id) ?? 100000
        return ai - bi
      })
      .map((m) => ({
        role: m.role === 'system' ? 'narrator' : m.role,
        name: m.displayName,
        content: m.rawText ?? m.contentBlocks?.map((b) => (b.type === 'text' ? b.text : '')).join('') ?? '',
      }))
      .filter((l) => l.content.length > 0)
  }

  private compile(o: {
    conversationId: string
    character: Character
    knowledge: KnowledgeEntry[]
    dialogue: DialogueLine[]
    preset?: unknown
    systemOverride?: string
    postHistoryInstructions?: string
    contextTokens?: number
    reserveOutput?: number
  }): ReturnType<typeof compilePrompt> {
    const input: CompileInput = {
      conversationId: o.conversationId,
      recipeId: 'compat-st-default',
      persona: 'user',
      charName: o.character.identity.name,
      charDescription: o.character.identity.description,
      charPersonality: o.character.identity.personality,
      scenario: o.character.identity.scenario,
      preset: o.preset,
      knowledge: o.knowledge,
      examples: o.character.presentation.guide.exampleMessages,
      systemOverride: o.systemOverride ?? o.character.behavior.systemOverrides['system_prompt'],
      postHistoryInstructions: o.postHistoryInstructions ?? o.character.behavior.systemOverrides['post_history_instructions'],
      dialogue: o.dialogue,
      budget: { contextTokens: o.contextTokens ?? 8000, reserveOutput: o.reserveOutput ?? 1024 },
      turn: o.dialogue.length,
    }
    return compilePrompt(input)
  }
}

/** Resolve the tip message id for the next append: last node on the active path. */
function snipTip(messages: Array<{ id: string; parentId: string | null }>, activePath: string[]): string | null {
  if (activePath.length) {
    const last = activePath[activePath.length - 1] ?? null
    if (last !== null && messages.some((m) => m.id === last)) return last
  }
  const roots = messages.filter((m) => m.parentId === null)
  for (const r of roots) {
    if (activePath.length === 0 || activePath[activePath.length - 1] === r.id) return r.id
  }
  return null
}

export { uuid }