import type { KnowledgeEntry, MessageRole, PromptBlock, PromptBlockSpec, PromptPlan, QueryDetail, InjectionSlot } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { budgetDrop, estimateTokens } from './counting.js'
import { macroEval } from './macros.js'
import { presetToBlockSpecs } from './preset.js'
import { createWIState, rankEntries } from './world-info.js'

export interface DialogueLine {
  role: MessageRole
  name?: string
  content: string
}

export interface CompileInput {
  conversationId: string
  recipeId: string
  persona: string
  charName: string
  charDescription: string
  charPersonality: string
  scenario: string
  preset?: unknown
  knowledge: KnowledgeEntry[]
  examples?: string[]
  systemOverride?: string
  postHistoryInstructions?: string
  dialogue: DialogueLine[]
  budget: { contextTokens: number; reserveOutput: number }
  turn: number
  wi?:
    | {
        state?: Map<string, unknown>
        disabled?: boolean
      }
    | undefined
}

export interface CompileResult {
  plan: PromptPlan
  wiDropped: string[]
  systemText: string
  finalPrompt: string[]
  markdown: string
}

const MARKER_MAP: Record<string, InjectionSlot> = {
  personaDescription: 'systemPrompt',
  charDescription: 'beforeChar',
  scenario: 'beforeChar',
  charPersonality: 'beforeChar',
  charName: 'systemPrompt',
  mesExamples: 'beforeExamples',
  chatHistory: 'afterHistory',
  worldInfoBefore: 'beforeChar',
  worldInfoAfter: 'afterExamples',
  authorNote: 'afterHistory',
  system: 'systemPrompt',
  postHistoryInstructions: 'postHistoryInstructions',
}

