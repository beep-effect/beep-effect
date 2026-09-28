# Epistemic client canonical test proof

Source commit: `fb194e8541`. This batch closes the 15 saved actionable findings
for `@beep/epistemic-client` in the consolidated PR. It does not close the goal
or the separate use-case authentication-boundary finding.

All eleven fresh registries register disposal immediately with
`Effect.acquireRelease`. The two formerly synchronous cases now run inside
`it.effect`, so their previously absent disposal is scope-owned. All five
mounts use public `AtomRegistry.mount`; release ordering remains unmount before
registry disposal. Existing runtime initial values and captured TestClock
services remain unchanged. Forced defect and interruption controls in the
actual failed-review case each verified exactly that release order.

Seven four-yield delays now wait for the specific AsyncResult with
`AtomRegistry.getResult` and `suspendOnWaiting: true`. Expected failures are
awaited through Exit, with every original failure assertion retained. The
three temporal request pairs remain exactly `(2000,1500)`, `(2100,1500)` and
`(2100,1600)`. A temporary 50 ms handler delay failed the old test and passed
the new test. A preliminary twelve-yield probe did not distinguish the old
implementation and is not claimed as a successful negative control. All
temporary delays and control instrumentation were removed.

The native joint property preserves both schema-derived request inputs, both
encode/decode equivalence predicates and `fcRuns(25)`. Independently inverting
each predicate produced native replay seed `20260708` and shrinking. One
aggregate `Passed` assertion retires. The preservation check accounted for all
32 original assertions and 14 static registrations, expanding to the same 17
runtime cases; 21 assertions now use public helpers. Existing expected values,
RPC handlers, registry factories and protocol-routing cases remain unchanged.

Both files now use the shared runner. Its development dependency adds two
TypeScript references, two generated Fallow edges and eight reviewed cache
edges across 13 owned computations. Unrelated qualification state is unchanged.

## Verification

- Full package verification passed with 400 trials and seed `20260708`: audit
  8.5 seconds and docgen 3.7 seconds.
- Root Oxlint, Sherif, Fallow health, Fallow audit, cache policy and schema-first
  checks passed. Post-commit changeset coverage passed.
- Normal Node and Bun runs both passed all 17 cases before and after, with no
  skips and stable source hashes. Node whole-command observations were 4.3707
  seconds before and 5.3235 after; Bun observations were 2.4173 before and
  1.6666 after. Recorded load and CPU/memory/I/O pressure accompany these
  contextual observations; they do not establish causal performance gains.
- The current detector has no package findings. Reconciliation preserves 683
  unrelated ledger hashes and unrelated raw root/census objects.

Sixteen packages and 918 saved actions remain. This package proves in-process
atom/RPC behavior and pure protocol routing. It does not establish browser,
network transport, authenticated sidecar or full repository readiness.
