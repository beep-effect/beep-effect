# MAP — v3-consistency-audit

> Decomposition into candidate goal packets. Every component cites an
> existing repo capability or is marked NET-NEW. Graduation is a separate
> act (DECISIONS *packet depth*): nothing under `goals/` is scaffolded by this
> packet.

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `slice-topology-audit` | Make the slice grammar mechanical: land the doctrine amendments the grill locked, then a `beep architecture audit` command that walks existing slice packages, asserts closed `LiteralKit` vocabularies, emits a schema-versioned report, and ratchets against a committed baseline in a required ci lane. | none | `packages/tooling/tool/cli/src/commands/Architecture/{Architecture.schemas,Architecture.command}.ts` (extend: `ArchitectureSliceRole` L109, `ArchitecturePlanStage` L71, `ArchitectureDomainKind` L33, `ArchitecturePackageRole` L157; new `AuditReport`/`AuditBaseline` classes beside `CanonicalSliceOperationPlan` L801); package discovery from `@beep/repo-utils` `resolveWorkspaceDirs` / `resolveWorkspacePackages` / `WorkspacePackage` (`packages/tooling/library/repo-utils/src/Workspaces.ts` L120/L303/L262 — the brick `Fallow.command.ts` L155 already walks with; the earlier NET-NEW extraction of `Lint/PackageTestImports.ts`'s private `collectPackageSourceRoots` is withdrawn); tier classifier EXTEND: promote `Fallow.command.ts` L119-131 private `classifyWorkspaceRole` to an exported `LiteralKit`-typed helper that also knows `use-cases`/`client`/`config`; `commands/Lint/Lint.command.ts:collectTypeScriptFiles` L144 (exported; `test/lint-security.test.ts` already reuses it); `Lint/SchemaTopology.ts` L71-73 export-map ↔ concept-index regexes (private consts — export them); `@beep/schema` `LiteralKit` (`packages/foundation/modeling/schema/src/LiteralKit/`); ratchet substrate `cli/src/internal/ratchet/{RatchetDiff,RatchetLifecycle}.ts` (`diffMembership` L71, `diffTotals` L241, `enforceRatchet` L67 — already behind `CoverageRegression`, `KnipRatchet`, `JSDocRatchet`, `PackageTestTypecheck`, `SchemaFirstScan`, `Goals/Doctor`); lane registry `commands/Ci/CiLane.ts` (`CiLaneId` `LiteralKit` L164-204, descriptors L339-577, `bunRunStep` L679, the `knip` lane L463/L1007 as the template, its `check.yml` job and `Quality/internal/GithubChecks.ts` row) — the lane is REUSE of a closed registry, not net-new; hook points `rootRepoLintPolicySteps` (`Quality/Tasks.ts` L2075, `repoCliStep`), `beep:preflight` (`package.json` L335), `commands/Yeet/Yeet.command.ts` `verify` subcommand; `Fallow boundaries` (`Fallow.command.ts` L37-135, advisory) as the existing partial role-topology audit. NET-NEW: the rule set; the `audit` subcommand (`--json`, `--slice`, `--tier`, `--write-baseline`); the `AuditReport`/`AuditBaseline` schemas (`architecture-audit-report/v1`, `architecture-audit-baseline/v1`); `architecture.audit-baseline.jsonc` (new, under `standards/`); the CLI test asserting the accepted proof is audit-clean (no existing test references `AcceptedProofManifest`; host `test/architecture-operation-plan.test.ts` beside the v1 replay + `test/fixtures/architecture-operation-plan/accepted-work-item-manifest.json`). |
| `canonical-proof-reconciliation` | Bring the CLI's accepted proof and the eight live slices onto the amended grammar: fix `AcceptedProofManifest` + `architecture-lab` first (so `add concept` stops propagating drift), then one codemod PR per slice, each proving itself by an audit baseline delta. | `slice-topology-audit` (needs the vocabularies and the baseline) | `commands/Architecture/internal/AcceptedProofManifest.ts` (`acceptedProofFiles` L130-847: 125 entries + 9 `rolePackageFiles` spreads, also covering `apps/architecture-lab-proof/**` and `packages/_internal/db-admin/**`; edit the manifest) and `internal/TemplateRetarget.ts` (exported `targetPathFor` L139-184 rewrites *paths*; private `replacementPairs`/`renderAcceptedTemplate` L186-262 rewrite *file bodies* by substring over `WorkItem`/`work-item`/`work_item`/`ArchitectureLab`, surfaced as `renderAcceptedTemplateForPlan` L263 — shrink the body pass to `$I`-key rewriting once symbols are role-named); `packages/architecture-lab/**` (the proof); `goals/canonical-slice-factory` (V1 replay contract: `architecture-operation-plan/v1` must still decode — `test/architecture-operation-plan.test.ts` L246-294 replays it; proof renames are content changes, not plan-schema changes); `beep tsconfig-sync` (re-derive aliases after export-map edits); ts-morph substrate `@beep/repo-utils` `TSMorph/TSMorph.service.ts` (`TSMorphService.updateSourceFile`) + `cli/src/internal/tsmorph/ProjectFactory.ts` `createRepoTsMorphProject` L33 (the `"ts-morph"` member of `ArchitectureWriterKind` has no executor and is not a brick); import-rewrite precedent `commands/Laws/EffectImports.ts`; codemod contract + golden-diff test pattern `goals/repo-crispening-orchestration/ops/codemods/*.codemod.ts`; `.converters.ts` exemplar `packages/epistemic/tables/src/entities/CandidateClaim/CandidateClaim.converters.ts` (25 exist across slices, 0 in the lab); `Contract` kit EXTEND of `@beep/schema/Fn` (`packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`: schema triad attached as statics via `SchemaUtils.withStatics` L441/L456 + `implement`/`implementEffect`/`implementSync`) composed over `effect/unstable/rpc` `Rpc.make` (`Rpc.ts` L902) / `RpcGroup.make` / `RpcClient.make`; live vocabulary precedent `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts` (`Payload` L46 / `Success` L87 / `Failure` L201 against `HttpApiEndpoint`, in a driver `domain/` — the amendment reconciles it). NET-NEW: the per-slice codemods; `beep architecture move concept --kind` (needs a new `ArchitectureOperationKind` member or a v2 plan — the four current kinds cannot express a relocation); the `Contract` concept module itself; the `contracts/` + `handlers/` file set and the `add role --op` emitter. |

## Sequencing

1. **`slice-topology-audit` P0 — doctrine amendments PR.** One
   `standards/architecture/DECISIONS.md` entry per locked decision (kind
   folders in every tier; entry-file = subpath name; tables `.converters`;
   test lens grammar + twin rule; barrel shape; `$I` key grammar; Layer
   naming; error naming; role-member vocabulary (+ the `ARCHITECTURE.md`
   L1778 / `04` L213 example fix); operation contracts (`contracts/` +
   `handlers/` sub-folders, `Contract`/`Handler` members, `Contract` kit
   home) with their six deferred sub-choices; plus the two open doctrine
   forks the grill surfaced:
   per-concept `<Concept>/server.ts` subpath admit-or-forbid (live exemplars
   `packages/documents/use-cases/src/{aggregates/Document,entities/SyncConflict,entities/SyncCursor}/server.ts`;
   DEFERRED `BN-12`), `.processes.ts` tier), then the text edits in `ARCHITECTURE.md` (tree L827-952, role
   tables L969-1129, entry-file rows), `13`, `09`, `10`, `08`, `05`. Why
   first: the auditor's `LiteralKit`s must be transcriptions of the text, not
   a second source of truth.
2. **`slice-topology-audit` P1 — command + baseline PR.** `audit` with
   `--json`, `--slice`, `--tier`, `--write-baseline`; the initial
   `architecture.audit-baseline.jsonc` (new, under `standards/`) generated from `main` (every
   current drift finding, keyed by identity, becomes an owned `follow_ups` row); the CLI's own
   tests assert that `AcceptedProofManifest` files are audit-clean *after*
   step 3 lands (until then, the proof's nine divergences are baseline rows;
   NET-NEW test beside the v1 replay in `test/architecture-operation-plan.test.ts`
   — no existing test references `AcceptedProofManifest`). The command walks
   packages with `@beep/repo-utils` `resolveWorkspaceDirs` and ratchets through
   `cli/src/internal/ratchet` (`diffMembership` / `diffTotals` /
   `enforceRatchet`), the same substrate as the coverage, knip, JSDoc and
   test-typecheck ratchets — no new ratchet code.
3. **`slice-topology-audit` P2 — lane PR.** Register `architecture-audit` in
   `CiLane.ts`'s closed registry (`CiLaneId` tuple, descriptor, `$match` arm
   via `bunRunStep`, flags, local default list — the `knip` lane is the
   template), clone the `knip` job in `check.yml`, add the `GithubChecks.ts`
   row; `lint policy` (`rootRepoLintPolicySteps`) + `beep:preflight` wiring;
   yeet `verify` tier. Which context is *required* is DEFERRED (DECISIONS
   *deferred rows*, `audit lane host`): the lint-policy step already rides the
   required `Heavy / Lint Policy` context, so the dedicated lane may end up as
   local ergonomics rather than a new required check.