export function compilePrompt(input: CompileInput): CompileResult {
  const budget = Math.max(0, input.budget.contextTokens - input.budget.reserveOutput)
  const macroVars: Record<string, unknown> = {
    char: input.charName,
    user: '用户',
    'user name': '用户',
    persona: input.persona,
    time: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
  }

  const makeBlock = (b: Omit<PromptBlock, 'id' | 'macroExpanded' | 'tokenCount'>): PromptBlock => {
    const { expanded, remaining } = macroEval(b.content, macroVars)
    const blk: PromptBlock = {
      ...b,
      id: uuid(),
      content: expanded,
      macroExpanded: true,
      tokenCount: estimateTokens(expanded),
    }
    if (remaining.length) blk.exclusionReason = (blk.exclusionReason ? blk.exclusionReason + '; ' : '') + `unresolved: ${remaining.join(', ')}`
    return blk
  }

  const blocks: PromptBlock[] = []
  const exposedSpecs = input.preset !== undefined ? presetToBlockSpecs(input.preset) : []

  // Preset-driven blocks (compat mode keeps ST ordering; marker → slot)
  for (const spec of exposedSpecs) {
    if (!spec.includedInPrompt) continue
    const slot = spec.marker ? MARKER_MAP[spec.marker] ?? (spec.injectionSlots[0] ?? 'systemPrompt') : (spec.injectionSlots[0] ?? 'systemPrompt')
    blocks.push(
      makeBlock({
        sourceRef: { kind: 'preset', id: spec.id, name: spec.id },
        stage: stageOfSlot(slot),
        role: spec.role,
        slot,
        content: spec.content,
        order: spec.injectionOrder,
        depth: spec.injectionDepth,
        included: true,
        inclusionReason: `preset:${spec.id}`,
      }),
    )
  }

  // System override
  if (input.systemOverride?.trim()) {
    blocks.push(
      makeBlock({
        sourceRef: { kind: 'recipe', id: input.recipeId, name: 'systemOverride' },
        stage: 'system',
        role: 'system',
        slot: 'systemPrompt',
        content: input.systemOverride,
        order: -100,
        depth: 0,
        included: true,
        inclusionReason: 'systemOverride',
      }),
    )
  }

  // Persona
  if (input.persona.trim()) {
    blocks.push(
      makeBlock({
        sourceRef: { kind: 'persona' },
        stage: 'system',
        role: 'system',
        slot: 'systemPrompt',
        content: input.persona,
        order: -90,
        depth: 0,
        included: true,
        inclusionReason: 'persona',
      }),
    )
  }

  // Identity
  const identityParts = [input.charDescription, input.charPersonality, input.scenario].filter((s) => s.trim().length > 0)
  if (identityParts.join('\n').trim()) {
    blocks.push(
      makeBlock({
        sourceRef: { kind: 'character', id: input.charName },
        stage: 'identity',
        role: 'system',
        slot: 'beforeChar',
        content: identityParts.join('\n'),
        order: 0,
        depth: 0,
        included: true,
        inclusionReason: 'identity',
      }),
    )
  }

  // World info activation
  const wiDropped: string[] = []
  const queries: QueryDetail[] = []
  const wiEnabled = input.wi?.disabled !== true
  let loreTokens = 0
  const loreBudget = Math.floor(budget * 0.1)
  if (wiEnabled) {
    const wiState = createWIState()
    const weighted: Record<string, number> = {}
    for (const e of input.knowledge) {
      const g = e.activation.group
      if (g?.key) {
        const cur = weighted[g.key] ?? 0
        if (g.weight > cur) weighted[g.key] = g.weight
      }
    }
    const dialogueTexts = input.dialogue.slice(-6).map((l) => `${l.name ? l.name + ': ' : ''}${l.content}`)
    const activated = rankEntries(input.knowledge, dialogueTexts, {
      turn: input.turn,
      state: wiState,
      weightedGroup: weighted,
    })
    for (const r of activated) {
      const slot = r.entry.activation.injection.position === 'afterExamples' ? 'afterExamples' : 'beforeChar'
      const content = r.entry.content
      const tokens = estimateTokens(content)
      const kept = tokens > loreBudget - loreTokens ? content.slice(0, 0) : content
      if (tokens > loreBudget - loreTokens) wiDropped.push(r.entry.uid ?? r.entry.title ?? r.entry.id)
      else loreTokens += tokens
      queries.push({ entryId: r.entry.id, title: r.entry.title, mode: 'keyword', matchedKeys: r.matchedKeys, score: r.score })
      blocks.push(
        makeBlock({
          sourceRef: { kind: 'world-info', id: r.entry.id, name: r.entry.title },
          stage: 'lore',
          role: 'system',
          slot,
          content: kept,
          order: r.entry.activation.injection.order,
          depth: r.entry.activation.injection.depth,
          included: tokens <= loreBudget - loreTokens && kept.length > 0,
          inclusionReason: tokens <= loreBudget - loreTokens && kept.length > 0 ? `WI:${r.entry.title ?? r.entry.uid ?? r.entry.id}` : undefined,
          exclusionReason: tokens > loreBudget - loreTokens ? 'budget' : undefined,
        }),
      )
    }
  }

  // Examples
  const exampleLimit = Math.floor(budget * 0.12)
  let exampleTokens = 0
  const exampleBlocks: PromptBlock[] = []
  for (const ex of input.examples ?? []) {
    const b = makeBlock({
      sourceRef: { kind: 'recipe', id: input.recipeId, name: 'examples' },
      stage: 'examples',
      role: 'system',
      slot: 'beforeExamples',
      content: ex,
      order: -50,
      depth: 0,
      included: exampleTokens + estimateTokens(ex) <= exampleLimit,
      inclusionReason: 'examples',
      exclusionReason: exampleTokens + estimateTokens(ex) > exampleLimit ? 'budget' : undefined,
    })
    if (b.included) exampleTokens += b.tokenCount
    exampleBlocks.push(b)
  }

  // History — volatile tail, kept within remaining budget
  const remainingBudget = budget - exampleTokens - loreTokens
  const historyBlocks: PromptBlock[] = []
  let histTokens = 0
  for (const line of input.dialogue) {
    const role = line.role === 'user' ? 'user' : 'assistant'
    const b = makeBlock({
      sourceRef: { kind: 'chat-history', name: line.name },
      stage: 'history',
      role,
      slot: 'afterHistory',
      content: `${line.name ? line.name + ': ' : ''}${line.content}`,
      order: 1000,
      depth: 0,
      included: histTokens + estimateTokens(line.content) <= remainingBudget,
      inclusionReason: 'history',
      exclusionReason: histTokens + estimateTokens(line.content) > remainingBudget ? 'budget' : undefined,
    })
    if (b.included) {
      histTokens += b.tokenCount
      historyBlocks.push(b)
    } else if (!b.included && histTokens === 0) {
      // first line exceeds budget: keep at least one
      b.included = true
      b.exclusionReason = undefined
      histTokens += b.tokenCount
      historyBlocks.push(b)
    }
  }

  // Post-history instructions
  if (input.postHistoryInstructions?.trim()) {
    blocks.push(
      makeBlock({
        sourceRef: { kind: 'character', id: input.charName, name: 'postHistory' },
        stage: 'post-history',
        role: 'system',
        slot: 'postHistoryInstructions',
        content: input.postHistoryInstructions,
        order: 100000,
        depth: 0,
        included: true,
        inclusionReason: 'postHistoryInstructions',
      }),
    )
  }

  const ordered: PromptBlock[] = [
    ...blocks.filter((b) => b.slot === 'systemPrompt'),
    ...blocks.filter((b) => b.slot === 'beforeChar'),
    ...exampleBlocks,
    ...blocks.filter((b) => b.slot === 'afterExamples'),
    ...historyBlocks,
    ...blocks.filter((b) => b.slot === 'postHistoryInstructions'),
  ]

  const plan: PromptPlan = {
    conversationId: input.conversationId,
    recipeId: input.recipeId || 'compat-st-default',
    mode: 'compat',
    stages: ['system', 'identity', 'lore', 'examples', 'history', 'post-history'],
    blocks: ordered,
    budget: [
      { stage: 'system', allotted: budget, used: blocks.filter((b) => b.stage === 'system').reduce((a, b) => a + b.tokenCount, 0), dropped: 0 },
      { stage: 'identity', allotted: budget, used: blocks.filter((b) => b.stage === 'identity').reduce((a, b) => a + b.tokenCount, 0), dropped: 0 },
      { stage: 'lore', allotted: loreBudget, used: loreTokens, dropped: wiDropped.length },
      { stage: 'examples', allotted: exampleLimit, used: exampleTokens, dropped: 0 },
      { stage: 'history', allotted: remainingBudget, used: histTokens, dropped: 0 },
    ],
    queries,
    cacheBreakpoints: [
      { slot: 'systemPrompt', reason: 'stable' },
      { slot: 'beforeChar', reason: 'semi-stable' },
      { slot: 'afterExamples', reason: 'semi-stable' },
      { slot: 'afterHistory', reason: 'volatile' },
    ],
    createdAt: new Date().toISOString(),
    preset: (input.preset ?? {}) as Record<string, unknown>,
    warnings: wiDropped.length ? [`${wiDropped.length} WI entries dropped for budget`] : [],
  }

  const finalPrompt = ordered.filter((b) => b.included).map((b) => b.content)
  const markdown = ordered.map((b) => [`\`\`\`text`, b.content, '\`\`\`'].join('\n')).join('\n\n')
  const systemText = ordered.filter((b) => b.stage === 'system' && b.included).map((b) => b.content).join('\n')

  return { plan, wiDropped, systemText, finalPrompt, markdown }
}

function stageOfSlot(slot: InjectionSlot): PromptBlock['stage'] {
  switch (slot) {
    case 'systemPrompt': return 'system'
    case 'beforeChar':
    case 'afterChar': return 'identity'
    case 'beforeExamples':
    case 'afterExamples': return 'examples'
    case 'beforeHistory':
    case 'inHistory':
    case 'afterHistory': return 'history'
    case 'postHistoryInstructions': return 'post-history'
    default: return 'system'
  }
}

export { estimateTokens }