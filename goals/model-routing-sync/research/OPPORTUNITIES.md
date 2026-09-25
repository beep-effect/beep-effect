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
