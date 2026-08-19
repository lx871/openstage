import type { Block, Id, IsoDate, MessageNode, MessageRole, StateSnapshot } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { ContentPart } from './content.js'
import { applyDelta, cloneState, deltaSnapshot, emptyScopedState, toFullSnapshot, type ScopedState } from './state.js'

export interface MessageTreeState {
  messages: Map<Id, MessageNode>
  roots: Id[]
  activePath: Id[]
  stateSnapshots: Map<Id, StateSnapshot>
  state: ScopedState
}

export interface AppendMessagesParams {
  conversationId: Id
  parentId: Id | null
  messages: Array<{
    id?: Id
    role: MessageRole
    speakerId?: Id
    displayName?: string
    blocks: Block[]
    metaTrigger?: 'normal' | 'continue' | 'swipe' | 'regenerate' | 'import'
    stateSnapshotId?: Id
    at?: IsoDate
  }>
  at?: IsoDate
}

export interface TreeCommandResult {
  ok: boolean
  messagesCreated: MessageNode[]
  stateSnapshotId: Id
  state: ScopedState
  newActivePath?: Id[]
  changed?: boolean
  error?: string
}

export function createMessageTree(): MessageTreeState {
  return {
    messages: new Map(),
    roots: [],
    activePath: [],
    stateSnapshots: new Map(),
    state: emptyScopedState(),
  }
}

function attachChild(tree: MessageTreeState, parentId: Id, childId: Id): void {
  const parent = tree.messages.get(parentId)
  if (!parent) return
  const children = parent.children.filter((c) => c !== childId)
  children.push(childId)
  parent.children = children
}

function appendCreatedNode(
  tree: MessageTreeState,
  conversationId: Id,
  parentId: Id | null,
  o: { id?: Id; role: MessageRole; speakerId?: Id; displayName?: string; blocks: Block[]; at?: IsoDate; metaTrigger?: 'normal' | 'continue' | 'swipe' | 'regenerate' | 'import' },
): MessageNode {
  const node: MessageNode = {
    id: o.id ?? uuid(),
    conversationId,
    parentId,
    role: o.role,
    speakerId: o.speakerId,
    displayName: o.displayName,
    content: new ContentPart(o.blocks),
    visibility: 'prompt',
    meta: {
      createdAt: o.at ?? new Date().toISOString(),
      trigger: o.metaTrigger ?? 'normal',
    },
    alternateIds: [],
    children: [],
  }
  tree.messages.set(node.id, node)
  return node
}

export function createConversationInTree(
  tree: MessageTreeState,
  conversationId: Id,
): TreeCommandResult {
  const snap = toFullSnapshot(tree.state, null)
  tree.stateSnapshots.set(snap.id, snap)
  tree.roots = []
  tree.activePath = []
  return {
    ok: true,
    messagesCreated: [],
    stateSnapshotId: snap.id,
    state: cloneState(tree.state),
    changed: true,
  }
}

export function appendMessagesToTree(tree: MessageTreeState, params: AppendMessagesParams): TreeCommandResult {
  const created: MessageNode[] = []
  let cursor: Id | null = null

  if (params.parentId === null) {
    // First message is the root of this conversation
    const first = params.messages[0]
    if (!first) return { ok: true, messagesCreated: [], stateSnapshotId: '', state: cloneState(tree.state), changed: false }
    const root = appendCreatedNode(tree, params.conversationId, null, first)
    created.push(root)
    tree.roots = [root.id]
    cursor = root.id
  } else {
    const parent = tree.messages.get(params.parentId)
    if (parent) cursor = params.parentId
    else cursor = firstExistingChainTip(tree, params.parentId)
    if (!cursor) {
      return { ok: false, messagesCreated: [], stateSnapshotId: '', state: cloneState(tree.state), error: `parent not found: ${params.parentId}` }
    }
    for (const m of params.messages) {
      const node = appendCreatedNode(tree, params.conversationId, cursor, m)
      attachChild(tree, cursor, node.id)
      created.push(node)
      cursor = node.id
    }
  }

  const tipId = created.length ? created[created.length - 1]!.id : (cursor ?? '')
  const snap = toFullSnapshot(tree.state, tipId)
  tree.stateSnapshots.set(snap.id, snap)

  // Extend active path to the new tip
  const basePath = pathOf(tree, tipId)
  tree.activePath = basePath.length ? basePath : [tipId]

  return {
    ok: true,
    messagesCreated: created,
    stateSnapshotId: snap.id,
    state: cloneState(tree.state),
    newActivePath: tree.activePath,
    changed: created.length > 0,
  }
}

