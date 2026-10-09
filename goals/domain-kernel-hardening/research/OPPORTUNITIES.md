# Tooling friction receipts

## 2026-10-09 — heavy admission environment

- Doing: P0 dependent typecheck through `beep-heavy`.
- Evidence: first invocation exited 1 before launch: `XDG_RUNTIME_DIR not defined`.
- Attribution: environment-only; this shell omitted the user-manager bus environment.
- Remedy: set `XDG_RUNTIME_DIR=/run/user/1000` and the matching user bus address on heavy invocations.
- Prevention: initialize these variables in the lane execution environment.

## 2026-10-09 — dependent check admission queue

- Doing: P0 blast-radius measurement before authoring the activation PR.
- Evidence: `beep-heavy` repeatedly reports `all 3 slots busy, waiting`;
  `lslocks` confirms all three machine-wide slot locks have live holders.
- Attribution: shared-capacity queue, not a compiler failure; no result yet.
- Prevention: expose queue position and wait duration in the shared wrapper.
  Preserve current slot count and memory caps; another lane's work is not interrupted.

## 2026-10-09 — variant default mapper inference

- Doing: compare FieldOption with constructor defaults during P0.
- Evidence: the curried fieldEvolve mapper widened model services to any;
  the dependent run produced cascading missing-context errors, starting at
  `Worker.model.ts:70`. EntityKit also had `effect(unnecessaryPipeChain)`.
- Attribution: introduced prototype defects, not a measured consumer requirement.
- Remedy: use data-first Model.fieldEvolve with contextually typed field mappers
  and a single pipe; rerun before treating the diagnostic count as blast radius.
- Prevention: demonstrate the concrete service-free type for variant combinators
  in a small compiler example before the dependent graph run.

## 2026-10-09 — admission slot configuration drift

- Doing: submit the corrected P0 comparison through the existing wrapper.
- Evidence: wrapper now reports `all 4 slots busy, waiting`; the brief described
  three, while live locks also showed a fourth slot.
- Attribution: external workstation configuration changed during the run.
- Action: keep using the canonical wrapper; this lane changes no slot or memory
  cap, and still runs at most two own heavy jobs.

## 2026-10-09 — historical source retired during pre-publish merge

- Doing: merge main before PR 1 publication.
- Evidence: #1566 removed the cited housekeeping-entity-stack changeset note;
  shared-domain, db-admin and desktop source were unchanged.
- Remedy: cite its verified local Git blob at #720. Stop the still-queued own
  publish unit before admission, amend the evidence, rerun packet checks and
  resubmit. No push or scanner run occurred; no push budget consumed.
- Prevention: mark historical change records with their commit from the outset.

## 2026-10-09 — private-package release policy contradicts the lane brief

- Doing: prepare PR 2 after publishing activation PR #1577.
- Evidence: brief step 5.5 requires a changeset for every changed versioned
  package, major when outside-kernel sites change. Main #1566 (`2eefbb64af`)
  now forbids notes for live private workspaces; ChangesetGraph.ts lines 600-621
  enforces it. Shared-domain, db-admin, desktop and workspace-tables are private.
- Attribution: inherited release-policy change, introduced after the brief's
  `7febc0287b` source snapshot; not an implementation failure.
- Action: stop before package implementation under the manifest's materially
  contradictory sources condition. Preserve the P0 plan and ready activation PR.
- Prevention: reconcile the lane's changeset requirement with the current
  manifest-aware policy before resuming P1. Do not change package privacy or
  weaken the guard from this lane.

## 2026-10-09 — resumed qualification waits for shared capacity

- Doing: resume P1 after the reconciled release-policy ruling, with one dependent
  typecheck and one migration-generation job.
- Evidence: both wrappers report `all 4 slots busy, waiting`; neither payload has
  emitted a compiler or generator result.
- Attribution: shared admission queue, not a code or migration failure.
- Action: preserve caps, use at most two own jobs, and poll their logs while
  preparing the exact measured fixture repairs. No other lane is interrupted.
- Prevention: show queue position and payload start time in the wrapper receipt.

## 2026-10-09 — compiler-only blast radius missed docgen and exact-column fixtures

- Doing: full package qualification of the measured soft-delete encoding.
- Evidence: kernel gate and shared-domain package verification pass; five table
  package docgen runs fail on 31 distinct example subjects missing the new
  selected-row column pair. Epistemic table tests fail five exact-column checks
  backed by two shared fixture definitions.
- Attribution: introduced by the new kit columns, not inherited failures.
- Action: stop at the brief's 40-mechanical-edit bound. Existing work is 37 sites;
  the additional 31 docgen fixtures and two column-map definitions raise the
  conservative total to at least 70. No further consumer edits or publish.
- Prevention: P0 compatibility measurements must include dependent docgen and
  exact-column tests, not only dependent typecheck. Measure both candidate
  encodings across that full surface before declaring a bounded migration.

## 2026-10-09 — run-3 admission remains queued

- Doing: qualify the authorized 70 mechanical sites through two beep-heavy batches.
- Evidence: both wrappers reported `all 4 slots busy, waiting`; no payload log
  existed at the first result-file poll. The wrapper emits its wait line only once.
- Attribution: shared-capacity queue, not compiler or package failure.
- Action: keep caps and at most two own admissions; poll result files every minute.
- Prevention: periodic admission receipts would distinguish queued from running.

## 2026-10-09 — slot floor changed while a wrapper was queued

- Doing: await the table-package proof, queued with a captured four-slot floor.
- Evidence: live heavy locks acquired a fifth slot and the canonical overrides
  now set a five-slot floor. The queued wrapper reads overrides only at startup.
- Attribution: external workstation admission configuration drift; no payload
  log or result existed for the queued table batch.
