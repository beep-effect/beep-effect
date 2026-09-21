# @beep/html — P1 four-lens digest

Eighteen census test files were read completely: 5,748 lines / 212,790 bytes, no support declarations. Seventy-two rows cover all file/lens pairs: nine review items and 63 prescribed NONE rows. Review items comprise two major lifecycle issues, four minor proof/diagnostic gaps and three informational native-boundary constraints. Total severity: two major, four minor, 66 info. No waiver or P2 authorization is supplied.

| Lens | Rows | Review | NONE |
|---|---:|---:|---:|
| resource | 18 | 5 | 13 |
| flake | 18 | 0 | 18 |
| property | 18 | 2 | 16 |
| observability | 18 | 2 | 16 |

## Top ten files

Every file has four rows, so this is a lexical tie-break, not a severity ranking:

- `ConformanceLedger.test.ts` — four rows.
- `Html.browser-conformance.test.ts` — four rows.
- `Html.browser-import.test.ts` — four rows.
- `Html.conformance-annotation.test.ts` — four rows.
- `Html.conformance-hardening.test.ts` — four rows.
- `Html.coverage-matrix.test.ts` — four rows.
- `Html.entrypoints.test.ts` — four rows.
- `Html.form-control.test.ts` — four rows.
- `Html.generator.test.ts` — four rows.
- `Html.heading-conformance.test.ts` — four rows.

## Resource topology and cost

Most tests construct local HTML/schema values and execute pure parser, codec, conformance or serialization operations. Script contents and URL strings are data; no HTTP fetch or script evaluation occurs. Generator tests call a pure set-comparison helper; scripts/generate.ts:4191–4199 constructs a deferred scoped program and runs it only under import.meta.main. Importing that helper is not permission to run generation or treat the NodeServices recipe as an acquired layer.

ConformanceLedger.test.ts and the annotation parity test intentionally read real package artifacts. The helper reads five ledger files, deduplicates referenced test-source paths within one validation, and checks actual declarations. Each of the two annotation validations reads sources/invariants independently. These are read-only acquisition sites, not measured rebuild timings. Keep the real repository subject; a seeded MemoryFileSystem would merely validate the seed. Existing helper error channels and full diagnostics remain. No database/container or external provider is required.

The two import probes each spawn one real child with process.execPath and await exit and stderr drain through Effect.all. Neither registers child release; Effect.promise receives no observed AbortSignal. The pinned Effect.ts:871–872 states that underlying asynchronous work stops only if it observes the signal. Add scope-owned terminate-and-await cleanup while preserving actual import/global deletion, cwd, exit zero and empty stderr. No leak was reproduced here. A child is not shareable across the fresh-process isolation witnesses, and no fake filesystem or import stub is a substitute.

The browser-conformance suite uses jsdom and disconnected local elements. Preserve namespace, breakout, ASCII-space and attribute normalization witnesses. This is DOM emulator evidence, not a Chromium run. Source-size tests naming Chromium outcomes are committed fixture assertions; this audit did not execute Chromium.

## Proof and diagnostic gaps

Html.security.test.ts:478–488 checks root freeze and then gates all child mutation/freeze assertions behind an unasserted fragment tag. Assert the expected fragment shape before narrowing, retaining every existing mutation and serialized-byte assertion. The production snapshot codec preserves the root and recursively freezes it (Html.conformance.ts:242–266,2267–2276); no current production failure is claimed.

Html.source-size.test.ts:348–365 checks repeat-call polarity and only the first failure code. It does not compare successful entryCount/usesAuto, diagnostic entryIndex/message or the complete issue list. Add complete schema-derived Result equality while retaining every check, String maxLength256 and fcRuns(250). This is an incomplete determinism witness, not evidence of nondeterminism.

The two child waits lack intermediate import/drain/exit context. After lifetime repair, adopt the accepted public instrumented tester and safe phase annotations in P2. Preserve TestEnv, actual process behavior and assertions; never raise timeouts or print environment values. Named synchronous parser matrices already provide useful inputs/paths; no generic logging findings were added there.

The 177 unchanged detector rows comprise 33 EV001, 125 EV006 and 19 EV007. Their complete payloads remain in the canonical detector inventory. EV006 judgment must preserve Boolean polarity, compounds and exact values without invented payloads/Causes. Manual native properties retain explicit fcRuns(25/50/100/250/500) and configured seeds/floors. All generated assertions, grammar negatives, 4096-candidate exactly-once control, 2048 CSS arguments and 33/64/100 nesting witnesses remain intact. No independent flake or generator explosion was established.

## Retained runtime/history evidence

Root's accepted first Node command baseline reports all 18 files and 190 passed tests, exit zero, 13.978743456s whole command and 13,524.767334ms reporter span. Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 identities and raw hashes are retained in the public timing context. Browser-import is 4884.480469ms and entrypoints 4699.767334ms; these are retained file spans under concurrent workers, not additive setup costs or predicted savings. Fork pool, isolation, concurrent default, maxConcurrency5 and worker capacity63 are configuration, not proof of observed concurrency. Host load/PSI qualifies this single observation, not a causal explanation or adjusted baseline.

HTML has 29 mapped historical coverage-ratchet observations across 13 jobs. They are not 29 unique flakes or failing test cases. Globally, 527 failed runs retain 21 unavailable logs and one unresolved cause. The 139 timing attempts retain 132 full-file baselines, four configured subsets and three failures. Effect-drizzle's Node bun:sqlite collection failure and graph-3d's unexecuted configured-out browser file remain distinct package boundaries; neither is a failed HTML test. Vitest4.1.11 remains outside the adapter rc113 declared >=5 <6 peer range; the accepted runtime receipts are qualified evidence, not a dependency change.

## Proposed P2 order and limits

Scope the two real children first, preserving real ledger/DOM subjects. Then migrate assertion families without changing operands and add the fragment witness. Preserve property domains and floors, strengthen the complete determinism law, and retain existing independent fixed matrices. Investigate flake causes only when evidence exists. Adopt public observability last with safe child phases. P2 remains gated by Benjamin's acknowledgement.

All rows passed strict public decoding, ownership/census bounds, primitive IDs, uniqueness and exact re-encoding. This static audit does not establish race freedom, production coverage, current package proof, browser conformance or a timing improvement. No source, tests, configuration, canonical row, baseline or runtime was changed.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
