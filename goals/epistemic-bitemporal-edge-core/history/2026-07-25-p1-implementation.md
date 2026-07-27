# P1 Implementation Evidence — Vertical Slice Landing

**Date:** 2026-07-25
**Packet:** `goals/epistemic-bitemporal-edge-core`, phase P1
**Branch:** `feat/epistemic-bitemporal-edge-core` (base `57c475f724`)
**Design contract:** session scratchpad `P1-DESIGN.md`, derived from
[`ops/handoffs/p0-to-p1-handoff.md`](../ops/handoffs/p0-to-p1-handoff.md); every
ratified P0 decision implemented exactly, deviations recorded per lane below.

## Lane summary

| Lane | Scope | Verification | Status |
| --- | --- | --- | --- |
| domain | `@beep/shared-domain` EntityIds (`EdgeVersionId`, `ClaimDispositionId`); `@beep/epistemic-domain` values (`EdgeRelation` + symmetric subset, `EdgeEndpoint` tagged union, `LogicalEdgeIdentity` + `logicalEdgeKey` digest, `ClaimDispositionStatus`) and entities (`EdgeVersion` with derivation header, `ClaimDisposition`), flatten/unflatten endpoint projections | domain: tsc clean, lint clean, vitest 3 files/24 tests, docgen 114 examples; shared-domain: tsc clean, lint clean, vitest 7 files/56 tests, docgen 265 examples; digest byte-parity vs spike `node:crypto` proven | complete |
| tables | Four `EntityTable.pgTableFrom` projections + converters (`CandidateClaim`, `Evidence`, `EdgeVersion`, `ClaimDisposition`), `DbSchema` extension, dtslint update | `bun run check` (tsgo incl. new tsconfig.test.json) clean; vitest 13 tests with 100% coverage thresholds held; tstyche 46 assertions; docgen 50 examples; **mechanical column-parity assertion against the migration DDL** (STOP condition not triggered) | complete |
| use-cases | `EdgeAuthority` module (typed errors with mapping statics, commands with required `validFrom`, repository port), `ClaimDisposition` module (port + `resolveClaimGateOutcome` closing the `ClaimLifecycle.service.ts:116` rejected no-op by composition — that file untouched) | `bun run check` clean, vitest 15/15 (incl. `S.toArbitrary` property test on the millis boundary), biome clean, docgen 66 examples, `beep lint schema-first` exit 0 (3 sanctioned exceptions, 2 findings restructured) | complete |
| db-admin | `drizzle/20260726000000_epistemic_bitemporal_edge/migration.sql` (all P0 constraint semantics, production names), `EpistemicEdgeMigrationTarget` + `targets.ts` registration, two `AcceptedProofManifest` entries, `EpistemicEdgeMigration.pglite.test.ts` proof (exact 14-constraint + 7-index catalog assertions, converter round-trip, open-head adversarial probe) | db-admin check/unit (7)/integration (3) green; repo-cli architecture-operation-plan 17/17; docgen 9 modules/11 examples; desktop codegen:check green | complete |
| extension lanes | `@beep/test-utils` `inProcess.extensions` seam; NINE whole-folder migration consumers flipped to in-process + `btree_gist` (two db-admin tests, three slice-server suites, three desktop tests incl. flag-gated e2e; one self-healed via `makeBundledPgliteLayer`); desktop sidecar registers `btree_gist` for probe + live layers | all flipped suites green (3+3+6+1+1+6 tests); gate-branch unit test extended (14/14) | complete |
| server | `EdgeAuthorityRepositoryDrizzle` (atomic close-and-insert supersession over `PostgresDrizzle`, canonical asOf/latest reads) + `ClaimDispositionRepository` (drizzle + in-memory) + `resolveClaimGateOutcome` wired into layers; behavior suite ports every spike scenario against the real repository API | `bun run check` (incl. tsconfig.test.json) clean; unit 1/1 (EpistemicServer.test.ts byte-unmodified); integration 10/10 (round-trip, retroactive correction with boundary instants, fact-became-false, out-of-order, disjoint no-op, malformed-interval → EdgeConstraintViolation, staleVersion/lockLoser/backstop conflicts, disposition e2e); biome clean; docgen 16 examples; schema-first exit 0; fallow boundaries regenerated + check green | complete |

### Server-lane ratified refinements (beyond the P0 handoff)

- **Constraint-name → typed-error mapping** (extraction via
  `PostgresError.fromUnknown(...).constraintName`, names never prose):
  `epistemic_edge_open_head_idx` / `epistemic_edge_no_overlap` →
  `SupersessionConflict.backstop`; every other named constraint →
  `EdgeConstraintViolation.on(operation, constraintName)`; constraint-less
  driver failure → `EdgeRepositoryUnavailable.during`; locked head with wrong
  version → `staleVersion`; zero lockable rows or guarded close touching none
  → `lockLoser`. Mapper is idempotent (typed errors pass through).
