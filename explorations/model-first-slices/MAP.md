# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

Decomposed 2026-11-17 from `BRIEF.md` (confirmed, D59) under the appetite in D60. The capability
check below rests on a read-only inventory of `packages/`, `standards/`, `goals/` and the root
manifest made the same day. Paths are repo-relative. "Prototype" means
`scratchpad/model-first-slices/`, which is evidence and a porting source, never a dependency.

## Candidate Goal Packets

Created at graduation (D66):

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `model-first-standard` | Amend the architecture standard to the model-first, four-package slice; retarget `beep architecture` to it; enforce the file grammar, exact exports and context boundaries with checkers under a ratchet. Supersedes `goals/slice-topology-audit` (D65). | none | See "Standard and tooling" |
| `effect-cluster-host` | Make Effect Cluster on Postgres a host the monorepo can run a slice on: Alchemy beta.87, `@alchemy.run/effect-cluster`, the library fixes as root patches (D61), the conformance suite as a repo package, a local swarm recipe, deployment descriptors and generated entry modules. | none | See "Host" |
| `authority-context` | Build `authority` as the first four-package slice (D63): the kernel's Invocation and grant-check language, grants, delegation that only narrows, accountability, admission at the boundary and re-admission at each hop, on Effect Cluster. | `model-first-standard` (doctrine and scaffolder phases), `effect-cluster-host` | See "Authority" |

Gated candidates. Each stays here as a re-entry point; when its gate fires the packet reopens at
decompose.

| Slug | Mission | Gate | Capabilities cited |
| --- | --- | --- | --- |
| `authority-absorbs-execution-authority` | Move the existing grant language, decision ledger and gates into `authority` (D64). | `authority-context` done and `goals/execution-authority-slice` done | `packages/execution-authority/{domain,use-cases,server,tables,config}`: `ExecutionGrant`, `FrozenGrantSet`, `evaluateExecutionRequest`, `ExecutionLedger`, `makeGovernedTierGate`, `GovernedEgress`; `packages/foundation/capability/mcp-kit` `TierGate` |
| `runs-context` | `AgentRun`, the budget ledger, run lineage, the Reasoner evaluation contract (D6, D19, D23, D26 to D29). | `authority-context` done | `packages/agents/use-cases` `AgentTurnKernel` with fixture and Anthropic implementations; ProfessionalRuntime fixture contracts (`RuntimeApprovalGate`, `RuntimeUsageRecord`); `packages/workspace/domain` `ApprovalGate` entity. NET-NEW: the aggregate, the ledger, lineage, recorded fixtures |
| `product-slice-model-first` | The first product context on the shape, with a `web` package, an integration fact to `runs` through a published stream and an inbox, and browser QA. Carries the deferred browser session question. | `runs-context` done | `packages/party/{domain,use-cases,server}`; React usage in `apps/professional-desktop/src/sync/`; `@effect/atom-react`. NET-NEW: published streams, inbox, generated bindings, stream pins and the drain and retirement checks (ported from the prototype) |
| `documents-vault-sync-reshape` | Re-shape the one slice already on `@alchemy.run/domain` from seven packages to four. | `model-first-standard` done | `packages/documents/{domain,use-cases,server}` VaultSync; `apps/professional-desktop/src/sync/` |
| `retire-alchemy-postgres` | Retire the repo-owned Postgres platform (D5). | An Alchemy release contains the fixes and the conformance package passes on it unpatched (D41, D53) | `packages/drivers/alchemy-postgres` |
| `slice-migrations` | Move the remaining entity-kit slices to the shape, one candidate per slice when the gate fires. | `product-slice-model-first` done | `packages/{agents,epistemic,law-practice,ontology,workspace,architecture-lab}`; `standards/entity-kit-freeze.baseline.jsonc` |
| `operations-context` | Repairs as commands, quarantine, degraded modes, an operations Api (D14). | A product slice runs on the cluster | NET-NEW |
| `production-cut-stories` | A journal on aggregate sends, stories cut from real histories, a replay-diff check (D14). | A product slice runs on the cluster | Prototype stories; upstream `Story`. NET-NEW in the repo |
| `retention-and-trust` | Retention classes, erasure by tombstone, recorded privileged reads, trust labels (D14). | A product slice holds real data | NET-NEW |
| `agent-evaluation-harness` | Build the harness behind the Reasoner evaluation contract (D19). | `runs-context` done | NET-NEW |
| `agent-session-and-sandbox` | The session entity holding a chain of runs, and the sandbox for agents that write code (D21, D23). | `runs-context` done | NET-NEW |
| `alchemy-upstream-contract` | The upstream asks not yet written: a model-free Api (D9), request context persisted with events (D4), a request-context hook against root forgery (D25), receipts answered before the grant check, the event field rename. | A maintainer has answered the first set (D62) | `scratchpad/model-first-slices/notes/upstream/` |

