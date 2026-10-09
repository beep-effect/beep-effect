# Domain kernel lane handoff — 2026-10-09

## P0 execution entry

- Base after initial fetch/merge: `36027982f2d1077458d66d9455c388ee109d19c8`; branch `feat/domain-kernel-hardening`.
  The lane began clean at `7febc0287b`; main fast-forwarded to the base above.
- Full lane brief read; lane owns only its packet and named kernel/migration
  surfaces. No PR merged by this worker; no published branch rebased.
- `.repos/alchemy` and `.repos/effect-workspace` are absent; Effect reference
  remains available. No external corpus read and no live database operation.
- Packet activation used `bun run beep goals set-status domain-kernel-hardening active`.
  Owner command appended event 2 and regenerated the trace, README lifecycle and
  ignored index. Unmodeled manifest keys are retained through in-place edits.
- Adopt plan before authoring: 12 entries, conflicts empty, one report row for
  SOURCES.md. After SOURCES registration: conflicts empty, no report rows.
- SPEC/GOAL reconciliation and D1-D8 drafted; GOAL size 3,521 characters.
- Packet checks so far: reflection lint blocking_findings=0; goals doctor
  blocking_new=0 and blocking_inherited=0. Final ordered packet set is pending.

### Partial compatibility evidence

- GeneratedByApp with constructor defaults: dependent Turbo check finished
  after 31.054 seconds of admitted execution, 79 successful / 102 planned,
  49 cached. Eight introduced TS2345 diagnostics in one fixture/test file,
  workspace/tables/test/WorkspaceTables.test.ts. Later packages were cut off
  by fail-fast; no complete downstream claim.
- Source census: four workspace insert converters explicitly omit the two new
  fields and need mechanical additions to preserve populated deletion metadata.
  Paths and exact test locations are in the P0 research note. No mechanical
  edits have been applied during this research phase.
- Initial FieldOption comparison: curried default mapper widened service types,
  and EntityKit had unnecessary chained pipes. Cascading downstream diagnostics
  are prototype defects, not a trustworthy consumer count.
- Corrected comparison queued as one beep-heavy job: data-first fieldEvolve for
  FieldOption, then GeneratedByApp with constructor and decoding null defaults;
  both dependent checks collect all failures with --continue=always.
- Runtime probes establish constructor omission yields Option.none and a null
  decoding default preserves omitted fixture inputs while encoding explicit null.
- Revert the prototype with git checkout -- packages before the activation PR.

### Decisions and reversal paths

SPEC Decision Log is normative and holds the complete rationale:

| Decision | Reversal |
| --- | --- |
| D1 live surface map | Revert reconciliation if restoring the historical stack. |
| D2 existing DomainModel retirement | A separately scoped contract must restore it. |
| D3 canonical auditColumns placement | Revert new fields and ProductEntity record amendment. |
| D4 encoding comparison; no CHECK | Revert prototype/fields and reassess before migration. |
| D5 additive nullable migration and bundle | Revert PR and generate drop-columns migration, preserving any later data. |
| D6 errors identity and re-export | Move class back, remove union and re-exports. |
| D7 exact SPEC exception to GOAL stop line | Revert GOAL/SPEC contract edits. |
| D8 SOURCES ledger (R3) | Remove file and researchReports; report row returns. |

### Friction and pending work

User-bus environment was absent on the first heavy invocation; retry uses the
existing user-manager bus. Shared admission waits and prototype inference defects
are recorded when observed in research/OPPORTUNITIES.md. The wrapper's slot count
changed externally from three to four; this worker changes no limits.

P0 corrected counts, chosen encoding, completion and PR 1 publish are pending.
PR 2 implementation, generated migration, verification, reflection and lifecycle
closeout have not begun. R1 superset/packet-stream checks are not yet applicable.

Orchestrator-owned stale ROADMAP items: platform re-entry bullet around line 349
and the Parked packets row around line 383 still describe domain-kernel-hardening
as waiting for KG scale / PRD P2 librarian. The cohort prose around line 406 also
names the packet. This lane does not edit docs/ROADMAP.md.

