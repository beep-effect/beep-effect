# Repo Codegraph

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give coding agents a repo-native lookup surface that starts with deterministic
public export facts and grows into AST, semantic, graph, and reasoning-backed
guidance without making stale prompts the source of truth.

The first implementation vertical is intentionally conservative:

- `@beep/repo-codegraph` owns schema-first catalog, policy, and lookup models.
- `beep reuse lookup` answers symbol and intent queries from
  `standards/repo-exports.catalog.jsonc`.
- Lookup results include legal import candidates, a recommended import,
  explainable score components, catalog freshness posture, and advisory
  boundary guidance.

## Relationship To Existing Packets

- `repo-context-topology` remains the home for generated topology artifacts such
  as `standards/repo-exports.catalog.jsonc`.
- `repo-codegraph-jsdoc` remains a reference packet for research, JSDoc
  extraction history, and graph/RAG literature.
- This packet is the active implementation initiative for lookup, enrichment,
  graph projection, embeddings, and agent-facing retrieval.

## Reading Order

- [SPEC.md](./SPEC.md) - binding implementation contract
- [PLAN.md](./PLAN.md) - phased delivery plan
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing metadata
