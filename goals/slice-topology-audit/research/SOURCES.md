# Slice Topology Audit — Sources & Provenance

- **Source exploration:** `explorations/v3-consistency-audit` — primary ledger:
  [`explorations/v3-consistency-audit/research/SOURCES.md`](../../../explorations/v3-consistency-audit/research/SOURCES.md).
  This file reproduces that corpus for implementation; the exploration's
  ledger stays canonical.
- **Cluster / origin:** operator brief (2026-08-29) + a multi-phase workflow
  over two local checkouts; no external web research.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `v3-iam` | v3 IAM slice | `effect-v3-main-archive` (local `~/YeeBois/projects/beep-effect4`, HEAD `997a827454`) | `packages/iam/**` | role-named members (`Account.Model` / `.Repo` / `.RepoLive` 39/39), `contracts/<Op>.contract.ts` quartet (72), client `Handler`/`Wrapper` pairs (120) | reference — patterns only; no code ported |
| `v3-knowledge` | v3 Knowledge slice | same | `packages/knowledge/**` | entity-folder grammar, hollow protocol shells (14/22 — the anti-pattern) | reference — patterns only |
| `v4-doctrine` | Architecture standard | this repo | `standards/ARCHITECTURE.md` (tree L827-952, role tables L969-1129, `Model` example L1778); `standards/architecture/{04,05,08,09,10,13}.md`, `DECISIONS.md` (2026-04-21 protocol declarations; 2026-04-23 no live Layers in use-cases; 2026-05-22 namespace-first `@beep/schema` modules) | binding; amended by `slice-topology-audit` only |
| `v4-slices` | Live slice packages | this repo | `packages/{agents,architecture-lab,documents,epistemic,law-practice,ontology,shared,workspace}/**` | conformance census (exploration `synthesis/00`, 110 rows) | measured |
| `v4-cli` | Architecture command + gates | this repo | `packages/tooling/tool/cli/src/commands/{Architecture,Lint,Laws,Quality,Fallow,Ci}/**` | hook points and reusable bricks (§4) | extend |
| `v4-proof` | Canonical slice factory | this repo | `goals/canonical-slice-factory/{README,SPEC,PLAN}.md`, `packages/architecture-lab/**`, `commands/Architecture/internal/AcceptedProofManifest.ts` L130-847 | the accepted proof and its nine divergences (exploration `synthesis/15`) | extend |
| `effect-v4-rpc` | effect v4 `unstable/rpc` | `.repos/effect` (symlink to the local effect checkout) | `packages/effect/src/unstable/rpc/{Rpc.ts L902,RpcGroup.ts L402,RpcClient.ts L631}` | `Rpc.make(tag, { payload, success, error })`, `RpcGroup.make`, `group.toLayer`, `RpcClient.make` | reuse (primitive under the `Contract` kit) |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `effect-v3-main-archive` (beep-effect v3, same author) | same ownership as this repo | reference-only (no code moves) | naming and organization patterns only |
| `effect` (Effect-TS, v4 line) | MIT | use as a dependency; validate every API against `.repos/effect` | `Rpc` / `RpcGroup` / `RpcClient` |

## 3. External research sources

