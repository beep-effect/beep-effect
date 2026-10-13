### sol-2-1
- file: scratchpad/effected/cli/ui/Select.ts:164
- class: bug   severity: required
- standard: D9, D11, §14 verified-upstream-bug exception; `Select.View` documents that submission is single-shot and the view stays as submitted.   evidence: Read-only `CliUiTest.render` probes sent keys in one `handle.chunk(...)`. Select received `("enter", "down")` while highlighting `"first"` and returned `"second"`; Confirm received `("enter", { char: "y" })` with an initial No and returned `confirmed: true`; MultiSelect received `("enter", "space")` with nothing selected and returned the first item. Pure reducer probes against the pinned oracle reproduced all three results. The existing coalesced-input test covers `y` **before** Enter.
- failure: Submission only sets `submitted`; subsequent actions in the same input batch keep changing state before the submission effect reads it. The answer returned can differ from the answer the user submitted. The same defect is present in `Confirm.ts:170` and `MultiSelect.ts:164`.
- fix: Make submitted reducer states terminal by returning the existing state for subsequent actions. Add the three Enter-then-action chunk regressions and record the verified upstream-bug deviation.

### sol-2-2
- file: scratchpad/effected/cli/internal/renderMarkdown.ts:30
- class: bug   severity: required
- standard: D9, D11, §14 verified-upstream-bug exception; `Render.markdown` promises that document text cannot become Markdown syntax and that a link renders as a link.   evidence: Both the port and pinned oracle render `Doc.paragraph("!", Doc.link({ url: "https://example.test/image.png" }, "guide"))` as `![guide](https://example.test/image.png)`. A read-only probe through the pinned upstream Markdown parser returned an `image` node rather than a text node followed by a link.
- failure: A literal exclamation mark immediately before a document link turns that link into an image. The exclamation disappears as text, the label becomes alternative text, and an image-capable reader can load the destination as an image.
- fix: Include `!` in `escapeText`’s escaped punctuation. Add a parser-backed regression for text immediately preceding a link and record the verified upstream-bug deviation.

### sol-2-3
- file: scratchpad/effected/cli/ui/Select.ts:369
- class: bug   severity: required
- standard: D9, D11, §14 verified-upstream-bug exception; `Select.View` and `MultiSelect.View` document that their choices or sections are read once at mount.   evidence: A read-only `CliUiTest.view` probe mounted a choice labelled `"original"` with value `"original"`, then rerendered the same view with label and value `"replacement"`. Select displayed `→ replacement` but Enter submitted `"original"`. MultiSelect displayed `→ ◉ replacement` but submitted `["original"]`. Inspection of the pinned oracle shows the same split between rendering current props and submitting mount-time state.
- failure: The displayed choices and submitted values come from different collections after a parent rerender. Select builds rows, labels and details from `props.choices` while submitting `state.choices`; MultiSelect similarly uses `props.sections` at `MultiSelect.ts:372` while submitting `state.sections`. A user can choose the displayed replacement and receive the original value.
- fix: Derive Select’s rows, rendered choices and detail from `state.choices`, and MultiSelect’s items and rows from `state.sections`. This preserves the documented mount-time snapshot. Add rerender-and-submit regressions and record the verified upstream-bug deviation.

### sol-2-4
- file: scratchpad/effected/cli/ui/Select.ts:156
- class: bug   severity: required
- standard: D11 and §14 verified-upstream-bug exception; `SelectInitOptions.initial` promises an enabled starting choice.   evidence: With choices `[disabled, enabled]`, read-only probes against both the port and pinned oracle returned `{ cursor: 0, disabled: true, submitted: false }` for `initial: 0.5` and `initial: NaN`; the control `initial: 1` selected and submitted the enabled choice. These are additional cases beyond round-1’s repaired out-of-range integer inputs. The new `NaN` coverage test uses an enabled first row.
- failure: Clamping does not normalize fractional indices or `NaN`. Fractional array lookups return `undefined`, which `enabled` treats as enabled because `choices[index]?.disabled !== true`; `NaN` skips both searches and falls back to row zero. Select can consequently highlight a disabled choice despite an enabled choice being available.
- fix: Normalize `initial` to an integer, use zero for `NaN`, and then clamp before searching. Make `enabled` require an existing choice. Add fractional and `NaN` regressions with a disabled first row, extending the existing upstream-bug record.

