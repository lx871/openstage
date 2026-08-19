import type { Id, ScopedState, StateDelta, StateSnapshot } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'

export function emptyScopedState(): ScopedState {
  return { global: {}, character: {}, conversation: {} }
}

export function applyDelta(state: ScopedState, delta: StateDelta): void {
  const target = state[delta.scope] as Record<string, unknown>
  switch (delta.op) {
    case 'set':
      target[delta.key] = delta.value
      break
    case 'unset':
      delete target[delta.key]
      break
    case 'increment': {
      const current = typeof target[delta.key] === 'number' ? (target[delta.key] as number) : 0
      const by = typeof delta.value === 'number' ? delta.value : 1
      target[delta.key] = current + by
      break
    }
    case 'append': {
      const existing = Array.isArray(target[delta.key]) ? (target[delta.key] as unknown[]) : []
      target[delta.key] = [...existing, delta.value]
      break
    }
  }
}

export function cloneState(state: ScopedState): ScopedState {
  return structuredClone(state)
}

export interface SnapshotResult {
  snapshot: StateSnapshot
  derived: ScopedState
}

/** Create a full state snapshot carrying a complete map of scopes. */
export function toFullSnapshot(state: ScopedState, cursor: Id | null, id = uuid()): StateSnapshot {
  const snapshot: StateSnapshot = {
    id,
    header: {
      kind: 'full',
      parentSnapshotId: null,
      revision: 1,
      createdAt: new Date().toISOString(),
      cursor,
    },
    deltas: [],
    full: cloneState(state),
  }
  return snapshot
}

/** Create an incremental delta snapshot on top of derived state. */
export function deltaSnapshot(
  derived: ScopedState,
  parentSnapshotId: Id,
  deltas: StateDelta[],
  cursor: Id | null,
  parentRevision: number,
  id = uuid(),
): SnapshotResult {
  const next = cloneState(derived)
  for (const d of deltas) applyDelta(next, d)
  const snapshot: StateSnapshot = {
    id,
    header: {
      kind: 'delta',
      parentSnapshotId,
      revision: parentRevision + 1,
      createdAt: new Date().toISOString(),
      cursor,
    },
    deltas,
  }
  return { snapshot, derived: next }
}

export type { ScopedState, StateDelta, StateSnapshot }