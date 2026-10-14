### sol-3-1
- file: scratchpad/effected/cli/internal/renderMarkdown.ts:146
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified-upstream-bug exception; `Render.markdown`’s inline-code fidelity contract.   evidence: A read-only `bun --no-cache -e` probe rendered `Doc.paragraph(Doc.code("a"), Doc.code("b"))` through both the reviewed port and the pinned oracle, then parsed each result with the pinned upstream Markdown parser. Both emitted `` `a``b` ``; both parsed as one `inlineCode` node whose value was `"a``b"`, rather than the original visible text `"ab"`.
- failure: Independently fencing adjacent code spans merges their closing and opening backticks into content. A reader sees two additional backticks, changing the code being displayed.
- fix: Fence consecutive compatible code spans as one concatenated code run, preserving link and emphasis boundaries. Add parser-backed regressions for adjacent code nodes, including different internal backtick runs, and record the verified upstream-bug deviation under §14.

### sol-3-2
- file: scratchpad/effected/cli/internal/renderMarkdown.ts:146
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14; `escapeText`’s documented guarantee that URL-looking text cannot become a GFM autolink.   evidence: Read-only probes against the port and pinned oracle rendered `Doc.paragraph("https", "://example.test")` as `"https://example.test"` and `Doc.paragraph(Doc.text("www"), Doc.text(".example.test"))` as `"www.example.test"`. The pinned upstream Markdown parser produced `link` nodes for both. The equivalent unsplit text passes through the intended autolink escaping.
- failure: Autolink detection operates independently on each span, so a scheme or `www.` prefix split across text nodes bypasses escaping. Plain document text becomes a clickable link depending on how callers partition it into nodes.
- fix: Apply contextual text escaping to concatenated compatible non-code text runs, rather than individual spans. Add split-versus-unsplit properties for URL prefixes and record the verified upstream-bug deviation. Preserve explicit links and formatting boundaries.

### sol-3-3
- file: scratchpad/effected/cli/ui/CliUiLive.ts:325
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14; `CliUi.live` documents that a failed drawing/final callback degrades its run, warns once, and allows the fold to continue.   evidence: A read-only probe supplied two non-interactive runs with a `final` callback that first threw `{ toString() { throw "warning conversion failed"; } }` and would return a document on its second call. Both the port and pinned oracle returned a failed `done` with `"warning conversion failed"`, stopped at state `2` instead of `4`, invoked `final` once, emitted zero warnings, and printed nothing.
- failure: `DEGRADED` performs an unguarded string conversion while recovering the original callback failure. That secondary exception kills the controller and discards subsequent runs instead of degrading only the failed run.
- fix: Guard the complete error-description operation, including reading an Error’s message, with `Result.try` or equivalent and use a fixed fallback description when it throws. Add a two-run regression asserting continued folding, one warning, and the second run’s output; record the verified upstream-bug deviation.

### sol-3-4
- file: scratchpad/effected/cli/ui/KeyHelp.ts:98
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D11 and §14; `KeyHelp` promises a one-line footer, `Select.View` promises a one-line detail, and `UiTheme.useTerminalSize` documents the need for layout-time clipping during immediate Ink resize repaints.   evidence: Read-only production-path `CliUiTest.session` probes resized from 80 to 20 columns. Confirm produced an intermediate 8-row frame before settling to 3 rows; Select produced 12 rows before settling to 4; MultiSelect produced 15 rows before settling to 5. Long questions and details wrapped into four physical rows, and the footer wrapped into three to five rows. The pinned oracle retains the same unclipped footer, question and detail constructions. These are additional sites beyond round 2’s repaired TextInput, Toggle and Tabs.
- failure: The footer and surrounding widget text use the previous hook width during Ink’s immediate resize repaint. They exceed the widgets’ reserved row budgets and can push the frame into scrollback before React supplies the new width. Other affected sites are `Confirm.ts:449`, `Select.ts:434,442`, and `MultiSelect.ts:440,444`.
- fix: Add layout-time clipping to the footer and these intended single-row elements, using direct Text truncation or one-row overflow-hidden wrappers for styled content. Reserve the cursor column through layout. Extend the resize regressions to assert every intermediate frame for Confirm, Select and MultiSelect, and record the upstream-bug deviation.

