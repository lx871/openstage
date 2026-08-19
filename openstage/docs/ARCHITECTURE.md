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

## Card Converter

- `V1`/`V2`/`V3` → openstage via `normalizeRaw` + `characterFromV2` + `listKnowledgeFromV2Book`; `V2` vs `V3` differences (`nickname`/`character_version`/`creator_notes_multilingual`) are preserved in `unknownFields`.
- `character_book` ↔ `KnowledgeBase` entries; `keys`→`primary`, `secondary_keys`→`secondary`; `insertion_order`→`order`.
- PNG: `tEXt` chunk keyword `chara` (V2) / `ccv3` (V3); file ≤12 MB, chunk ≤5 MB, CRC-32, magic + unsigned length checked.

## Browser Isolation

- Node-only storage (`better-sqlite3`, `fs`/`path`) is replaced in the Web build via `packages/storage/src/index.browser.ts` + `sqlite-store.browser.ts` (in-memory stub) and Vite alias `@openstage/storage → index.browser.ts`.
- `apps/web` runs entirely on localStorage + in-memory event store; no server required.

## Recipe

- `compat-st-default` vs `native-modern` in `@openstage/recipe`.
- `compilePrompt(CompileInput)` folds budget → cache breakpoints → lore → history.
