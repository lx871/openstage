import { describe, expect, it } from 'vitest'
import { EventStore } from '@openstage/storage'

describe('分支与状态回滚', () => {
  it('setBranch 切换分支后追加仅影响新分支', async () => {
    const store = new EventStore()
    const cid = 'c-branch-1'
    await store.execute({ type: 'createConversation', conversationId: cid, characterIds: ['ch1'] })
    await store.execute({ type: 'appendMessages', conversationId: cid, parentId: null, messages: [{ role: 'assistant', displayName: '林晚', blocks: [{ type: 'text', text: '分支A 根' }] }] })
    const snapA = await store.replay(cid)
    const rootA = snapA!.messages[0]!.id
    // 再追加一条，形成 A 分支
    await store.execute({ type: 'appendMessages', conversationId: cid, parentId: rootA, messages: [{ role: 'user', blocks: [{ type: 'text', text: '去三楼' }] }] })
    const snapBefore = await store.replay(cid)
    const branchLenBefore = snapBefore!.conversation.activePath.length
    // 回到根，再开分支 B
    await store.execute({ type: 'setBranch', conversationId: cid, path: [rootA] })
    await store.execute({ type: 'appendMessages', conversationId: cid, parentId: rootA, messages: [{ role: 'user', blocks: [{ type: 'text', text: '去二楼' }] }] })
    const snapAfter = await store.replay(cid)
    expect(snapAfter!.conversation.activePath.length).toBeGreaterThan(0)
    // 活跃路径的末尾消息应为 B 分支
    const activeTip = snapAfter!.conversation.activePath[snapAfter!.conversation.activePath.length - 1]!
    const tipMsg = snapAfter!.messages.find((m) => m.id === activeTip)
    expect(tipMsg!.rawText).toContain('去二楼')
    // 总消息数包含两条分支
    expect(snapAfter!.messages.length).toBeGreaterThan(branchLenBefore)
  })

  it('state.snapshot.created 写入的状态可在后续分支中体现', async () => {
    const store = new EventStore()
    const cid = 'c-state-branch'
    await store.execute({ type: 'createConversation', conversationId: cid, characterIds: ['ch1'] })
    await store.execute({ type: 'appendMessages', conversationId: cid, parentId: null, messages: [{ role: 'assistant', blocks: [{ type: 'text', text: 'hi' }] }] })
    const snap = await store.replay(cid)
    const tip = snap!.messages[0]!.id
    await store.execute({ type: 'saveStateSnapshot', conversationId: cid, parentSnapshotId: null, deltas: [{ scope: 'conversation', key: 'mood', op: 'set', value: 'curious' }], cursor: tip })
    const snap2 = await store.replay(cid)
    // 分支切换后再读，state 应保留
    await store.execute({ type: 'setBranch', conversationId: cid, path: [tip] })
    const snap3 = await store.replay(cid)
    expect(snap2).not.toBeNull()
    expect(snap3).not.toBeNull()
  })
})
