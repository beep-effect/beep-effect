### sol-1-1
- file: scratchpad/effected/github-commands/WorkflowCommand.ts:101
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; upstream `WorkflowCommand.render` uses `Object.entries`.   evidence: A read-only Node probe imported both implementations and passed each a fresh properties object equivalent to `{ get first() { Object.defineProperty(this, "second", { enumerable: false }); return "a"; }, second: "b" }`. Upstream returned `::debug first=a::m`; the lab returned `::debug first=a,second=b::m`. Installed `Record.toEntries` snapshots `Object.keys` before reading values, whereas `Object.entries` interleaves descriptor checks and value reads.
- failure: The port emits a property upstream omits when an earlier getter changes that property's enumerability. This is an observable formatted-byte deviation on an input accepted by the public structural signature, and neither Port notes nor the ledger records it. The existing tests use ordinary data properties and miss this difference.
- fix: Preserve upstream entry-enumeration semantics, using the original `Object.entries` operation with the narrowly documented native-runtime exception permitted by the 2026-10-09 ruling. Add the getter case as a parity regression test.

### sol-1-2
- file: scratchpad/effected/github-commands/CommandNeutralizer.ts:2
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14's verified-upstream-bug provision; `scratchpad/test/github-commands/helpers/runnerCommands.ts:17` explicitly excludes U+FEFF from .NET whitespace, and `CommandNeutralizer.test.ts:97` states that quiet lines are returned unchanged.   evidence: A read-only Node probe with input `"\uFEFF::error::x"` returned `isCommand(input) === false`, but both the lab and pinned upstream produced `"\u200B\uFEFF::error::x"`; `CommandNeutralizer.text(input) === input` was false. JavaScript `\s` includes U+FEFF. The oracle mutation-control test already lists this input as quiet at line 31, but the unchanged-output exhaustive suite's alphabet omits U+FEFF.
- failure: The neutralizer changes a line the independent oracle identifies as safe, adding an unnecessary invisible character. This is an inherited upstream bug in the claimed .NET-whitespace model, demonstrated by a counterexample to the existing quiet-line fidelity property.
- fix: Replace the V2 prefix's whitespace expression with the exact .NET whitespace character set, excluding U+FEFF. Add an unchanged-output assertion for the existing BOM-prefixed quiet input. Record the verified `upstream-bug` deviation in the ledger and Port notes before changing behavior.

### sol-1-3
- file: scratchpad/effected/github-commands/WorkflowCommand.ts:13
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md, Core Principle 5, “Schemas Are Executable Contracts”; standards/schema-first-development-prompt.md, “Schema owns pure data”; EFFECTED_PORT_GOAL.md D11.   evidence: `AnnotationProperties` is a reusable six-field pure-data payload consumed by `notice`, `warning`, `error`, and `annotation`. Its sole definition is an exported interface; the module contains no schema defining this shape.
- failure: The annotation payload's contract disappears at runtime, so callers cannot derive validation, metadata, or an arbitrary from its authoritative definition. This is a representable wire-data model, outside the service-contract and type-level-machinery exceptions.
- fix: Define an IdentityComposer-annotated structural schema and derive the existing exported `AnnotationProperties` type from it. Preserve the current optional fields and structural call signatures; do not introduce numeric refinements or automatic decoding that would change upstream behavior.

### sol-1-4
- file: scratchpad/effected/github-commands/WorkflowCommand.ts:39
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5, which requires Effect helper modules and avoids direct native string helpers in domain logic; EFFECTED_PORT_GOAL.md D5 and D11.   evidence: `escapeMessage` chains native `.replaceAll` calls, and `escapeProperty` repeats that pattern at line 50. `CommandNeutralizer.ts:14` and `:64` also use native `.replace` and `.split`. The installed `effect/String` supplies `replaceAll`, `replace`, and `split`; its replacement helpers delegate to the corresponding native operation.
- failure: The protocol's core string transformations retain native helper calls despite equivalent Effect helpers being available. This is a cited idiom residue, separate from the already-green native-runtime checks for forbidden runtime APIs.
- fix: Use `Str.replaceAll`, `Str.replace`, and `Str.split` from `effect/String`, composing the replacement steps with `flow` where appropriate. Preserve percent-first escaping, the global legacy regex, and the existing line-break expression.

### sol-1-5
- file: scratchpad/effected/github-commands/WorkflowCommand.ts:6
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, “Hard requirements” and “Carrier policy”; EFFECTED_PORT_GOAL.md section 10.2. S2 findings are backlog by operator order.   evidence: The file retains `@remarks` at lines 6, 34, 45, 55, and 82, and `@example` at line 65. The exported interface and class lack canonical `@category` and `@since 0.0.0`.
- failure: The public annotation and renderer documentation does not satisfy the required JSDoc carrier grammar or export metadata.
- fix: During S2, convert the legacy carriers to `**Details**` and titled `**Example** (Title)` sections, preserve the upstream semantic prose, and add the required export metadata and meaningful examples.

### sol-1-6
- file: scratchpad/effected/github-commands/CommandNeutralizer.ts:21
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, “Hard requirements” and “Carrier policy”; EFFECTED_PORT_GOAL.md section 10.2. S2 findings are backlog by operator order.   evidence: The class documentation retains `@remarks` at line 21 and `@example` at line 44; `text` retains `@remarks` at line 70. The exported class lacks canonical `@category` and `@since 0.0.0`.
- failure: The neutralizer documentation retains forbidden legacy carriers and lacks required export metadata.
- fix: During S2, convert the carriers, retain the two-parser and idempotence explanations, give the example a specific title, and add the required metadata.

### sol-1-7
- file: scratchpad/effected/github-commands/README.md:38
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3, “README adaptation”. S2 findings are backlog by operator order.   evidence: The usage example imports `@effected/github-commands`; lines 3–15 retain release badges and the stability block, and lines 23–33 retain upstream installation instructions. Lines 8 and 11 claim there is no Effect dependency, while the lab implementation imports `effect/Record`.
- failure: The README directs readers to the upstream package rather than the reviewed lab port and describes a dependency guarantee the port no longer satisfies.
- fix: During S2, remove the specified release and installation boilerplate, rewrite usage imports to the lab entrypoint, and update the dependency prose to match the port while preserving the protocol explanations and attribution.

REQUIRED: 4
BACKLOG: 3