lane: domain-kernel
head: 36027982f2d1077458d66d9455c388ee109d19c8 (base head; P0 drafts and prototypes remain uncommitted)
PR(s): PR 1 none (P0 measurement pending) | PR 2 none (implementation not begun)
package-verify: not run (no final package implementation yet)
hosted-parity: test-tsgo: not run (P0) | docgen local: not run (P0) | jsdoc-ratchet: not run (P0) | knowledge refs: not run (P0) | fallow audit+health: not run (P0) | scoped coverage: not run (P0)
handoff: goals/domain-kernel-hardening/history/handoffs/domain-kernel-2026-10-09.md
open items: finish corrected measurement and both PR waves; D1-D8 reversals above; stale ROADMAP rows are orchestrator-owned

## P0 completion

Both corrected measurements finished; no own heavy unit remains running.
FieldOption: exit 2, 129/137 tasks successful, 33 diagnostics in 9 files.
GeneratedByApp with constructor/decoding defaults: exit 1, 131/137 tasks
successful, 32 diagnostics in 8 table-test files. Counts by package are in the
P0 note. FieldOption additionally requires a production fixture change;
GeneratedByApp preserves that fixture and keeps audit fields out of JSON writes.

D4 is selected: GeneratedByApp nullable codecs, constructor none and missing-key
decoding null defaults. No CHECK. Conservative mechanical bound is 36 edit sites
(32 fixture diagnostics plus four explicit insert converters), 12 files, zero
slice model/behavior edits. No mechanical edits applied yet. P0 prototype reverted
with `git checkout -- packages` before activation commit.

Db-admin drift preview has precisely the expected 52 nullable ADD COLUMN
operations in 26 audited baseline tables. This is introduced migration drift,
resolved by the required generated migration in PR 2; no non-additive drift found.
P0 manifest/PLAN marked complete and README moved to P1. D1-D8 reversals remain
as above. Packet verification and activation publish follow.

### Activation packet verification

Ordered packet set before commit: GOAL size <= 4000 pass (3,521 characters);
manifest jq pass; packet anchor/launcher search pass; git diff --check pass;
reflection-artifacts pass (blocking_findings=0, advisory_findings=0); goals doctor
pass (blocking_new=0, blocking_inherited=0). Three completion advisories name
other packets and are outside this lane. Kernel prototype has been reverted.

### Pre-publish main merge

Activation commit `091235b5bb`; main merge `653aef7039` brought in #1566
(`2eefbb64af`) and other base changes. Packet and named source packages were
unchanged. The release-policy baseline removed the housekeeping changeset note;
SOURCES/SPEC now cite its verified local Git blob at #720. The own publish unit
was stopped while still queued: no scanner run and no push occurred, so no push
budget was used. Evidence amendment and packet re-verification precede resubmit.

## PR 1 ready; PR 2 blocked before implementation

Published PR #1577 at exact head
`dd8bbccba6eecdc665e89548af0259285c0863e3`, then marked ready for review.
Publication passed cheap gates and head-install preflight; its one publish push
is used. No review-round or conflict-only push has occurred. R4 gate receipt was
written with this head and push time `2026-10-09T20:02:39Z`. The worker did not
merge. PR 2 branch `feat/domain-kernel-hardening-p1` was created from that head.

Main #1566 (`2eefbb64af`) materially contradicts brief step 5.5: the brief requires
changesets naming every changed versioned package (major for the measured forced
outside-kernel fixture/converter edits); `.changeset/README.md` lines 3-6 and
`ChangesetGraph.ts` lines 600-621 forbid notes naming live private workspaces.
Manifest reads confirm shared-domain 0.0.2, db-admin 0.0.2, professional-desktop
0.0.3 and workspace-tables 0.0.2 are all private. Scope excludes changing privacy,
CI or release policy. D9 records the stop and reversal: resume with a reconciled
brief, leaving release policy intact. P1-P3 remain pending; no implementation,
mechanical fixes, migration, bundle or reflection has been applied.

