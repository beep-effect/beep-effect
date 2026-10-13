### sol-2-1
- file: scratchpad/effected/env/internal/osc8/detect.ts:57
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md` “Schema owns pure data”; D5/D11.   evidence: `Osc8Info` is an exported, interface-only diagnostic payload containing booleans, strings, finite literals, nullable values, and existing schema-backed payloads. It has no operations or type-level machinery requiring the service-contract exception. `detect` returns this payload at lines 252–265. The local `Gate` interface at lines 179–183 independently repeats three of its fields. Round 1’s schema findings cover `ProcessSnapshot` and `Osc8Detection`, but omit this model.
- failure: The full diagnostic result has no schema-derived runtime contract, field metadata, codec, or equivalence. The schema-first conversion covers the projected result while leaving its underlying diagnostic payload as a handwritten interface; the green gates miss this omission.
- fix: Define an identity-annotated `Osc8Info` `S.Struct` using the existing literal and payload schemas, preserving its nullable fields and ordinary object representation. Derive the same-name type from the schema and derive `Gate` as a field subset of that type. Preserve every detection result and explanation.

### sol-2-2
- file: scratchpad/test/env/internal/osc8/detect.property.test.ts:35
- class: test   severity: required
- standard: D10; `scratchpad/EFFECTED_PORT_GOAL.md` §11.4, requiring an `Arbitrary.schema(schema)` encode/decode identity property for every exported schema or codec.   evidence: Production exports `ProcessSnapshot` at `internal/osc8/detect.ts:148`, with `env: S.Record(S.String, S.UndefinedOr(S.String))`. The property suite imports only `Osc8Reason` and `Osc8Detection`, then constructs a separate `Snapshot` whose environment values are exclusively strings. A search of `scratchpad/test/env/**` finds no encode/decode property using the production `ProcessSnapshot` schema.
- failure: The required property floor is missing for `ProcessSnapshot`. Its production codec can change or mishandle undefined-valued environment entries while the local `Snapshot` serialization property continues to pass. Full source coverage does not detect this missing contract test.
- fix: Import `ProcessSnapshot` and add the existing round-trip property pattern using `Arbitrary.schema(ProcessSnapshot)`, its actual encode/decode functions, schema equivalence, and `fcRuns`. Retain the narrower JSON serialization property separately.

### sol-2-3
- file: scratchpad/test/env/internal/osc8/semver.property.test.ts:25
- class: test   severity: required
- standard: D10; `scratchpad/EFFECTED_PORT_GOAL.md` §11.4 parser idempotence/fidelity requirements; D9 requires preserving the pinned oracle’s permissive parser behavior.   evidence: A read-only Bun probe evaluated the property’s exact parsing and serialization operations for both parsers with the schema-valid input `"1000000000000000000000"`. Lab and frozen oracle both return `"100000000000000000.0.0"`. `stringifyPacked` produces `"1e+21"`; parsing that produces `"0.0.1"`, whose serialization is `"1"`. Consequently, both assertions at lines 28–29 fail for this input.
- failure: The new property asserts an inverse-format law over unrestricted strings that its test serializer does not satisfy. Scientific notation from numeric serialization is read as a numeric prefix by the permissive parser. The green generated run missed this counterexample, so it does not establish the claimed idempotence or fidelity.
- fix: Generate the inverse-format law’s packed inputs from the existing bounded `Version` tuple, where the serialization is valid. Keep unrestricted-input behavior checks separately and add this oversized input as a deterministic oracle-parity case. Preserve the parser’s upstream behavior.

REQUIRED: 3
BACKLOG: 0