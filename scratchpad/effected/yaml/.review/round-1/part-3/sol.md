### sol-1-1
- file: scratchpad/effected/yaml/internal/stringifier.ts:1955
- class: type-safety   severity: required
- standard: `standards/effect-first-development.md` EF-18; `standards/effect-laws-v1.md` “Dual-Arity Inventory Contract”; D9.   evidence: The added overload promises `(options?: StringifyOptionsInput) => (value: unknown) => string`, but the dispatch predicate treats every call with an argument as data-first. A read-only Bun probe returned `"finalNewline: false\n"` for `stringifyValue({ finalNewline: false })` and `"null\n"` for `stringifyValue(undefined)`. Using either result in `pipe(42, …)` threw `TypeError: args[0] is not a function`. The broad data-first overload also shadows the options-bearing data-last overload during ordinary TypeScript overload resolution.
- failure: The advertised options-bearing data-last API cannot be used. Its options are serialized as YAML data instead of configuring a formatter. Distinguishing options from arbitrary YAML objects would also change upstream’s valid one-argument behavior.
- fix: Restore the upstream data-first `(value, options?)` signature and remove the misleading overload and unnecessary `dual` wrapper. Optional-options APIs are explicitly exempt from forced dual conversion. A separately named curried formatter can be added if needed.

### sol-1-2
- file: scratchpad/effected/yaml/internal/stringifier.ts:1139
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the scalar-value contract in `YamlNode.ts` and the document stringifier’s fidelity contract.   evidence: A read-only probe against both the lab and the pinned oracle composed `n: 9007199254740993\n`, stringified the document, and composed the result. Both emitted `n: "9007199254740993"\n`; the original value was `bigint`, while the reparsed value was `string`. The input produced no composition errors. Root and sequence forms reproduce the same failure.
- failure: Rendering a document silently changes a valid large YAML integer into a YAML string. The value-level stringifier handles `bigint`, but the AST scalar renderer falls through to double-quoted string coercion.
- fix: Add a `P.isBigInt(val)` branch before the string/fallback branches and emit the preserved numeric spelling or `val.toString()` without quotes. Add a large-integer document round-trip regression and record the verified upstream-bug deviation in the README and ledger before changing behavior.

### sol-1-3
- file: scratchpad/effected/yaml/internal/stringifier.ts:1009
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the stringifier’s stated nesting-depth guarantee and `YamlDocument.stringify`’s typed `NestingDepthExceeded` contract.   evidence: A read-only probe constructed a valid synthetic AST containing 50,000 nested `YamlSeq` instances. In both the lab and pinned oracle, `stringifyDocument(doc, { forceDefaultStyles: false })` threw `StringifyDepthExceeded: Nesting depth exceeded maximum of 256`, while `{ forceDefaultStyles: true }` threw `RangeError: Maximum call stack size exceeded.` Canonical mode calls the unbounded recursive `stripNodeComments` before reaching the guarded renderer.
- failure: Canonical rendering bypasses the nesting-depth protection during preprocessing. A deeply nested synthetic document reaches a stack overflow instead of the promised depth diagnostic.
- fix: Thread a depth counter through `stripNodeComments` and enforce `MAX_NESTING_DEPTH` before descending, raising `StringifyDepthExceeded`. This bounds the first canonical preprocessing walk before tag normalization and rendering. Add a canonical-mode depth regression and record the upstream-bug deviation under section 14.

