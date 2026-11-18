# Model-First Standard — Sources & Provenance

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
| The standard | `standards/ARCHITECTURE.md` (Slice Package Topology, Role Suffixes, Slice Consumption Rules, Event-Sourced Slices On `@alchemy.run/domain`); `standards/architecture/DECISIONS.md` | amend |
| Scaffolder | `packages/tooling/tool/cli/src/commands/Architecture/` (`Architecture.schemas.ts`, `Architecture.plan.ts`, `internal/RoleTopology.ts`, `internal/PackageShell.ts`) | retarget |
| Package bootstrap | `packages/tooling/tool/cli/src/commands/CreatePackage/` | reuse |
| Boundary zones | `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts`; `standards/fallow.boundaries.generated.jsonc` | extend |
| Laws | `packages/tooling/tool/cli/src/commands/Laws/` (`entity-kit-freeze`) | reuse |
| GritQL rules | `packages/tooling/policy-pack/lint-rules/rules/` | extend |
| Checker and generator sources | `scratchpad/model-first-slices/shared/tooling/`, `scratchpad/model-first-slices/scripts/` | port; NET-NEW in the repo |
| First slice on the library | `packages/documents/{domain,use-cases,server}` (VaultSync) | evidence; legacy shape |
| Superseded goal | `goals/slice-topology-audit` | superseded by this goal |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/model-first-slices/RESEARCH.md`,
  `explorations/model-first-slices/DECISIONS.md`,
  `explorations/model-first-slices/BRIEF.md`,
  `explorations/model-first-slices/MAP.md`.
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