- Action: stop only this queued unit and resubmit through unchanged beep-heavy
  so it reads current settings. No cap or other lane unit was changed.
- Prevention: refresh the slot census during waiting or report captured and
  current floor values in periodic admission receipts.

## 2026-10-09 — independent PGlite table fixture missed migration fields

- Doing: run the six server test lanes after all nine package proofs pass.
- Evidence: four ProviderInstance tests fail with ProviderProbeUnavailable;
  prepareTable creates its own isolated table without either new column.
- Attribution: introduced fixture drift; inherited Drizzle select/insert columns
  now include the pair, but this test bypasses the db-admin migration folder.
- Action: add two nullable columns to this one test fixture definition. Final
  mechanical count is 71, within 90; no repository/model/behavior edits.
- Prevention: include independent SQL table fixtures in the P0 compatibility census.

## 2026-10-09 — default server tests exclude migration-replay suites

- Doing: execute the brief's exact six-server test command as PGlite proof.
- Evidence: five generated beep:test scripts exclude test/integration/**;
  the actual migration-replay files are located under that directory.
- Attribution: verification-plan gap, not a migration failure.
- Action: run the owner beep:test:integration script for architecture-lab,
  documents, epistemic and workspace, excluding **/*.pg.test.ts so only PGlite
  runs. Agents' isolated ProviderInstance fixture runs in the default suite;
  law-practice's default script includes its integration files.
- Prevention: name the integration task and verify test counts/skips in the brief.

## 2026-10-09 — production KG bundle DDL bypasses canonical table metadata

- Doing: repeat the exact six-server gate after the ProviderInstance fixture repair.
- Evidence: PracticeKg.projections.test.ts:2163 reports missing deleted_at and
  deleted_by_principal in the physical candidate-claim table. PracticeKg.claims.ts
  has independent CREATE TABLE definitions at lines 101 and 120, plus carry SQL.
- Attribution: introduced by the canonical audit-column additions; the production
  KG source is unchanged from main. Four explicit migration-replay suites pass.
- Action: stop under ownership boundaries; no production KG edit or weakened
  assertion. Cancel only the own still-queued parity unit; no payload result.
- Prevention: census independent production DDL and carry contracts during P0;
  use canonical metadata or owner-generated migration replay where appropriate.

## Run 4: shell lacked user-manager bus environment

Both beep-heavy launches exited before admission: "Failed to connect to user
scope bus" because XDG_RUNTIME_DIR and DBUS_SESSION_BUS_ADDRESS were absent.
Verified the current user's runtime bus socket and resubmitted with its explicit
runtime directory and bus address. No payload or unit was started by the failed
calls. A lane shell bootstrap that carries the user-manager environment would
prevent this avoidable launch failure. Reversal: remove the invocation-local
exports; no persistent configuration was changed.

## Run 4: heavy admission can starve existing waiters

The two beep-heavy batches remained queued for more than twelve minutes,
without a payload log or result file, while the five slot holders changed.
Metadata-only user-unit inspection shows both own waiters active with roughly
one MiB of memory each; no test had started. The wrapper retries flock every
five seconds without FIFO ordering, so slot turnover does not guarantee older
waiters progress. A FIFO admission queue with a waiting receipt would make
bounded lane qualification predictable. No budget or wrapper was changed;
reversal of any own retry is cancellation of that own unit only.

## Run 4: verify the installed Effect helper before coding

The first admitted six-server command failed at module import: "omit is not a
function". Record.omit is absent in the installed Effect v4. Replaced it with
Struct.omit after reading its installed signature and the local reference.
This was introduced by this run, not a bundle-schema failure. Checking the
installed helper surface before the edit would have prevented the failed gate
and re-admission delay. Reversal: revert the marker; no package pin changes.

## Run 4: compiler compatibility missed complexity from inline nullish defaults

Fallow audit/health failed two UsageRecord test generators in
EpistemicTables.test.ts: CC 11, estimated CRAP 37.1. The migration-following
fixture repair added two inline nullish defaults to functions already near the
limit. Reused the file's existing absentAsNull helper for only the new pair;
no behavior, assertion or slice model changed. A mechanical fixture recipe that
uses existing nullable-row helpers would have prevented this introduced red.
Reversal: restore inline defaults with kernel rollback. No suppression or
baseline edit was made.

## Run 4: external-schema parity changes a justified inventory anchor

Yeet publish refused at lint:effect-vitest with two new findings. The inherited
EV015 TestClock.adjust row in ContradictionDetection.golden.test.ts matches
origin/main. The authorized two-table parity assertion changes the statement
context of the existing EV002 scoped PGlite read-back exception in
PracticeKg.projections.test.ts: evidence and layer lifetime are unchanged, but
the v2 occurrence anchor changes and the scanner correctly requires re-review.
The standing inherited publish fallback cannot cover this own changed anchor.
Repair requires owner regeneration and reviewed exception retention in
standards/effect-vitest.inventory.jsonc, outside this brief's allowed generated
outputs. A lane-specific inventory ownership grant or owner-landed reviewed
inventory would prevent the scope hold. No inventory refresh, layer rewrite,
suppression or push was performed.

## Run-5 bounded inventory refresh unavailable

Task: re-anchor the existing PracticeKg.projections.test.ts EV002 exception through its owner command. Evidence: `bun run beep lint effect-vitest --help` exposes `--census`, `--write` ("Refresh the full-scan detector baseline"), and `--rows string`, with no occurrence/file selector. EffectVitestScan.ts writes the full discovered-source document. Run-5 permits exactly one anchor change and requires stopping if wider regeneration is necessary. Preventive improvement: an owner-supported reviewed single-occurrence re-anchor that retains reason/status and verifies unchanged counts. No inventory refresh was executed.
