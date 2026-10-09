### sol-1-1

- file: scratchpad/effected/cli/ui/CliUi.ts:522
- class: bug   severity: required
- standard: D9 behaviour preservation; section 14 deviation protocol.   evidence: A read-only Bun probe invoked `CliUi.lazy(() => { throw new Error("loader failed synchronously"); })(control)` in the port and pinned oracle. The port printed `threw before returning:loader failed synchronously`; the oracle printed `returned promise rejected:loader failed synchronously`. The reviewed CLI source is unchanged between commit `3fa5876691901fccf3d1cd29e9324564df134b56` and the probed checkout.
- failure: Replacing the upstream `async` wrapper with `load().then(...)` changes a synchronous loader exception into a synchronous exception from the returned screen. Callers that handle the oracle’s rejected promise now throw before reaching their rejection handler. The `asyncFunction` rule explains removing `async`, but does not require this behaviour change; neither the README nor ledger records a deviation.
- fix: Use `(control) => Promise.try(load).then((module) => module.default(control))`. This preserves immediate loader invocation and rejection of synchronous exceptions without an `async` declaration.

### sol-1-2

- file: scratchpad/effected/cli/ui/Select.ts:144
- class: bug   severity: required
- standard: D11 bug criterion; section 14 verified-upstream-bug exception; `SelectInitOptions.initial` documents “the first enabled one at or after it, or the nearest enabled one before it when none follows.”   evidence: A read-only Bun probe used choices `[{ label: "disabled", value: "d", disabled: true }, { label: "enabled", value: "e" }]` with `initial` values `-1`, `2`, and `99`. Both the port and pinned oracle returned `cursor: 0`, `disabled: true`; applying `"submit"` left `submitted: false`.
- failure: When the initial index lies outside the choices, both searches immediately terminate and the fallback selects index zero. This can highlight a disabled choice despite an enabled choice being available, violating the documented initial-selection rule. This is a reproduced upstream bug, rather than a port regression.
- fix: Clamp the initial search position to the choices’ bounds before searching forward and backward, preserving the existing search preference. Add regression cases for initial indices below and above the bounds, and record the upstream-bug deviation under section 14.

### sol-1-3

- file: scratchpad/effected/cli/internal/renderDoc.ts:440
- class: bug   severity: required
- standard: D11 bug criterion; section 14 verified-upstream-bug exception; `Doc.verbatim` promises lines “kept exactly” and states that plain, ANSI, and GitHub-log renderers write them as they are (`Doc.ts:875–878`).   evidence: A read-only Bun probe rendered `{ _tag: "Verbatim", text: "x  \n  ", indent: 2 }` through the port and pinned oracle. Both plain renderers produced `"  x\n"` instead of `"  x  \n    "`. Both Markdown renderers preserved the spaces inside their fences.
- failure: `trimLine` removes trailing content spaces and erases whitespace-only lines’ indentation. The text renderers therefore lose data that the `Verbatim` contract explicitly promises to preserve. This is a reproduced upstream bug.
- fix: Mark each Verbatim line’s span with `hold: true`, using the preservation mechanism already respected by `trimLine`, so both the branch-local and final trimming passes retain its spaces. Add a whitespace-fidelity regression and record the upstream-bug deviation under section 14.

### sol-1-4

- file: scratchpad/effected/cli/internal/scanAudience.ts:43
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` laws 17 and 19; `standards/schema-first-development-prompt.md`, “Derive behavior instead of duplicating truth.”   evidence: Lines 38–43 define the named audience domain as a widened `ReadonlyArray<string>` and manually assert membership through `isKind`. Lines 61–62 separately spell the same domain in another handwritten type predicate, `isBoolean`. Neither guard derives from a schema. This schema-authoring requirement is not enforced by the four green laws listed in the port goal: `effect-imports`, `effect-fn`, `terse-effect`, and `native-runtime`.
- failure: The named runtime domain and its type predicates have separate definitions instead of one executable schema. In particular, `KINDS` accepts arbitrary strings at compile time while `isKind` promises that membership proves `AudienceKind`; the definitions are not structurally tied together. This violates the cited schema-first requirements.
- fix: Define one module-local, identity-annotated `LiteralKit(["human", "agent", "ci"])` and derive both membership guards from it. Preserve the scanner’s accepted spellings and counting behaviour.

### sol-1-5

- file: scratchpad/effected/cli/ui/CliUi.ts:231
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; the review brief explicitly defers S2 findings to backlog.   evidence: The exported `CliUi` class uses `@example` and ends its documentation with only `@public`, lacking canonical `@category` and `@since`. The same deferred carrier problem appears in the focused files, including `MultiSelect.ts:203–208`, `Confirm.ts:196`, and `renderMarkdown.ts:339`.
- failure: The carried documentation does not meet the required Beep JSDoc format: legacy carriers remain, and public exports lack required metadata. This remains backlog because S2 has not been authorized to run.
- fix: During S2, preserve the existing prose and example bodies while converting carriers to titled `**Example** (Title)` and `**Details**` sections; add canonical categories and `@since 0.0.0`, then validate the examples through docgen.

REQUIRED: 4
BACKLOG: 1