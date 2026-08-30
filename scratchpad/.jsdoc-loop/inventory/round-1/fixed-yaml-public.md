# Pack yaml-public — round 1 fix report

- fixer: jsdoc-annotation-specialist
- scope: `scratchpad/yaml/*.ts` excluding `yaml/internal/`
- status: accepted findings R1-001–R1-024 closed in source

## Changed files

- `scratchpad/yaml/index.ts` — module header: `@remarks` → `**Details**`; added `@since 0.0.0`. Re-exports untouched.
- `scratchpad/yaml/Yaml.ts` — module header; owning-export leads/tags/Examples; method `@example`/`@remarks` converted; `$I` annotations on option/error classes.
- `scratchpad/yaml/YamlDiagnostic.ts` — module header; literal/union `$I.annoteSchema`; `YamlDiagnostic` Example + fatality Gotchas; type-companion leads rewritten.
- `scratchpad/yaml/YamlDocument.ts` — module header; models Examples; stringify `lineWidth` Gotchas; `documentFromRaw` kept `@internal` with lint-path Example.
- `scratchpad/yaml/YamlEdit.ts` — module header; type-level `@see`; `YamlRange`/`YamlEdit` Examples; `applyAll` overlap `@throws` + Gotchas.
- `scratchpad/yaml/YamlFormat.ts` — module header; options/error/class Examples; format/modify/directive/range/`<<`/`lineWidth` Gotchas preserved off `@remarks`.
- `scratchpad/yaml/YamlLint.ts` — module header; config/evidence/conflict/facade Examples; always-on `parse-validity`, first-document, overlapping-fix Gotchas.
- `scratchpad/yaml/YamlLintRule.ts` — module header; severity/diagnostic/vote/floor/rule Examples; `_tag` vs `instanceof` Gotchas.
- `scratchpad/yaml/YamlNode.ts` — module header; literal kits + node classes Examples; `.make` vs `new`, alias `null`, QuoteStyle vs ScalarStyle Gotchas; engine-only symbols marked `@internal`.
- `scratchpad/yaml/YamlToken.ts` — module header; tokenize reserved-failure Gotchas; well-formed + `"error"`-kind Examples.
- `scratchpad/yaml/YamlVisitor.ts` — module header; dropped stale “tokenizer stays internal” note; in-band `Error` events + Pair scalar-only Gotchas.

Runtime code was not rewritten except allowed `$I.annote` / `$I.annoteSchema` attachments. Schema class identifiers stay the short names (not `$I\`Name\``) so `_tag` / schema identity strings do not change.

`$I` composers:

- `$ScratchpadId.create("yaml/Yaml")`
- `$ScratchpadId.create("yaml/YamlDiagnostic")`
- `$ScratchpadId.create("yaml/YamlDocument")`
- `$ScratchpadId.create("yaml/YamlEdit")`
- `$ScratchpadId.create("yaml/YamlFormat")`
- `$ScratchpadId.create("yaml/YamlLint")`
- `$ScratchpadId.create("yaml/YamlLintRule")`
- `$ScratchpadId.create("yaml/YamlNode")`
- `$ScratchpadId.create("yaml/YamlToken")`

## Items closed

