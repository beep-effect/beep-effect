# Dock canonical test batch proof

All 44 saved findings are reconciled in dependency order. The batch preserves
the headless Dock kernel, actual Atom registries and configured Pretext capture
fixtures. It makes no production, browser, React or native font-capture change.

- Three formerly unclosed registries now have independent native layer scopes.
  Disposal probes pass; unclosed controls preserve all old assertions but fail
  teardown probes. See `dock-resource-proof.md`.
- Twenty-two Option assertions use public helpers. Conservation accounts for
  all 277 original assertion expressions and 112 registrations before property
  wrapper removal. Whole event-array equality remains intact.
- Two native properties retain the independent DockSnapshot and AnchoredBox
  domains, exact codec/equality laws and 24/100 floors. A 400-run sweep with
  seed 20260708 passes the 37-test cohort. Both inverted laws fail with shrinking
  and replay evidence. The rejected-transition test adds a pre-call immutable
  snapshot; its mutation control fails where the old alias comparison passes.
  See `dock-property-proof.md`.
- Three reactive minima cases await actual capture fibers instead of scheduler
  yields. The failure case validates the typed fixture error before accepting
  the empty fallback. Asynchronous capture passes; never-completing capture
  fails at the unchanged deadline while the old check passes. See
  `dock-capture-proof.md`.
- All 12 test files use the instrumented runner. The shared run-count helper
  and runner dependency changes have separate cache reviews: each reviews 14
  Dock nodes and adds nine dependency edges, preserving commands, configuration,
  unrelated nodes and qualification state.

Final package verification passes audit (7.0 s) and docgen (3.4 s). Root Oxlint,
Fallow health/audit, cache policy and dependency ordering pass. Root Oxlint
required hoisting the new runtime error decoder; the final timings were captured
again after that fix rather than attributing earlier measurements to new source.

Both Node and Bun pass all 112 tests before and after, with zero skips and
stable tracked-source hashes. Whole-command observations are Node 4.8224 s to
3.8705 s and Bun 2.5182 s to 1.9169 s. Load, pressure, limits and hashes accompany
the public timing artifacts. These single observations are not causal speedup
claims. Final measurements refer to source commit `40ffaf0d43`.

The final syntax inventory retains 14 reviewed exceptions: ten unchanged native
layer budgets, three already-public success assertions and one whole-event
comparison. Twenty-nine old detector rows are fixed; the eight other historical
rows retain explicit exception judgments. All seven actionable resource,
property and flake judgments are fixed. No obsolete finding is silently dropped.
Strict validation covers 6,202 unique root IDs and 13,953 unique ledger IDs,
owned bounds, the file census and timing schemas. Hashes of 683 unrelated ledger
files and raw unrelated root/census objects remain unchanged.

The saved remaining inventory is now 41 packages / 1,988 findings. This batch
closeout does not claim the consolidated goal or its hosted merge gates are
complete.
