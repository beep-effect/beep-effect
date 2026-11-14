# B1 partial implementation and design stop

Base: `0e2b4c42e6d`; branch: `feat/citation-native-lane`.

Only the independent schema step is implemented. Policy v2 rejects a regex
concurrency below operation concurrency, keeps all fields and values, and has a
major changeset. The package is not in the Changesets ignore list.

## Stop

See decision `2026-11-14-stop-b1-at-the-shared-html-cleaner-markup-boundary.md`.
The shared Markup worker also serves the closed HTML cleaner port. The design
must specify lane authority across that boundary before all Markup starts can
require CitationInvocation. No native implementation was changed.

## Counts

These are predecessor A4 recorded counts, not a fresh B1 measurement. The
post-change column is deliberately unverified: no count replay was run after
the design stop. Wall time and load for those predecessor counts were not
recaptured. Host load during schema verification: 18.02 / 10.50 / 9.12
(one/five/fifteen minutes); this is not a replay measurement.

| Count | A4 recorded | B1 measured |
| --- | --- | --- |
| Regex processes per ten plain-text calls | 291 | not measured |
| Construction metadata installs | 16 | not measured |
| Construction configuration detaches | 1 | not measured |
| Construction tokenizer builds | 1 | not measured |
| Construction evaluator installs | 26 | not measured |
| Per-call installs/detaches/tokenizer/evaluator installs | 0 each | not measured |
| Lanes acquired | no lane exists | no lane implemented |

All five lane rules and all four real-process proofs remain unimplemented and
unverified on both runtimes. regexOwner, Markup semaphores, per-request Diff/Xml
owners, protocol v2, release assertions and count fixtures are unchanged.

## Verification

- Frozen install and prerequisite Turbo build: passed (57 build tasks).
- CitationEngineLimits.test.ts: seven tests pass on Bun (1.49 s final run) and
  Node (2.38 s). An initial run caught the tightening fixture's now-incoherent
  concurrency pair; it was corrected. A test typecheck caught a yield in an
  assertion argument; it was corrected before the passing package verification.
- Both quick package-verifies: passed, including source and test typechecks.
- Both package lint:laws commands: passed.
- Root lint:oxlint: passed.
- docgen:local: passed.
- Fallow audit against origin/main: passed, zero introduced, 37 inherited-adjacent.
- Biome on changed TypeScript: passed.
- Effect Vitest: initial scan found EV006 on the new failure assertion; replaced
  it with the canonical assertTrue helper. Generated inventory churn was restored.
  Final full scan passed: 3,900 files, 636 inherited findings, zero introduced,
  one resolved. Scoped changed-file scan: zero findings.

No native tests or canonical full-span replays were run: no native change was
made after the design stop. No whole suite, coverage, push or PR command ran.
