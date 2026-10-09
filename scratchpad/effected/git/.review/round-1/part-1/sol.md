### sol-1-1
- file: scratchpad/effected/git/Git.ts:3304
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `GitShape.configGetAll` promises every configured value in order.   evidence: A read-only invocation of `git config --file /dev/stdin --null --get-all a.b`, with stdin containing three values `""`, `"one"`, `""`, returned `"\0one\0\0"`. Providing those bytes through the scripted spawner to both the port and the pinned oracle returned `["one"]`. The existing test at `scratchpad/test/git/Git.test.ts:2775` exercises only nonempty values and an unset key.
- failure: `configGetAll` uses `parseNulSeparated`, which removes every empty token. Explicitly configured empty values disappear, their positions are lost, and a key containing only an empty value becomes indistinguishable from an unset key.
- fix: Give `configGetAll` a value-preserving NUL parser that removes only the trailing terminator token. Retain the silent-exit-1 handling for an unset key. Add regressions for a single empty value and mixed empty/nonempty values, and record the verified upstream-bug deviation under section 14.

### sol-1-2
- file: scratchpad/effected/git/Git.ts:787
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `CommitLogEntry.paths` promises raw pathnames, and D10 requires parser fidelity.   evidence: A read-only scripted-spawner probe supplied one correctly formatted log record with path `"left\x1eright.txt"`. Both the port and the pinned oracle returned `GitCommandError` with detail `unparseable log output: a log record carried fewer fields than the format declares`. The record used the same five-field header and NUL-terminated pathname layout as `scratchpad/test/git/GitLog.test.ts`; the pathname contained no NUL.
- failure: Splitting the entire output on `"\x1e"` also splits pathname data. A valid pathname containing that byte turns a successful git history query into a failure for the entire listing.
- fix: Use an unambiguous NUL-framed commit boundary in the `GitCommand.log` format and parse headers and path tokens by position, preserving record-separator bytes inside pathnames. Add a fidelity regression for this pathname and record the verified upstream-bug deviation under section 14.

### sol-1-3
- file: scratchpad/effected/git/Git.ts:434
- class: schema   severity: required
- standard: D5; `standards/effect-first-development.md` EF-12b; `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts.”   evidence: `Classified` is a hand-written domain payload union containing nine classification cases, returned by `classify` and matched throughout the service. Its associated `ClassifyKind` domain at line 455 is another hand-written literal union. Neither has a schema declaration. The supplied green compiler/lint gates have therefore left this schema-first requirement unmet.
- failure: The module’s central classification model and classification-kind vocabulary exist only as TypeScript declarations. Their case shapes and constraints cannot supply the schema-derived constructors, guards, metadata and arbitrary generation required for named, reused and matched internal domains.
- fix: Define an annotated, module-local `S.TaggedUnion` for `Classified`, preserving every existing tag and payload, and derive its TypeScript type from that schema. Define `ClassifyKind` with an annotated module-local `LiteralKit` and derive its type. Preserve the existing classification order and observable results.

### sol-1-4
- file: scratchpad/effected/git/Git.ts:826
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.   evidence: `porcelainCode` is a named internal literal schema, reused for both `StatusEntry.x` and `StatusEntry.y` at lines 851 and 853, but is constructed with `S.Literals` and has no identity annotations. The law reserves `S.Literals` for anonymous inline unions never referenced by name. The `schemaUnionOfLiterals` tsgo rule addresses unions of individual literal schemas; it does not enforce this named-domain requirement.
- failure: The shared porcelain-axis vocabulary bypasses the required `LiteralKit` model and its canonical identity metadata despite being named and reused.
- fix: Replace the declaration with an annotated module-local `LiteralKit` containing exactly the same ten codes, and continue referencing that single schema from both axis fields.

### sol-1-5
- file: scratchpad/effected/git/Git.ts:232
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; the review brief explicitly defers S2.   evidence: Exported classes such as `GitCommandError`, `LsTreeEntry` and `CommitInfo` lack required examples, canonical `@category` and `@since` tags. `Git` and its test factories still use `@example` at lines 4640, 4718 and 4818; numerous blocks retain forbidden `@remarks`.
- failure: The file does not yet meet the binding documentation grammar or public-export documentation requirements. This remains S2 backlog under the operator’s ordering.
- fix: During S2, convert legacy carriers to titled `**Example** (Title)` and appropriate `**Details**`/`**Gotchas**` sections, preserve the upstream prose, and add meaningful examples and canonical tags to the owning exported declarations.

REQUIRED: 4
BACKLOG: 1