# Encoder differential, 2026-11-10

A shape-review probe run against `origin/main` at `6d47006fa1d`. It asks one
question: do the hand-rolled canonical-JSON encoders in this repository
produce different bytes for the same value?

## Method

A throwaway Bun script imported four encoders straight from their source
files and fed each the same values:

| Label | Source | Entry point |
| --- | --- | --- |
| epistemics | `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts` | `canonicalJson` |
| packetCore | `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketDigest.ts` | `canonicalJsonText` |
| semantica | `apps/labs/semantica/src/corpus/Canonical.ts` | `canonicalJson` |
| jcs | `packages/foundation/modeling/jsonc/src/JsoncFingerprint.ts` | `JsoncFingerprint.canonicalizeResult` |

The generator is a seeded xorshift producing 20,000 nested values from plain
JSON only: objects, arrays, booleans, `null`, a fixed pool of 14 numbers
(including `-0`, `1e21`, `1e-7`, `5e-324`, `2 ** 53` and the largest double)
and a fixed pool of 23 strings (including the empty string, quotes,
backslashes, a NUL, `U+2028`, a precomposed and a decomposed accent, a
ligature above `U+FB00` and an astral code point, so that UTF-16 code-unit
order and code-point order would disagree on the keys if any encoder used the
second). Nesting stops at depth four.

A second pass fed eight values that are not plain JSON.

## Result on plain JSON

Zero disagreements in all six pairings over 20,000 values. The four encoders
emit the same bytes, and those bytes are RFC 8785 (JSON Canonicalization
Scheme) output.

## Result off the JSON domain

| Input | epistemics | packetCore | semantica | jcs |
| --- | --- | --- | --- | --- |
| `{ a: undefined, b: 1 }` | `{"b":1}` | `{"b":1}` | `{"b":1}` | refuses, `UnrepresentableValue` |
| `[1, undefined, 2]` | throws `TypeError` | `[1,null,2]` | `[1,null,2]` | refuses, `UnrepresentableValue` |
| `{ n: NaN }` | `{"n":null}` | `{"n":null}` | `{"n":null}` | refuses, `NonFiniteNumber` |
| `[Infinity]` | `[null]` | `[null]` | `[null]` | refuses, `NonFiniteNumber` |
| a lone surrogate string | escaped | escaped | escaped | refuses, `LoneSurrogate` |
| `{ d: new Date(0) }` | `{"d":{}}` | `{"d":{}}` | `{"d":{}}` | refuses, `NonPlainObject` |
| `{ b: 1n }` | `{"b":{}}` | `{"b":null}` | `{"b":null}` | refuses, `BigIntValue` |
| `undefined` | throws `TypeError` | `null` | `null` | refuses, `UnrepresentableValue` |

The hand-rolled encoders coerce silently, so two different values can share a
digest: `{ n: NaN }` and `{ n: null }` encode to the same text in all three.
The only place two hand-rolled encoders disagree with each other is a bigint
member and an `undefined` array element.

## What this does and does not show

- It shows the byte form is already single on plain JSON, and that the
  standards-based encoder in `@beep/jsonc` is the one that refuses the inputs
  the others coerce.
- It does not show that no stored digest depends on a coerced value. That
  needs a replay over stored events and seals, which is the first phase of the
  graduated goal.
- It did not cover the PartyKey v1 encoder
  (`packages/party/domain/src/values/PartyKey/PartyKey.behavior.ts`), which is
  string-only and has its own escaping, or the pretty renderers
  (`canonicalJsonTextPretty`, the OpenClaw document renderer), which are
  indented and so are not RFC 8785 output by design.
- The value pools are small and fixed. The goal lands this as a property test
  with a wider generator.
