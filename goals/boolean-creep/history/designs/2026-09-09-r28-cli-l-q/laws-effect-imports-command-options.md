# Instance

- id: `laws-effect-imports-command-options`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:40`
- symbol: `EffectImportsCommandOptions`
- members: `write`, `candidate`
- evidence: E2 at `Laws.command.ts:276-283` — the command rejects
  candidate-plus-write, then treats ordinary dry-run, write, and candidate as
  the only operations.

# Current shape

The command callback constructs an internal options class containing raw
`write` and `candidate` booleans, checks their conflict, and forwards both
to `EffectImportRulesOptions`. The independent `check`,
`enforceDocumentation`, `json`, corpus mode, and path filters do not belong
to this finite state.

# Cardinality gap

Four write/candidate pairs are representable. Three are legal:
`dry-run`, `write`, and `candidate`; combined true is rejected.

# Target schema

Reuse the new exported `EffectImportOperation` LiteralKit owned by
`EffectImports.ts` with `dry-run | write | candidate`. Keep raw booleans only
as the CLI callback boundary, preserve the current conflict error, and
construct the literal exactly once before creating runtime options. Remove the
zero-value internal `EffectImportsCommandOptions` class if exact-source search
confirms it has no other consumer.

# Migration inventory

- `Laws.command.ts:38-71` — remove the internal class when its only constructor
  remains the command callback.
- `Laws.command.ts:232-295` — retain both external flags and their descriptions;
  reject combined true with the exact current message, resolve one operation,
  and pass it to `EffectImportRulesOptions`.
- `Laws.command.ts:297-323` — preserve the current dual-line text projection:
  render `operation=write` only for the `write` literal and
  `operation=dry-run` for both `dry-run` and `candidate`; render the separate
  `candidate=true|false` line from `EffectImportOperation.is.candidate`.
  Persistence guidance remains absent only for `write` and present for both
  dry-run variants.
- `packages/tooling/tool/cli/test/effect-imports.test.ts` — preserve CLI
  conflict, explicit-scope, text, JSON, exit, and write behavior.
- Repeat a source/barrel search before apply and migrate any new command-model
  consumer atomically.

# Guard-deletion accounting

Delete the post-construction `options.candidate && options.write` coherence
check, all forwarding of two correlated fields, and operation ternaries over
`options.write`. The raw flag conflict remains at the CLI adapter and is
consumed immediately into one literal.

# Encoded-side impact

None for this record. CLI flag names and behavior remain stable. The JSON
summary keys are owned by the separate Tier 2
`effect-import-rules-summary-operation` compatibility design.

# Test impact

Cover all four raw pairs, proving the three operation values and exact conflict
message. Retain the locked candidate text pair
`operation=dry-run` plus `candidate=true`, candidate-scope validation, and
independent combinations with check, corpus mode, documentation enforcement,
and JSON. Run the Effect Imports suites and full `@beep/repo-cli` package
verification.

# Risk and sequencing

Tier 1E, atomic with `laws-effect-import-rules-options`. Do not treat
`check`, `enforceDocumentation`, or `json` as operation members. The
later Tier 2 summary codec depends on this single operation owner.
