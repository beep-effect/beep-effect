### sol-2-1
- file: scratchpad/effected/yaml/internal/stringifier.ts:524
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and section 11.4 parser/formatter fidelity.   evidence: Read-only Bun probes imported both the port and the pinned oracle’s `src/internal/stringifier.ts`. In both, `stringifyValue({ x: "a\nb" }, { defaultCollectionStyle: "flow" })` returns `"{x: |-   a   b}\n"`. The independent `yaml` parser rejects it with `BAD_SCALAR_START`; the port’s own parser instead returns `{ x: "|-   a   b" }`. Adding `forceDefaultStyles: true` produces `"{x: 'a    b'}\n"`, which both parsers read with spaces replacing the original newline. The same failures occur in flow sequences; multiline flow mapping keys also emit invalid block-scalar syntax.
- failure: `renderString` receives `inFlow` but enters its multiline/block-style branches without honoring it. Flow collection renderers subsequently join the scalar’s lines with spaces, producing invalid YAML or silently changing scalar content. Green coverage does not exercise fidelity across this combination of values and options.
- fix: Before style dispatch, use escaped double-quoted rendering when `inFlow` is true and the string is multiline or the requested style is block-literal/block-folded. Apply the same rule to flow keys. Add value-path and AST-path regressions for flow maps and sequences, including canonical mode, and register the verified upstream bug under section 14.

### sol-2-2
- file: scratchpad/effected/yaml/internal/stringifier.ts:524
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and section 11.4 fidelity.   evidence: Read-only probes of both public facades show that `Yaml.stringifyResult("a\u0000b", { defaultScalarStyle: "single-quoted" })` succeeds with a literal NUL inside single quotes. Passing that output to `Yaml.parseResult` fails with `UnexpectedCharacter: Unescaped control character U+0000`. `"block-literal"` and `"block-folded"` produce the same failure. Separately, `"a\rb"` with either block style serializes successfully but parses back as `"b"` in both the port and pinned oracle. The default plain style correctly emits escaped double quotes for these values.
- failure: The general control-character/CR safety check runs only when the value contains LF. For a string without LF, explicit single-quoted or block styles bypass the plain renderer’s safety checks. Stringification therefore succeeds with output the package cannot parse, or loses content on round-trip.
- fix: Hoist the existing control-character/CR check ahead of multiline handling and style dispatch, falling back to `renderDoubleQuoted` for styles that cannot safely represent those characters. Add NUL/ESC regressions for explicit single-quoted and block styles and a lone-CR regression for both block styles. Register the verified upstream bug under section 14.

### sol-2-3
- file: scratchpad/effected/yaml/internal/composer/block.ts:2097
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and the parser’s YAML conformance contract.   evidence: Read-only probes of both port and pinned-oracle public facades return successful results for `"- &a &b foo\n"` (`["foo"]`), `"- !!str !!int 1\n"` (`[1]`), and `"a: &a &b foo\n"` (`{ a: "foo" }`), with no composition diagnostics. The independent `yaml` parser rejects these inputs with `MULTIPLE_ANCHORS` or `MULTIPLE_TAGS`. The assignments at lines 2098/2102 overwrite pending sequence properties; the block-map assignments at lines 556/562 do the same.
- failure: Multiple anchor or tag properties on one node are silently reduced to the last property. Strict parsing accepts malformed YAML, loses the earlier anchor, and can change the scalar’s resolved type through the later tag.
- fix: Before replacing a property already pending for the same node, emit a positioned fatal diagnostic in both block-map and block-sequence composition. Preserve the intentional outer-container/inner-node metadata split. Add strict-parser regressions for repeated anchors and tags, plus a valid outer/inner metadata case, and register the verified upstream bug under section 14.

### sol-2-4
- file: scratchpad/effected/yaml/internal/stringifier.ts:450
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.   evidence: `StringRenderContext` at line 450 and `StringifyContext` at line 659 remain handwritten interfaces. Both consist entirely of data fields: scalar presentation settings, literal domains, optional positioning information, and traversal state. Neither is a service contract, overload surface, or type-level transformation. No schema defines either payload; the declared-green gates therefore leave this concrete modeling-law violation undetected.
- failure: The named rendering payloads remain type-only models. Their field definitions, literal domains, and resolved configuration shape have no schema source from which annotations, validation, equivalence, or arbitraries can be derived. The required schema-first pass is incomplete.
- fix: Define file-local annotated structural schemas for both contexts and derive their types. Reuse the existing scalar/collection/quote/chomp schemas, preserve optionality and the mutable ancestor stack, and retain typed-literal construction without adding per-scalar decoding.

### sol-2-5
- file: scratchpad/effected/yaml/internal/composer/block.ts:1030
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.   evidence: `PendingComment` at line 1030, `ConsumedValue` at line 1302, and `PendingSeqComment` at line 1985 remain handwritten pure-data interfaces. The two pending-comment interfaces duplicate the same `{ text, offset, blankAbove }` payload. `ConsumedValue` models a composed node, cursor, and two comment arrays. None contains callable or type-level machinery, and none derives from a schema.
- failure: Migrating exported `SemanticItem` leaves the comment-attribution and value-consumption payloads outside the mandatory schema model. The same pending-comment shape is independently declared twice, so its fields and invariants have no shared runtime source of truth.
- fix: Define one file-local annotated pending-comment schema and reuse its derived type in mapping and sequence composition. Define an annotated structural schema for `ConsumedValue`, preserving its existing nullability, array fields, and mutation behavior. No public export or algorithm change is needed.

REQUIRED: 5
BACKLOG: 0