- **Head disambiguation:** `expired_at IS NULL` can hold two rows after an
  out-of-order arrival; supersession prefers the row open on BOTH axes (the
  open-head-index sense) and falls back to the highest version when none is
  valid-open, so late arrivals are never rewritten at the wrong end and a
  fact-became-false-closed head remains correctable.
- **Derived public ids:** `epistemic_edge_version_a<logicalKey>v<version>`
  (uniqueness inherited from `epistemic_edge_logical_version_unique`);
  documents-server precedent; keeps the repository layer at
  `RIn = PostgresDrizzle` with no Crypto/CuidState requirement.
- **Layer surface:** `EpistemicServerLive` keeps `RIn = never` (gate,
  transition, resolver, in-memory dispositions);
  `EpistemicServerDrizzleLive` adds the persistent repositories over
  `PostgresDrizzle`. No in-memory `EdgeAuthorityRepository` — its guarantees
  are the database's.
- **orgScope/orgId consistency** moved to the command schemas as a cross-field
  check (use-cases lane) after the server lane declined to invent an
  unmodeled error for it.

## Provenance duties discharged (S1 plan)

- `THIRD_PARTY_NOTICES.md` — drafted Graphiti section landed verbatim (pin
  `v0.29.2` @ `ff7e29cc`, Zep copyright 2024–2025, no upstream NOTICE ⇒ no
  §4(d)).
- `licenses/Apache-2.0.txt` — the DONOR'S OWN LICENSE bytes vendored
  (SHA-256 `2825300b…a372650` verified on fetch), not a canonical download.
- §4(c) derivation headers on the three carriers: `EdgeVersion.model.ts`
  (temporal axes), `EdgeAuthority.commands.ts` (supersession contract),
  `EdgeAuthority.repo.ts` (transactional reimplementation) — each with a
  file-specific divergence line.

## Retirement doctrine trigger

Recorded 2026-07-25 at the top of
`standards/memory-architecture/04-decision-log.md`; `AGENTS.md` memory line
updated; `docs/agent-memory-infra/00-recommendation.md` cleanup list annotated
as actionable. No product/operator coupling introduced.

## Ratified decisions applied during P1 (not in the P0 handoff)

