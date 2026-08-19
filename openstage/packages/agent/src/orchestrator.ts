import type { ToolSpec, ToolResult } from './tools.js'
import { builtinTools } from './tools.js'

export interface TurnPlan {
  registerTools(tools: ToolSpec[]): void
  callTool(name: string, input: Record<string, unknown>, ctx: Parameters<ToolSpec['handler']>[1]): Promise<ToolResult>
  listTools(): ToolSpec[]
}

export function createRuntime(extra: ToolSpec[] = []): TurnPlan {
  const map = new Map<string, ToolSpec>()
  for (const t of [...builtinTools(), ...extra]) map.set(t.name, t)
  return {
    registerTools(tools) { for (const t of tools) map.set(t.name, t) },
    async callTool(name, input, ctx) {
      const spec = map.get(name)
      if (!spec) return { ok: false, error: `unknown tool: ${name}` }
      return spec.handler(input, ctx)
    },
    listTools() { return [...map.values()] },
  }
}