### sol-2-5
- file: scratchpad/effected/cli/ui/Select.ts:375
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: The pinned oracle obtains each rendered choice with `props.choices[Number(row.key)]`, an O(1) lookup. The port calls `rows.indexOf(row)`, scanning up to N rows for each of V visible rows. Choice lookup therefore costs O(NV); when the configured height and terminal permit all N choices to be visible, one frame performs N(N+1)/2 identity comparisons. Including row construction, this changes O(N+V) work into O(N+NV), with an O(N²) case.
- failure: Large visible selections acquire quadratic lookup work on every repaint. This is a separate regression from the previously recorded matcher-allocation backlog.
- fix: Build a string-keyed index map once per render, as MultiSelect already does, and look up `row.key` directly. Preserve the existing checked lookup behavior without searching the entire row array for each visible row.

### sol-2-6
- file: scratchpad/effected/cli/ui/Confirm.ts:104
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` laws 17 and 19; `standards/effect-first-development.md` EF-12b.   evidence: `ConfirmAction` is a named, reused eight-member string union with no runtime schema. `SelectAction` at `Select.ts:68` and `MultiSelectAction` at `MultiSelect.ts:96` likewise remain erased literal domains used by reducers and typed key tables. The green mechanical gates accept these declarations without establishing schema ownership.
- failure: The action vocabularies have no annotation-bearing runtime source of truth from which their types, enumeration and membership checks can be derived. This leaves named domain concepts outside the required schema-first contract.
- fix: Define identity-annotated `LiteralKit` action domains and derive the existing action types from them, preserving every current member. Record any added runtime exports under D2.

### sol-2-7
- file: scratchpad/effected/cli/ui/Confirm.ts:23
- class: schema   severity: required
- standard: Operator step 4 requires schema and field annotations; `standards/effect-first-development.md` EF-12 requires meaningful canonical schema metadata.   evidence: Read-only probes caught `DuplicateToggleKeyError` and `NoEnabledChoiceError` and inspected their schema ASTs. Both contained only the composed `identifier` and tag sentinels, with no title or description; their `message` fields had no annotations. `MissingDocViewThemeError` at `DocView.ts:14` and `LiveTickError` at `CliUiLive.ts:298` have the same omission. These are additional error classes beyond round-1’s `cli-3` sites.
- failure: These introduced schema errors supply identity strings but omit the domain and field metadata required by the completed annotation step. Schema inspection and documentation consumers receive no meaningful description of these failures or their message payloads.
- fix: Add `$I.annote(...)` metadata to the four error schemas and meaningful descriptions to their message fields. Preserve their existing tags, construction and runtime behavior.

### sol-2-8
- file: scratchpad/effected/cli/ui/Confirm.ts:201
- class: law   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 6; `standards/effect-first-development.md` EF-5.   evidence: `Confirm.result` still calls native `Object.defineProperty` for each toggle in production reducer logic. The reviewed source matches commit `2f515ae`, despite the reported green native-runtime gate, and no Confirm exception appears in the law allowlist. A read-only probe compared the current construction with `R.fromEntries` for `__proto__` and `constructor` toggle keys; both produced the same serialized own properties and values.
- failure: Native `Object` manipulation remains in domain logic after the required native-runtime migration. The intact call on the green reviewed commit demonstrates a missed enforcement site.
- fix: Construct the toggle record with `R.fromEntries` over typed key/value tuples, retaining the `Partial<Record<K, boolean>>` result type. Keep regressions for special property names.

REQUIRED: 8
BACKLOG: 0