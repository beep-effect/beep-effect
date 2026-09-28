# ACP assertion checkpoint

The protocol suite now uses assertSome for three independently known native exit
code expectations (7, 7 and 0). The schema equivalence predicate now uses
assertTrue with its exact original operands. Unknown parse-cause extraction and
subset checks remain unchanged; no expected cause payload was invented.

Reversing the utility import and four substitutions reconstructs the scope-phase
protocol source byte-for-byte. All remaining assertions, properties, filters,
payloads and deadlines are unchanged. Malformed-output exit 23 remains a fixture
input, with no fabricated assertion credit.

Full `bun run beep quality package-verify @beep/acp` passed: audit 12.6 seconds
and docgen 4.0 seconds. Properties, flake and observability phases remain pending.
