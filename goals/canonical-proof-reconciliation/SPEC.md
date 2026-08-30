# Canonical Proof Reconciliation Spec

## Objective

Bring the CLI's accepted proof and the eight live slices onto the amended
grammar that [`goals/slice-topology-audit`](../slice-topology-audit/README.md)
makes mechanical. Fix `AcceptedProofManifest` + `architecture-lab` first, so
`beep architecture add concept` stops propagating drift, then one codemod PR
per slice, each proving itself by a shrinking audit baseline. Migrate the
uniformity, not the architecture: v4's boundaries stay; symbols, folders and
suffixes move.

PR train (exploration [`MAP.md` §Sequencing](../../explorations/v3-consistency-audit/MAP.md) steps 4–5):

1. **Manifest + lab PR.** The nine proof divergences (`.repository` →
   `.ports`, `.use-cases` → `.service`, server `.http/.rpc/.tools` →
   `.*-handlers`, `tables.ts`, config `layer.ts` + `.layer`, `.client` →
   client `.service`, `.view-model` → ui `.view-model`, port errors →
   `<C>.errors.ts`) plus `.converters.ts` in both lab tables and `…Live`
   Layer names; the member renames (`WorkItem` → `Model`, `workItemTable` →
   `Table`, `WorkItemClient` → `Client`, `WorkItemId` → `Id`, values bare);
   a `contracts/` + `handlers/` set (`Assign`, `Complete`, `Archive`,
   `Reopen`) replacing `WorkItem.http.ts`'s hand-typed factories via the
   `Contract` kit; `TemplateRetarget`'s file-body substring pass shrinks to
   `$I`-key rewriting; `architecture-operation-plan.test.ts` fixtures
   regenerate; the baseline's `architecture-lab` rows burn to zero.
2. **One PR per slice**, descending baseline-count order (epistemic,
   law-practice, documents, workspace, ontology, agents, shared — seven PRs;
   `architecture-lab` is finished by PR-1 and does not reappear): kind folders, suffixes, member renames with
   `ts-morph` rewriting every deep-import site to namespace access in the
   same PR, `.rpc.ts` → per-op contracts → `audit --write-baseline` →
   shrinking `follow_ups`. Leftovers stay in `follow_ups` under
   cleanup-on-touch when the budget runs out.

## Decision Log (binding — from the graduated exploration)

Full log: [`explorations/v3-consistency-audit/DECISIONS.md`](../../explorations/v3-consistency-audit/DECISIONS.md). Links, not
copies. Normative here, beyond the sixteen entries `slice-topology-audit`
enumerates:

1. **Proof vs doctrine precedence** — the doctrine wins; the proof is
   rewritten, never the standard.
2. **Namespace member vocabulary** (2026-08-30) — every rename in this packet
   targets the member table (`Model`, `Id`, `Errors`, `Repo`, `RepoShape`,
   `Service`, `Rpcs`, `Config`, `RepoLive`, `Live`, `Test`, `RpcsLive`,
   `Table`, `Row`, `Insert`, `Client`, `ViewModel`); the concept is carried
   by `export * as <Concept>` only.
3. **Operation contracts** (2026-08-30) — `contracts/<Op>.contract.ts`
   (`Payload`, `Success`, `Failure`, `Contract`) and
   `handlers/<Op>.handler.ts` (`Handler`); `Contract = Rpc.make(<Op>,
   { payload, success, error: Failure })` — the effect v4 option key is
   `error`; `Failure` is only the member name.
4. **Sub-choices ratified 2026-08-30** — `Repo`; values bare + `Id`; `Client`
   derived from `Rpcs`; `Contract` kit as an `@beep/schema/Fn` sibling;
   `contracts/` + `handlers/` only; one optional group level.
5. **Rollout posture** — every migration is a baseline delta; no big-bang
   rename; `main` never goes red for a pending slice.
6. **Appetite** — 1 PR per slice; the budget is a budget: what does not fit
   lands in `follow_ups`.

## Non-Goals

- No new audit rules, schemas, or gate wiring — those belong to
  `slice-topology-audit`; if a codemod reveals a missing rule, file it there.
- No return to v3 architecture (no domain-tier protocols, no entity cluster
  kit, no per-operation client folders, no `<C>Live` namespace prefixes, no
  `Account.AccountErrors`-style concept-in-member names).
- No bulk rewrite of persisted `$I` tag strings; ratchet them.
- No change to the `architecture-operation-plan/v1` plan schema; proof renames
  are content changes to fixtures.
- No casing relitigation.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`schema-first-development`,
   `effect-first-development`, `yeet`).