### sol-1-4
- file: scratchpad/effected/yaml/internal/stringifier.ts:47
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` short law 7; `standards/effect-first-development.md` EF-1 and EF-12; D5.   evidence: `StringifyFailure` here and `StringifyDepthExceeded` at line 63 extend `Data.TaggedError`, despite being imported and handled across module boundaries by the public facades. A read-only probe returned `false` for both `S.isSchema(StringifyFailure)` and `S.isSchema(StringifyDepthExceeded)`. Neither has a `$ScratchpadId` schema identity or schema annotations. The recorded stringifier allowlist entry covers only the ancestor `Set`, not these errors; the green gates therefore leave this explicit error-model violation present.
- failure: These cross-module failure models lack the required schema-backed error representation, identity, validation, and derivable codecs.
- fix: Define both errors with `S.TaggedError`, `$I` identities, field annotations, and `$I.annote(...)`. Update internal construction to `.make(...)`, preserving the messages, names, and `reason` consumed by the facades. Avoid overriding schema constructors; record any necessary constructor-shape deviation as law-driven.

### sol-1-5
- file: scratchpad/effected/yaml/internal/stringifier.ts:731
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` short law 10; `standards/effect-first-development.md` EF-38.   evidence: The value renderer executes native `keys.sort()` here, and the AST renderer executes native `items.sort(...)` at line 1404. Both sites remain in the reviewed commit despite the reported green gates. The stringifier’s recorded runtime exception covers only `new-map-set`; no sorting exception is recorded.
- failure: Both `sortKeys` rendering paths execute native array sorting contrary to the explicit Effect-first sorting law.
- fix: Use `A.sort` with `Order.String` for value keys and an explicit `Order.mapInput` ordering for AST pairs. Preserve the existing scalar-key coercion, empty-string fallback for non-scalar keys, and stable ordering of equal keys.

### sol-1-6
- file: scratchpad/effected/yaml/internal/token.ts:6
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b and EF-33; `standards/schema-first-development-prompt.md` “Schema owns pure data” and “Derive behavior instead of duplicating truth.”   evidence: The internal token kind is a handwritten 22-member union, and the token payload at line 35 is a plain interface. These are reused data models consumed by the lexer and CST parser. The same 22 kinds are separately declared in the public `YamlToken.ts` schema; the internal definitions are not derived from it or any other runtime schema.
- failure: The lexical domain has duplicated sources of truth and no schema-backed internal token model. Runtime validation and arbitrary derivation cannot come from the definitions the engine actually uses.
- fix: Define the internal kind domain once with an annotated `LiteralKit`, define the raw token payload with an annotated `S.Struct`, and derive their types. Have the public token-kind export reuse that domain while retaining the public token’s distinct `text`/`character` fields. Preserve existing raw token fields and lexer behavior.

### sol-1-7
- file: scratchpad/effected/yaml/internal/composer/block.ts:204
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` short law 20; `standards/effect-first-development.md` EF-13 and EF-33; `standards/schema-first-development-prompt.md` “Finite variants are discriminated.”   evidence: `SemanticItem` represents four internal composition states with one interface containing independent optional `node`, `comment`, and `offset` fields. The flattening and pair-building passes repeatedly discriminate on `kind` and then recover payload presence through optional access and fallbacks. The type permits unrelated combinations such as a `"value-sep"` item carrying node or comment payloads.
- failure: The internal semantic stream does not encode its case-specific payload invariants in a schema-backed discriminated union. Impossible combinations remain representable, and downstream composition must reconstruct those invariants.
- fix: Replace the optional payload bag with an annotated union discriminated by the existing `kind` field, deriving `SemanticItem` from it. Preserve the intentional node-less explicit-key markers and absent-value behavior; do not introduce a new discriminator or alter the upstream semantic stream.

### sol-1-8
- file: scratchpad/effected/yaml/internal/composer/anchors.ts:36
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` hard requirements and kind-split Example law; `scratchpad/EFFECTED_PORT_GOAL.md` section 10.2; the brief’s explicit S2 deferral.   evidence: `makeAlias` has no JSDoc. Other reviewed exports lack the required titled Examples, canonical `@category`, and `@since 0.0.0`, including `checkAnchorOnAlias`, the stringifier error classes and rendering helpers, `composeBlockMap`, and the internal token types. Section 10.2 explicitly includes `internal/**` in docgen’s documentation standard.
- failure: The reviewed internal API surface is not ready for the deferred S2 documentation gate. This is backlog only under the operator’s stage order.
- fix: During S2, retain the upstream explanatory prose, document currently undocumented exports, add compiling titled Examples to value exports, and add canonical categories and `@since 0.0.0` throughout the four reviewed files.

REQUIRED: 7
BACKLOG: 1