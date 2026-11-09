# @beep/agent-memory-store

Agent memory store: append-only node event log, store-side admission, Markdown projection and observation log for operator agent memory

## Installation

```bash
bun add @beep/agent-memory-store
```

## Usage

The package holds schemas and `Context.Service` contracts. The only live
Layers are the keyless defaults of the two optional local-model ports:
`Reranker.passThrough`, which keeps candidates in fused order, and
`Embedder.unavailable`, which leaves the vector index empty.

```ts
import { Candidate, NodeId, RecallBudget, RecallQuery, Reranker, RevisionId } from "@beep/agent-memory-store"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"

const query = RecallQuery.make({
  text: "sqlite driver decision",
  filters: [],
  budget: RecallBudget.make({ maxTokens: 2000 }),
})

const candidate = Candidate.make({
  nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
  revisionId: RevisionId.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  text: "SQLite access goes through @beep/sqlite.",
  bm25: O.some(4.2),
  vector: O.none(),
  fused: 0.7,
  reranked: O.none(),
})

const program = Effect.gen(function* () {
  const reranker = yield* Reranker
  return yield* reranker.rerank(query, [candidate])
}).pipe(Effect.provide(Reranker.passThrough))
```

Storage lives behind the contracts: P1 provides `MemoryLog` over
`effect/eventlog` and `@beep/sqlite` in a separate layer file, so the domain
modules never import a driver.

Four rules shape the log:

- A memory file is the exact concatenation of its live nodes in document
  order. `NodeCreated.after` records the order and `gap` nodes hold the bytes
  between content nodes, so the log alone rebuilds every file.
- A node event appended on this replica lands only when its `parents` are
  the node's current heads. `MemoryLog.append` refuses anything else with
  `StaleParentsError`.
- A held write and its resolution are `WriteHeld` and `HoldResolved` events
  keyed by `HoldId`.
- Every event names the lineage that wrote it.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/agent-memory-store` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
