# Architecture

## Event Log → Projection

```
Command ──► EventStore / SqliteEventStore ──► events table
                        │
 replay(id) / load(id)  ▼
              ProjectionState { tree, characterIds, snapshots }
                        │
                        ▼
              ConversationSnapshot { conversation, messages }
```

- Single source of truth is the append-only `events` log.
- SQLite is transactional; `INSERT INTO events` is the commit boundary for `execute`.
- `SqliteEventStore` delegates materialization to the same `EventStore` path and wraps
  persistence in a `better-sqlite3` transaction (no silent `OR IGNORE`).

## Branch & State

- Messages form a tree (`parentId`); `activePath` is the current branch.
- `setBranch` validates via `setBranchInTree`; new appends fork from `activePath` tip.
- `saveStateSnapshot` (deltas) binds to the cursor message's `stateSnapshotId`.

## World-Book Activation

```
selectiveLogic: 0/→OR, 1→AND_ANY, 2→NOT, 3→AND
primary/secondary keys · probability · group weight · depth/order → ranked WI
```

Regex keys are length-limited and nested-quantifier rejected to avoid ReDoS.
Whole-word matching uses escaped regex; case handling respects `case_sensitive`.

## Recipe

- `compat-st-default` vs `native-modern` in `@openstage/recipe`.
- `compilePrompt(CompileInput)` folds budget → cache breakpoints → lore → history.
