# Effect Cluster Host — Sources & Provenance

- **Source exploration:** `explorations/model-first-slices` — primary ledger:
  `explorations/model-first-slices/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| alchemy-run/alchemy (its `domain` and `effect-cluster` packages) | Apache-2.0 (`LICENSE` at 33c10dd) | dependency, patched at the root where a fix is not yet released | the domain blocks and cluster hosting |
| Effect-TS/effect (`effect/cluster`) | MIT | dependency, not vendored | Effect Cluster primitives |

## 3. External research sources

None of its own. The exploration's ledger (`explorations/model-first-slices/research/SOURCES.md`, section 3) holds the
external citations.

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| Pins and the patch precedent | root `package.json` (`catalog`, `patchedDependencies`); `patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch` (an in-memory timer fix) | extend |
| Existing conformance shape | `packages/drivers/alchemy-postgres/test/conformance/`; `packages/documents/use-cases/test/vault-sync/scenarios.ts` | reuse the shape |
| Repo-owned platform | `packages/drivers/alchemy-postgres` | stays; keep green |
| Effect Cluster in the repo | `packages/drivers/alchemy-postgres/src/AlchemyPostgresWorkflows.ts`; `packages/drivers/duckdb/src/` | precedent |
| Local stack | root `docker-compose.yml` | precedent; the swarm recipe is NET-NEW |
| Fixes as run on the cluster | `scratchpad/model-first-slices/patches/` | port to root patches |
| Fixes rebased on upstream main, with tests | `scratchpad/model-first-slices/notes/upstream/rebased/`, `MAIN-CHECK.md`, `SENT.md` | source for the ledger |
| Conformance cases | `scratchpad/model-first-slices/conformance/` | port; NET-NEW in the repo |
| Descriptors and entry generation | `scratchpad/model-first-slices/apps/practice/` | port; NET-NEW in the repo |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/model-first-slices/RESEARCH.md`,
  `explorations/model-first-slices/DECISIONS.md`,
  `explorations/model-first-slices/BRIEF.md`,
  `explorations/model-first-slices/MAP.md`.
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
