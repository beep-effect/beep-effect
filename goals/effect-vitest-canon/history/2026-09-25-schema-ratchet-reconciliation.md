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