### sol-3-5
- file: scratchpad/effected/cli/internal/renderDoc.ts:197
- class: perf   severity: required
- standard: EFFECTED_PORT_GOAL.md D11’s algorithmic-class criterion.   evidence: `shrink` recomputes the total and scans all columns to remove exactly one cell on each iteration. For `C` columns initially two cells wide and a narrow limit, it performs `C` decrements, each costing Θ(C), despite Θ(C) input and output. A read-only probe evaluated the actual helper extracted from the reviewed commit and counted numeric array reads: 329, 1,259, 4,919 and 19,439 for 10, 20, 40 and 80 columns respectively.
- failure: Width allocation alone takes Θ(C²) work for a table with short headers and no body rows. Doubling the column count approximately quadruples the work before any cells are rendered.
- fix: Batch the widest-column reductions using sorted width levels or an equivalent bounded allocation algorithm. Preserve the existing leftmost tie rule and treatment of zero- and one-cell columns. Add an operation-count regression; the allocation can run in O(C log C) instead of Θ(C²).

### sol-3-6
- file: scratchpad/effected/cli/ui/Confirm.ts:98
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33.   evidence: `ConfirmState<K>`, `SelectState<A>` at `Select.ts:69`, and `MultiSelectState<A>` at `MultiSelect.ts:95` remain handwritten pure-data interfaces. Their constituent toggle, choice and section/item payloads also remain handwritten. These are concrete reducer inputs and outputs, with booleans, collections, viewport data and parameterized values—not service contracts or overload machinery. Round 2 supplied schemas for actions, ViewportState and TextInputState, but did not supply schemas for these three state families.
- failure: The production reducer-state contracts still have no executable source of truth for validation, codecs, equivalence, metadata or schema-derived generation. Their generic parameters do not prevent schema composition through factories accepting key/value schemas.
- fix: Define annotated structural schema factories for the three state families and their constituent payloads, reusing ViewportState and `S.HashSet` where appropriate, and derive the public types. Keep the current reducer signatures, plain-object results, optional-key semantics and input behavior. Add schema-derived round-trip properties and register added schema exports under D2.

### sol-3-7
- file: scratchpad/effected/cli/ui/KeyTable.ts:19
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `Binding<Action>`, `KeyHelpRow` at line 57, and `UseKeysOptions` at line 87 are handwritten data/configuration models without production schemas. `scratchpad/test/cli/ui/KeyTable.property.test.ts:14` separately defines `BindingInput` with the same keys/action/help/hidden fields and uses that test-only schema for serialization and generation. This demonstrates that the binding shape is schema-representable while its executable definition lives outside production.
- failure: Binding data has parallel TypeScript and test-schema owners. Changing the production fields or optionality need not update the codec/property contract, and production help/configuration payloads lack the required schema metadata and derived tooling.
- fix: Define an annotated Binding schema factory parameterized by the action schema, reusing KeyName for named keys, plus structural KeyHelpRow and UseKeysOptions schemas. Derive the existing types and make the property test consume the production binding schema. Preserve KeyTable’s class behavior, binding priority, normalization and optional fields.

### sol-3-8
- file: scratchpad/effected/cli/internal/scanAudience.ts:12
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-12b and EF-33.   evidence: AudienceFlagValues at line 12 and AudienceTally at line 25 are named, exported pure-data interfaces containing arrays of AudienceKind/boolean and a boolean result. `tallyAudience` constructs the result as a plain object. AudienceKind already has an executable schema, but neither containing payload has one. The recorded audience changes cover the literal domain and flag vocabulary, not these payload models.
- failure: The shared pre-parse and parsed-flag tally contract remains erased, so its shape, annotations, codecs and generated test data cannot derive from the production model.
- fix: Define identity-annotated structural schemas for AudienceFlagValues and AudienceTally, composing the existing AudienceKind schema, and derive their types. Retain the current plain-object results and counting behavior; add schema-derived round-trip properties.

### sol-3-9
- file: scratchpad/effected/cli/internal/renderMarkdown.ts:17
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/effect-laws-v1.md` laws 17 and 19; `standards/effect-first-development.md` EF-12b.   evidence: Mode is the named, reused literal domain `"flow" | "cell" | "line"`, consumed by `codeSpan`, `textPiece`, `emphasized` and `inlineMd`, including runtime case selection. It has no LiteralKit or annotation-bearing schema value. This declaration survives the green mechanical gates; those gates have not established ownership of this named runtime domain.
- failure: The renderer’s mode vocabulary remains an erased declaration rather than the required executable source of truth for its type, literals, guard and metadata.
- fix: Define an annotated module-local Mode LiteralKit containing the same three members and derive the type from it. Preserve all existing branch behavior.

REQUIRED: 9
BACKLOG: 0