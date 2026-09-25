# Schema ratchet reconciliation preparation

The tracked schema detector baseline contains 596 rows, while the original saved
schema detector ledger contains 454. Reconciliation must account for that moving
main delta without treating missing original rows as automatically fixed.

A current row emission initially found 121 remaining schema candidates. The
subsequent actual baseline comparison (not row emission) reported five introduced
findings: three diagnostic wrappers in Conformance, a Fn result capture and the
changed live-clock case. Those were addressed as follows:

- Conformance diagnostics retain per-input labels in pipe form.
- Fn now uses Effect.exit throughout its failure observations, exact Cause.fail
  expectations for known failures, and typed-failure checks for validation errors.
- LocalDate's live integration case has a documented exception. It observes the
  actual UTC clock before/after the operation; existing TestClock cases already
  cover controlled time. Only this baseline entry was refreshed and classified.

Additional residue fixes move codecStatics expectTypeOf to @effect/vitest, add
five-second acquisition timeouts to both SHA-256 layers, identify each invalid
Age input, and use assertExitSuccess for the existing successful header Exit.

Actual ratchet proof: introduced=0, resolved=488. This is not empty-baseline proof.
In particular, 106 Effect.result candidates remain for the explicit Exit/Cause
migration. The HttpHeaders error-channel lens still needs its original typed
failures asserted before the preserved orDie conversions.

Validation: 95 affected tests across six files passed under Node and Bun; after
one final pipe-style correction, full schema package audit and docgen passed.
Coverage remains dependent on the pending runner-context prerequisite. No
canonical finding is credited with a fix SHA until the wave commit exists.

## Subsequent Exit/Cause and header follow-up

The remaining 106 detector candidates were a subset of 160 actual Effect.result
captures across 28 files. All 160 are now migrated, with original typed-error
payload observations preserved and Exit.hasFails distinguishing typed failures
from defects. The actual ratchet now reports introduced=0 and resolved=598.
Header rejection tests also assert family-specific typed errors without orDie
erasing the channel; see the runtime preparation receipt. Ledger attribution,
implementation commit, and coverage prerequisite integration remain outstanding.

## Scoped baseline reconciliation

The final compound StatusCauseError assertion uses canonical deepStrictEqual on
all enumerable payload fields. The initial direct conversion correctly failed
because StatusCauseInput is a class instance while the expected payload is a
plain object; projecting all enumerable fields preserves the original toEqual
contract without introducing a prototype-identity requirement or omitting fields.
Full package audit (9.1 seconds) and docgen (6.0 seconds) pass.

A fresh detector emission leaves only the documented LocalDate EV009 exception.
The schema baseline is reduced from 596 entries to that one exception: 595
resolved entries removed. All 8,061 non-schema entries preserve their values,
relative order, and original serialized row text. The subsequent actual ratchet
passes with introduced=0 and resolved=4; the four remaining resolved entries
belong to other packages and were left untouched. This is scoped baseline proof,
not an empty repository-wide baseline.

The saved schema detector ledger has 454 rows, including 78 EV001 and 63 EV007
rows; the pre-reconciliation baseline had 35 EV001, 28 EV007 and 122 EV005 rows.
Only 233 exact finding IDs and 337 occurrence fingerprints overlap. Therefore
absence from the current detector is insufficient to assign all saved rows to
this wave. Historical fix attribution and implementation commit references are
still required before ledger closure.

## First inherited-fix attribution