The own readiness monitor was cancelled through its owner command on this
blocked stop; status is terminated. Its proof inbox row was acknowledged
observed. Three Vercel deployment rows were acknowledged environment-only: each
URL reports build-rate-limit. No purchase or plan change was made. All own heavy
jobs are terminal. The external R4 merge-gate receipt remains for the orchestrator;
only the orchestrator disarms that gate. No readiness-monitor success is claimed.

Graft context estimate: approximately 116,260 tokens saved across source queries.

The report below describes the exact published PR 1 head; the local PR 2 branch
only appends the blocked receipt to packet prose. It is not an implementation PR.

lane: domain-kernel
head: dd8bbccba6eecdc665e89548af0259285c0863e3 (exact published PR 1 head; blocked receipt follows locally)
PR(s): PR 1 #1577 open, content-final and ready | PR 2 none (blocked before implementation; local branch exists)
package-verify: not run (no package edits retained; P0 prototypes reverted)
hosted-parity: test-tsgo: not run (P1 blocked) | docgen local: not run (P1 blocked) | jsdoc-ratchet: not run (P1 blocked) | knowledge refs: not run (P1 blocked) | fallow audit+health: not run (P1 blocked; publish cheap fallow audit/dead-code passed) | scoped coverage: not run (P1 blocked)
handoff: goals/domain-kernel-hardening/history/handoffs/domain-kernel-2026-10-09.md
open items: reconcile brief step 5.5 with main #1566 private-package changeset prohibition; then implement the measured 36 mechanical sites in 12 files, generate the 52 nullable columns in 26 tables, verify and close P1-P3. D1-D8 and reversals are above; D9 hold reverses on a reconciled brief. Orchestrator owns stale docs/ROADMAP.md platform re-entry bullet (~349), Parked packets row (~383), and cohort prose (~406). R1 completed-retained stream/superset checks are not applicable yet. PR 1 is not merged and no readiness success is claimed.
blocked: brief step 5.5 requires private-package changesets that main #1566 now forbids

## Run 2 resume — P1 work in progress

- Read the full reconciled brief, including the 2026-10-09 resume ruling. D9 is
  retained verbatim; D10 lifts the hold and adopts #1566's manifest-aware release
  policy. Only published packages get changesets. Reversal: revert D10 and the
  implementation before publication, without changing package privacy or policy.
- Current lane remains `feat/domain-kernel-hardening-p1`; the local blocked receipt
  `6001c4401b` is retained. Initial main merge changed only the unrelated GPU OCR
  packet, preserving its owner's work. This worker did not merge any PR.
- PR 1 #1577 remains open and ready. The existing orchestrator merge gate owns it.
  P1, P2 and P3 now publish separately under the latest resume ruling, superseding
  the older two-wave sequencing. No P1 publish push has occurred.
- Adopt plan: conflicts empty, no report entries. Active status preview is an
  owner-command no-op at revision 2. `.repos/alchemy` and effect-workspace absent.
- P1 adds the measured GeneratedByApp nullable fields with constructor none and
  decoding null defaults; no CHECK or enforcement. Error role extraction retains
  tag/fields/equivalence and re-exports through EntityRef; no exports-map edit.
- Four workspace insert projections now preserve encoded soft-delete metadata.
  New shared-domain tests cover null/omission, user-principal epoch-millis rows,
  none encoding, schema-derived property round-trips, and error-union equivalence.
- One dependent check and one migration generate job are queued through
  beep-heavy. Both report all four shared slots busy. No payload result is claimed.
  Biome checked nine touched TypeScript files and fixed five; diff whitespace clean.

### Forced changes without changesets (resume ruling and #1566)

| Package | Change | Why it would have been major | Reversal |
| --- | --- | --- | --- |
| @beep/shared-domain | Audit select/encode shape gains two nullable columns; public EntityRef error module | Existing selected-row fixture/projection sites require explicit fields under the old brief's rule | Revert fields, tests, error extraction and docs; generate drop-columns migration only after preserving later data |
| @beep/workspace-tables | Four explicit insert projections preserve deletion metadata | Existing consumer insert projections needed edits | Revert the two new projections in each converter together with kernel rollback |

