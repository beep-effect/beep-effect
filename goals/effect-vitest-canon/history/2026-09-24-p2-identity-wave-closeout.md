# Identity wave closeout

Root took over the prepared lane on 2026-09-24, superseding the Codex/Grok lane
routing with the operator's Opus-only sub-agent directive; orchestration, git
and verification ran on the root session directly.

The prepared remediation was committed as bf82dd87af with the packet
authorization docs in 57a24ad653. Merging origin/main (through the 2026-09-23
nightly packet) surfaced two conflicts: the OPPORTUNITIES ledger union-merged,
and PnLocal.test.ts kept main's tsgo-0.45 `it.effect`/`Effect.fnUntraced`
round-trip form together with this branch's new generator-sampling tests. The
merge also dropped Fibered.test.ts's `Effect` import, which main's converted
test bodies require; the repair commit restores it and all 12 files/115 tests
pass on the merged tree.

With the #1185 detector prerequisite and the #1188 `@beep/test-runner`
extraction merged, the deferred observability adoption completed in
2c51d78de1: all twelve identity test files import `it` from
`@beep/test-runner`, with describe/expect and the assertion helpers staying on
`@effect/vitest`. The identity-to-runner development edge was proven acyclic in
the extraction receipt. All 115 tests pass on the instrumented runner and full
`@beep/identity` package verification passes audit and docgen.

The detector baseline refresh removed exactly the 31 resolved identity rows
(EV001 x9, EV007 x9, EV011 x7, EV006 x4, EV002, EV003 across eight files) with
zero additions; the ratchet reports zero introduced findings on a 1,158-file
census. All 31 detector rows and the 22 actionable lens rows (resource 1,
property 12, observability 9) flip to `fixed` with fixSha bf82dd87af. The 37
`no-findings` coverage rows keep their schema-required open status. All 90
rows re-decode through the strict `EffectVitestFinding` schema.

The after-timing report and its context receipt are recorded under
`ops/inventory/timings/{after,context/after}/beep_identity.json`. It is fresh
evidence only: the runtime moved to Effect rc.117 / Vitest 5.0.1 / Node
v24.20.0 under main, and the wave added five generator-coverage tests, so no
before/after speedup claim is made against the rc.113 baseline. Workstation
load during the run was high and is retained unadjusted.

Remaining after this wave: the deferred current-main census delta (backlog-first
authorization), the 147-candidate consistency-audit reconciliation, and the
next dependency-ordered packages. Publication runs through Yeet; Benjamin
merges.
