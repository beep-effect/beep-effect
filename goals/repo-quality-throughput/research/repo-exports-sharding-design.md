# Repo-Exports Sharding Design

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

Status: `selected-for-follow-up`

## Current State

`bun run repo-exports:catalog:check` still performs a repo-wide semantic export
scan from `packages/tooling/tool/cli/src/commands/Quality/internal/RepoExportsCatalog.ts`.
The current implementation discovers the package universe, runs `bun run
topo-sort`, then analyzes packages sequentially with ts-morph using
`Effect.forEach(..., { concurrency: 1 })`.

The generated root artifacts are current, but large:

| Artifact | Current Size |
| --- | ---: |
| `standards/repo-exports.catalog.jsonc` | 16M |
| `standards/repo-exports.catalog.md` | 2.7M |

The live check in this clone stayed sequential and hot for roughly the same
window as the Batch 2 baseline. It completed with:

```text
[repo-exports-catalog] generated artifacts are current
packages=92 importSpecifiers=1078 publicExportEntries=15094
```

## Design Target

Package-local catalog shards should mirror docgen's package-local ownership
model while avoiding `docs/**`, which docgen already owns as a Turbo output.
Use package-local `.beep` output instead:

- each shard-producing workspace package owns a generated
  `.beep/repo-exports/catalog.shard.jsonc` shard;
- each shard records the package catalog, generator/schema version, and a
  deterministic input fingerprint;
- a root aggregate command validates package shards, sorts deterministically,
  and writes the repo-wide catalog surface;
- lookup consumers expand shards through `@beep/repo-codegraph` instead of
  assuming all symbol entries live inline in the root JSON.

The package shard task should be cacheable and dependency-free:

```jsonc
"repo-exports:shard": {
  "cache": true,
  "inputs": [
    "$TURBO_DEFAULT$",
    "!.beep/**",
    "!docs/**",
    "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/internal/RepoExportsCatalog.ts",
    "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts",
    "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts"
  ],
  "outputs": [".beep/repo-exports/**"],
  "outputLogs": "new-only"
}
```

Do not add `dependsOn` to the shard task. It analyzes the package's own
`package.json` export map and source files; dependency sequencing would
recreate avoidable DAG fan-out.

Root scripts should keep the operational dependency explicit:

```json
"repo-exports:shards": "bunx turbo run repo-exports:shard --concurrency=4",
"repo-exports:catalog": "bun run repo-exports:shards && bun run beep quality repo-exports-catalog --from-shards",
"repo-exports:catalog:check": "bun run repo-exports:shards && bun run beep quality repo-exports-catalog --from-shards --check"
```

## Correctness Boundary

A hash-only fast check is not enough for the authoritative proof. If the root
command simply trusts a package shard because its input hash matches, a manually
edited shard could pass without re-running ts-morph. That would weaken the
current catalog proof.

The safe performance model is Turbo-backed package tasks:

1. package task analyzes its own package and writes the package shard;
2. Turbo caches the package task by package inputs and the repo-cli generator
   implementation;
3. root aggregation reads already-produced shards and verifies the deterministic
   aggregate;
4. the full proof keeps a non-cached fallback or an explicit full-rebuild mode
   for generator migrations and cache suspicion.

## Required Migration Surface

This should not be slipped into the current green PR as a small tweak. A real
implementation touches several contracts at once:

| Surface | Required Change |
| --- | --- |
| `@beep/repo-cli` | Add package-shard write/check mode and root aggregate mode. |
| `@beep/repo-codegraph` | Read root index plus package shards, or preserve a compatibility root until lookup migrates. |
| `turbo.json` | Add a cached package shard task with narrow inputs and shard outputs. |
| Workspace `package.json` files | Add `repo-exports:shard` scripts to source-export packages, or all workspace packages if no-op shards are preferred. |
| `lefthook.yml` | Gate changed package source against its package shard and root aggregate. |
| Agent/docs guidance | Update catalog search guidance if symbol entries move out of `standards/repo-exports.catalog.*`. |
| Biome, cspell, typos | Exclude or classify package-local generated shards so quality lanes do not spend time linting generated metadata. |
| Root catalog tests | Move direct `UnknownRecord` assertions through hydrated `@beep/repo-codegraph` readers if the root JSON becomes an index. |
| Generated artifacts | Add package-local shards and decide whether the root JSON remains full or becomes an index. |
| New package scaffolding | Add the shard script when repo tooling creates new source-export packages. |

## Recommendation

Defer rqt-007 from this PR and land it as its own shard-v2 implementation. The
current PR is already green and mergeable, while sharding is a high-churn
generated-artifact migration that needs its own proof matrix.

The follow-up should start with a compatibility phase:

1. add package-shard generation behind repo-cli;
2. add Turbo package task and package scripts mechanically;
3. keep the existing root catalog shape until `@beep/repo-codegraph` and agent
   guidance are shard-aware;
4. measure `turbo run repo-exports:shard` cache hit/miss behavior;
5. only then shrink the root catalog into an index if symbol lookup and agent
   `rg` workflows remain ergonomic.

The compatibility phase may choose additive shards while preserving the current
root JSON/Markdown. That would not solve root merge churn by itself, but it
would let the repo prove package-task cache behavior before changing the
consumer contract.
