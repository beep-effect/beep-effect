# Worker transport and hosted policy follow-up

PR #2511 published native pattern/source framing in `d90736fc35` and merged
main through `874533e793` in `8485c280d0`. No runtime Python matcher, regex
family acceptance, or full engine completion is claimed.

The preceding head `86e580698685e7ded6493e84c6b3b18aad135472` ran hosted Check
41555681173. Heavy Build job 125654630893 passed. Heavy Lint Policy job
125654630855 and Fallow Advisory Envelopes job 125653875555 failed. These are
failed receipts, not pending or passing evidence for the new head.

Repairs following those logs:

- Replace generator-returning callbacks with `Effect.fnUntraced` while retaining
  the original lazy generator bodies and interruption boundaries.
- Use schema tags for the frozen missing-reporter outcome.
- Remove the unused oracle-artifact type alias; its schema remains authoritative.
- Record the private prepared-input interface as a live capability exception:
  layout/value already have schemas; decoding data cannot create its map closure.
- Review ten test-policy findings individually: repository fixture integrity,
  OS-visible native children, and independent fixed-count race trials. No flaky
  retry, corpus alteration, or detector suppression was introduced.
- Route private test subjects through package-style aliases in test compiler and
  Vitest configuration only. Both package manifests retain `./internal/*: null`.
  Production publication and child entrypoints do not acquire these aliases.

Focused verification: server test compiler and use-case test compiler passed;
server and use-case package laws passed (including native-runtime, effect-fn,
package-test-imports). Six focused server suites passed 39 tests before the
alias migration; three migrated suites passed 20 tests; the use-case artifact
suite passed two tests. Full native qualification and broad regression belong
to hosted CI. The divergence audit still has 11 representation laws, four open
fidelity questions and fifteen unfinished target-proof rows, with no semantic
waiver.

Fallow remains actionable: its downloaded exact-head audit contains 58 citation
complexity findings, 19 duplication groups and one unused type (removed above).
The complexity/duplication findings are not dismissed as baseline failures and
are not resolved by this repair. They require source-preserving refactoring
and hosted re-evaluation. The package-wide policy replay also reports knowledge
semantic-delta failures; no passing result is inferred from the focused checks.

## Completed hosted integration inspection

The same run's Heavy Check (125654630926), Integration (125654630987),
Docgen (125654631029) and Doctest (125654631040) also passed. Integration's
checkout log identifies merge `44679e24bba18760155bbaea26febf2690482e9a`.
Fetching that exact object and comparing tree IDs with PR head `86e5806986`
produces `20585a4cdaa66f8c9644f74a05dcf2a7b9ce1623` for both.

All four law-practice citation integration files passed. The regex qualification
asserts 13,610 extractor instances, maximum translation length 3,183,
4,456,448 code-point checks, 28 controlled cases, 23 capture matches and one
confirmed child exit. Named HTML replay asserts 504 sequences and actual
retirement. Native custom and Unicode history replay also passed. These are
exact historical-head receipts; they do not qualify later transport/policy
changes or complete regex semantics. Job URL:
https://github.com/beep-effect/beep-effect/actions/runs/41555681173/job/125654630987

Coverage Regression job 125665259121 failed. Its log identifies domain/server
coverage floor regressions, including citation domain value files, and the
new citationOracleAssertions file has one uncovered function/line/statement.
These gaps remain open. No coverage baseline is lowered. New-head hosted
results supersede these receipts only after inspection.

Final focused fixed-tag check inspected 9,900 files and 5,417 fences with zero
findings. The test-policy inventory refresh found 486 rows repository-wide,
with zero open citation rows after the explicit reviews. Focused Oxlint
completed successfully with warnings, including pre-existing namespace-import
warnings; this is not a warning-free claim.
