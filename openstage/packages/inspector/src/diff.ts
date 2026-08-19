import type { PromptPlan, PromptBlock } from '@openstage/contracts'

export interface PlanDiff {
  fromId?: string
  toId: string
  added: PromptBlock[]
  removed: PromptBlock[]
  moved: Array<{ blockId: string; from: number; to: number }>
  renamed: Array<{ id: string; field: 'included' | 'slot' | 'tokenCount'; before: unknown; after: unknown }>
}

function keyOf(block: PromptBlock): string {
  const src = block.sourceRef
  return `${src.kind}:${src.id ?? src.name ?? block.id}`
}

export function diffPlans(prev: PromptPlan | null, next: PromptPlan): PlanDiff {
  const prevMap = new Map(prev ? prev.blocks.map((b) => [keyOf(b), b] as const) : [])
  const nextMap = new Map(next.blocks.map((b) => [keyOf(b), b] as const))
  const added: PromptBlock[] = []
  const removed: PromptBlock[] = []
  const moved: PlanDiff['moved'] = []
  const renamed: PlanDiff['renamed'] = []

  for (const [k, b] of nextMap) if (!prevMap.has(k)) added.push(b)
  for (const [k, b] of prevMap) if (!nextMap.has(k)) removed.push(b)

  if (prev) {
    const prevOrder = new Map(prev.blocks.map((b, i) => [keyOf(b), i] as const))
    const nextOrder = new Map(next.blocks.map((b, i) => [keyOf(b), i] as const))
    for (const k of nextMap.keys()) {
      if (!prevMap.has(k)) continue
      const from = prevOrder.get(k)!
      const to = nextOrder.get(k)!
      if (from !== to) moved.push({ blockId: k, from, to })
      const a = prevMap.get(k)!
      const c = nextMap.get(k)!
      if (a.included !== c.included) renamed.push({ id: k, field: 'included', before: a.included, after: c.included })
      if (a.slot !== c.slot) renamed.push({ id: k, field: 'slot', before: a.slot, after: c.slot })
      if (a.tokenCount !== c.tokenCount) renamed.push({ id: k, field: 'tokenCount', before: a.tokenCount, after: c.tokenCount })
    }
  }

  return { fromId: prev?.conversationId, toId: next.conversationId, added, removed, moved, renamed }
}
