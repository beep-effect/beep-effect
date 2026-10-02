# Eight CLI suite reconciliation, 2026-10-01

Source fix: `8a39b2ff2b4456946a8aaec3b116fea77c8b420b`.

The applied batch covers ci-runner-security, proof-ledger, qa-round-pipeline,
run-scope, yeet-inbox-porcelain, yeet-provenance-footer, yeet-remediation and
yeet-watch-mode. Full repo-cli package verification completed exit 0 (audit
676.6 seconds; docgen 24.4 seconds). Applied CI=true focused proof passes all
218 tests on Node 22.22.3 in 31.01 seconds and Bun 1.4.2 in 16.57 seconds.
These are correctness receipts, not controlled before/after package timings.
The first focused invocation used the repository root and discovered no tests;
it is failed invocation evidence, not a pass. The passing runs use package cwd.

The historical 254-row application set preserves all IDs, evidence and prior
fix SHAs. Its 23 NONE coverage rows and 21 previously fixed rows remain unchanged.
Of the open findings, 198 are now fixed with this source SHA and 12 are reasoned
exceptions for retained inner lifetimes or native subjects. Seventy current
EV003 call-site exceptions are appended; one further current wrapper ID is
already represented by its preserved historical row. Every retained bracket
owns fresh per-invocation fixture data, while public layers own services.
Cleanup failure remains visible. The reviewed detector ratchet exits 0 with
introduced=0 and 2,345 current findings. Its baseline refresh also clears stale
prior entries; the complete baseline reduction is not this batch's fix count.

A new L-PROP-04 finding records six QA rejection checks that accepted unrelated
setup defects. Its original historical L-PROP-NONE row remains intact. The new
row is independently fixed by requiring the intended QaCommandError tag/message
through Effect.flip. The private defect mutation fails all six hardened checks
and passes all six original checks; the applied intended scenarios pass.

All 4,569 repo-cli ledger rows decode through the public finding schema with
excess-property rejection and unique IDs. Goal doctor reports no blocking
findings. The seven prepared candidate bodies match their formatted application
at the parsed AST level. Per-suite proof documents retain the native/Memory,
clock, cleanup and assertion control evidence and its private/applied limits.

Current API evidence: installed @effect/vitest index, utils, internal runner
and README match immutable 4.0.0 tag commit
67ba4e46a11ccda0b6761578bfd22c04ae00167d byte for byte. Current primitives graph
uses that pin; older packet and charter rc.113 statements remain historical and
need current-source reconciliation before final acceptance.

The spawn environment adapter repair is a separately qualified, still-unapplied
checkpoint. Hosted PR heavy jobs and closeout remain pending. Remaining existing
inventory, full lens closeout, final main delta, empty baseline, timing report,
human gates and lifecycle/reflection closure remain required. This checkpoint
does not close P1, P2 or the goal.
