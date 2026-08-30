# Packs yaml-public + yaml-internal — round 2 fixer report

- `fixer`: jsdoc-annotation-specialist
- `scope`: everything under `scratchpad/yaml/`
- `status`: all 10 accepted round-2 findings closed in source (JSDoc only)

Runtime behavior was not changed. `$I.annote` description text on `YamlParseError` was updated to match the lead (allowed documentation surface).

## Changed files

Public:

- `scratchpad/yaml/Yaml.ts` — `YamlParseOptions` Example actually trips `maxAliasCount`; `YamlParseError` lead/Gotchas/`$I.annote` cover DuplicateKey promotion
- `scratchpad/yaml/YamlNode.ts` — `AliasExpansionBudgetExceeded` Example fails under `maxAliasCount: 0` and reads `AliasCountExceeded`
- `scratchpad/yaml/YamlEdit.ts` — `YamlRange` Example compares ranged vs full `formatToString`
- `scratchpad/yaml/YamlFormat.ts` — `YamlFormattingOptions` lead points at `{@link YamlFormat.format}` instead of retired module remarks

Internal:

- `scratchpad/yaml/internal/cst-parser.ts` — `parseCSTAll` Example is `parseAll` of a stream; `"true"` stays in the lead, off the title
- `scratchpad/yaml/internal/cst-visitor.ts` — `cstEvents` Example retitled to the public one-pair parse
- `scratchpad/yaml/internal/composer/block.ts` — `composeBlockMap` Example retitled the same way
- `scratchpad/yaml/internal/diff.ts` — `computeEdits` Example observes a one-line `modify` edit
- `scratchpad/yaml/internal/rules/catalog.ts` — `builtinOptionsSchemas` Example fails construction on `{ maxx: 80 }`
- `scratchpad/yaml/internal/stringifier.ts` — quote escaping, apostrophe doubling, document-path `0x10` spelling
- `scratchpad/yaml/internal/fold.ts` — interior trailing space observed via `JSON.stringify` (`hi \\nthere`)

## Items closed

| id | status |
| --- | --- |
| yaml-public-R2-001 | closed — lead + Gotchas + `$I.annote` name fatal codes plus DuplicateKey promotions when `uniqueKeys` is true; Example kept (`DuplicateKey`); `{@link YamlDiagnostic.isFatal}` documented |
| yaml-public-R2-002 | closed — Example parses `a: &id 1\nb: *id\n` with `YamlParseOptions.make({ maxAliasCount: 0 })`, asserts `Result.isFailure` and `AliasCountExceeded` |
| yaml-public-R2-003 | closed — ranged format of `"key:\n- a\n- b\n"` with `indentSequences: true` leaves the source intact; full format includes `"  - a"` |
| yaml-public-R2-004 | closed — positional `range` wins over `options.range` via `{@link YamlFormat.format}`; no `@remarks` |
| yaml-public-R2-005 | closed — `.make({ maxAliasCount: 0 })` plus a defined alias; observes `AliasCountExceeded` |
| yaml-internal-R2-001 | closed — title/fence are `Yaml.parseAll` of a two-document stream; CST `"true"` sentence stays in the lead; Gotchas note value parse resolves Core Schema after CST |
| yaml-internal-R2-002 | closed — `cstEvents` / `composeBlockMap` titles are “Parse a one-pair mapping” / “Parse a one-pair block mapping”; sibling-key CST shape remains in Gotchas |
| yaml-internal-R2-003 | closed — `YamlFormat.modify("a: 1\nb: 2\n", ["a"], 9)` → one edit at offset 3 with content `"9"`; tautological `length >= 0` / `includes("a:")` dropped |
| yaml-internal-R2-004 | closed — `YamlLintConfig.make({ rules: { "line-length": { maxx: 80 } } })` is caught; `rejected === true` |
| yaml-internal-R2-005 | closed — double-quoted `\\"`; single-quoted `it''s`; document stringify `includes("a: 0x10")`; parsed interior space-before-newline via `JSON.stringify` |

## Residual risk

- Internal value Examples still import `@beep/scratchpad/yaml` (round-1 pack constraint). They cannot show CST `source === "true"`, sibling-first-key events, or `new AliasExpansionBudgetExceeded`. Leads/Gotchas keep those engine facts; titles now match the public fence.
- `AliasExpansionBudgetExceeded`’s Example trips the composer’s per-token `maxAliasCount` cap (same public `AliasCountExceeded` mapping the facade uses). The expansion-walk throw remains unobservable from the barrel, by design.
- `computeEdits` CRLF / unrelated-string coarse collapse stays in Gotchas. The public formatter never accepts two unrelated strings; the Example shows the one-line skeleton edit `modify` actually produces.
- `@internal` owning exports are still skipped by docgen `shouldIgnore`. Public extracted fences that changed: `YamlParseOptions`, `YamlRange` (plus `YamlParseError` / `YamlFormattingOptions` prose).
- `{@link}` targets such as `parseCSTAll`, `CstNode`, `MAX_NESTING_DEPTH` remain internal; resolution is deferred.

## Commands run

This fixer process has no shell tool, so these were **not** executed here:

```bash
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
```

Re-run those to prove yaml-public / yaml-internal opens stay `0` and that the public extracted Examples typecheck.
