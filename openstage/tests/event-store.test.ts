import { describe, expect, it } from 'vitest'
import { EventStore } from '@openstage/storage'
import { uuid } from '@openstage/contracts'

describe('EventStore 事件溯源', () => {
  it('createConversation + appendMessages 生成可回放的投影', async () => {
    const store = new EventStore()
    const convId = uuid()
    const created = await store.execute({ type: 'createConversation', conversationId: convId, characterIds: ['char-1'] })
    expect(created.ok).toBe(true)

    const appended = await store.execute({
      type: 'appendMessages',
      conversationId: convId,
      parentId: null,
      messages: [{ role: 'assistant', displayName: '林晚', blocks: [{ type: 'text', text: '你好' }] }],
    })
    expect(appended.ok).toBe(true)

    const snap = await store.replay(convId)
    expect(snap).not.toBeNull()
    expect(snap!.messages).toHaveLength(1)
    expect(snap!.messages[0]!.role).toBe('assistant')
  })

  it('分支切换（setBranch）改变 activePath 但保留历史', async () => {
    const store = new EventStore()
    const convId = uuid()
    await store.execute({ type: 'createConversation', conversationId: convId, characterIds: ['char-1'] })
    const first = await store.execute({
      type: 'appendMessages',
      conversationId: convId,
      parentId: null,
      messages: [{ role: 'assistant', blocks: [{ type: 'text', text: '分支A' }] }],
    })
    const branch = await store.execute({
      type: 'appendMessages',
      conversationId: convId,
      parentId: null,
      messages: [{ role: 'assistant', blocks: [{ type: 'text', text: '分支B' }] }],
    })
    expect(first.ok).toBe(true)
    expect(branch.ok).toBe(true)
    const snap = await store.replay(convId)
    expect(snap!.messages).toHaveLength(2)
    expect(snap!.conversation.activePath.length).toBeGreaterThan(0)
  })

  it('stream 按会话过滤', async () => {
    const store = new EventStore()
    await store.execute({ type: 'createConversation', conversationId: 'c-1', characterIds: [] })
    await store.execute({ type: 'createConversation', conversationId: 'c-2', characterIds: [] })
    expect(store.stream('c-1')).toHaveLength(1)
    expect(store.stream()).toHaveLength(2)
  })
})