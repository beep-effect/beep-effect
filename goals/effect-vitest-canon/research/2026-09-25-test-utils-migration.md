# Test-utils P2 migration proof

Six test files strengthen resource ownership, assertions, generated codec checks,
retry readiness and diagnostics in D12 order. Production code and generated
declarations are unchanged. Both SQL scopes register fallback cleanup while
retaining early close. Local wrappers reuse the public scoped helper. SQLite
freshness now performs its first write before checking a second provision.

The original five-schema codec property uses yielded operations and ten trials
per schema via the native property runner, respecting environment floors. The
removed helper's default twenty was unused by its five explicit-ten callers.
Snapshots retain full nested Options and plain fields. New release witnesses
cover success, failure and interruption with an acquisition barrier.

Native container inspection accepts only a verified 404 as absence; other
failures remain visible. Live time is confined to native retry/inspection waits
with existing bounds. Watch diagnostics cap observed prefixes to the requested
count, preserving actual events, order and the first-delivery handshake.

The inherited pg.Client mock no longer intercepted the rc.117 adapter. The
current public package barrel mock overrides only PgClient.makeClient, retaining
the real test-utils retry and error mapping. It proves 21 attempts and checks
each observed retry sleep is 250ms. Failed discovery receipts remain private.

## Verification

Baseline full Node: 252 registered, 247 passed, five external-database skips.
Migrated full Node: 255 registered, 250 passed, five external-database skips.
Both include all eighteen files and fifteen native spawned-runner cases.
Focused Bun: 84 registered, 72 passed, twelve runtime/external skips.
SQL property sweep: all nineteen selected tests pass at 400 runs, seed 20260708.

The full-suite receipts precede final bounded-prefix and canonical-helper
cleanups. Both changed watcher files then pass 44 tests under Node and 44 under
Bun; the final release-helper file passes three tests, and typechecking passes.
Full package verification on the final tree passes: audit 19.3 seconds and
docgen 3.3 seconds. No skipped external branch is claimed as executed.

AST accounting preserves all 129 original direct test names and accounts for
762 original assertion/helper-call nodes. Documented substitutions cover two
aggregate property Passed checks, five yielded codec-helper calls, synchronous
runtime calls replaced by yielded execution, and equivalent assertNone. Other
original assertion expressions match.

All 165 saved rows have dispositions. Thirteen historical runner-file rows
(nine detector candidates and four coverage judgments) belong to a prior runner
split and receive no new repair credit. Sixty-four current detector candidates
have reviewed reasons for native subjects, shorter lifetimes, pure providers,
module mocks, or assertions whose exact native payload is deliberately unknown.
Non-test-utils baseline rows are preserved.

## Inventory and committed-head timing

Implementation commit: `aeee188d63c21487683580dab0c728f85a0b1fb7`.
The original 165 rows reconcile to 27 fixed findings, 69 retained exceptions
and 69 coverage-only no-findings judgments. Nine historical runner detector
rows are retained exceptions with prior-split provenance, not new repair credit;
four historical runner coverage judgments remain coverage-only.

The original 85 detector rows and their dispositions are preserved in
`2026-09-25-test-utils-original-detector-dispositions.jsonl`. The active detector
sidecar now contains the 64 current exceptions. All 229 rows across the original
archive, four lens sidecars and current detector sidecar strictly decode against
EffectVitestFinding with excess properties rejected.

The full configured Node timing cohort ran at the implementation commit above,
verified unchanged after collection: 255 registered, 250 passed, five skipped,
eighteen files. Reporter duration was 19,874.05 ms; whole-command duration was
20.279 seconds. The source manifest remained unchanged. Maximum observed
one-minute host load was 19.99; maximum CPU/memory/IO pressure avg10 was
4.02/0.18/0.00. These are recorded context, not adjustment factors. Runtime and
test populations differ from the baseline; no causal speedup is claimed.
This final full-suite run includes the bounded-prefix and helper cleanups.

Hosted PR closure remains pending. A passing package proof does not complete
the goal.
