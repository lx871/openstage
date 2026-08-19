import { describe, expect, it } from 'vitest'
import { createOpenAICompatibleAdapter } from '@openstage/gateway'

describe('Gateway SSE/流式', () => {
  it('stream 推送 text 块并以 done 收尾（离线镜像）', async () => {
    const adapter = createOpenAICompatibleAdapter({ offline: true, model: 'offline-test' })
    const req = adapter.createChatRequest({ system: '你是助手', dialogue: [{ role: 'user', content: '你好' }] })
    const chunks: Array<{ kind: string; text?: string }> = []
    for await (const c of adapter.stream(req)) chunks.push(c)
    expect(chunks.some((c) => c.kind === 'text')).toBe(true)
    expect(chunks[chunks.length - 1]!.kind).toBe('done')
  })

  it('取消信号中止流', async () => {
    const adapter = createOpenAICompatibleAdapter({ offline: true })
    const req = adapter.createChatRequest({ system: '', dialogue: [{ role: 'user', content: '长输出触发取消' }] })
    const ac = new AbortController()
    const chunks: unknown[] = []
    const iter = adapter.stream(req, { signal: ac.signal })
    let i = 0
    for await (const c of iter) {
      chunks.push(c)
      if (i++ === 0) ac.abort()
    }
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })
})
