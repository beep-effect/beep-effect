# Packs yaml-public + yaml-internal — round 3 fixer report

- `fixer`: jsdoc-annotation-specialist
- `scope`: everything under `scratchpad/yaml/`
- `status`: all 10 accepted round-3 findings closed in source (JSDoc only)

Runtime behavior was not changed. One titled Example per owning export; titles now match the public fence they actually run.

## Changed files

Public:

- `scratchpad/yaml/YamlLint.ts` — `StyleConflict` candidates are a real disagreement; `StyleEvidence.combine` asserts both quote spellings survive the merge

Internal:

- `scratchpad/yaml/internal/composer/state.ts` — `createState` observes default alias budget vs `maxAliasCount: 0`; `MAX_NESTING_DEPTH` stringifies a 257-deep array
- `scratchpad/yaml/internal/stringifier.ts` — `StringifyDepthExceeded` uses the same overflow; `stripNodeComments` formats source that actually carries a comment
- `scratchpad/yaml/internal/fold.ts` — width no-op vs wrap, `|` body not folded, mixed whitespace bytes, single-quoted fold-to-space, block-literal newlines
- `scratchpad/yaml/internal/composer/scalars.ts` — `hasBlockMapAfterInList` retitled off sibling-first-key
- `scratchpad/yaml/internal/composer/block.ts` — `checkDuplicateKeys` is default `Yaml.parseResult` / `DuplicateKey`
- `scratchpad/yaml/internal/composer/comments.ts` — keep-chomp format is idempotent, keep-chomp value keeps both trailing newlines, `#` vs `# ` are distinct bytes
- `scratchpad/yaml/internal/composer/tags.ts` — `parseDirective` Example is a `%YAML 1.2` document, not the TAG-leak check

## Items closed

| id | status |
| --- | --- |
| yaml-public-R3-001 | closed — `StyleConflict.make` carries double + single `StyleVoteTally` candidates; fence asserts `candidates.length === 2` and both values |
| yaml-public-R3-002 | closed — after `StyleEvidence.combine`, quoteType votes are length 2 with `single` and `double`; tautological `some(quoteType)` dropped |
| yaml-internal-R3-001 | closed — both `MAX_NESTING_DEPTH` and `StringifyDepthExceeded` stringify a 257-deep array, assert `Result.isFailure` and `diagnostics[0].code === "NestingDepthExceeded"`; `StringifyDepthExceeded` retitled off “fatality” |
| yaml-internal-R3-002 | closed — same defined-alias document succeeds under default options and fails with `maxAliasCount: 0` |
| yaml-internal-R3-003 | closed — `formatToString` of `a: 1 # c` with `preserveComments: false` drops `#`; default format keeps it. Retitled to the public path |
| yaml-internal-R3-004 | closed — `foldScalarLine` keeps a spaced phrase at `lineWidth: 0` and breaks it at `8`; `foldRenderedScalar` stringifies a `\|` body that would wrap if folded; `hasNewlineSpacesTab` asserts the space-then-tab bytes; `renderSingleQuotedMultiline` observes `{ a: "hello world" }`; `renderBlockLiteral` asserts the interior newline |
| yaml-internal-R3-005 | closed — title is “Parse a nested one-pair mapping”; sibling-first-key CST shape stays in the lead |
| yaml-internal-R3-006 | closed — fence is `Yaml.parseResult("a: 1\na: 2\n")` reading `DuplicateKey`, matching the public parse-error Example |
| yaml-internal-R3-007 | closed — `blankLineAboveStart` format of keep-chomp is idempotent; `blankAboveIsKeepChompContent` JSON includes both trailing newlines; `rawCommentText` distinguishes bare `#` from spaced `# ` |
| yaml-internal-R3-008 | closed — title/fence parse a `%YAML 1.2` document as `{ a: 1 }`; TAG-leak stays on `validateTagHandlesInDocument` |

## Residual risk

- Internal value Examples still import `@beep/scratchpad/yaml` (round-1 pack constraint). They cannot show `new StringifyDepthExceeded`, `parseDirective`’s `{ name, parameters }` record, or `rawCommentText("#") === " "`. Leads/Gotchas keep those engine facts; titles match the public fence.
- `AliasExpansionBudgetExceeded` still trips the composer’s per-token `maxAliasCount` cap rather than the expansion-walk throw (round-2 residual; unobservable from the barrel).
- `@internal` owning exports are still skipped by docgen `shouldIgnore`. Public extracted fences that changed: `StyleConflict`, `StyleEvidence`.
- `{@link}` targets such as `MAX_NESTING_DEPTH`, `parseDirective`, `stripNodeComments` remain internal; resolution is deferred.

## Commands run

This fixer process has no shell tool, so these were **not** executed here:

```bash
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
zsh -ic 'bun run --cwd scratchpad docgen --include "yaml/YamlLint.ts" --include "yaml/internal/fold.ts"'
```

`@beep/scratchpad` has no package `check` script. Re-run the commands above to prove yaml-public / yaml-internal opens stay `0` and that the public extracted Examples typecheck.
