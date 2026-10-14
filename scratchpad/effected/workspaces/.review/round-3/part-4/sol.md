### sol-3-1
- file: scratchpad/effected/workspaces/internal/sourceText.ts:290
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; the lexer’s documented rule that `/` after a TypeScript non-null assertion divides.
- evidence: A read-only `bun --eval` probe compared the port with the pinned oracle. For `const y = x! / 2; process.cwd(); const z = 1 / 4;`, both find the `process` reference. Adding whitespace—`const y = x ! / 2; process.cwd(); const z = 1 / 4;`—makes both return no references, and the port’s public `SourceBoundary.check("probe.ts", source, ["process"])` returns `[]`. A comment before `!` produces the same omission. Bun’s TypeScript transpiler emits the same JavaScript for these forms, confirming that they contain division followed by an executable `process.cwd()` call. `endsOperand(j - 1)` examines the whitespace immediately before `!`, so the lexer incorrectly blanks everything between the two division slashes as a regex body.
- failure: Formatting or inserting a comment before a non-null assertion lets executable forbidden references pass the source boundary check.
- fix: Find the preceding significant token before deciding whether `!` follows an operand; handle consecutive postfix non-null assertions as well. Add whitespace, comment, and repeated-assertion regressions, retaining prefix logical-negation and genuine-regex controls. Record the verified upstream bug under section 14.

### sol-3-2
- file: scratchpad/effected/workspaces/internal/sourceText.ts:539
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; `references` documents that members of another object are excluded and that global-object members are included.
- evidence: A read-only probe using `const child = {globalThis: {process: 42}}; child.globalThis.process;` makes the port’s public `SourceBoundary.check("probe.ts", source, ["process"])` report a `process` offence at column 61. The pinned oracle’s lexer/reference functions likewise return offset 60. The corresponding `child.window.process` example also produces an offence. These expressions read explicitly constructed local objects. The implementation accepts the immediate receiver’s spelling from `GLOBAL_OBJECTS` without checking whether that receiver is itself an unrelated object’s property.
- failure: Local object members named `globalThis`, `window`, `global`, or `self` cause false global-reference offences, potentially failing otherwise compliant source checks.
- fix: Before accepting the member, verify that its receiver is a free global-object reference or a verified global-object chain. Preserve cooked identifier handling, optional chaining, and original offsets. Add local nested-object controls alongside genuine `globalThis.process` references, and record the verified upstream bug.

### sol-3-3
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:392
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-19; `standards/schema-first-development-prompt.md`, “Defaults, normalization, and absence live at the boundary”; D5/D11.
- evidence: Native JSON operations remain in the focused production paths: `WorkspacesSync.ts:392,420`; `internal/packedInstallPlan.ts:215,281,380,429`; and `internal/configDependencyFetch.ts:364–399`. These calls sit in ordinary synchronous helpers. The reference checker’s `internal/rules/prefer_schema_over_json.go:14–17,50–64` explicitly restricts its detection to Effect contexts, explaining why the green tsgo gate misses them. Round 1’s r40 applied the same law and synchronous Result-codec repair to `WorkspaceSnapshots.parseJsonObject`; the listed paths remain outside that completed repair.
- failure: Manifest parsing and generated consumer/configuration documents still bypass the required Schema JSON boundary, with separate native parsing, exception handling, and serialization implementations.
- fix: Use `S.fromJsonString(...)` with Result/Option codecs for these deliberate synchronous helpers, including a string codec for JSON-quoted YAML scalars. Preserve skip behavior, read-versus-parse failure classification, formatting, and trailing newlines. Record any SyntaxError-to-SchemaError cause changes and adjusted oracle assertions under the schema-JSON deviation protocol.

### sol-3-4
- file: scratchpad/test/workspaces/WorkspacesSync.property.test.ts:31
- class: test   severity: required
- standard: D10/D11 and `scratchpad/EFFECTED_PORT_GOAL.md` section 11.4: every exported schema or codec requires an `it.effect.prop` encode/decode property driven by `Arbitrary.schema(schema)`.
- evidence: The sync schema-fidelity group registers only `WorkspaceEnumerationDepthError`; it does not register the newly exported `SyncDirectoryEntry`, `WorkspaceDiscoverySkipKind`, or `WorkspaceDiscoverySkip`. Searching all workspaces test files also finds no generated codec properties for the focused additions `CatalogMisconfiguration`, `FetchFailureReason`, `FetchFailure`, `RegistrySettings`, `ConfigDependencySpecParts`, `EnumeratedDirectory`, `EnumerationFailure`, `EnumerateOptions`, `LayerRootOptions`, `ConsumerInput`, `PackedManifest`, `PatternReadFailure`, `ImporterRoots`, `TraversalFrame`, and `TraversalStop`. The two `ImporterRoots` coverage fixtures perform example round trips, rather than generated properties. A read-only derivation probe additionally shows `Arbitrary.schema(EnumerateOptions)` throwing `Unable to derive an arbitrary for an unsupported Declaration at ["maxDepth"]`, and `Arbitrary.schema(TraversalFrame)` throwing the equivalent error at `["depth"]`.
- failure: Eighteen exported schemas in the focused surface lack the binding generated codec floor. The green execution and coverage gates leave this omission undetected, including two schemas whose arbitrary derivation currently fails.
- fix: Register the listed schemas with the existing generated round-trip helpers, asserting equivalence and successful decoding of encoded values with `fcRuns`. Supply generation metadata for the two number declarations while retaining their accepted values and lazy validation behavior. Keep the existing behavioral properties and example regressions.

REQUIRED: 4
BACKLOG: 0