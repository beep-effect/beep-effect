# Fallow fixture and duplication checkpoint

Retain every source case and expected result while separating independent case
runners, scene dispatch, iterator lifecycle logging and fixture projection.
Sequential Effect traversals keep case order and counters. Error assertions
combine tag and closed reason/limit fields so a wrong tag cannot skip a check.
The controlled custom-cleaner scenes use closed Match handlers, with unchanged
hash/equality/invocation order and mutable host/iterator state.

Shared runtime operations copy receipt data through the existing canonical
codec, sanitize callback-input failures, traverse HTML source points without
per-point allocations, and validate Python native storage under each caller's
original failure mapping. HTML yield cadence, early framing failure, native
word validation and snapshot-before-verification ownership remain intact.

Verification checkpoints:

- 76 tests across 21 changed server suites pass after sequential case extraction.
- 22 tests across six suites pass after the final custom-scene, host dispatch,
  builtin input-kind, prior-full, model mutation and regex-input changes.
- 59 tests across eight suites pass for shared scans, native input/framing,
  Python hash/Unicode, mention/document restoration, frozen editions and defaults.
- Server test compilation, scoped lint and formatting pass.
- The last new-only audit retains **eight complexity findings** (all fixtures or
  tests) and **13 introduced clone groups**. These are still required work.

The schema-first scan found only a moved existing CallbackSession test anchor
(309 to 313); its reviewed golden-evidence disposition and rationale are
unchanged. The next hosted/full policy scan must confirm that location update.
The full native HTML worker corpus remains hosted proof; it was not rerun
locally. No corpus count, expected outcome, suppression or threshold changed.
