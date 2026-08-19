import type { ConversationSnapshot, DomainEvent, MessageRecord, ScopedState } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { ContentPart } from './content.js'
import { cloneState, emptyScopedState, toFullSnapshot } from './state.js'
import { createMessageTree, appendMessagesToTree, setBranchInTree, type MessageTreeState } from './tree.js'

export interface ProjectionState {
  conversationId: string
  characterIds: string[]
  tree: MessageTreeState
  currentSnapshotId: string
  snapshots: Map<string, ScopedState>
}

export function createProjection(conversationId: string): ProjectionState {
  const tree = createMessageTree()
  const snap = toFullSnapshot(emptyScopedState(), null)
  tree.stateSnapshots.set(snap.id, snap)
  return {
    conversationId,
    characterIds: [],
    tree,
    currentSnapshotId: snap.id,
    snapshots: new Map([[snap.id, emptyScopedState()]]),
  }
}

function scopedOf(tree: MessageTreeState): ScopedState {
  return cloneState(tree.state)
}

export function applyEvent(p: ProjectionState, e: DomainEvent): ProjectionState {
  const d = e.data as Record<string, unknown>
  switch (e.kind) {
    case 'message.created': {
      const result = appendNodeForEvent(p, e)
      if (result && result.stateSnapshotId) p.snapshots.set(result.stateSnapshotId, scopedOf(result.tree ?? p.tree))
      if (result?.stateSnapshotId) p.currentSnapshotId = result.stateSnapshotId
      break
    }
    case 'branch.path.changed': {
      const path = Array.isArray(d['path']) ? (d['path'] as string[]) : []
      const result = setBranchInTree(p.tree, path)
      if (result.newActivePath) p.tree.activePath = result.newActivePath
      p.tree.state = result.state ? cloneState(result.state) : p.tree.state
      if (result.stateSnapshotId) {
        p.snapshots.set(e.id, cloneState(result.state ?? p.tree.state))
        p.currentSnapshotId = e.id
      }
      p.snapshots.set(e.id, cloneState(p.snapshots.get(result.stateSnapshotId!) ?? p.tree.state))
      break
    }
    case 'state.snapshot.created': {
      const deltas = d['deltas']
      const cursor = d['cursor'] as string | null | undefined
      if (Array.isArray(deltas) && deltas.length) {
        for (const item of deltas as Array<{ scope?: string; key?: string; op?: string; value?: unknown; opId?: string }>) {
          const scope = item.scope as ScopedState extends infer _ ? 'global' | 'character' | 'conversation' : never
          const key = item.key ?? ''
          const op = (item.op ?? 'set') as 'set' | 'unset' | 'increment' | 'append'
          const target = p.tree.state[scope as keyof ScopedState] as Record<string, unknown>
          if (op === 'set') target[key] = item.value
          else if (op === 'unset') delete target[key]
          else if (op === 'increment') {
            const cur = typeof target[key] === 'number' ? (target[key] as number) : 0
            target[key] = cur + (typeof item.value === 'number' ? item.value : 1)
          } else if (op === 'append') {
            const arr = Array.isArray(target[key]) ? (target[key] as unknown[]) : []
            target[key] = [...arr, item.value]
          }
        }
        if (cursor && p.tree.messages.get(cursor)) {
          const fresh = toFullSnapshot(p.tree.state, cursor)
          p.tree.stateSnapshots.set(fresh.id, fresh)
          p.tree.messages.get(cursor)!.stateSnapshotId = fresh.id
          p.snapshots.set(fresh.id, cloneState(p.tree.state))
          p.currentSnapshotId = fresh.id
        } else {
          p.snapshots.set(e.id, cloneState(p.tree.state))
          p.currentSnapshotId = e.id
        }
      } else {
        const scopes = d['scopes']
        if (scopes && typeof scopes === 'object') {
          const s = scopes as ScopedState
          p.tree.state = cloneState(s)
          p.snapshots.set(e.id, cloneState(s))
        } else {
          p.snapshots.set(e.id, cloneState(p.tree.state))
        }
        p.currentSnapshotId = e.id
      }
      break
    }
    case 'conversation.created': {
      const ids = d['characterIds']
      if (Array.isArray(ids)) p.characterIds = ids.map((x) => String(x))
      break
    }
  }
  return p
}

