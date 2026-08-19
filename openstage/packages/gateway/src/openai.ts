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
  completeWithRetry?(request: UnknownRecord, opts?: { retries?: number; signal?: AbortSignal }): Promise<{ text: string; usage: TokenUsage | null }>
  stream(request: UnknownRecord, opts?: { signal?: AbortSignal }): AsyncIterable<ChatChunk>
  cancel?(generationId: string): Promise<void>
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

export interface AdapterOptions {
  model?: string
  endpoint?: string
  apiKey?: string
  offline?: boolean
}

export function createOpenAICompatibleAdapter(opts?: AdapterOptions): ProviderAdapter {
  const model = opts?.model ?? 'gpt-4o-mini'
  const endpoint = opts?.endpoint ?? 'https://api.openai.com/v1/chat/completions'
  const apiKey = opts?.apiKey ?? process.env.OPENSTAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
  const offline = opts?.offline ?? !apiKey

  if (offline) return createOfflineAdapter(model)

  const doComplete = async (request: UnknownRecord, signal?: AbortSignal): Promise<{ text: string; usage: TokenUsage | null }> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(request),
      signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const retryable = res.status === 429 || res.status >= 500
      const err = new Error(`provider ${res.status}: ${body.slice(0, 600)}`) as Error & { status?: number; retryable?: boolean }
      err.status = res.status
      err.retryable = retryable
      throw err
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: TokenUsage }
    const text = data.choices?.[0]?.message?.content ?? ''
    return { text, usage: data.usage ?? null }
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
    complete: doComplete,
    async completeWithRetry(request, o) {
      const retries = o?.retries ?? 2
      let last: Error | undefined
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (o?.signal?.aborted) throw Object.assign(new Error('abort'), { name: 'AbortError' })
        try {
          return await doComplete(request, o?.signal)
        } catch (err) {
          last = err as Error
          const retryable = (err as { retryable?: boolean }).retryable === true
          if (!retryable || attempt === retries) throw err
          const backoff = Math.min(2000, 200 * 2 ** attempt) + Math.random() * 80
          await new Promise<void>((r) => setTimeout(r, backoff))
        }
      }
      throw last
    },
    async *stream(request, opts) {
      const payload = { ...(request as Record<string, unknown>), stream: true }
      let res: Response
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Accept: 'text/event-stream' },
          body: JSON.stringify(payload),
          signal: opts?.signal,
        })
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        throw err
      }
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '')
        throw new Error(`provider ${res.status}: ${body.slice(0, 600)}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          if (opts?.signal?.aborted) {
            try { await reader.cancel() } catch {}
            return
          }
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            const line = part.replace(/^\s*data:\s*/, '').trim()
            if (!line || line === '[DONE]') {
              if (line === '[DONE]') {
                yield { kind: 'done' as const }
                return
              }
              continue
            }
            try {
              const chunk = JSON.parse(line) as {
                choices?: Array<{ delta?: { content?: string; reasoning_content?: string }; finish_reason?: unknown }>
                usage?: TokenUsage
              }
              const content = chunk.choices?.[0]?.delta?.content
              const reasoning = chunk.choices?.[0]?.delta?.reasoning_content
              if (reasoning) yield { kind: 'reasoning', text: reasoning }
              if (content) yield { kind: 'text', text: content }
              if (chunk.usage) yield { kind: 'usage', usage: chunk.usage }
              if (chunk.choices?.[0]?.finish_reason !== undefined && chunk.choices?.[0]?.finish_reason !== null) {
                yield { kind: 'done' }
              }
            } catch {}
          }
        }
        if (buffer.trim()) {
          const line = buffer.replace(/^\s*data:\s*/, '').trim()
          if (line && line !== '[DONE]') {
            try {
              const chunk = JSON.parse(line) as { choices?: Array<{ delta?: { content?: string } }>; usage?: TokenUsage }
              const c = chunk.choices?.[0]?.delta?.content
              if (c) yield { kind: 'text', text: c }
              if (chunk.usage) yield { kind: 'usage', usage: chunk.usage }
            } catch {}
          }
        }
        yield { kind: 'done' }
      } finally {
        try { await reader.cancel() } catch {}
      }
    },
    async cancel() {},
  }
}

function createOfflineAdapter(model: string): ProviderAdapter {
  const caps = openaiCapabilities(model)
  let cancelled = new Set<string>()
  const makeChunks = (content: string): ChatChunk[] => {
    const segs: ChatChunk[] = []
    const words = content.split(/(\s+)/)
    for (const w of words) if (w) segs.push({ kind: 'text', text: w })
    segs.push({ kind: 'done' })
    return segs
  }
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
    async completeWithRetry(request, o) {
      if (o?.signal?.aborted) throw Object.assign(new Error('abort'), { name: 'AbortError' })
      const messages = ((request as { messages?: ChatMessage[] }).messages ?? []) as ChatMessage[]
      const last = messages[messages.length - 1]
      const text = last ? `(offline) ${last.role} said: ${last.content.slice(0, 80)}` : '(offline) no messages'
      return { text, usage: { input: 0, output: 0 } }
    },
    async *stream(request, opts) {
      const messages = ((request as { messages?: ChatMessage[] }).messages ?? []) as ChatMessage[]
      const last = messages[messages.length - 1]
      const text = last ? `(offline) ${last.role} said: ${last.content.slice(0, 80)}` : '(offline) no messages'
      for (const c of makeChunks(text)) {
        if (opts?.signal?.aborted) return
        yield c
        await new Promise<void>((r) => setTimeout(r, 3))
      }
    },
    async cancel(generationId) { cancelled.add(generationId) },
  }
}