3. Governing architecture/package standards as amended by
   `slice-topology-audit`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, then the exploration
   packet [`explorations/v3-consistency-audit`](../../explorations/v3-consistency-audit/README.md).

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Architecture/internal/{AcceptedProofManifest,TemplateRetarget}.ts`
  and `packages/tooling/tool/cli/test/architecture-operation-plan.test.ts` +
  `test/fixtures/architecture-operation-plan/`.
- `packages/architecture-lab/**`, `apps/architecture-lab-proof/**`,
  `packages/_internal/db-admin/**` (manifest-covered proof paths).
- a new `Contract/` concept module in `packages/foundation/modeling/schema/src/`
  (sibling of `Fn/`), reconciling
  `packages/drivers/govinfo/src/domain/contracts/Search/`.
- `packages/{epistemic,law-practice,documents,workspace,ontology,agents,shared}/*/src/**`
  and their `package.json#exports`, `tsconfig` aliases (`beep tsconfig-sync`).
- `architecture.audit-baseline.jsonc` (new, under `standards/`) (`--write-baseline` per PR).
- Codemods under this packet's `ops/codemods/` following
  `goals/repo-crispening-orchestration/ops/codemods/*.codemod.ts`.

## Constraints

- **Requires `architecture/slice-audit`.** No codemod PR opens before the
  audit command, its baseline and its required check exist.
- **Codemods move symbol and consumers together.** 724 deep named-import
  sites repo-wide (UNMEASURED per slice): a PR that renames `class X` →
  `Model` without rewriting its import sites to namespace access in the same
  codemod breaks the build. Use `TSMorphService` / `createRepoTsMorphProject`
  (`commands/Laws/EffectImports.ts` is the import-rewrite precedent); show
  `_tag` strings unchanged (`$I` keys carry the path).
- **Kind-folder moves rewrite `package.json#exports`** subpaths and consumers;
  `beep tsconfig-sync` only re-derives aliases; the audit's `exports ↔
  folders` rule is the proof.
- **Concept reclassification** (entity → aggregate) renames across up to
  seven packages; do it with a `beep architecture move concept --kind`
  helper (NET-NEW; needs a new `ArchitectureOperationKind` member or a v2
  plan) — never hand edits.
- **The `Contract` kit is a sibling of `@beep/schema/Fn`,** not a fork:
  `SchemaUtils.withStatics` over `Rpc.make` with `Payload` / `Success` /
  `Failure` statics and a typed-identity `implement`. Schema → service →
  implementation.
- **V1 replay contract:** old `architecture-operation-plan/v1` plans must
  still decode after every fixture regeneration.
- **Never scaffold optional roles empty** (exploration R12): a `contracts/`
  entry ships with its handler body, never a shell — v3's 14/22 empty
  protocol files are the anti-pattern.
- **`coverage/` mirrors are excluded** from every count and walk.
- **Effect v4 only;** `effect/HashMap` / `HashSet`; `LiteralKit`;
  `Effect.fn`.

## Acceptance Criteria

- [ ] Manifest + lab PR merged: `beep architecture audit --slice
      architecture-lab --json` returns zero findings; `beep architecture add
      concept` emits role-named members, kind folders in every tier, and a
      `contracts/` + `handlers/` pair; `architecture-operation-plan.test.ts`
      replays the v1 fixtures and asserts the proof is audit-clean.
- [ ] `TemplateRetarget.ts` no longer substring-renames identifiers in file
      bodies (path + `$I`-key rewriting only).
- [ ] `@beep/schema` exports a `Contract` concept module; `drivers/govinfo`
      `contracts/Search` is reconciled to it or explicitly ledgered.
- [ ] One merged PR per slice, each ending with `audit --write-baseline` and a
      strictly smaller baseline; `follow_ups` names every leftover with an
      owner.
- [ ] Every codemod ships with a golden-diff test under `ops/codemods/`.
- [ ] `bun run beep quality package-verify` green for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Proof clean | `beep architecture audit --slice architecture-lab --json` | zero findings |
| V1 replay | `bun run --filter @beep/repo-cli test -- architecture-operation-plan` | passes |
| Baseline delta | `beep architecture audit --write-baseline` then `git diff` on the baseline under `standards/` | finding identities only disappear, never appear |
| Package proof | `bun run beep quality package-verify <touched @beep/*>` | green |
| Docgen | `bun run docgen:local` | green |
| Packet launcher size | `test "$(wc -m < goals/canonical-proof-reconciliation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/canonical-proof-reconciliation/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/canonical-proof-reconciliation` | Passes |
| PR gate | `bun run beep yeet monitor` | `merge-ready: yes` per PR |

## Stop Conditions

- `architecture/slice-audit` is not yet provided (no audit command, baseline,
  or required check on `main`).
- Required source files are missing or materially contradictory.
- A codemod cannot rewrite every consumer of a renamed symbol in one PR.
- A fixture regeneration breaks v1 plan decoding.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Persisted `$I` tag strings | any rename that would change a stored `_tag` | this packet | stored JSON / workflow activity names may reference them | a migration or an explicit ledger row per string |