## Capability Check

### Standard and tooling (`model-first-standard`)

- **The standard.** `standards/ARCHITECTURE.md`: Slice Package Topology (lines 325 to 420, the
  seven roles), Role Suffixes (1017 to 1190), Slice Consumption Rules (682 to 709),
  Boundary-Sensitive Export Contracts (421 to 469), Event-Sourced Slices On `@alchemy.run/domain`
  (1731 to 1781, the placement table that names `@beep/alchemy-postgres`). Decision log:
  `standards/architecture/DECISIONS.md`, the 2026-11-06 entry "Slices Adopt `@alchemy.run/domain`;
  The Entity Kit Is Frozen". Supporting chapters `standards/architecture/01`, `10`, `13`.
- **The scaffolder.** `bun run beep architecture` in
  `packages/tooling/tool/cli/src/commands/Architecture/`. The seven roles are encoded in
  `Architecture.schemas.ts` (`ArchitectureSliceRole`, `ArchitecturePackageRole`,
  `ArchitectureDomainKind`), `Architecture.plan.ts` (`makeCanonicalSliceOperationPlan`) and
  `internal/RoleTopology.ts`, with package shells in `internal/PackageShell.ts`.
  `bun run beep create-package` (`CreatePackage/`) is the only package bootstrap.
- **Enforcement that exists.** Fallow boundary zones generated by
  `commands/Fallow/Fallow.command.ts` into `standards/fallow.boundaries.generated.jsonc`, at warn
  level; the `Laws` command (`entity-kit-freeze`, `frozen-grant-set`); `beep lint` subcommands;
  ten Biome GritQL rules in `packages/tooling/policy-pack/lint-rules/rules/`, none about topology.
- **NET-NEW.** A role-suffix and placement checker; an exact-exports lint; a context-import
  checker; the generated handler registry; the proof inventory generator and outcome coverage.
  The prototype has each in `shared/tooling/` and `scripts/` as a porting source.
- **Not found, and not assumed.** `beep architecture audit` does not exist; the paused goal that
  planned it is superseded here.

### Host (`effect-cluster-host`)

- **Pins and patches.** The root catalog pins `@alchemy.run/domain` and `alchemy` at
  2.0.0-beta.86 and `effect` at 4.1.4. The root `patchedDependencies` has one entry
  (`patches/@alchemy.run%2Fdomain@2.0.0-beta.86.patch`, an in-memory timer fix), which is the
  precedent for D61. `@alchemy.run/effect-cluster` is not in the catalog. NET-NEW in the root.
- **Existing conformance shape.** `packages/drivers/alchemy-postgres/test/conformance/`
  (`scenarios.ts` run against `Domain.InMemory` and PGlite) and
  `packages/documents/use-cases/test/vault-sync/scenarios.ts`.
- **Effect Cluster in the repo.** `effect/cluster` is used only for the workflow engine
  (`packages/drivers/alchemy-postgres/src/AlchemyPostgresWorkflows.ts`) and the DuckDB storage
  drivers. No cluster entity, sharding or swarm definition exists. The local stack is the root
  `docker-compose.yml` (Postgres 17, Redis, Grafana).
