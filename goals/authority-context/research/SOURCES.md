# Authority Context — Sources & Provenance

- **Source exploration:** `explorations/model-first-slices` — primary ledger:
  `explorations/model-first-slices/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| alchemy-run/alchemy (`packages/domain`, `packages/effect-cluster`) | Apache-2.0 (`LICENSE` at 33c10dd) | dependency, patched at the root where a fix is not yet released | the domain blocks and cluster hosting |
| Effect-TS/effect (`effect/cluster`) | MIT | dependency, not vendored | Effect Cluster primitives |

## 3. External research sources

None of its own. The exploration's ledger (`explorations/model-first-slices/research/SOURCES.md`, section 3) holds the
external citations.

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| Principals | `packages/shared/domain/src/entity/Principal.ts` (`UserPrincipal`, `AgentPrincipal`, `ServiceAccountPrincipal`, `SystemPrincipal`) | reuse |
| Branded ids | `packages/shared/domain/src/identity/Shared/` | reuse |
| Identity and schema foundations | `packages/foundation/modeling/identity`, `packages/foundation/modeling/schema` (`LiteralKit`) | reuse |
| Prior grant language | `packages/execution-authority/domain` (`ExecutionGrant`, `FrozenGrantSet`, `evaluateExecutionRequest`) | stay compatible; not moved here |
| Session admission precedent | `packages/documents/domain/src/aggregates/VaultSync/Session.context.ts`; `packages/documents/server/src/VaultSyncSession.ts` | precedent |
| Tier gate port | `packages/foundation/capability/mcp-kit` (`TierGate`) | untouched; moves with the gated candidate |
| Authority model | `scratchpad/model-first-slices/authority/{contract,model,host}` | port; NET-NEW in the repo |
| Kernel and contract kit | `scratchpad/model-first-slices/shared/kernel/`, `scratchpad/model-first-slices/shared/contract-kit/` | port; NET-NEW in the repo |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/model-first-slices/RESEARCH.md`,
  `explorations/model-first-slices/DECISIONS.md`,
  `explorations/model-first-slices/BRIEF.md`,
  `explorations/model-first-slices/MAP.md`.
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
