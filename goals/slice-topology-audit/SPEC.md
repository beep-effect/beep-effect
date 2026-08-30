# Slice Topology Audit Spec

## Objective

Make the slice grammar mechanical. Land the doctrine amendments the
exploration locked, then ship `beep architecture audit` — a sibling of
`beep architecture check` that walks the existing slice packages, asserts
closed `LiteralKit` vocabularies shared with the generator, emits a
schema-versioned report, and ratchets against a committed baseline in a
required check. v4's boundaries do not change; its uniformity becomes a gate.

One path type for every slice file, each `∈` a closed vocabulary the auditor
asserts membership of (full grammar block: exploration
[`BRIEF.md` §"The grammar, as a schema"](../../explorations/v3-consistency-audit/BRIEF.md)):

```txt
SliceFile = packages/<slice>/<tier>/src/<kind>/<Concept>/<Concept>.<role>.ts
Member    = <Concept>.<role>.ts exports RoleMember[tier][role]      -- User.Model, User.Table, User.Repo
Operation = <Concept>/contracts/[<Group>/]<Op>.contract.ts           -- Payload, Success, Failure, Contract
            <Concept>/handlers/[<Group>/]<Op>.handler.ts             -- Handler, typed from Contract
```

Three PRs, in order (exploration [`MAP.md` §Sequencing](../../explorations/v3-consistency-audit/MAP.md)):

1. **Amendments PR.** One `standards/architecture/DECISIONS.md` entry per
   locked decision below, then the text edits in `standards/ARCHITECTURE.md`
   (tree, per-tier role tables, entry-file rows, the L1778 `Model` example)
   and `standards/architecture/{13,09,10,08,05,04}.md`. The auditor's
   vocabularies must be transcriptions of this text, never a second source.
2. **Command + baseline PR.** `beep architecture audit [--slice] [--tier]
   [--json] [--write-baseline]`; `AuditReport` / `AuditBaseline` `S.Class`
   schemas (`architecture-audit-report/v1`, `architecture-audit-baseline/v1`)
   beside `CanonicalSliceOperationPlan`; `standards/architecture.audit-baseline.jsonc`
   generated from `main` (every current drift a counted, owned `follow_ups`
   row); a CLI test asserting the accepted proof is audit-clean (baseline rows
   until `canonical-proof-reconciliation` lands).
3. **Gate PR.** A `rootRepoLintPolicySteps` step (the required context),
   `beep:preflight`, the yeet `verify` tier, and `architecture-audit`
   registered in `CiLane.ts`'s closed lane registry for local ergonomics.

## Decision Log (binding — from the graduated exploration)

Full grill log with rationale and rejected options:
[`explorations/v3-consistency-audit/DECISIONS.md`](../../explorations/v3-consistency-audit/DECISIONS.md). Links, not copies — the
exploration's entries stay canonical. Normative here:

1. **Casing** — PascalCase concept folders; not relitigated.
2. **Kind folders in every tier** (`aggregates | entities | values`), also in
   `use-cases`, `config`, `server`, `tables`, `client`, `ui`.
3. **Doctrine beats the canonical proof** — `.ports` not `.repository`,
   `.service` not `.use-cases`, server `.*-handlers`, port errors in
   `<C>.errors.ts`.
4. **Entry file = subpath name**, lowercase (`layer.ts`, `tables.ts`).
5. **Tables `.converters.ts`** admitted (`Row`, `Insert`, `toRow`, `fromRow`).
6. **Test file grammar** — flat `test/`, closed lens `LiteralKit`, per-concept
   twin ratchet; no mirrored `test/` tree.
7. **Barrel shape** — `export * as <Concept>` at kind and tier barrels; concept
   `index.ts` flat re-exports.
8. **`$I` identity gate** — presence on schema roles; key = src-relative path.
9. **Layer naming** — `<Port>[<Adapter>]Live` / `<Port>Test` / `<Port>InMemory`
   / `<Slice>ServerLive`; no live `Layer` exported from `use-cases`.
