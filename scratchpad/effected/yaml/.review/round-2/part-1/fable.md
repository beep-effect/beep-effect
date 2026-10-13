<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the yaml port read-only against the pinned upstream oracle and round-1 inventory, starting with the binding decisions and the nine files in this brief.Round 1 already recorded those defects. I’ll inspect the current nine files for leftover or newly introduced issues, not the closed inventory.The round-1 fixes are in place. Next I’ll probe the public surfaces for behavior that still diverges from the pinned oracle.The CR line-model mismatch is the strongest lead. I am checking the current line numbers and the remaining unproven cases against the pinned oracle before writing findings.### fable-2-1
- file: scratchpad/effected/yaml/YamlLint.ts:216
- class: bug   severity: required
- standard: D9; D11. The recorded lone-CR deviation covers scanner and public token positions only (README Port notes; round-1 `token-cr-positions`).
- evidence: `YamlToken.promoteAll` (`YamlToken.ts:105-108`) treats a lone CR and a CRLF as one line break. `buildLines` (`YamlLint.ts:216-217`) splits only on `\n` and strips a CR only when it immediately precedes that `\n`. `document-start` and `document-end` then read `ctx.lines[token.line]?.text ?? ""` (`document-start.ts:117`, `document-end.ts:128`). For `"\r---\n"` with `document-start` `present: false`, the lexer emits a newline at offset 0 and a `document-start` at offset 1 (`lexer.ts:1216-1253`, column reset in `advance`). `promoteAll` assigns that marker line 1. `buildLines` keeps a single line, `"\r---"`. The lookup is `""`, `trim() === "---"` fails, and the removal fix is omitted. Upstream `promoteAll` splits only on `\n`, so the marker stays on line 0, `"\r---".trim() === "---"`, and the fix is offered. `"\r...\n"` with `document-end` `present: false` drops the same way.
- failure: After the admitted CR token fix, `token.line` no longer indexes `ctx.lines`. A marker that is alone on its line loses the autofix upstream emits.
- fix: Split `buildLines` with the same lone-CR and CRLF convention as `promoteAll`. Do not add U+2028 or U+2029. `eof-newline` still keys off `endsWith("\n")`; only its reported line and character move for a lone-CR file.

### fable-2-2
- file: scratchpad/effected/yaml/Yaml.ts:1051
- class: bug   severity: required
- standard: D9; D11. Upstream `Yaml.allFromString` always decodes through `Yaml.parseAll` (oracle `packages/yaml/src/Yaml.ts:802-803`). Not in the ledger or Port notes.
- evidence: `parseCSTAll("")` returns one empty document (`cst-parser.ts:967-969`). `composeDocument` leaves `contents` null (`document.ts:269`), and `nodeToJsValue(null)` returns null (`YamlNode.ts:1131`). `Yaml.parseAllResult("")` is therefore `[null]`, which `scratchpad/test/yaml/Yaml.test.ts:323-331` locks as the empty-stream contract, matching `Yaml.parse("")`. The codec special-cases `input === ""` to `[]` before `parseAll`. Encoding `[]` is still `""`, so the codec round-trips an empty array that the parser does not produce. `Yaml.property.test.ts` only round-trips `allFromString` composed with `S.Array(Value)`, so the gate never compares the empty decode with `parseAll`.
- failure: `S.decode(Yaml.allFromString())("")` is `[]`. Upstream and `Yaml.parseAll("")` are `[null]`.
- fix: Delete the `input === ""` branch and decode through `Yaml.parseAll`. The lab property that round-trips `[]` has to stop treating an empty array as a YAML stream.

### fable-2-3
- file: scratchpad/effected/yaml/Yaml.ts:882
- class: bug   severity: required
- standard: D9; D11. Distinct from the three recorded comment deviations (block-scalar content hashes, apostrophe comments, CRLF replacement bytes) and from round-1 `yaml-comments`.
- evidence: `stripComments` removes only `comment` tokens, and re-lexes a header only when the token kind is `scalar` and the source starts with `|` or `>` (`Yaml.ts:882-890`). For `"> hello # comment\n"`, `scanBlockScalar` (`lexer.ts:737-749`) takes the invalid-header branch and returns one `error` token covering the whole line, including the whitespace-preceded `# comment`. No comment token is emitted, the scalar re-lex does not run, and the source is unchanged. Upstream's character scanner (`oracle packages/yaml/src/Yaml.ts:701-708`) is not inside a quote, sees a `#` preceded by a space, and returns `"> hello \n"`. A quoted `#` such as `"hello # there` stays one unterminated-string error token on both sides and must not be stripped.
- failure: A real comment on an invalid block-scalar header survives `Yaml.stripComments`. Upstream removes it.
- fix: In the invalid-header branch, stop the error token before a whitespace-preceded `#` and emit `scanComment` for the rest. The existing comment walk then strips it. Do not strip `#` inside other `error` tokens.

REQUIRED: 3
BACKLOG: 0