export function setBranchInTree(tree: MessageTreeState, path: Id[]): TreeCommandResult {
  if (!path.length) return { ok: false, messagesCreated: [], stateSnapshotId: '', state: cloneState(tree.state), error: 'empty path' }
  const tipId = path[path.length - 1]!
  const tip = tree.messages.get(tipId) ?? null
  const snapshotId = tip?.stateSnapshotId ?? null
  const snapshot = (snapshotId ? tree.stateSnapshots.get(snapshotId) : undefined) ?? null
  const fresh = toFullSnapshot(snapshot?.full ?? tree.state, tipId)
  tree.stateSnapshots.set(fresh.id, fresh)
  tree.activePath = path
  tree.state = snapshot?.full ? cloneState(snapshot.full) : cloneState(tree.state)
  return { ok: true, messagesCreated: [], stateSnapshotId: fresh.id, state: cloneState(tree.state), newActivePath: path, changed: true }
}

export function applyStateDeltasToTree(
  tree: MessageTreeState,
  parentSnapshotId: Id,
  scan: { scope: 'global' | 'character' | 'conversation'; key: string; op: 'set' | 'unset' | 'increment' | 'append'; value?: unknown; opId: Id }[],
  cursor: Id | null,
): TreeCommandResult {
  const parent = tree.stateSnapshots.get(parentSnapshotId)
  const result = deltaSnapshot(
    tree.state,
    parentSnapshotId,
    scan.map((d) => ({ ...d })),
    cursor,
    parent?.header.revision ?? 0,
  )
  for (const d of scan) applyDelta(tree.state, d)
  tree.stateSnapshots.set(result.snapshot.id, result.snapshot)
  return { ok: true, messagesCreated: [], stateSnapshotId: result.snapshot.id, state: cloneState(tree.state), changed: true }
}

function firstExistingChainTip(tree: MessageTreeState, nodeId: Id): Id | null {
  // walk up from a possibly-stale id to the deepest ancestor we actually have
  let cur: Id | undefined = nodeId
  let guard = 0
  while (guard < 100000) {
    const node = tree.messages.get(cur as Id)
    if (!node) return cur === nodeId ? null : (cur as Id)
    if (node.parentId === null) return node.id
    cur = node.parentId
    guard++
  }
  return null
}

export function pathOf(tree: MessageTreeState, nodeId: Id): Id[] {
  const path: Id[] = []
  let cur: Id = nodeId
  let guard = 0
  while (guard < 100000) {
    const node = tree.messages.get(cur)
    if (!node) break
    path.unshift(node.id)
    if (node.parentId === null) break
    cur = node.parentId
    guard++
  }
  return path
}

export function getBranchHistory(tree: MessageTreeState, includeSystem = false): MessageNode[] {
  const out: MessageNode[] = []
  for (const id of tree.activePath) {
    const node = tree.messages.get(id)
    if (!node) continue
    if (includeSystem || node.role !== 'system') out.push(node)
  }
  return out
}

export function asLinearHistory(tree: MessageTreeState): Array<{ role: MessageRole; name?: string; content: string }> {
  return getBranchHistory(tree).map((m) => ({
    role: m.role,
    name: m.displayName,
    content: m.content.text(),
  }))
}

export type { Block, MessageNode, MessageRole, ScopedState }