10. **Error naming** — bare tags in domain/use-cases; `*Error` only for drivers.
11. **Auditor shape** — sibling `audit`, never overload `check`; vocabularies
    colocated with `ArchitectureSliceRole` in `Architecture.schemas.ts`.
12. **Rollout posture** — baseline ratchet from day one; fail only on growth.
13. **Audit scope** — slice packages first; driver/foundation anchors are a
    later rule pack under the same report schema.
14. **Namespace member vocabulary** (2026-08-30) — role files export a fixed
    role-named member; the namespace carries the concept (`User.Model`,
    `User.Table`, `User.Repo`, `User.RepoLive`, `User.Errors`, `User.Id`,
    `User.Rpcs`, `User.Client`). Member table: DECISIONS *namespace member
    vocabulary*.
15. **Operation contracts** (2026-08-30) — `<C>.<Op>.Contract` =
    `Rpc.make(<Op>, { payload: Payload, success: Success, error: Failure })`,
    `<C>.<Op>.Handler` typed from it, `<C>.Rpcs = RpcGroup.make(...)`.
16. **Sub-choices ratified 2026-08-30** — `Repo` (not `Repository`); values
    bare inside the namespace with `Id` fixed; client member `Client`; the
    `Contract` kit is an `@beep/schema` concept module built as a sibling of
    `@beep/schema/Fn` (`SchemaUtils.withStatics` + `implement*`) over
    `Rpc.make`; `contracts/` and `handlers/` are the only sub-folders admitted
    inside a concept; one optional group level; the lint-policy step is the
    required context first, the dedicated lane is local ergonomics.

Nine DEFERRED items enter this packet's P0 with recommended answers
(DECISIONS *deferred rows*): `dir:package-shell-skeleton`, `BN-19`,
`tests:coverage-ratio-by-tier`, `tests:typecheck-covers-test-tree`, `BN-12`
(`<Concept>/server.ts` shims), `BN-14`, `BN-15`, the lab's
`WorkItem.client.ts` → client `.service.ts` and `WorkItem.view-model.ts` →
ui `.view-model.ts`. Ratify, do not re-derive.

## Non-Goals

- No return to v3 architecture: no protocol declarations in `domain`, no
  `.entity.ts` cluster kit, no per-entity error kit, no contract + `Live` in
  one file, no wildcard exports or shim files, no per-operation client
  folders.
- No casing relitigation.
- No overloading `beep architecture check`; the `architecture-operation-plan/v1`
  replay contract is untouched.
- No hard gate on day one; no hand-maintained allowlist.
- No driver/foundation/tooling anchors in the first rule pack.
- No slice codemods and no proof rewrite here — that is
  [`goals/canonical-proof-reconciliation`](../canonical-proof-reconciliation/README.md),
  which requires this packet's `architecture/slice-audit` capability.