function appendNodeForEvent(p: ProjectionState, e: DomainEvent): (ReturnType<typeof appendMessagesToTree> & { tree: MessageTreeState }) | null {
  const d = e.data as Record<string, unknown>
  const result = appendMessagesToTree(p.tree, {
    conversationId: p.conversationId,
    parentId: (d['parentId'] ?? null) as string | null,
    messages: [
      {
        id: d['messageId'] as string | undefined,
        role: d['role'] as 'user' | 'assistant' | 'system' | 'narrator',
        speakerId: d['speakerId'] as string | undefined,
        displayName: d['displayName'] as string | undefined,
        blocks: d['blocks'] as import('@openstage/contracts').Block[],
        metaTrigger: d['metaTrigger'] as 'normal' | 'continue' | 'swipe' | 'regenerate' | 'import' | undefined,
        at: d['at'] as string | undefined,
      },
    ],
  })
  return result as unknown as ReturnType<typeof appendMessagesToTree> & { tree: MessageTreeState }
}

export function projectStream(id: string, events: DomainEvent[]): ProjectionState {
  const p = createProjection(id)
  for (const e of events) applyEvent(p, e)
  return p
}

export function projectionToSnapshotLike(p: ProjectionState): ConversationSnapshot {
  const messages: MessageRecord[] = []
  for (const [, node] of p.tree.messages) {
    messages.push({
      id: node.id,
      conversationId: node.conversationId,
      parentId: node.parentId,
      role: node.role,
      speakerId: node.speakerId,
      displayName: node.displayName,
      contentBlocks: node.content.textBlocks,
      rawText: node.content.rawText(),
      meta: node.meta,
      visibility: node.visibility,
      children: node.children,
      alternateIds: node.alternateIds,
      stateSnapshotId: node.stateSnapshotId,
    })
  }
  return {
    conversation: {
      id: p.conversationId,
      characterIds: p.characterIds,
      roots: p.tree.roots,
      activePath: p.tree.activePath,
      stateSnapshotId: p.currentSnapshotId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    messages,
  }
}

export function snapshotMessagesToTree(snap: ConversationSnapshot): MessageTreeState {
  const tree = createMessageTree()
  for (const m of snap.messages) {
    tree.messages.set(m.id, {
      id: m.id,
      conversationId: m.conversationId ?? snap.conversation.id,
      parentId: m.parentId,
      role: m.role,
      speakerId: m.speakerId,
      displayName: m.displayName,
      content: ContentPart.fromBlocks((m.contentBlocks ?? []) as import('@openstage/contracts').Block[]),
      visibility: m.visibility ?? 'prompt',
      meta: m.meta
        ? {
            createdAt: m.meta.createdAt ?? new Date().toISOString(),
            trigger: (m.meta.trigger as MessageNodeMeta['trigger']) ?? 'import',
          }
        : { createdAt: new Date().toISOString(), trigger: 'import' },
      alternateIds: m.alternateIds ?? [],
      children: m.children ?? [],
      stateSnapshotId: m.stateSnapshotId,
    })
    if (m.parentId === null && !tree.roots.includes(m.id)) tree.roots.push(m.id)
  }
  tree.activePath = Array.isArray(snap.conversation.activePath) ? snap.conversation.activePath : tree.roots.length ? [tree.roots[0]!] : []
  return tree
}

export function cloneProjectionState(p: ProjectionState): ProjectionState {
  return {
    conversationId: p.conversationId,
    characterIds: p.characterIds,
    tree: snapshotMessagesToTree(projectionToSnapshotLike(p)),
    currentSnapshotId: p.currentSnapshotId,
    snapshots: new Map(),
  }
}

export { uuid, cloneState }
export type { ScopedState, ConversationSnapshot, MessageRecord, DomainEvent, MessageNodeMeta }

type MessageNodeMeta = {
  trigger?: 'normal' | 'continue' | 'swipe' | 'regenerate' | 'impersonate' | 'quiet' | 'summary' | 'import'
}
