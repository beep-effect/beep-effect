# Execution Authority Slice Spec

## Objective

Move agent execution authority out of the epistemic slice into a new
`execution-authority` product slice without changing behavior (P1). Then link
each ontology Session change-journal entry to the decision that authorized it
(P2).

The 2026-10-21 architecture decision ("Epistemic Vocabulary Is Foundation;
Party Is A Product Slice; Propositions Are Slice-Owned") recorded the execution
values as misfiled and promised them their own home. This goal delivers that
home.

Graduated from [`explorations/execution-authority-home`](../../explorations/execution-authority-home/README.md):

- brief: [`BRIEF.md`](../../explorations/execution-authority-home/BRIEF.md)
- map: [`MAP.md`](../../explorations/execution-authority-home/MAP.md)
- decisions: [`DECISIONS.md`](../../explorations/execution-authority-home/DECISIONS.md)
- research: [`RESEARCH.md`](../../explorations/execution-authority-home/RESEARCH.md) and
  [`research/provenance-placement-ddd.md`](../../explorations/execution-authority-home/research/provenance-placement-ddd.md)

## Non-Goals

- Changing hash labels (`epistemic-execution-decision/v1`,
  `epistemic-execution-outcome/v1`, `epistemic-grant-set/v1`), canonical JSON,
  or ledger row semantics.
- Anchoring the chain tip. That is `agent-execution-record-anchoring`, gated in
  the exploration MAP.
- Extracting the gate or chain mechanism into `foundation/capability` before a
  second consumer exists.
- Re-export shims or deprecation aliases from epistemic packages.
- Any change to the epistemic slice's claim, edge, contradiction or retention
  code. The slice's direction is a separate grill that opens after P1 merges.
- New governed sinks, grant kinds or policy features.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- New packages `packages/execution-authority/{domain,use-cases,server,tables,config}`,
  created only with `bun run beep create-package`.
- The execution modules in `packages/epistemic/{domain,use-cases,server,tables}`,
  which move out, and `@beep/epistemic-config`, which is retired.
- `packages/_internal/db-admin`: the rename migration, its down-migration, the
  name-pinned tests and the schema composition.
- `apps/professional-desktop`: imports, `src/runtime/Layer.ts`,
  `server/OntologyMcpTransport.ts`, `.env.example`.
- `turbo.json` env keys and `changesets.retired-packages.json`.
- Tooling pins, including `FROZEN_GRANT_SET_DEFINING_MODULE`
  (`Laws/FrozenGrantSet.ts`).
- The `@beep/mcp-kit` and `@beep/api-transport` README port-inversion records.
- P2 only: `@beep/ontology-domain` Session change-journal entry (`authorizedBy`),
  the ontology server tool handlers, and the desktop wiring.

## Constraints

- Classify the new slice by domain kind from the first commit. Grant, grant set
  and verdict are values. Decision and outcome records are entities: they are
  chained by index and referenced by id.
- Hash bytes stay byte-identical. Keep importing `canonicalDetectionJson` from
  `@beep/epistemics`. Freeze the three `epistemic-*/v1` labels, with a comment
  at each definition explaining the name.
- One atomic P1 PR, with no aliases (`11-evolution-and-deprecation.md`
  "same PR, no alias").
- The rename covers tables, constraints, triggers and the guard function in one
  forward drizzle migration with a tested down-migration, run against a PGlite
  database seeded with pre-move rows.
- Env keys become `EXECUTION_AUTHORITY_*` with no fallback. The PR body and
  `.env.example` say a stale env unregisters the publish tool, which fails
  closed.
- `EpistemicServerDrizzleLive` drops `ExecutionLedger`. The desktop's app-local
  runtime Layer composes the new ledger layer.
- No slice imports another slice. Search for an existing `OptionalDefect`
  equivalent before copying it, and record the outcome as a decision.
- The P2 link is an IRI string. Ontology imports nothing from
  `@beep/execution-authority-*`.
- The behavior proof diffs observable state: the bound address, ledger row
  counts and `information_schema.columns` pins. A green test list alone is not
  proof (`agent-execution-authority` reflection).

## Acceptance Criteria

- [ ] P1: `rg '@beep/epistemic-config|epistemic-domain/values/(ExecutionGrant|GrantSet|ExecutionVerdict|ExecutionRecord)|epistemic-(use-cases|server)/ExecutionLedger|GovernedTierGate|GovernedEgress' packages/epistemic apps packages/_internal`
      finds no execution code left in epistemic and no import of it.
- [ ] P1: the desktop sidecar governs MCP mutations and publishes exactly as
      before. The pre-move and post-move recordings match for bound address,
      ledger row counts and column pins.
- [ ] P1: a PGlite database seeded before the move with decision and outcome
      rows (including a denial) migrates forward. Every row survives,
      `verifyExecutionDecisionChain` still passes, and the down-migration
      restores the old names.
- [ ] P1: `@beep/epistemic-config` is retired and recorded in
      `changesets.retired-packages.json`. The env keys are `EXECUTION_AUTHORITY_*`.
- [ ] P1: `ValueSchemaIdentifiers.test.ts` stays green for the remaining
      epistemic modules.
- [ ] P2: every governed Session change-journal entry carries an `authorizedBy`
      decision IRI next to `OntologyChangeActor`, and a test proves the IRI
      resolves to an allowed decision row.
- [ ] `bun run beep quality package-verify` passes for every new package and
      for each touched epistemic, ontology and desktop package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/execution-authority-slice/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/execution-authority-slice/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/execution-authority-slice` | Passes |
| Boundary: no execution code left in epistemic | `rg` command from the first acceptance item | No matches |
| Boundary: no slice-to-slice import | `rg -n '@beep/epistemic-' packages/execution-authority` and `rg -n '@beep/execution-authority-' packages/epistemic packages/ontology` | No matches |
| Chain survives migration | db-admin migration test over a PGlite database seeded before the move | All rows kept; chain verifies; down step restores names |
| Package handoff | `bun run beep quality package-verify` per touched package | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add execution-authority-slice --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug execution-authority-slice`; add a `kind: decision` file there, never edit this block._

### Keep importing canonicalDetectionJson from @beep/epistemics, 2026-11-06

A slice may import foundation; reusing the function keeps the bytes identical by construction. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (canonical-json).

Lane `docs/execution-authority-home-exploration`

Reverse: Promote a neutral canonical-JSON primitive to foundation/primitive with golden byte tests

### GovernedEgress moves with GovernedTierGate, 2026-11-06

Both sinks share one frozen grant set, one hash-chained ledger and one config. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (egress-scope).

Lane `docs/execution-authority-home-exploration`

Reverse: Split egress into its own home with its own ledger

### Freeze the epistemic-*/v1 hash labels byte-identical, 2026-11-06

They are hash inputs; changing them changes every new row's bytes. Comment each definition with why it keeps the epistemic name. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (hash-domain-labels).

Lane `docs/execution-authority-home-exploration`

Reverse: Mint new labels with a dual-prefix verifier

### Execution authority gets a dedicated product slice, 2026-11-06

A cross-cut gets its own slice (10-cross-slice-coordination.md section 5). packages/agents runs the model and would also judge its tools. shared needs two consumers and admits no adapters. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (home-slice).

Lane `docs/execution-authority-home-exploration`

Reverse: Move the packages into another home and repoint consumers in one PR

### Three pieces: the move, the authorizedBy link, then anchoring, 2026-11-07

The link is new ontology behavior and gets its own reviewable PR. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (brief-split).

Lane `docs/execution-authority-home-exploration`

Reverse: Fold the link into the move PR

### Rename EPISTEMIC_* env keys to EXECUTION_AUTHORITY_* with no fallback, 2026-11-07

Config owns its key namespace. A stale env empties the allowlist, which unregisters the publish tool and fails closed. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (env-keys).

Lane `docs/execution-authority-home-exploration`

Reverse: Restore the EPISTEMIC_* key names in the config package, .env.example and turbo.json

### Keep a session-keyed decision stream with denials; link Session changes to it, 2026-11-07

Provenance of a result attaches to the result; a decision that precedes, gates or never produces a result is its own record (research/provenance-placement-ddd.md). Session journal entries get an authorizedBy IRI next to OntologyChangeActor. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (ledger-shape).

Lane `docs/execution-authority-home-exploration`

Reverse: Collapse decisions into Session journal provenance and send denials to telemetry

### Search for an OptionalDefect equivalent before copying it, 2026-11-07

Reuse before recreate; copying without searching may trip the fallow duplication gate. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (optional-defect-helper).

Lane `docs/execution-authority-home-exploration`

Reverse: Promote the helper to a foundation package

### Behavior proof is a committed observable-state recording, diffed pre and post move, 2026-11-07

execution-authority-recording.pglite.test.ts drives the real desktop MCP transport over a migrated PGlite ledger: one allowed and one egress-denied publish. It records the sidecar bind host, verdict chains with verification results, outcome settlements, information_schema column pins, constraints and triggers. With EXECUTION_AUTHORITY_RECORDING_OUT set it writes JSON. research/recordings/pre-move.json (taken on cf46c70048) and post-move.json are identical after mapping the declared epistemic_execution_ prefix to execution_authority_.

Lane `feat/execution-authority-slice`

Reverse: Delete apps/professional-desktop/test/integration/execution-authority-recording.pglite.test.ts and the recordings

### No desktop runtime Layer change: main.ts already composes ExecutionLedgerDrizzle, 2026-11-07

EpistemicServerDrizzleLive no longer provides ExecutionLedger. apps/professional-desktop/src/runtime/Layer.ts only Layer.provides it to the contradiction QA seed, whose output never included the ledger, and server/main.ts already provides ExecutionLedgerDrizzle beside PgliteDrizzleLive to the governed MCP transport. Typecheck of @beep/professional-desktop and the four desktop integration suites confirm it.

Lane `feat/execution-authority-slice`

Reverse: Merge ExecutionLedgerDrizzle back into EpistemicServerDrizzleLive

### ExecutionRecord lives under entities/; grants, grant sets and verdicts under values/, 2026-11-07

SPEC Constraints classify decision and outcome records as entities. Domain and tables therefore export ./entities/ExecutionRecord and ./values/{ExecutionGrant,GrantSet,ExecutionVerdict}. Use-cases and server keep the epistemic concept folders (ExecutionLedger, GovernedTierGate, GovernedEgress), so the move stays a relocation. $I composer paths follow the new file paths. No test pins an execution identifier (RESEARCH section 6).

Lane `feat/execution-authority-slice`

Reverse: Move entities/ExecutionRecord back under values/ in domain and tables and update the export maps

### Promote optionalDefect to @beep/schema SchemaUtils instead of copying it, 2026-11-07

Search result (2026-11-07): no foundation helper combines `S.Defect` with `SchemaUtils.alwaysEquivalent` and `Effect.succeedNone`. The only equivalent is `law-practice/use-cases/src/internal/DefectCause.ts`, which another slice cannot import. A first copy into `@beep/execution-authority-use-cases` tripped the Fallow audit duplication gate (introduced clone `dup:f67f335a`, 6 lines). Following this decision's recorded reversal, the helper moves to `@beep/schema/SchemaUtils/optionalDefect`. Its two consumers, `EdgeAuthority.errors.ts` and `ExecutionLedger.errors.ts`, call `SchemaUtils.optionalDefect`, and the epistemic internal copy is deleted. The law-practice `DefectCause` takes no description argument and stays out of scope.

Lane `feat/execution-authority-slice`

Reverse: Restore packages/epistemic/use-cases/src/internal/OptionalDefect.ts and an internal copy in @beep/execution-authority-use-cases, then drop SchemaUtils.optionalDefect

### Rename migration covers named NOT NULL constraints; guard body unchanged; down.sql sits beside migration.sql, 2026-11-07

The forward migration renames both tables, every constraint through one DO block (PostgreSQL 18 names NOT NULL constraints, which ALTER TABLE RENAME leaves alone; the block is a single line, safe for the LegacyStatementBoundary splitter), the four triggers and the guard function. The function body and its RAISE text are unchanged, so behavior stays byte-identical. down.sql is the exact inverse. The drizzle migrator and the desktop bundler read only migration.sql, so down.sql is never applied automatically. ExecutionAuthorityLedgerMigration.pglite.test.ts seeds a pre-move database with an allowed-denied-allowed chain and two outcomes, migrates it forward, verifies the chain and outcome bindings, runs down.sql and checks that the old names and row counts are back. The db-admin target is renamed to execution-authority-ledger with schemaName execution_authority.

Lane `feat/execution-authority-slice`

Reverse: Run drizzle/20261107032821_execution_authority_rename/down.sql, then delete the folder and re-sync the desktop bundle

### Config symbols, span names and log subsystems take the slice name; digest prefixes stay frozen, 2026-11-07

EpistemicConfig, EpistemicServerConfig and the rest become ExecutionAuthority*. Spans Epistemic.{ExecutionLedger,GovernedTierGate,GovernedEgress}.* become ExecutionAuthority.*, and log subsystems become execution_authority_governed_*, because the instrumentation catalog keys span names by owning package. Hash and digest inputs stay byte-identical: the three epistemic-*/v1 labels and the run-key prefixes epistemic-run/ and epistemic-egress/. Each now carries a comment explaining why.

Lane `feat/execution-authority-slice`

Reverse: Restore the Epistemic* config symbols, the Epistemic.* span names and the epistemic_governed_* subsystem annotations

### Config follows its domain; the desktop composes the ledger; one atomic PR, 2026-11-07

06-configuration-boundaries.md, 01-hexagonal-vertical-slices.md and the same-PR rule in 11-evolution-and-deprecation.md fix these. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (settled-by-doctrine).

Lane `docs/execution-authority-home-exploration`

Reverse: Split the move into staged PRs with temporary dual composition

### Name the slice execution-authority, 2026-11-07

Matches agent-execution-authority and the Execution* vocabulary; bare authority collides with glossary terms. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (slice-name).

Lane `docs/execution-authority-home-exploration`

Reverse: Rename the packages in one PR

### Rename the ledger tables with a forward migration and a tested down-migration, 2026-11-07

Installed desktops keep PGlite data; hash inputs contain no table names; the prefix should name the owning slice. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (table-names).

Lane `docs/execution-authority-home-exploration`

Reverse: Run the down-migration to restore the epistemic_execution_* names

### Anchor the chain tip in a separate goal after this one, 2026-11-07

The move stays a relocation that preserves behavior; anchoring is a security feature with its own design space. Recorded in the exploration: explorations/execution-authority-home/DECISIONS.md (tip-anchoring).

Lane `docs/execution-authority-home-exploration`

Reverse: Fold anchoring into this goal's scope

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
