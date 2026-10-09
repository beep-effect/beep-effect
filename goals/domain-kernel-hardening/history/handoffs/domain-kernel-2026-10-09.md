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