4. **`canonical-proof-reconciliation` P0 — manifest + lab PR.** The nine
   proof divergences (`synthesis/15`) plus converters in the two lab tables
   and `…Live` Layer names; the member renames (`WorkItem` → `Model`,
   `workItemTable` → `Table`, `WorkItemClient` → `Client`, …) and a
   `contracts/` + `handlers/` set replacing `WorkItem.http.ts`'s hand-typed
   factories (the `Contract` kit extends `@beep/schema/Fn`'s statics +
   `implement` shape over `Rpc.make`; the two converters follow
   `CandidateClaim.converters.ts`); `architecture-operation-plan.test.ts` fixtures
   regenerate; baseline burns the lab rows down to zero.
5. **`canonical-proof-reconciliation` P1..P7 — one PR per slice**, in
   descending baseline-count order (epistemic, law-practice, documents,
   workspace, ontology, agents, shared — seven PRs; `architecture-lab` is
   finished in step 4 and does not reappear). Each PR:
   codemod (folders, suffixes, member renames with `ts-morph` rewriting the
   deep-import sites, `.rpc.ts` → per-op contracts) → `audit --write-baseline`
   → shrinking `follow_ups`. Optional
   packets stay in `follow_ups` under cleanup-on-touch if the appetite runs
   out.

