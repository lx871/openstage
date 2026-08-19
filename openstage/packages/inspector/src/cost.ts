import type { PromptPlan } from '@openstage/contracts'

export interface CostEstimate {
  inputTokens: number
  outputReserve: number
  cachedPrefixTokens: number
  effectiveInputTokens: number
}

export function estimatePlanCost(plan: PromptPlan): CostEstimate {
  const inputTokens = plan.blocks.filter((b) => b.included).reduce((a, b) => a + b.tokenCount, 0)
  const cachedPrefixTokens = plan.blocks
    .filter((b) => b.included && (b.slot === 'systemPrompt' || b.slot === 'beforeChar'))
    .reduce((a, b) => a + b.tokenCount, 0)
  const hist = plan.budget.find((b) => b.stage === 'history')
  const outputReserve = hist ? Math.max(0, hist.allotted - hist.used) : 0
  return {
    inputTokens,
    outputReserve,
    cachedPrefixTokens,
    effectiveInputTokens: inputTokens,
  }
}
