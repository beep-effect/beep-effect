### sol-1-1
- file: scratchpad/effected/cli/TestTerminal.ts:87
- class: bug   severity: required
- standard: D9, D11, section 14 `upstream-bug`; `TestTerminalHandle.reads` explicitly counts keys **taken**, and says all-zero counters prove that input was untouched.   evidence: A read-only Node probe ran `TestTerminal.make()`, then `terminal.end`, then `terminal.input([{ name: "enter" }])`, without subscribing to or reading input. It returned `{"reads":{"keys":1,"lines":0,"subscriptions":0},"pending":0}`. An assertion expecting zero reads failed. The same probe against the frozen upstream oracle returned the same incorrect result, establishing an inherited bug. `offered` increases before `Queue.offerAll`, and the returned unaccepted inputs are discarded.
- failure: Offering input after the terminal has ended makes the double report a key read that never occurred. Tests using `reads` to prove that a noninteractive path left stdin untouched can fail falsely.
- fix: Increase `offered` only by the number of inputs actually accepted, accounting for the unaccepted array returned by `Queue.offerAll`. Add the end-then-offer regression and record the verified upstream bug through section 14.

### sol-1-2
- file: scratchpad/effected/cli/internal/ExitRequested.ts:11
- class: law   severity: required
- standard: D5; `standards/effect-laws-v1.md` short law 7; `.patterns/error-handling.md` structured-error contract.   evidence: `ExitRequested` extends `Data.TaggedError`, has no schema contract, and has no `$ScratchpadId` identity. The cited law specifically requires typed errors to extend `S.TaggedError` directly. This escapes the reported green gates: the installed `@effect/tsgo` 0.47.2 schema has no `preferSchemaTaggedError` rule, and the pinned `tsconfig.base.json` has no configuration entry for it. Replacing native `Error` with `Data.TaggedError` therefore clears the native-error checks without meeting this separate law. No exception is recorded for this error.
- failure: The private exit failure remains outside the required schema and identity contract: it cannot supply schema-derived decoding, encoding or canonical annotation metadata.
- fix: Define it with identity-backed `S.TaggedError` and annotated fields. Represent the exit code as a field and derive its message and runtime exit marker with getters; update its internal construction site to use `.make(...)`, preserving the existing exit behavior.

### sol-1-3
- file: scratchpad/effected/cli/Status.ts:12
- class: schema   severity: required
- standard: Operator step 4 in `scratchpad/EFFECTED_PORT_GOAL.md`; `standards/effect-first-development.md` EF-12.   evidence: The newly introduced `UnknownStatusError` supplies `$I` as the schema identifier, but omits the schema’s `$I.annote(...)` metadata entirely. Its `message: S.String` field is also unannotated. Step 4 explicitly requires annotations on fields and schemas; EF-12 requires meaningful canonical metadata on new schemas. Typechecking and the four syntax laws do not establish that metadata requirement.
- failure: The error has a canonical identifier but lacks the required descriptive schema and field metadata. The completed identity pass therefore leaves this newly added schema incomplete.
- fix: Add meaningful `$I.annote(...)` metadata to the error and descriptive annotations to its `message` field, without changing the tag or error message.

### sol-1-4
- file: scratchpad/effected/cli/Doc.ts:53
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5, “Schemas Are Executable Contracts”; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-13.   evidence: The document model’s `Inline` and `Block` variants are handwritten TypeScript unions, and supporting node payloads such as `LinkTarget`, `TreeNode`, `Column` and `Counter` are handwritten types or interfaces. `Doc.ts` contains no schema definitions. These are the module’s explicitly documented plain-data AST, consumed and matched by the renderers, rather than service contracts or type-level machinery. The green syntax gates can accept these declarations without checking that the schema owns the model.
- failure: The document’s runtime variants and payloads have no executable schema contract. Guards, codecs, equivalence and schema-derived arbitraries cannot be derived from the source of truth required by the binding standards.
- fix: Introduce identity-annotated structural schemas for the AST and supporting payloads, using recursive tagged schemas where necessary, and derive the existing exported types from them. Preserve the existing plain-object shapes, optional-field semantics, callbacks and frozen constructors so this does not change upstream behavior.

### sol-1-5
- file: scratchpad/effected/cli/Token.ts:13
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b.   evidence: `NamedColor` and `TokenName` are named, reused literal domains declared only as string-union types. The same omission appears in `Status.ts:40` for `CoreStatusName`, and in `internal/failureTarget.ts:257`, where `SPAN_SETTINGS` duplicates a literal domain and `readSpans` searches that array manually. None has a `LiteralKit` source of truth. The green gates do not reject these type-only declarations or ordinary literal arrays.
- failure: The finite vocabularies remain erased or duplicated declarations instead of annotation-bearing runtime domains. Their types, runtime membership checks and enumerated values cannot be derived from one schema as required.
- fix: Define the named vocabularies with identity-annotated `LiteralKit` values and derive their types. Derive the span-setting enumeration and membership check from its kit, preserving the existing value order, case normalization and invalid-setting message.

### sol-1-6
- file: scratchpad/effected/cli/Fmt.ts:36
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy” and “Kind-split Example law”; the review brief’s S2 deferral.   evidence: The 33 focused files contain 79 legacy `@remarks` or `@example` tags. Public value exports such as `Fmt`, `Glyphs` and `Token` also lack required canonical `@category`, `@since 0.0.0` and value-level Examples. For example, `Fmt` at line 51 has only its description and `@public`; its method documentation continues to use `@remarks`. These are deferred S2 obligations, not failures of the already green S1 gates.
- failure: The focused public documentation does not yet satisfy the canonical JSDoc carrier and metadata contract.
- fix: During S2, preserve the upstream prose while converting legacy carriers to `**Details**`/`**Gotchas**` and titled `**Example** (Title)` sections. Add canonical categories, `@since 0.0.0` and meaningful compilable Examples where required.

REQUIRED: 5
BACKLOG: 1