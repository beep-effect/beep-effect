# Model routing sync friction receipts

## 2026-09-24 — slice-1 acceptance audit

- The merged implementation passed all 31 Models tests and the package quick
  lint/check, but its seed omitted the R9 JSDoc targets and its check output
  named only catalog change counts, not unbound candidates (R2).
- `bun run beep models check` with a scratch seed returned 27 findings across
  337 catalog entries. Generated-block absence hid the actual `xhigh` doctrine
  values, so this did not establish all seven SPEC conflict categories.
- Live `cursor-agent models` includes an `Available models` heading and a
  trailing `Tip:`. `parseCursorModelLines` accepts both as model identifiers.
- Prevention: assert the packet's seven conflict categories against the seeded
  manifest, and exercise the Cursor boundary with a complete CLI listing,
  including its surrounding human-readable text.

## 2026-09-24 — verification and mutable inputs

- The first repair typecheck rejected an Option-returning callback passed to
  `Array.filterMap` (which expects Result in this Effect version). Replacing
  it with `Array.map` plus `Array.getSomes` restored the package quick proof.
- The live Codex cache refreshed during the check. A snapshot briefly lacked
  Astra availability; the next complete check returned 35 findings. Keep actual
  target values visible even when a catalog binding is invalid.
- Yeet cheap gates found new `effect-vitest` ratchet rows in the touched tests.
  Investigate the exact rules before changing tests; do not refresh a generated
  baseline merely to make the lane green.
- The five introduced test-policy findings were repaired with explicit layer
  timeouts and removal of redundant whole-test scopes; the lint now reports
  `introduced=0`. Remaining cheap-gate Fallow blockers name the pre-existing,
  untracked `explorations/beep-ci-operational-ontology/assets/agentic-yoyo/build.mjs`.
  Preserve that other task's files and run final proof in an isolated sibling
  worktree. Beginning in an isolated lane would have avoided this interference.
- The original full audit built the CLI before later source/test edits and then
  ran against that stale build: 4,555 tests passed and one newly strengthened
  Models assertion failed. The emitted `Models.service.js` still returned
  `upstreamProblem` without the new current-value observation. Do not edit a
  checkout during a proof that compiles and then tests package exports.
- Docgen found two examples whose `.make(...)` calls lacked newly required
  fields. Decoding defaults do not provide constructor defaults; the new
  candidate/effort arrays now have both. Reverify docgen after that repair.
- The schema skill's constructor-default example used an older thunk/Option
  API. The current Effect reference requires `Effect.succeed(default)`.
  Consulting that checkout corrected the implementation; final build, package
  quick verification, 37 Models tests, and all 1,874 docgen examples pass.
- Schema-first correctly requires documented exceptions for the five lossless
  external wire structs. Existing lossless Lexical/Pandoc boundaries use the
  same inventory mechanism. The goal's explicit edit/generated-file scope
  requires approval before adding these entries; the exact proposal is in
  `2026-09-24-schema-boundary-exceptions.md`.

## 2026-09-24 — approved boundary closeout

- The operator ratified the five wire exceptions through grill-with-docs and
  requested implementation. The remaining block was goal scope, not an
  architecture-doctrine disagreement. The inventory's generated date alone
  did not establish that its exception records were wholly generated.
- Adding the persistence regression crossed the schema-codec assertion threshold
  in models-check.test.ts. Schema-derived report round-trip coverage resolved
  the advisory without another inventory exception. All 39 Models tests and
  schema-first lint pass.

- Hosted review found two stale packet surfaces: the SPEC locator census still
  named ts-literal for template/examples, and launcher acceptance boxes were
  unchecked. Align all current acceptance surfaces with the evidence before
  publication; historical census reports remain historical. The queued initial
  proof was cancelled before admission so the replacement proves the corrected
  commit rather than an obsolete head.

## 2026-09-25 — interrupted proof and source-ladder review

- The publication proof stopped at `git fetch` with temporary name-resolution
  failure; its monitor terminated during workstation maintenance. The operator
  confirmed the network repair, and a fresh fetch succeeded. Six newly merged
  PRs were integrated before restarting proof; no model-routing conflicts arose.
- Review caught that snapshot diffs compared only the merged effort ladder.
  Source-specific validation also needs source-specific diff evidence; compare
  all three source ladders and preserve their before/after values in the report.
- Keep lifecycle active while final delivery remains unverified. Prepare the
  reflection early, then synchronize final phases and lifecycle in the same PR
  after the initial proof and hosted gates pass.
- The review-fix audit passed all 4,580 TypeScript tests and 53 Python tests
  before stopping on one Biome line-wrap difference in the new regression.
  Format touched tests before starting the full audit; package quick verification
  now confirms lint and typecheck pass.
- Hosted Heavy / Check caught six `preferTypedSchemaDecoder` errors in the
  new tests after package audit passed. Package audit does not include the
  separate test typecheck lane. Use typed `decodeEffect` for already typed
  payloads and run `package-test-typecheck` alongside focused tests before
  publication; do not weaken the diagnostic or relabel it as environmental.
- Hosted policy lint also enforces module-scope schema compilation, which the
  package lint subset does not cover. Hoisted the new test codecs and ran root
  Oxlint explicitly: it passes, along with all 40 Models tests, test typechecking,
  and package quick verification.
- Coverage failed outside Models in wink (invalid string length), utils (private
  error equivalence), and identity (missing instrumented test context). The same
  failures reproduce locally with files identical to current main; adding only
  the command-line `--isolate` flag makes all three package coverage runs pass.
  A three-config isolation proposal is prepared separately from the scoped
  Models changes; do not refresh coverage thresholds to hide the failures.
- A subsequent `yeet publish --start-pr-early --monitor --pr --detach` pushed
  successfully but exited 130 while waiting for local proof admission. The job
  recorded `unrecorded-failure`, with no cancellation request. Its canonical
  waiter confirmed termination; full verification was resubmitted on the
  published head. Persisting signal provenance would make the interruption
  attributable instead of leaving only the generic termination receipt.
- The merged acceptance PR required a fresh follow-up worktree. Its initial
  `quality package-verify @beep/wink --quick` failed with TS6305 because dependency
  declaration outputs had not been built. This is worktree bootstrap state, not
  an isolation-config regression. Build the affected dependency graph before
  quick checks in a fresh checkout; retain the original failed log for attribution.
- The coverage follow-up's hosted Repo Sanity passed its preflight checks but
  failed `quality changeset-status --since origin/main`: all three edited
  product workspaces require an in-range changeset, even for test-runner config.
  Add the narrow changeset and run that exact gate before republishing; package
  quick verification does not cover publication metadata.
- PR #1240 was merged by the operator at 2026-09-25T10:22:25Z while its
  canonical publisher was still proving the merged preview. Its head-local proof
  and hosted readiness were already green, but packet lifecycle closeout had not
  been committed. The agent did not merge it. Keep the running proof to terminal
  and preserve its result; use an explicit delivery handoff before operator merge
  so the packet and implementation can finish in the same PR.
- The documentation closeout publisher committed and pushed successfully, then
  `gh pr create` failed with `API rate limit already exceeded`. The canonical
  waiter confirmed a failed publication job. A subsequent quota read showed
  capacity available; retry publication through Yeet after checking for an
  existing PR. Keep API quota failures separate from network and content failures.