- No mirrored `test/` directories; no new test lenses without a vocabulary
  change.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`schema-first-development`,
   `effect-first-development`, `yeet`).
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`,
   `standards/architecture/*`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, then the exploration
   packet [`explorations/v3-consistency-audit`](../../explorations/v3-consistency-audit/README.md).

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `standards/architecture/DECISIONS.md`, `standards/ARCHITECTURE.md`,
  `standards/architecture/{04,05,08,09,10,13}.md` (amendments PR only).
- `packages/tooling/tool/cli/src/commands/Architecture/` —
  `Architecture.schemas.ts` (vocabularies, `AuditReport`, `AuditBaseline`),
  `Architecture.command.ts` (`audit` subcommand), a new `Audit/` or
  `internal/audit/` rule module.
- `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts` —
  promote `classifyWorkspaceRole` to an exported `LiteralKit`-typed helper.
- `packages/tooling/tool/cli/src/commands/Lint/SchemaTopology.ts` — export
  the export-map ↔ concept-index regexes.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
  (`rootRepoLintPolicySteps`), `commands/Ci/CiLane.ts`,
  `.github/workflows/check.yml`, `Quality/internal/GithubChecks.ts`,
  root `package.json` (`beep:preflight`).
- `standards/architecture.audit-baseline.jsonc` (new).
- `packages/tooling/tool/cli/test/` — audit tests + the proof audit-clean test.

## Constraints

- **Design order:** schema (`RoleVocabulary`, `RoleMember`, `ContractMember`,
  `AuditReport`, `AuditBaseline`, rule ids as `LiteralKit`) → Effect
  `Context.Service` contract for the walker/rule engine → implementation.
- **Reuse, do not rebuild:** package discovery is `@beep/repo-utils`
  `resolveWorkspaceDirs` / `resolveWorkspacePackages`; the file walker is
  `Lint.command.ts:collectTypeScriptFiles`; the ratchet is
  `cli/src/internal/ratchet` (`diffMembership` / `diffTotals` /
  `enforceRatchet`); member checks use `ts-morph` through
  `createRepoTsMorphProject`. No new lint framework, no new ratchet code.
- **Open-ended server suffix:** `.<port-name>.ts` in `server` is checkable only
  as closed vocabulary ∪ port names parsed from the slice's `.ports.ts` files;
  no "looks like a port" heuristics.
- **`exports ↔ folders`:** the audit checks package export subpaths against
  kind folders so a half-moved package is a finding, not a runtime surprise.
- **`shared` keeps its reduced spine;** rules key by package role, never by
  "every slice has every tier".
- **`$I` key renames change persisted tag strings** — the audit reports them;
  it never rewrites.
- **`coverage/`, `dist/`, `node_modules/`, `.turbo/` are excluded** from every
  walk; the exploration's first numbers were polluted by coverage mirrors.
- **Generator parity:** `add role` accepts only `RoleVocabulary[tier]`; `add
  concept` emits kind folders in every tier; `AcceptedProofManifest` is itself
  audited.
- **Effect v4 only;** `effect/HashMap` / `HashSet` over native `Map` / `Set`;
  `LiteralKit` over hand-rolled literal unions; `Effect.fn` for generators.

## Acceptance Criteria

- [ ] Amendments PR merged: every decision in the log above has a dated
      `standards/architecture/DECISIONS.md` entry and the doctrine text
      matches it (tree, role tables, `Model` example, member table, contract
      quartet, `contracts/` + `handlers/`).
- [ ] `bun run beep architecture audit --slice architecture-lab --json` on
      `main` returns ≥ 14 file-level findings with `expected` / `actual`
      paths (the nine divergence categories in exploration `synthesis/15` §2
      plus the two missing `.converters` files).
- [ ] `--write-baseline` produces `standards/architecture.audit-baseline.jsonc`
      whose `architecture-lab` rows sum to those counts; a second run exits 0;
      an injected regression exits non-zero.
- [ ] The audit runs inside `lint policy` / `beep:preflight` / yeet `verify`,
      and `architecture-audit` is a registered `CiLane` id.
- [ ] `RoleVocabulary` / `RoleMember` / `ContractMember` are read by both the
      generator and the auditor from `Architecture.schemas.ts`.
- [ ] `bun run beep quality package-verify @beep/repo-cli` green.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| First vertical slice | `bun run beep architecture audit --slice architecture-lab --json` | ≥ 14 findings, schema-valid report |
| Ratchet | `bun run beep architecture audit` after `--write-baseline` | exit 0; exit ≠ 0 on an injected regression |
| Package proof | `bun run beep quality package-verify @beep/repo-cli` | green |
| Docgen | `bun run docgen:local` | green |
| Packet launcher size | `test "$(wc -m < goals/slice-topology-audit/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/slice-topology-audit/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/slice-topology-audit` | Passes |
| PR gate | `bun run beep yeet monitor` | `merge-ready: yes` |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (slice codemods, proof rewrite,
  driver/foundation rules).
- A doctrine amendment would overturn a locked exploration decision — stop
  and reopen the exploration at `align` instead.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Proof divergences are baseline rows | `architecture-lab` rows in `architecture.audit-baseline.jsonc` | `canonical-proof-reconciliation` | the proof is fixed in the next packet, not here | that packet's manifest + lab PR burns the rows to zero |
