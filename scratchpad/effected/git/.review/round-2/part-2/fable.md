<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review only the named git files against the pinned upstream oracle and the round-1 inventory, then report new findings as fable-2.Round 1 is closed. I'll read the current versions of the six files and the decisions that set severity, then compare them to the pinned oracle.### fable-2-1
- file: scratchpad/effected/git/internal/config.ts:438
- class: bug   severity: required
- standard: D9, D11; git-config line endings; this module's own `isLineEnd` (internal/config.ts:189)   evidence: The value loop breaks on `\n` and on `\r\n` only. A carriage return at end of input fails both checks and is appended as a significant value character (`decoded += ch`, and `\r` is not `isWs`). Bare keys and headers already treat that same byte as a line ending (`scanEntry` at internal/config.ts:401, `scanHeader` at internal/config.ts:357). `GitConfig.test.ts:530` only asserts `stringify()` for `[core]\nbare\r`, which never enters the value loop. `JSON.stringify` is not involved.
- failure: On `[core]\neditor=vim\r`, `get` returns `"vim\r"` rather than `"vim"`. `key=\r` decodes as `"\r"` rather than `""`, so a boolean field such as `shallow=0\r` or `shallow=1\r` fails `Gitmodules` decode instead of false/true. `set` uses `valueLength`, so the replacement span includes that `\r` and deletes the line ending. A trailing `\` plus a terminal `\r` is reported as `invalidEscape` instead of a line continuation.
- fix: In the value loop, break on `isLineEnd` before consuming the character, and treat `\` followed by a terminal `\r` like the existing `\` + `\r\n` continuation. Add regressions for `get`, `set` (line ending kept), and `shallow=0\r` / `shallow=1\r`.

### fable-2-2
- file: scratchpad/effected/git/Gitmodules.ts:160
- class: law   severity: required
- standard: standards/effect-first-development.md EF-3 and checklist item 16   evidence: `NoNativeRuntime.ts` flags `split`/`trim`/`startsWith`/`endsWith` in hotspot files only. It does not flag `JSON.stringify`, so a green law run misses these calls: `Gitmodules.ts:160` (`this.value ?? ""`), `internal/config.ts:421` (`after`), and the examples at `GitConfig.ts:568`, `GitConfig.ts:677`, and `Gitmodules.ts:415`.
- failure: Domain paths and JSDoc examples still format text with `JSON.stringify`. EF-3 requires a schema JSON codec. The messages and example output are the contract and must stay byte-identical.
- fix: Replace each call with `S.encodeResult(S.fromJsonString(S.String))` (or the same codec's non-throwing encode) and keep the surrounding message text. Do not hand-roll a second escaper.

### fable-2-3
- file: scratchpad/effected/git/GitConfig.ts:36
- class: docs   severity: backlog
- standard: D4; the public diagnostic contract is `GitConfigDiagnosticCode` (internal/config.ts:46, used at GitConfig.ts:58)   evidence: The only occurrence of `GitConfigErrorCode` in the module is this Details sentence. Docgen does not resolve prose identifiers.
- failure: The class docs name a union that does not exist.
- fix: Say `GitConfigDiagnosticCode` in that sentence.

REQUIRED: 2
BACKLOG: 1