None. No URLs are cited; every claim is carried by the on-disk evidence tables
in the exploration's `synthesis/10`–`15` and `20`–`25` (Codex-verified, with
per-file verification logs) and the 2026-08-30 capability gate.

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| `beep architecture` operation-plan core (`ArchitectureSliceRole` L109, `ArchitecturePlanStage` L71, `ArchitectureDomainKind` L33, `ArchitecturePackageRole` L157, `CanonicalSliceOperationPlan` L801, `check`) | `packages/tooling/tool/cli/src/commands/Architecture/Architecture.{schemas,command}.ts` | extend |
| `AcceptedProofManifest` (`acceptedProofFiles` L130-847) + `TemplateRetarget` (`targetPathFor` L139-184 path pass; `replacementPairs`/`renderAcceptedTemplate` L186-262 body pass) | `.../Architecture/internal/` | extend |
| Package discovery `resolveWorkspaceDirs` L120 / `resolveWorkspacePackages` L303 / `WorkspacePackage` L262 | `packages/tooling/library/repo-utils/src/Workspaces.ts` (`@beep/repo-utils`) | reuse (replaces the withdrawn `collectPackageSourceRoots` extraction) |
| Tier classifier `classifyWorkspaceRole` L119-131 (private) + Fallow `boundaries` L37-135 | `.../Fallow/Fallow.command.ts` | extend (export, `LiteralKit`-type, add `use-cases`/`client`/`config`) |
| TypeScript walker `collectTypeScriptFiles` L144 | `.../Lint/Lint.command.ts` | reuse |
| Export-map ↔ concept-index regexes L71-73 (private) | `.../Lint/SchemaTopology.ts` | extend (export) |
| Ratchet substrate `diffMembership` L71 / `diffTotals` L241 / `enforceRatchet` L67 | `packages/tooling/tool/cli/src/internal/ratchet/{RatchetDiff,RatchetLifecycle}.ts` | reuse (behind coverage, knip, JSDoc, test-typecheck, schema-first, goals doctor) |
| Lane registry `CiLaneId` L164-204, descriptors L339-577, `bunRunStep` L679, `knip` lane L463/L1007 | `.../Ci/CiLane.ts`, `.github/workflows/check.yml` (`knip` job), `Quality/internal/GithubChecks.ts` | reuse |
| Hook points `rootRepoLintPolicySteps` L2075 / `repoCliStep`; `beep:preflight`; yeet `verify` | `.../Quality/Tasks.ts`, root `package.json` L335, `.../Yeet/Yeet.command.ts` | reuse |
| `LiteralKit` | `packages/foundation/modeling/schema/src/LiteralKit/` | reuse — closed vocabularies |
| `Fn` concept module (`SchemaUtils.withStatics` L441/L456 + `implement`/`implementEffect`/`implementSync`) | `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts` | extend — the `Contract` kit is its sibling over `Rpc.make` |
| Live `Payload`/`Success`/`Failure` precedent (against `HttpApiEndpoint`, driver `domain/`) | `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts` L46/L87/L201 | reconcile |
| ts-morph substrate `TSMorphService.updateSourceFile`; `createRepoTsMorphProject` L33 | `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts`; `cli/src/internal/tsmorph/ProjectFactory.ts` | reuse |
| Import-rewrite precedent; codemod contract + golden-diff pattern | `.../Laws/EffectImports.ts`; `goals/repo-crispening-orchestration/ops/codemods/*.codemod.ts` | reuse |
| V1 replay test + fixture | `packages/tooling/tool/cli/test/architecture-operation-plan.test.ts` L246-294; `test/fixtures/architecture-operation-plan/accepted-work-item-manifest.json` | extend |
| `.converters.ts` exemplar (25 exist) | `packages/epistemic/tables/src/entities/CandidateClaim/CandidateClaim.converters.ts` | reuse as template |

## 5. Cross-links & provenance

- Exploration: [`explorations/v3-consistency-audit`](../../../explorations/v3-consistency-audit/README.md) — `DECISIONS.md`
  (binding), `BRIEF.md` (grammar block), `MAP.md` (sequencing, first vertical
  slice, risks), `synthesis/00` (110-row inventory), `synthesis/40` (ranked
  mechanisms R1–R12 + R6a/R6b), `synthesis/15` (proof divergences).
- Sibling goal: [`goals/slice-topology-audit`](../../slice-topology-audit/README.md)
  ⇄ [`goals/canonical-proof-reconciliation`](../../canonical-proof-reconciliation/README.md)
  (`architecture/slice-audit` → `architecture/proof-reconciled`).
- Related packets: `goals/canonical-slice-factory` (completed-retained; the
  proof), `goals/beep-schema-topology` (the only existing topology lint),
  `goals/fallow-quality-enforcement` / `goals/fallow-advisory-ratchets`
  (advisory → ratchet rollout pattern).