Follow-ons (gated, reopen this packet at `decompose` when the gate fires):

| Candidate | Gate |
| --- | --- |
| `family-anchor-audit` — rule pack for `drivers`, `foundation/*`, `tooling/*` anchors (ARCHITECTURE.md L681-711) | `slice-topology-audit` closed and the slice baseline below 50 rows |
| `move-concept-codemod` — `beep architecture move concept --kind` across all tiers | first entity→aggregate reclassification after kind folders are universal |
| `contract-test-lens` — make `08-testing`'s `.contract.test.ts` suite real (0 files today) | first port with two live adapters lands |

Unresolved measurement rows (no grill decision chooses "good"; see
`synthesis/40` §"Rows the grill measured but did not resolve"):
`dir:package-shell-skeleton`, `BN-19`, `tests:coverage-ratio-by-tier`,
`tests:typecheck-covers-test-tree`, and the `v4-only` policy rows `BN-12`,
`BN-14`, `BN-15`. They enter `slice-topology-audit` as DECISIONS questions in
P0, not as rules — each already carries a recommended answer (DECISIONS *deferred rows*) and a terminal mechanism (`synthesis/40`). The 2026-08-30 capability gate added one more deferred choice, `audit lane host` (P2), with its recommendation in the same table.

## First Vertical Slice

For `slice-topology-audit`: after the amendments PR, run
`beep architecture audit --slice architecture-lab --json` on `main`
and get a report whose finding set equals an explicit expected-path set that
P0 re-derives against the *amended* doctrine: `synthesis/15` §2's 14 manifest
line locations across the nine divergence categories (`.repository`,
`.use-cases`, server `.http/.rpc/.tools`, `tables.ts`, config `layer.ts` +
`.layer`, `.client`, `.view-model`, port errors in the ports file) minus the
rows the ratified `.view-model.ts` and `<Concept>/server.ts` admissions
legalize, plus the two missing `.converters` files — no fixed count is the
bar. Each finding carries `expected`/`actual` paths; `--write-baseline`
produces a baseline whose `architecture-lab` finding identities equal that
set; a second run exits 0. That
proves the walker, the vocabularies, the report schema and the ratchet on
the smallest slice before the lane goes required.

For `canonical-proof-reconciliation`: the manifest + lab PR makes the same
command return zero findings for `architecture-lab`, and
`architecture-operation-plan.test.ts` still replays the v1 fixtures.

## Open Risks Inherited From The Brief

- Server `.<port-name>.ts` is open-ended: closed vocabulary ∪ port names
  parsed from the slice's `.ports.ts` files; no heuristics.
- Kind-folder moves rewrite `package.json#exports` subpaths; codemods must
  move exports and consumers together, and the audit checks
  `exports ↔ folders`.
- Concept reclassification renames across up to seven packages; accepted
  cost, codemod-only.
- `shared` keeps its reduced spine; rules are keyed by package role.
- `$I` key renames change persisted tag strings; ratchet, never bulk-rewrite.
- `coverage/` mirrors pollute naive counts; the walker excludes them.
- The `architecture-operation-plan/v1` replay contract: proof renames change
  fixture *content*, not plan structure; verify old plans still decode.
- Member renames touch every consumer of a concept (724 deep named import
  sites repo-wide): a per-slice PR that renames `class X` → `Model` without
  rewriting import sites in the same codemod breaks the build; the codemod
  must move symbol and consumers together and show `_tag` strings unchanged
  (`$I` keys carry the path).