The table will be extended for exact fixture edits and generated outputs after
qualification. No changed published package has been identified.

Mechanical converter files:

- packages/workspace/tables/src/entities/Workspace/Workspace.converters.ts
- packages/workspace/tables/src/entities/Turn/Turn.converters.ts
- packages/workspace/tables/src/entities/Thread/Thread.converters.ts
- packages/workspace/tables/src/entities/Message/Message.converters.ts

Orchestrator still owns stale ROADMAP platform re-entry bullet (~349), Parked
packets row (~383), and cohort prose (~406). R1 superset and stream checks will
be recorded at qualification; completed-retained is reserved for P3 closeout.

### P1 implementation evidence

- First dependent check: 135/137 tasks successful, 61 cached, 1m18.713s; exit 1.
  The only compiler diagnostic was introduced test TS377050 at AuditSoftDelete
  line 70; repaired with the pipeable guard form. The other red was expected
  db-admin drift before migration generation. No fixture/model diagnostics remain.
- Mechanical fixes: 32 fixture projections in eight files, plus four production
  projections. The ProviderInstance exact-column assertion adds the two column
  names (one additional mechanical assertion site), total 37 sites, below 40.
- Generated `20261009202131_audit_soft_delete` through db-admin's owner command.
  SQL validated as exactly 52 nullable ADD COLUMN statements across 26 tables;
  no CHECK, backfill, drop, rename or recreate. Desktop codegen and codegen:check
  pass. No live database used.
- D11 adds migration.sql and snapshot.json to the accepted architecture proof
  inventory, matching prior generated migration entries. Reversal: remove both
  entries with the migration and regenerate the desktop bundle.
- Full qualification submitted in two beep-heavy jobs; results pending.

### Remaining forced private-workspace changes without changesets

| Package | Change | Why it would have been major | Reversal |
| --- | --- | --- | --- |
| @beep/agents-tables | ProviderInstance nullable row fixtures and exact column assertion | Selected-row consumer fixtures require the new column pair | Revert fixture/assertion edits together with the kernel rollback |
| @beep/architecture-lab-tables | Two Worker select-row projections | Insert-shaped fixtures require explicit nullable columns | Revert the two fixture projections with kernel rollback |
| @beep/documents-tables | SyncConflict, SyncCursor, SyncItem and SyncOperation row fixtures | Selected-row consumer fixtures require the new column pair | Revert the four test-file edits with kernel rollback |
| @beep/epistemic-tables | Eight row fixture/projection sites | Selected-row consumer fixtures require the new column pair | Revert the test-file changes with kernel rollback |
| @beep/workspace-tables | Eight selected-row fixture projections, alongside four production converters | Selected-row consumer fixtures require the new column pair | Revert fixture and converter changes with kernel rollback |
| @beep/db-admin | Generated additive nullable migration SQL and snapshot | Required persistence contract adds two columns to each audited table | Revert the migration before rollout; preserve later data before any drop-column rollback |
| @beep/professional-desktop | Owner-generated migration bundle resync | Desktop migration consumers inherit the new persistence contract | Regenerate the bundle after reverting the migration |
| @beep/repo-cli | Accepted proof manifest includes the new generated files | Required architecture inventory changes with the persistence proof surface | Remove the two entries with migration rollback |

Mechanical fixture files:

- packages/agents/tables/test/ProviderInstanceTable.test.ts
- packages/architecture-lab/tables/test/WorkerTable.test.ts
- packages/documents/tables/test/SyncConflictTable.test.ts
- packages/documents/tables/test/SyncCursorTable.test.ts
- packages/documents/tables/test/SyncItemTable.test.ts
- packages/documents/tables/test/SyncOperationTable.test.ts
- packages/epistemic/tables/test/EpistemicTables.test.ts
- packages/workspace/tables/test/WorkspaceTables.test.ts
