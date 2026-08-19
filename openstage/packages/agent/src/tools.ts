import type { ScopedState } from '@openstage/contracts'

export interface ToolSpec {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult> | ToolResult
}

export interface ToolContext {
  state: ScopedState
  conversationId: string
  messageId?: string
}

export interface ToolResult {
  ok: boolean
  output?: unknown
  error?: string
}

export function statePatchTool(): ToolSpec {
  return {
    name: 'state.patch',
    description: 'Patch scoped state (global/character/conversation). Replaces {{setvar}} regex hacks.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['global', 'character', 'conversation'] },
        key: { type: 'string' },
        op: { type: 'string', enum: ['set', 'unset', 'increment', 'append'] },
        value: {},
      },
      required: ['scope', 'key', 'op'],
    },
    handler(input, ctx) {
      const scope = input['scope'] as 'global' | 'character' | 'conversation'
      const key = String(input['key'] ?? '')
      const op = (input['op'] as string) ?? 'set'
      const value = input['value']
      if (!key) return { ok: false, error: 'key is required' }
      const target = ctx.state[scope] as Record<string, unknown>
      if (op === 'set') target[key] = value
      else if (op === 'unset') delete target[key]
      else if (op === 'increment') {
        const cur = typeof target[key] === 'number' ? (target[key] as number) : 0
        target[key] = cur + (typeof value === 'number' ? value : 1)
      } else if (op === 'append') {
        const arr = Array.isArray(target[key]) ? (target[key] as unknown[]) : []
        target[key] = [...arr, value]
      }
      return { ok: true, output: { scope, key, value: target[key] } }
    },
  }
}

export function memoryRememberTool(): ToolSpec {
  return {
    name: 'memory.remember',
    description: 'Persist a fact into semantic memory with source message refs.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        subject: { type: 'string' },
        predicate: { type: 'string' },
        object: { type: 'string' },
        confidence: { type: 'number' },
        tier: { type: 'string', enum: ['semantic', 'episodic', 'working'] },
      },
      required: ['text'],
    },
    handler(input) {
      if (!input['text']) return { ok: false, error: 'text is required' }
      return { ok: true, output: { text: input['text'], subject: input['subject'], tier: input['tier'] ?? 'semantic' } }
    },
  }
}

export function diceTool(): ToolSpec {
  return {
    name: 'dice.roll',
    description: 'Roll NdM dice (e.g. 1d20).',
    inputSchema: {
      type: 'object',
      properties: { spec: { type: 'string' } },
      required: ['spec'],
    },
    handler(input) {
      const spec = String(input['spec'] ?? '1d6')
      const m = spec.match(/^(\d+)d(\d+)([+-]\d+)?$/i)
      if (!m) return { ok: false, error: `invalid dice spec: ${spec}` }
      const n = Number(m[1]), sides = Number(m[2]), mod = m[3] ? Number(m[3]) : 0
      let total = mod
      const rolls: number[] = []
      for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * sides); rolls.push(r); total += r }
      return { ok: true, output: { spec, rolls, total } }
    },
  }
}

export function builtinTools(): ToolSpec[] {
  return [statePatchTool(), memoryRememberTool(), diceTool()]
}
