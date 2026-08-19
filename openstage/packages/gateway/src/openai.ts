import type { TokenUsage, UnknownRecord } from '@openstage/contracts'

export interface Capability {
  supportsTools: boolean
  supportsVision: boolean
  contextWindow: number
  supportsCacheControl: boolean
  supportsReasoning: boolean
  model: string
  provider: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

export interface ProviderAdapter {
  readonly capabilities: Capability
  createChatRequest(opts: {
    system: string
    dialogue: Array<{ role: 'user' | 'assistant'; name?: string; content: string }>
    maxTokens?: number
  }): UnknownRecord
  complete(request: UnknownRecord): Promise<{ text: string; usage: TokenUsage | null }>
  stream?(request: UnknownRecord): AsyncIterable<ChatChunk>
}

export interface ChatChunk {
  kind: 'text' | 'reasoning' | 'tool_call' | 'usage' | 'done'
  text?: string
  name?: string
  arguments?: string
  usage?: TokenUsage
  error?: string
}

export const openaiCapabilities = (model: string): Capability => ({
  supportsTools: true,
  supportsVision: true,
  contextWindow: 200000,
  supportsCacheControl: false,
  supportsReasoning: model.includes('o3') || model.includes('o4') || model.includes('deepseek-r'),
  model,
  provider: 'openai-compatible',
})

export function createOpenAICompatibleAdapter(opts?: { model?: string; endpoint?: string; apiKey?: string; offline?: boolean }): ProviderAdapter {
  const model = opts?.model ?? 'gpt-4o-mini'
  const endpoint = opts?.endpoint ?? 'https://api.openai.com/v1/chat/completions'
  const apiKey = opts?.apiKey ?? process.env.OPENSTAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
  const offline = opts?.offline ?? !apiKey

  if (offline) {
    return createOfflineAdapter(model)
  }

  return {
    capabilities: openaiCapabilities(model),
    createChatRequest: (o) => ({
      model,
      messages: [
        ...(o.system.trim() ? [{ role: 'system', content: o.system }] : []),
        ...o.dialogue.map((m) => ({ role: m.role, name: m.name, content: m.content })),
      ],
      max_tokens: o.maxTokens ?? 1024,
      stream: false,
    }),
    async complete(request) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(request),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`provider ${res.status}: ${body.slice(0, 500)}`)
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: TokenUsage }
      const text = data.choices?.[0]?.message?.content ?? ''
      return { text, usage: data.usage ?? null }
    },
  }
}

function createOfflineAdapter(model: string): ProviderAdapter {
  const caps = openaiCapabilities(model)
  return {
    capabilities: caps,
    createChatRequest: (o) => ({
      model,
      messages: [
        ...(o.system.trim() ? [{ role: 'system', content: o.system }] : []),
        ...o.dialogue.map((m) => ({ role: m.role, name: m.name, content: m.content })),
      ],
      max_tokens: o.maxTokens ?? 1024,
    }),
    async complete(request) {
      const messages = ((request as { messages?: ChatMessage[] }).messages ?? []) as ChatMessage[]
      const last = messages[messages.length - 1]
      const text = last ? `(offline) ${last.role} said: ${last.content.slice(0, 80)}` : '(offline) no messages'
      return { text, usage: { input: 0, output: 0 } }
    },
  }
}