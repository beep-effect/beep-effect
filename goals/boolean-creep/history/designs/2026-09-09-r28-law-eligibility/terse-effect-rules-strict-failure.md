# Instance

- id: `terse-effect-rules-strict-failure`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:39`
- symbol: `TerseEffectRulesOptions` / `TerseEffectRulesSummary`
- members: `strictCheck`, `strictFailure`
- evidence class: E4 at `TerseEffect.ts:784-793` — strict failure is derived
  only from strict mode plus at least one detected candidate.

# Current shape

`TerseEffectRulesOptions` carries the command's strict-check intent. The local
runner folds all candidate counters into `TerseEffectRulesSummary.strictFailure`,
and the Laws command reads that boolean to choose the process exit. Unlike
EffectFn and FrozenGrantSet, TerseEffect owns this derivation rather than
delegating it to `LawScan`.

# Cardinality gap

Four bit combinations encode three legal run outcomes: advisory,
strict-clean, and strict-failure. A strict failure without strict mode is never
written.

# Target schema

Reuse `LawScanDisposition` from `internal/LawScan.ts`; do not create a parallel
literal family. Keep input `strictCheck` because it is operator intent. Replace
the returned `strictFailure` boolean with `disposition`, derived once from
`strictCheck` and the aggregate candidate predicate.

# Migration inventory

- `TerseEffect.ts:35-47` — retain the input toggle.
- `TerseEffect.ts:65-104` — replace the summary boolean schema with the shared
  disposition schema.
- `TerseEffect.ts:784-805` — derive advisory, strict-clean, or strict-failure
  once and write it to the summary.
- `Laws.command.ts:384-430` — preserve advisory behavior and exact failure text
  by selecting only `strict-failure`.
- `test/terse-effect.test.ts` — migrate its local summary shape and every
  strict-failure assertion; prove all three outcomes.

# Guard-deletion accounting

Delete the summary `strictFailure` field, its boolean conjunction writer, and
the command's `if (summary.strictFailure)` guard. The candidate-count predicate
remains only as the input to the one disposition derivation.

# Encoded-side impact

None. TerseEffect has no JSON flag or persisted/RPC/MCP summary boundary. Its
exported decoded TypeScript result migrates atomically with every in-repo
consumer.

# Test impact

Retain every helper, thunk, flow, optional-object, nested-match, dual-overload,
include/exclude, advisory, write, and failure-text assertion. Add or retain
table evidence for advisory-with-findings, strict-clean, and strict-failure.

# Risk and sequencing

Tier 1E, in the same repo-CLI batch that introduces the shared LawScan
disposition. Import the existing domain rather than duplicating its literals.
Run full `@beep/repo-cli` package verification.