1. **Migration-proof lane pinning.** The whole db-admin drizzle folder now
   contains `CREATE EXTENSION btree_gist`, which the shared pglite-socket
   integration lane (testcontainers image, pglite 0.4.x, no extensions map)
   cannot load. All migration-applying suites are pinned to the in-process
   driver with `btree_gist` registered via the new test-utils seam — the P0 S4
   named substitution ("extension-dependent proofs run on pglite-inprocess and
   pg-external only"). Cost accepted: those suites no longer exercise the
   shared external server; the in-process engine is the same one the desktop
   sidecar ships.
2. **SPEC Exception Ledger** gained the drafted raw-SQL constraint ownership
   row (kit ceiling: `EntityTable.pgTableFrom` + drizzle-orm 1.0.0-rc.4 cannot
   express CHECK/FK/EXCLUDE/partial indexes).
3. **`beep architecture` cannot author epistemic db-admin files**
   (`dbAdminProofTargetAllowed` gates the db-admin role to architecture-lab
   concepts): the sanctioned path is hand-author + `AcceptedProofManifest`
   registration, with the operation-plan test as the byte-equality proof.

## Deferred to end-of-branch (single-shot, after all lanes land)

- `bun run beep quality jsdoc-inventory` regeneration (new exports, 4+ packages).
- `standards/schema-catalog.generated.jsonc` — staleness is repo-wide at HEAD
  (~2,246-line regen of which this branch contributes ~10 entries); attribute
  as inherited vs regenerate once, decided at verify time.
- `standards/fallow.boundaries.generated.jsonc` regeneration after the spike
  devDependency revert.
- Spike deletion (suite + entire fixtures tree + devDeps + tsconfig reference +
  docgen mappings) once the server lane no longer needs the porting sources.
- P1 changeset (additions + `@beep/pglite` devDependency removal).

## Restart proof and real-Postgres race determinism (server lane follow-up)

- `EdgeAuthority.restart.pglite.test.ts` — two scopes over one persistent
  dataDir (`@beep/pglite` `makeLayer({ dataDir, extensions: { btree_gist } })`);
  scope 2 re-runs NO migration: both as-of answers exact off disk
  ((1500,1500)→"100", (1500,2500)→"150"), lineage and the rejected disposition
  (resolvedAt 1500, violation message verbatim) survive, and the exclusion
  constraint is still live through the typed repository error.
- `EdgeAuthority.pg.test.ts` — opt-in real-Postgres lane
  (`BEEP_EPISTEMIC_PG_URL`, dedicated variable per the S5 lesson), two
  repository INSTANCES per race (per-instance write semaphore would otherwise
  serialize locally). Evidence run against `pgvector/pgvector:pg17`
  (PostgreSQL 17): migration reset/apply 75ms; race A (concurrent supersession,
  third-connection lock + `pg_sleep` choreography) 277ms — one winner at
  version 2, one typed `SupersessionConflict`, one open head with lineage;
  race B (concurrent creation) 11ms; race C (lock-skipping writer vs
  `epistemic_edge_no_overlap`) 8ms. 4/4, six consecutive runs, no flakes.
- **Ratified mapping correction found by race B:**
  `epistemic_edge_logical_version_unique` joins the conflict backstop set
  (`SupersessionConflict.backstop`). A duplicate `(logical_key, version)` is
  unreachable for a lone writer (version is derived as max+1 over rows the
  transaction locked), so it can only mean a lost creation race — and the P0
  handoff's concurrency rule already required "constraint violations from
  racing writers map to the same typed conflict". Postgres checks the btree
  unique index before the partial/exclusion indexes, which neither the raw-SQL
  spike (hard-coded distinct versions) nor the PGlite suite (existing head)
  could surface. Malformed writes remain distinguishable
  (`epistemic_edge_valid_ordered` → `EdgeConstraintViolation`, live-tested).
- **orgScope/orgId cross-field check** landed on both write commands
  (`S.check` filter with an attached `["identity"]["orgScope"]` path; a
  mismatched command is undecodable ⇒ unissuable, closing a silent two-tenant
  mixing hole). Two decode-rejection tests added; use-cases 17/17; server
  suite re-verified 11/11 read-only.

## Spike disposal and reverts (same PR, per handoff §2 item 9)

- Deleted `packages/drivers/pglite/test/integration/spike/` and the entire
  `test/integration/fixtures/` tree.
- Reverted the spike's `@beep/pglite` touchpoints: devDependencies
  `@beep/postgres` + `@electric-sql/pglite`, the `../postgres` tsconfig
  reference, and the seven `@beep/postgres*` docgen path mappings.
- Regenerated `standards/fallow.boundaries.generated.jsonc`
  (`fallow:boundaries:write`; check + doctrine-pinned layer-legality green).
- Driver verification after revert: `bun run check` clean, 7/7 tests
  (unit + persistent-dataDir).
- Changeset `.changeset/epistemic-bitemporal-edge-core.md` covers the twelve
  affected workspace packages (`@beep/repo-cli` is changeset-ignored).

## P2 verification outputs

- `bun run beep yeet repair` — outcome success, all lanes passed (dtslint-tsgo
  133 files, type-test 527 tests/1797 assertions).
- `bun run beep yeet verify` — first full run failed on six INTRODUCED
  findings, all attributed and fixed (no inherited/unrelated repairs):
  terse-effect flow-candidates ×2 (`rejectionReason`, `encodeScope` — rewritten
  to `flow`/direct `O.match` per the tersest-form law); `Order.string` →
  `Order.String` in the db-admin migration test (v4 trap; that package's
  test-typecheck blind spot); knip unresolved `bun-types` (devDependency added
  to use-cases); cspell terms `asof`/`unflatten`/`unrepresentable` (added to
  `.cspell/tech-terms.txt`); typos `CHECKs` prose (rewritten to "CHECK
  constraints" at 5 sites); two fallow CRAP-complexity findings on exhaustive
  column-walk test arrows (sanctioned `fallow-ignore-next-line complexity`
  suppressions with rationale); changeset gate (entries added for the two
  law-practice docgen-sync packages; the `--since` gate requires the changeset
  file to be git-visible — staged).
- **Final `bun run beep yeet verify`: outcome SUCCESS, exit 0** — lanes
  `advisory:01-fallow-feedback`, `full:01-pre-push` (global check, full
  docgen, full test incl. all epistemic integration suites, secrets/security/
  SAST/Nix, changeset parity), and `publish:00-head-install-preflight` all
  passed. Verdict:
  `.beep/yeet/runs/feat_epistemic-bitemporal-edge-core-9f6d3d11ef39/verdict.json`.
- Inherited-debt attribution: the repo-wide `schema-catalog` and
  jsdoc-inventory staleness at HEAD was NOT absorbed (regeneration reverted;
  only 416 of ~27,790 inventory diff lines were ours) — the full proof passed
  without them, confirming they are not gating.
