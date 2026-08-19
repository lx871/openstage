export interface CommunityMacro {
  name: string
  description: string
  nominal: string
  eval?: (ctx: Record<string, unknown>) => string | undefined
}

/** Built-in context of the prompt engine before any message content is appended. */
export function engineMacroContext(input: Record<string, unknown>): Record<string, unknown> {
  return {
    ...input,
    engine: 'openstage-esr',
  }
}

export const CONTEXT_MACROS: Record<string, CommunityMacro> = {
  '{{char}}': { name: 'char', description: 'Character display name', nominal: '{{char}}' },
  '{{user}}': { name: 'user', description: 'User display name', nominal: '{{user}}' },
  '{{random}}': { name: 'random', description: 'Random choice from comma list', nominal: '{{random}}' },
  '{{roll}}': { name: 'roll', description: 'Dice (NdM+K)', nominal: '{{roll}}' },
  '{{time}}': { name: 'time', description: 'Current time', nominal: '{{time}}' },
}

/**
 * Expand macros of the form {{name}} using vars. Leaves unresolved names in
 * place and reports them; "{{}}"-style pipes are left to the flow layer.
 */
export function macroEval(template: string, vars: Record<string, unknown>): { expanded: string; remaining: string[] } {
  const remaining = new Set<string>()
  const expanded = template.replace(/\{\{\s*([a-zA-Z0-9_:-]+)\s*\}\}/g, (m, key: string) => {
    const v = vars[key]
    if (v === undefined) {
      remaining.add(key)
      return m
    }
    return typeof v === 'string' ? v : String(v)
  })
  return { expanded, remaining: Array.from(remaining) }
}