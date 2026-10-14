<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review those six workspace files against the round-2 inventory, the port ledger, and the pinned upstream oracle, and I'll only report new findings.Round-2 items on these files are already inventoried. I'll read the current sources against the pinned oracle and look only for new defects.I'll confirm the member-escape path against the port notes and the upstream oracle before writing findings.### fable-3-1
- file: scratchpad/effected/workspaces/SourceBoundary.ts:387
- class: bug   severity: required
- standard: D9, D11, EFFECTED_PORT_GOAL.md §14 (`upstream-bug`); `console-stdout` contract in SourceBoundary.ts:33–36 and the pinned oracle README (rule table: spare a member access to `error`, `warn`, `trace`, `assert`). ECMAScript `IdentifierName` includes `UnicodeEscapeSequence`. Round-2 r23 and the ledger entry at `sourceText.test.ts:95` / `SourceBoundary.test.ts:404` cook the receiver only; `SourceBoundary.test.ts:432` covers `\u0063onsole.warn`, not an escaped member. Not b01 (that item is the suffix slice).
- evidence: `memberAfter` walks `code.slice(j)` and stops at the first character `isIdentifierChar` rejects (`IDENTIFIER` is `[\p{ID_Continue}$\u200c\u200d]`). `\` fails that test, so the member is `undefined`. `check` then records the reference (`SourceBoundary.ts:818–820`). The same walk in the oracle (`SourceBoundary.ts:230–239`) also stops at `\`, and the oracle suite never feeds an escaped member. `console.\u0065rror("x")` is a call to `console.error`.
- failure: `SourceBoundary.check("f.ts", 'console.\\u0065rror("x");', ["console-stdout"])` reports a `console-stdout` offence with detail `console`. The same call spelled `console.error("x")` is clean (fixture at `SourceBoundary.ts:563`). `\u0077arn`, `\u0074race`, `\u0061ssert`, and `\u{65}rror` fail the same way, including after `?.` and on `globalThis.console`.
- fix: Cook the member with the existing identifier cooker before `STDERR_METHODS` lookup, and keep the offence column on the raw `console` offset. Add a fixture for `console.\u0065rror` / `console?.\u0077arn` that expects no `console-stdout` offence, and keep `console.\u006clog` flagged. Record the deviation as an upstream bug.

### fable-3-2
- file: scratchpad/effected/workspaces/SourceBoundary.ts:346
- class: bug   severity: required
- standard: D9, D11, EFFECTED_PORT_GOAL.md §14 (`upstream-bug`); `stdout-write` contract in SourceBoundary.ts:27–29 and the oracle README (a `stdout.write`, or a `stdout.end` that passes a chunk). Same `IdentifierName` escape rule as fable-3-1. The known-miss list (`SourceBoundary.ts:649–673`) does not include escaped method or receiver names. r23 did not change this regex.
- evidence: `STDOUT_WRITE` is `/stdout\s*(?:\?\.|\.)\s*(write|end)/gu`, and the oracle defines the same pattern (`SourceBoundary.ts:199`). A `UnicodeEscapeSequence` in `stdout`, `write`, or `end` fails the literal match, so `stdoutWrites` yields nothing. `stdout.\u0077rite(buf)` and `\u0073tdout.write(buf)` both invoke `stdout.write`.
- failure: `SourceBoundary.check("f.ts", 'stdout.\\u0077rite(buf);', ["stdout-write"])` returns no offence. `stdout.write(buf)` is flagged. `stdout.\u0065nd("chunk")` and `\u0073tdout.end("chunk")` are also silent, so a real final-chunk write passes the rule.
- fix: Resolve the `stdout` receiver and the following member as cooked identifiers, then keep the existing `write` / `end`+chunk filter and raw offsets. Add regressions for an escaped method and an escaped `stdout` receiver. Record the deviation as an upstream bug.

REQUIRED: 2
BACKLOG: 0
