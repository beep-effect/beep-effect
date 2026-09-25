# Slice-1 acceptance audit — 2026-09-24

The original implementation and offline-diff follow-ups merged in PRs #1202,
#1205, #1211, and #1213. This audit checks the original acceptance contract,
rather than treating those merges as proof that every criterion was met.

## Live decoding

- The upstream `models.json` decoded and re-encoded with deep equality to the
  original payload, including unknown provider, model, and thinking metadata.
- The live Codex cache decoded and re-encoded with deep equality. Raw cache
  metadata is not written into catalog snapshots or reports.
- All 241 model IDs in the live `cursor-agent models` listing were retained;
  its heading and usage tip were excluded. The previous parser counted both
  as model IDs. A subsequent ledger diff correctly removed those two spurious
  entries (R1, R2, R6).
- Upstream, Codex, and Grok effort ladders are retained separately. Surface
  validation uses the appropriate ladder instead of treating the upstream
  ladder as the Codex ladder (R10).

## Seven conflict categories

`bun run beep models check` with a scratch seed returned exit **1**, with
**35 findings across 335 models**. All five catalog sources answered. These
observations are dated evidence, not timeless assertions about operator files.

| SPEC category | Current evidence |
| --- | --- |
| Repo medium versus home xhigh | Working-style and Codex doctrine report `xhigh` versus `medium`; claudex reports `gpt-6-astra(xhigh)` versus `gpt-6-astra(medium)`. |
| Stale JSDoc migration default | `repo.code.jsdoc-migrate-titles` reports `grok-4.5` versus `grok-4.6`. |
| QaJudgeRef examples | All three declared Qa example files report `gpt-daybreak-blue-latest` versus `gpt-6-astra`. |
| Unbound Codex candidate | `gpt-5.6-terra` is printed as a routable, unbound candidate, alongside `gpt-5.5` and `gpt-5.6-sol`; no binding is changed (R2). |
| Three Codex effort values | Home doctrine and impeccable seats report `xhigh`; Air reports `high`; the manifest and repo use `medium`. |
| Divergent Codex models | Both WebStorm launchers report `gpt-5.6-sol`; Air now reports `gpt-6-sol`, rather than the historical `gpt-5.6-sol`; the expected value remains `gpt-6-astra`. |
| Grok effort absent from doctrine | The missing doctrine block includes the full `research.web × grok-cli` expectation of `grok-4.6`/`xhigh`; the current Grok config reports `grok-4.7`/`low`. The historical `xhigh` pin has changed since the packet was written. |

The six JSDoc target files and the JudgePack command template are now declared
read-only targets (R9). A literal-delimited `line-value` locator reads every
distinct matching value on the declared lines; mixed examples cannot pass
merely because their first occurrence is current.

## Read-only proof

SHA-256 before/after comparison covered **all 36 declared targets**, recording
absence for optional missing files. Every target was unchanged. The operator
manifest was not created or overwritten: `init` wrote only a scratch manifest
under the ignored report directory. No projection-write flag was added (R12).

The live Codex cache refreshed during the audit. One intervening snapshot did
not advertise Astra as available and therefore emitted additional catalog
findings. A fresh run after that cache refresh produced the 35-finding result
above. Availability failures now retain the actual target value in the report,
so they cannot hide independent file drift.

## Verification evidence

- Named package quick verification in the isolated acceptance lane: lint and
  typecheck passed against the final source.
- Rebuilt CLI and focused Models suite: **39 tests passed across five files**,
  including schema-derived properties, unknown-field round trips, per-surface
  effort validation, Cursor envelopes, distinct example values, and candidates.
- Package docgen passed: **1,874 examples** typechecked.
- Final `bun run beep quality package-verify @beep/repo-cli` passed with
  **audit 798.7 seconds** and **docgen 29.0 seconds**. This run built and tested
  the settled source without intervening implementation edits.
- Manifest JSON, goal launcher length, and packet whitespace checks passed.
- Yeet publication/hosted closeout remains separate; local package verification
  alone does not establish mergeability.

## Approved boundary and final delivery gate

The operator ratified full payload fidelity, normalized-only persistence, and
five narrow wire-schema exceptions, then requested implementation. See
`../DECISIONS.md` and `../research/2026-09-24-schema-boundary-exceptions.md`.
`bun run beep lint schema-first` now passes with no new findings or advisories.
A real-check regression injects synthetic account and nested extension metadata,
then proves the persisted ledger and encoded report exclude it. Schema-derived
report round trips cover the public serialization contract.

The first full package audit used a build from before a later test/source edit
and failed one of 4,556 tests; its docgen also exposed missing constructor
defaults. A broader Yeet repair then saw an intermediate default implementation
before the final Effect API correction. That obsolete repair job was cancelled.
Neither obsolete run is final full-proof evidence. The rebuilt 39-test suite,
quick verification, and successful final full package audit above supersede
those package failures. Final full Yeet proof and hosted checks remain pending.
The packet carries its slice-1 closeout in this PR. Delivery is complete only
when final Yeet proof and hosted review/checks establish merge readiness; the PR
is intentionally left open. Slices 2 and 3 remain outside this delivery.

Local raw logs and reports are in `.beep/model-routing-sync-audit/`. They are
ignored and deliberately not committed; this receipt records only sanitized
facts required to assess the acceptance contract.

## 2026-09-25 review and live refresh

The review follow-up adds source-specific ladder change detection and normalized
before/after values in catalog diffs. Its regression independently changes each
source while holding the merged ladder constant. The full test phase passed
4,580 TypeScript tests and 53 Python tests (three skipped); one formatting issue
in the new test stopped that audit before docgen. Biome corrected it, and package
quick verification subsequently passed lint and typecheck. Final full proof remains
a separate delivery gate.

Fresh upstream and Codex payload round trips still equal the original JSON. A
fresh Cursor listing preserves all 241 model IDs. The refreshed live check reports
34 findings over 335 models from all five sources, includes the unbound Terra
candidate, and exits 1. All 36 target hashes remain unchanged. Some operator
settings have changed since the original seven-conflict receipt above; the new
report observes their actual current values without adopting or rewriting them.

After the formatting correction, the full package gate passed: audit 951.9
seconds and docgen 24.6 seconds. This supersedes the formatting-only failed run
above. The focused Models suite now contains 40 tests.

Hosted test typechecking then identified six already-typed inputs decoded with
`decodeUnknownEffect`. Those test-only calls now use `decodeEffect`; the separate
`package-test-typecheck` command passes, as do package quick verification and all
32 tests in the selected catalog/check/locator files. Runtime implementation and
serialization behavior are unchanged from the successful full package audit.

## 2026-09-25 approved coverage follow-up

The operator approved package-local coverage isolation for wink, utils, and
identity through Ask User Question, then requested implementation. Each package's
normal `bun run coverage` now passes without an isolation CLI override: wink
47 tests, utils 182 tests, identity 115 tests (344 total). Package quick
verification passes lint and check for all three after building their dependency
outputs in the fresh worktree. Assertions, thresholds, shared runner defaults,
dependencies, and runtime interfaces are unchanged.

The Models-only codec hoist previously passed root Oxlint, all 40 Models tests,
test typechecking, package quick verification, and all 15 Yeet cheap gates.
The monitor for PR #1224 reported `merge-ready: yes` on head `f51f9e53d1` before
the operator merged it. Its remaining local full-proof job was stopped when the
merged PR required a new delivery branch; it is not counted as completed proof.
The approved coverage exceptions and final packet closeout now travel in a
follow-up PR, which must remain open after final local and hosted verification.