Direct review of b1aa7e320cde926e7e80a98073ba8b0d517d7c8c (PR #1200)
confirms the Cuid and Sha256 provideScopedLayer helpers and Cuid call sites were
removed in favor of it.layer. Their manual checkEffect/runSync properties became
it.effect.prop with the original fcRuns(25) floor and original payload checks.
Eleven saved detector rows and two property-diagnostic observability rows now
cite that landed commit. The current wave's added layer acquisition timeouts
and remaining assertion improvements are separate changes. Other rows stay open
until their individual provenance or implementation SHA is established.

## Pre-integration timing

The original configured Node Vitest JSON reporter command passed 725 tests in
78 files. Whole-command time is 6.510 seconds; reporter span is 5,992.55 ms.
The historical baseline was 717 tests, 6.317 seconds whole-command, and
5,965.52 ms reporter span. Runtime versions and test population differ, so this
is not a causal performance comparison. The timing context retains CPU, memory
and I/O pressure, memory availability, process limits and source-manifest hash.
Sources did not change during the run. Coverage and prerequisite integration
remain separate proof obligations.

All 786 schema ledger rows across the five lenses decode with the canonical
EffectVitestFinding schema using onExcessProperty=error after this attribution.
The first inherited batch is 11 detector rows plus two observability rows; it
includes three Sha256 Promise-runtime bridges replaced with yielded effects.
No other saved finding status was changed.

## Published implementation and lens dispositions

PR #1252 publishes implementation 369a8f6d981006937146f96cbb9e5ced4065f2ba
and main integration 58e11ec558c5271b6577ef56ffba27c8eb3366ce. It is stacked on
#1247 and must target main only after its prerequisite waves land. All 15 local
cheap-gate lanes passed at the published head.

Four resource, five property-oracle, one flake and 18 observability findings now
cite the published implementation. The detector ledger retains the documented
live-clock exception, preserving its original ID and evidence.

Attribution review caught a missed CSP run-policy migration: the inherited native
property still used bare runs:25. Repair 5cd27cd70555b4ee4798f1f4085909152f76e0c6 uses fcRuns(25),
preserving the source arbitrary, callback and minimum while honoring shared seed
and run configuration. Full package audit (10.6 seconds) and docgen (6.6 seconds)
pass. Its property finding cites this separate repair, not the earlier wave.

Current actionable schema ledger: 42 fixed, 1 exception, 468 open.
No-findings coverage rows remain intact. Remaining detector and property-runner
provenance still requires review; these counts do not claim wave completion.

The post-CSP timing artifacts supersede the preceding sample: all 725 tests in
78 files passed, whole-command time 5.758 seconds and reporter span 5,226.30 ms.
Source hashes remained stable. Runtime/load caveats remain unchanged. All 786
ledger rows pass the strict canonical decoder after these dispositions.

## Exact-occurrence detector attribution

Reconciliation uses the baseline at the parent of implementation commit
369a8f6d981006937146f96cbb9e5ced4065f2ba, not a moving-main scan.
All 362 still-open saved detector rows matching that baseline by file, rule and
occurrence fingerprint now cite the implementation: 35 EV001, 297 EV006,
28 EV007, one EV011 and one EV014. The actual post-implementation scan retains
only the separately justified EV009 live-clock exception. Assertion parity,
error-payload preservation and package proofs are recorded in the wave receipts.

The scoped pre-wave baseline also contained 233 findings absent from the frozen
ledger: 122 EV005, 108 EV006 and three EV014. They are appended with their original
IDs, evidence and occurrence fingerprints and the same implementation fix SHA.
No original row is deleted; there are no ID collisions or duplicate occurrence
keys in either input. This accounts for exactly the 595 resolved schema baseline
entries without counting unrelated package changes.

Actionable schema totals are now 637 fixed, one exception and 106 open. The
remaining open rows are unmatched historical detector findings and property-runner
observability judgments; they remain uncredited until their provenance is reviewed.

## Remaining historical findings reconciled

All 71 remaining EV001/EV007 saved evidence snippets match the parent source of
b1aa7e320cde926e7e80a98073ba8b0d517d7c8c after whitespace normalization.
At that commit, the relevant files contain no Arbitrary.checkEffect calls and
use native it.effect.prop; the 38 runtime findings also have no remaining calls
to their captured Effect.runSync/runPromise symbol. Twenty-six remaining
observability snippets independently match that same preimage and native-property
transition. These 97 findings cite the inherited commit.

Nine older EV006 assertion findings survived the codec migration under changed
syntax: HttpHeaders invalid creation, two Number rejection checks, four Options
None/Some checks, and two SchemaUtils optional-label checks. Their operand and
payload continuity is visible across the inherited migration and the current
implementation diff. They cite 369a8f6d981006937146f96cbb9e5ced4065f2ba,
which replaces them with canonical typed-error, Boolean and Option assertions.

The final scoped ledger has 743 fixed actionable rows, one documented live-clock
exception, and zero open actionable rows. All frozen rows and no-findings coverage
records remain represented; the 233 selected-package baseline-delta rows are
additional. This closes finding disposition only. Coverage integration, review
service availability, hosted proof against main and Benjamin's merge remain
required before calling Wave C complete.
