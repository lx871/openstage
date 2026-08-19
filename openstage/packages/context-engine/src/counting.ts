/** Deterministic token estimator: latin ~1 token/4 chars, CJK ~1 token/1.3 chars. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  let latin = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3040 && code <= 0x30ff)) cjk++
    else latin++
  }
  return Math.ceil(latin / 4 + cjk / 1.3)
}

export type TokenEstimator = typeof estimateTokens

export function budgetDrop(payload: string, maxTokens: number, est: TokenEstimator = estimateTokens): { kept: string; dropped: number; droppedTokens: number } {
  const full = est(payload)
  if (full <= maxTokens) return { kept: payload, dropped: 0, droppedTokens: 0 }
  const ratio = maxTokens / full
  const limit = Math.max(0, Math.min(payload.length, Math.floor(payload.length * ratio)))
  const kept = payload.slice(0, limit)
  return { kept, dropped: 1, droppedTokens: full - est(kept) }
}

export function stableKey(input: { role: string; content: string; order: number }): string {
  return `${input.role}|${input.content}|${input.order}`
}