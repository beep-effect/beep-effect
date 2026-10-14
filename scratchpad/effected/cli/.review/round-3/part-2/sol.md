### sol-3-1
- file: scratchpad/effected/cli/internal/fileSink.ts:80
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14’s verified-upstream-bug exception; `makeFileSink`’s documented contract that a filesystem defect prints one warning and disables file logging.   evidence: A read-only `bun --no-cache -e` probe provided `FileSystem.makeNoop` with an in-memory `writeFileString` implementation returning `Effect.die({ toString() { throw new Error("conversion exploded"); } })`. Both the reviewed port and pinned oracle performed one attempted append, captured no stderr warning, and returned `Exit.Failure` from scope closure. The port’s resulting cause points to `String(error)` at line 80. A `"disk gone"` control produced the documented warning and `Exit.Success`. No actual filesystem writes occurred.
- failure: Formatting the filesystem failure can itself throw. That secondary defect terminates the drain, suppresses the promised warning, and propagates through the finalizer’s `Fiber.join`, causing an otherwise successful enclosing scope to fail because diagnostics logging failed.
- fix: Guard failure-message extraction, including reading an error’s `message` and coercing a non-Error value, with a stable fallback such as `[unprintable value]`. Continue through the existing warning and disabled-drain path. Add regressions for throwing string conversion and a throwing message getter, and record the verified upstream-bug deviation.

### sol-3-2
- file: scratchpad/effected/cli/Fmt.ts:164
- class: bug   severity: required
- standard: D9, D11 and §14’s verified-upstream-bug exception; `Fmt.truncate` documents that its result is never wider than the requested width, including a custom ellipsis.   evidence: Read-only probes against both the reviewed port and pinned oracle returned `Fmt.truncate("♥abc", 1, { ellipsis: "\uFE0F" }) === "♥️"`, whose `Fmt.width` is **2**. Likewise, truncating `"123"` to width 1 with `ellipsis: "\uFE0F\u20E3"` returned `"1️⃣"`, also width **2**. The ordinary `"hello"` / width 3 / `"…"` control returned `"he…"` at width 3. `truncateSpans([{ text: "♥abc" }], 1, "\uFE0F")` also returned a two-column result through `internal/layout.ts:233`.
- failure: The prefix and marker are measured separately, but concatenating them can change the final grapheme’s presentation and width. A zero-width variation selector or keycap suffix converts a retained one-column character into a two-column emoji, breaking the truncation guarantee and overflowing the layout.
- fix: Check the display width of the assembled prefix and marker, removing whole retained graphemes until the final result fits. Apply the same boundary handling to `truncateSpans`, preserving retained span attributes. Add custom-marker regressions and record the verified upstream-bug deviation. This is separate from round 2’s finding about graphemes split between input document spans.

### sol-3-3
- file: scratchpad/effected/cli/TestTerminal.ts:16
- class: schema   severity: required
- standard: D5 and D11; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: At the reviewed commit, `KeyInput` is a handwritten interface containing a string key name and three optional boolean modifiers. It is the public input payload consumed by `TestTerminalHandle.input` and translated into queued `Terminal.UserInput` values at lines 194–204. `TestTerminal.ts` has no executable schema for this payload. It is pure data, independently representable by a structural schema; the handle’s Layer and Effect members do not prevent modeling the key payload. The green syntax and coverage gates do not establish semantic schema ownership.
- failure: The public key-event model has no schema source of truth for its type, metadata, validation, codecs or schema-derived arbitrary, contrary to the binding pure-data modeling requirement.
- fix: Define an identity-annotated `KeyInput` structural schema and derive the existing same-name type. Preserve arbitrary string names, optional modifiers, explicit `undefined` compatibility, and the existing queue conversion without adding decoding to `input`. Re-export the added value through `testing.ts`, document it under D2, and add its schema round-trip property.

### sol-3-4
- file: scratchpad/effected/cli/internal/layout.ts:24
- class: schema   severity: required
- standard: D5 and D11; `standards/effect-first-development.md` EF-12b and EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `Span` remains a handwritten plain-data interface for text, token/style, link and rendering flags. It is returned by `flatten`, transformed by truncation and wrapping, and consumed by painting and the renderers. Its constituent domains already have executable schemas in `Token.ts` and `Doc.ts`, but `layout.ts` defines no schema owning their composition. This is a named, reused intermediate rendering model, rather than a service contract or type-level utility. Prior findings concerning document AST ownership and cross-span grapheme handling do not supply a `Span` schema.
- failure: The shared layout payload remains outside the required executable modeling contract. Its shape, optionality, metadata and generated test data cannot be derived from a canonical production schema.
- fix: Define an identity-annotated structural `Span` schema using the existing `TokenName`, `Style` and `LinkTarget` schemas, and derive the type. Preserve optional-key semantics, literal-`true` flags, plain construction and shared link-object identity; do not introduce decoding into layout operations. Add a schema-derived round-trip property.

### sol-3-5
- file: scratchpad/effected/cli/Token.ts:82
- class: schema   severity: required
- standard: D5 and D11; `standards/effect-first-development.md` EF-12 explicitly requires meaningful annotation metadata and says descriptions must encode intent rather than repeat the symbol name.   evidence: All five `Style` field descriptions use the form `"The <field> field of Style."` at lines 82–92. A read-only AST probe confirmed that `Style.fields.fg.ast.annotations.description` is `"The fg field of Style."` and the bold field’s description is `"The bold field of Style."`. The retained field JSDoc already explains foreground colors and text attributes, but those semantics are absent from the schema annotations. The green gates establish metadata presence, not compliance with this semantic requirement.
- failure: Schema consumers receive descriptions that merely restate field names. The foreground annotation omits the named-color/hex contract and deliberate malformed-hex compatibility; the boolean annotations omit the terminal attribute each field enables.
- fix: Replace the five placeholder descriptions with concise descriptions of their existing semantics, drawing from the retained field documentation. Preserve schema identities, field types and rendering behavior.

REQUIRED: 5
BACKLOG: 0