- **Porting sources.** The prototype's `conformance/`, `patches/`, `apps/practice` (descriptors
  and the generated entry module) and `notes/upstream/` (the fixes, rebased onto upstream main
  with tests in `rebased/`).
- **NET-NEW.** The swarm recipe, the conformance package, deployment descriptors and entry
  generation in an app.

### Authority (`authority-context`)

- **Principals and ids.** `packages/shared/domain/src/entity/Principal.ts` (`UserPrincipal`,
  `AgentPrincipal` with `onBehalfOfUserId`, `ServiceAccountPrincipal`, `SystemPrincipal`) and the
  branded ids under `packages/shared/domain/src/identity/Shared/`.
- **Modeling foundations.** `@beep/identity` (`packages/foundation/modeling/identity`) and
  `@beep/schema` (`LiteralKit`).
- **Prior grant language.** `packages/execution-authority/domain`: `ExecutionGrant` (principal,
  purpose, resource, operation, sink, budget, policy revision, expiry) and
  `evaluateExecutionRequest`. The first slice stays compatible with these terms and moves none of
  that code (D64).
- **Session admission precedent.**
  `packages/documents/domain/src/aggregates/VaultSync/Session.context.ts` (`SessionResolver`,
  `VaultSyncGrant`, `ScopeDenied`) and `packages/documents/server/src/VaultSyncSession.ts`.
- **Porting sources.** The prototype's `authority/{contract,model,host}`, `shared/kernel` and
  `shared/contract-kit`.
- **NET-NEW.** The `Invocation` and provenance schemas, delegation, the Accountability relation,
  the re-admission port, the root-construction scan, and the `contract`, `model` and `host`
  packages themselves.

## Sequencing

1. `model-first-standard` opens with the doctrine amendment. The scaffolder and every later goal
   cite it, and D17's hold on new seven-package migrations becomes doctrine there.
2. `effect-cluster-host` runs beside it. It touches the root manifest, a new conformance package
   and an app, and no file the standard goal touches.
3. `authority-context` starts when the scaffolder can generate a four-package slice and the host
   passes conformance in the monorepo. Its in-memory work may begin on the doctrine alone.
4. The gated candidates follow their gates. `runs-context` is the next bet, then the first
   product slice.

## First Vertical Slice

In `authority-context`: a human admitted at the Session boundary holds a grant and delegates a
narrowed one to an agent. A command is decided under the Invocation authority builds. The grant is
revoked, the next hop's re-admission drops it, and the command that needs it is refused and the
refusal recorded.

Verified by stories on `Domain.InMemory`, by the proof inventory entries for root construction,
no grant terms in events and re-admission adding nothing, and by the revocation case of the
conformance package on the two-runner swarm. The prototype passes all three today on its own
code; the slice passes them in `packages/`.

## Open Risks Inherited From The Brief

Each is a constraint on the goal named.

- The host guarantees hold only with the fixes; the root carries them as patches until an Alchemy
  release has them (`effect-cluster-host`).
- A connection pooler that rewrites the session name makes every commit refused
  (`effect-cluster-host`).
- Not yet observed on a cluster: the startup guard, the refusal on an unnamed pool, the
  frozen-runner case as rewritten, and serving a retired generation (`effect-cluster-host`).
- Upstream main has moved past the release the fixes were run on, and one rebased check (a commit
  on an instance a decision holds) has run in process only (`effect-cluster-host`).
- The root is on beta.86 and `@beep/alchemy-postgres` is written against the beta.85 platform
  contract; vault-sync must stay green through the bump (`effect-cluster-host`).
- Root forgery in process is controlled by a source scan with known gaps (`authority-context`).
- A reused command id is answered from the stored receipt before the grant is checked
  (`authority-context`).
- The contract needs views and queries declared a second time until upstream splits the Api from
  the model (`model-first-standard`, `authority-context`).
- Swarm cannot bind a published port to localhost; a conformance driver runs inside the stack's
  network (`effect-cluster-host`).
