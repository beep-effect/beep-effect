# Reflection lint and bootstrap-plan runtime proof

Both suites use the public instrumented tester with shared platform fixtures,
scoped per-case working directories and fresh consoles. Reflection migrates ten
runtime registrations and ten cwd wrappers. Bootstrap removes the shared run
helper for all eleven terminal callers plus seven direct runtimes, replaces
seven cwd wrappers, and preserves its existing Effect property registrations.
The parameterized slug case, property budgets, test titles and per-test timeout
arguments remain unchanged. The tests exercise 36 expanded cases across the two
files and preserve all 76 assertion trees (13 reflection, 63 bootstrap).

All thirteen existing bootstrap describes explicitly set concurrent:false;
reflection already has a serial describe. This protects process-wide cwd even
though anonymous it.layer does not apply its own concurrent option to a named
suite. The Effect reference's makeLayer uses layer timeout for fixture hooks;
existing per-test deadlines remain in their original registration arguments.

Clock and service review:

- Reflection reads manifests/reflections, decodes frontmatter and reports
  findings. The exercised handler has no lock acquisition or retry timer.
- Bootstrap/adopt are plan-only command paths. readPacketSnapshot walks and
  hashes files without packet locks. PacketEventStore construction captures
  filesystem, path and crypto services; append is where its lock is acquired,
  and these tests do not append. The pre-existing Effect test for an omitted
  date retains its test clock; resolveToday reads DateTime.now without sleeping.
- Both suites retain the test clock. Each ordinary Effect callback gets its
  own TestConsole; bootstrap's schema property constructs one per generated
  case. Native filesystem provenance remains an open obligation in both files,
  and bootstrap's remaining direct checkEffect finding stays open.

Applied verification:

- Node and Bun each pass all 36 tests. Original and final report title
  multiplicities match. Dedicated temporary roots have zero residue and source
  hashes remain stable during ordinary runs.
- The actual package test-type diagnostic artifact has empty output and
  exitCode 0. Root Oxlint passes. The root Effect Vitest ratchet scans 1,217
  files with 2,928 findings, zero introduced and 2,094 resolved against the
  unchanged baseline. This batch removes 20 current findings.
- Reflection failure/interruption probes each produce ten intended failures
  on both runtimes, with restored cwd and zero temporary residue. Console probes
  pass eleven cases and observe ten distinct services on each runtime.
- Bootstrap failure/interruption probes each produce seven intended failures
  and nineteen passes, checking cwd restoration after every test and empty
  temporary roots. Console probes pass 27 cases and observe 56 distinct services:
  24 ordinary/expanded callbacks plus 32 generated property cases.
- Mutation probes reject unexpected assertion failures and restore source
  bytes in finally. The final explicit-serial bootstrap revision passed
  the same probes, with byte-for-byte restoration confirmed.

Whole-command observations (before -> after): reflection Node 5.373 -> 5.523
seconds and Bun 3.219 -> 3.620 seconds; bootstrap Node 4.974 -> 4.672 seconds and
Bun 2.568 -> 2.518 seconds. Private receipts include versions, hashes, load and
pressure. Shared workstation activity prevents causal performance conclusions.

Historical matching identifies ten reflection and nine remaining bootstrap
rows uniquely; eight bootstrap rows are removed and one checkEffect row remains
open. The bootstrap helper row includes its eleven caller migrations,
and the renamed index case maps to its current refresh-stale behavior. Three
other bootstrap property rows were already reconciled to their merged-main fix
in cli-bootstrap-property-backfill.json. Full grouped package proof for these
new source edits is pending; no goal-wide acceptance is claimed.


Source commit: `d3677d2270cccc173ba2fc4b9e94441be7a7c1a3`.
Reconciliation closes exactly 18 historical runtime rows, adds none, and leaves
the retained property row and all unrelated rows unchanged. An initial script
count included the retained row; its afterMatches guard refused the write.
The corrected reconciliation explicitly retains that row. Strict validation
passes for all 3,495 CLI and 687 schema rows. CLI totals are 1,917 fixed,
12 exceptions and 1,566 open. The grouped package proof is running.