| id | status |
| --- | --- |
| yaml-public-R1-001 | closed — Yaml.ts module header, tags, titled Examples, `@example`/`@remarks` converted |
| yaml-public-R1-002 | closed — YamlDiagnostic.ts header, tags, Examples, type companions |
| yaml-public-R1-003 | closed — YamlDocument.ts header, tags, Examples, stringify Gotchas |
| yaml-public-R1-004 | closed — YamlEdit.ts header, tags, Examples, jsonc parity in Details |
| yaml-public-R1-005 | closed — YamlFormat.ts header, tags, Examples, method remarks converted |
| yaml-public-R1-006 | closed — YamlLint.ts header, tags, Examples, pure-half Details |
| yaml-public-R1-007 | closed — YamlLintRule.ts header, tags, Examples |
| yaml-public-R1-008 | closed — YamlNode.ts header, tags, Examples, `.make` Gotchas |
| yaml-public-R1-009 | closed — YamlToken.ts header, tags, Examples, tokenize remarks converted |
| yaml-public-R1-010 | closed — YamlVisitor.ts header, tags, Examples, visit remarks converted |
| yaml-public-R1-011 | closed — index.ts `@remarks` → Details, `@since 0.0.0` |
| yaml-public-R1-012 | closed — examples import `@beep/scratchpad/yaml`; Effects/Results are observed |
| yaml-public-R1-013 | closed — Yaml Gotchas (lineWidth, `<<`, bind-to-const, equals alias bomb, no `code`) + sibling `@see` |
| yaml-public-R1-014 | closed — YamlDiagnostic fatality/`fromRaw`/modify-code Gotchas; type-companion leads |
| yaml-public-R1-015 | closed — YamlDocument lineWidth/comment-slot/parseAll Gotchas; `documentFromRaw` stays internal |
| yaml-public-R1-016 | closed — `YamlEdit.applyAll` overlap `@throws` + Gotchas + non-overlapping Example |
| yaml-public-R1-017 | closed — YamlFormat total-format / single-doc modify / directive / range / `<<` / inert lineWidth Gotchas |
| yaml-public-R1-018 | closed — YamlLint always-on parse-validity, first document, overlapping fixes |
| yaml-public-R1-019 | closed — `_tag` discriminator Gotchas; engine vs lint diagnostic `@see`; YamlRule Example |
| yaml-public-R1-020 | closed — YamlNode `.make`/parents/alias-null/pathOf; `nodeToJsValue` `@throws`; QuoteStyle vs ScalarStyle |
| yaml-public-R1-021 | closed — reserved tokenize failure, error tokens in success, raw `text` |
| yaml-public-R1-022 | closed — visitor Error-in-band, Pair scalar-only, comment ownership; stale CST header dropped |
| yaml-public-R1-023 | closed — `$ScratchpadId.create("yaml/...")` + `$I.annote` / `$I.annoteSchema` on exported schemas |
| yaml-public-R1-024 | closed — facade leads rewritten off “statics, not instantiable” |

## Residual risk

- **Non-barrel symbols.** `documentFromRaw`, `AliasExpansionBudgetExceeded`, `aliasExpansionLimit`, and `nodeToJsValue` are not re-exported from `@beep/scratchpad/yaml`. Their Examples compile via public facades (`YamlLint.run` recovered parse, `Yaml.parseResult` alias resolution) rather than importing the internal names. That matches the “do not present as a package entry point” constraint and the example-import law.
- **Example outputs.** Observable `console.log` / `Result.isSuccess` assertions are written from the implementation contracts (duplicate-key promotion, circular stringify, indentSequences, trailing-spaces, in-band visitor errors). Exact printed YAML strings are asserted with `.includes(...)` where folding/diff could vary.
- **`$I` identity strings.** Annotations were added as Class/TaggedError extra arguments and `.pipe($I.annoteSchema(...))`. Short schema identifiers (`"YamlParseOptions"`, `_tag: "YamlParseError"`) were left unchanged to avoid runtime identity drift.
- **Census / docgen not executed in this subagent.** This fixer environment has no shell tool, so `/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts`, `bun run docgen:local`, and the owning-package check were not run here. Mechanical census rules were applied by inspection (module `@packageDocumentation`+`@since`, owning `@category`/`@since`, value-level `**Example** (Title)`, zero `@example`/`@remarks` on the public surface). Re-run those commands to prove opens=0 and example compilation.
- **`yaml/index.ts` census.** Module findings still skip barrels (`owningExportCount === 0`); the header law is satisfied in source anyway.
- **`yaml-internal` pack.** Left open; another agent owns `scratchpad/yaml/internal/`.

## Commands to run (not executed here)

```bash
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts
bun run docgen:local -- --package @beep/scratchpad
```

Expect yaml-public `openModuleCount: 0` and `openOwningExportCount: 0`. yaml-internal may still be open.
