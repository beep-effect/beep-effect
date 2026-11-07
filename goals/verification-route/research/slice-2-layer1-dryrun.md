# Layer 1 dry-run counts

Turbo version: 2.11.10

| Mutation | Stage | Build invalidated | Check invalidated | Lint invalidated | All requested tasks invalidated |
| --- | --- | ---: | ---: | ---: | ---: |
| Biome catalog only | Before | 193 | 193 | 192 | 578 |
| Biome catalog only | After | 0 | 0 | 0 | 0 |
| Biome catalog and lock | Before | 194 | 194 | 194 | 582 |
| Biome catalog and lock | After | 194 | 194 | 194 | 582 |
| Packet markdown | Before | 0 | 0 | 0 | 0 |
| Packet markdown | After | 0 | 0 | 0 | 0 |

## Retargeted fixture (parent, 2026-11-07)

The gated test now bumps `@duckdb/node-api`, a catalog entry outside the root's own dependencies
(used by `packages/drivers/duckdb` only). Under turbo 2.11.10 with the projection in place, the
dependents' tasks change and fewer than 10% of the 582 requested tasks change in total; with the raw
root manifest as a global input every task changed. A packet markdown edit still changes no build or
check task. The Biome bump stays a global invalidation: Biome is a root devDependency, and turbo folds
the root's external-dependency hash into every task. Run with
`BEEP_LAYER1_DRYRUN=1 bunx --bun vitest run test/verification-layer1-turbo.test.ts` from
`packages/tooling/tool/cli`.
