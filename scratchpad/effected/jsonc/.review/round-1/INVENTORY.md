# jsonc review round 1 — inventory

Commit 65b074c3b47588797cf62b7226ad44adb3c9fa04. Seats: grok (rerun with the read-only
tool allowlist; the plan-mode run is kept as grok.failed-plan-mode.md), sol, fable.

Counts as reported: grok 4/2, sol 5/0, fable 9/7. After dedupe: 15 required, 7 backlog.

## Required (deduplicated)

| Id | Sources | File | Class | Resolution owner |
| --- | --- | --- | --- | --- |
| R1 | sol-1-1 | JsoncFingerprint.ts:237 | bug | lane fingerprint: short-circuit on the first member failure |
| R2 | sol-1-2, fable-1-7, fable-1-8, fable-1-9 | parser.ts:400, scanner.ts:265, JsoncFormatter.ts:133, Jsonc.ts:628/699 | perf (algorithmic class, measured 186 vs 5 ms) | lane text: local mutable accumulators |
| R3 | sol-1-3, grok-1-3 | JsoncFingerprint.ts:262 | bug (error order) | lane fingerprint: validate each key just before reading it |
| R4 | sol-1-4 | Jsonc.ts:607 | bug (accepted input and codes) | lane text: classify after toJSON |
| R5 | sol-1-5 | Properties.test.ts:304 | test (canon D5) | lane text: assertSuccess/assertFailure |
| R6 | fable-1-1, grok-1-2 | JsoncFormatter.ts:146 | bug (bytes) | lane text: leading closer never decrements |
| R7 | fable-1-2, grok-1-2 | JsoncFormatter.ts:103 | deviation unrecorded | lane text: keep total output, record upstream-bug (RangeError defect on hostile input), pin + totality property |
| R8 | fable-1-3 | JsoncVisitor.ts:140 | bug (stream not re-runnable) | lane tree: fresh generator per run, record upstream-bug, pin |
| R9 | fable-1-4 | JsoncParser/Navigate/Scanner/Formatter tests | law (D13) | lanes: relative imports (gate now enforces) |
| R10 | fable-1-5 | JsoncModifier.ts:62 | schema (law 19) | lane tree: expected is NavigateContainer |
| R11 | fable-1-6 | Jsonc.ts:449 | jsdoc | lane text: When to use opener (gate now enforces) |
| R12 | grok-1-1 | JsoncNode.ts:363 | bug (fractional index) | lane tree: non-natural segment finds nothing |
| R13 | grok-1-4 | JsoncModifier.ts:182 | deviation unrecorded | lane tree: keep typed JsoncStringifyError (law:7), record, pin |
| R14 | grok-1-5 (promoted from backlog) | JsoncModifier.ts:232 | bytes differ from upstream with eol CRLF | lane tree: re-indent with "\n" + indent, not eol |
| R15 | grok-1-6 (promoted from backlog) | JsoncModifier.ts:63 | schema parity | lane tree: restore optional offset |

Promotion reason (R14, R15): D9 makes every unrecorded observable difference a
deviation that needs a cause; neither has one, so both are restored to upstream.

## Backlog

fable-1-10 (JsoncParseErrorCode reuse), fable-1-11 (shared token guards),
fable-1-12 (Str.substring and import order), fable-1-13 (drop Container alias),
fable-1-14 (category refinements), fable-1-15 (doc wording), fable-1-16 (Bool.match).
Recorded in the ledger backlog; fable-1-13 is folded into R10 because it touches the same line.

## Rejected

None.
