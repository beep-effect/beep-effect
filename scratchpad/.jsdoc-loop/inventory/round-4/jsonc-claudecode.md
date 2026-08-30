# Packs jsonc / jsonl / toml / claudecode — round 4 independent JSDoc review

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `scope`: `scratchpad/jsonc/`, `scratchpad/jsonl/`, `scratchpad/toml/`, `scratchpad/claudecode/`
- `law`: `.patterns/jsdoc-documentation.md`, `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`, `.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md`
- `census`: mechanical opens are 0/0 (`census-summary.json`); this pass is editorial residual only
- `prior`: round-3 jsonc (3) and claudecode (1) items were fixed; jsonl and toml had zero accepted findings in round 3

Independent re-review after those closures. Hunt: leftover vacuous / unrun-Effect Examples, expected-comment grammar, signature-echo leads, missing `@packageDocumentation`, TSDoc grammar, undescribed `@see`, kind-split Example law, Gotchas that still live only in implementation comments, `$I.annote` gaps on exported schemas, `@effected/*` example imports.

Zero `@example` / `@remarks` / `@module` / `@template` tags remain. Every `@see` has a purpose phrase. Public fences import `@beep/scratchpad/<kit>` or `effect-claudecode`, never `@effected/*`. Runtime identity strings (`~effected/jsonl/JsonlEvent`, `assertCap`'s `@effected/toml` TypeError) are not findings.

---

## Round-3 items verified closed

| id | status |
| --- | --- |
| jsonc-R3-001 | closed — `Jsonc.stringifyResult` success observation is `console.log(ok.success); // '{\n  "port": 3000\n}'`, matching `JsoncFormatter` / toml stringify grammar. Bigint failure line unchanged. |
| jsonc-R3-002 | closed — `Jsonc.equals` and `Jsonc.equalsValue` have **Gotchas** plus described `@see {@link MAX_NESTING_DEPTH}`: past the cap the shared walker returns `false`; parser-produced JSONC never reaches it; a hand-built `value` nested past it is silently unequal to itself. |
| jsonc-R3-003 | closed — `JsoncNode.toValue` **Gotchas** keep the `"__proto__"` own-property sentence and add the silent `{}` / `[]` / `null` placeholder past `{@link MAX_NESTING_DEPTH}`. `findAtOffset` / `pathAt` have matching method-hover Gotchas. Class Gotchas were not removed. |
| claudecode-runtime-R3-001 | closed — `ClaudeProject.project` Example provides `ClaudeProject.layer({ cwd: "/repo" })` plus `Testing.makeMockFileSystem().layer`, `runPromise`s the mapped `service.cwd`, and logs `"/repo"`. Pattern matches the sibling `Service` Example. |

---

## Accepted findings

accepted findings: 0.

---

## Rejected (do not open)

- **Re-opening closed R1–R3 items** as still-open mechanical/editorial misses. Closures match the live files, including jsonc `$I.annote` / `$I.annoteSchema`, `JsoncFormatter` pretty-print text, `JsoncNode` walker depth-cap, `"__proto__"` on `Jsonc` / `toValue`, toml `TomlFormat` purpose-first lead and quoted stringify expected comments, claudecode `@packageDocumentation` on hubs, `EffortLevel` decode, `readTranscript` mock-FS run, `HookDefinition` purpose lead, `LoadOptions.make`, and `ClaudeProject.Service` / `project` provided `runPromise`.
- **`export declare namespace` missing Examples.** Law: namespaces are type-level; Example optional. Event `Input`/`Output` companions, Tool input companions, MCP/plugin/error companions, Settings/Frontmatter Encoded companions, `JsoncBoundCodec`, `TomlBoundCodec`, Literals `.Type` aliases, `Slice` / `EnvelopeOf` were not opened.
- **Barrel `export { … }` / `export * as` graph edges.** Document the owning declaration. Hub comments such as `Re-exports the ./Hook/Context.ts public surface` stay undocumented as new symbols.
- **`runMain` / `dispatch` / `runHookProgram` / `runDispatchProgram` `typeof program`.** Round-1 `claudecode-hook-R1-014` forbade process-main inside the fence. Compromise still in place. No new evidence those fences log a namespace without calling the constructor they name.
- **Layer tautologies.** `ClaudeProject.layer`, `Testing.makeMockStdioLayer`, `ClaudeRuntime.baseLayer` / `layer` log or `Layer.isLayer` the constructed Layer. They call the owning symbol.
- **`ClaudeProject.settings` / `plugin` still use `process.cwd()`.** They already `runPromise`. Sibling `mcp` is the mock-FS teaching vehicle. Not a new unrun-Effect defect; rewriting them is extra-Example / isolation polish.
- **`Settings.load` against `ClaudeRuntime.baseLayer`.** Filesystem-bearing loaders (`Frontmatter.parseFile`, `Mcp.loadJson`) are allowed to show the real requirement channel. Not opened.
- **Missing `// true` on LiteralKit `.is` fences** (`Settings.PermissionMode`, `Settings.EffortLevel`, `HookEntryType`, `PluginIssueSeverity`). They call the owning symbol. `Frontmatter.EffortLevel` already has `// true`. Expected-comment polish, not a wrong observation.
- **Context accessors / `Testing.makeMockHookContext` / some `Errors` constructors logging a field without an expected comment.** They construct or `runPromise` the owning symbol. `sessionId` already shows `"test-session"`. Pack-wide expected-comment fill is taste.
- **`JsoncParseError` Example uses `errors.length > 0` on `{ bad }`.** Title still observes the tagged aggregate failure (`_tag` + non-empty `errors`). Requiring a two-span fixture is extra-Example polish on a closed R1-015.
- **`@returns` restating `Effect` channels on `JsoncFingerprint.canonicalize` / `hash`.** Member-level tag omission. Census owning-export law; round 3 already rejected member `@since` inconsistency on Effect twins.
- **`JsoncFromString` / Effect twins (`parse` / `stringify` / `canonicalize`) without their own Example.** Defined in terms of the `*Result` twin or covered by the class Example. Extra Examples rejected.
- **`Jsonc.parseResult` / `parse` method hover omitting `__proto__`.** Class **Gotchas** already name those methods. Re-opening R2-004.
- **Loose `jsonc` fence on `Settings/HooksSection.ts`.** Law forbids a loose `ts` fence. The fileoverview illustrates the settings wire shape in `jsonc`; docgen does not extract it.
- **`NpmPluginSource` `"@example/plugin"`.** Sample package string, not a `@example` tag.
- **Module leads starting `Schema for …`** (`HooksSection`, `Plugin/Manifest`, `Plugin/Marketplace`). Purpose-first fileoverviews of the document they model, not identifier echoes. Wording churn.
- **`$I` on `Data.taggedEnum` visitor events and non-schema facades** (`JsoncVisitorEvent`, `TomlVisitorEvent`, `Jsonc`, `Toml`, `Journal`). Annotation-patterns cover Schema Class / TaggedError / Literals / Union.
- **Internal example relative depths** (`../../jsonc/...` vs `../../../toml/...`). `@internal` symbols are skipped by docgen extraction; public fences use `@beep/scratchpad/<kit>`.
- **`Toml.bind` named `Schema` from root `"effect"`.** Conventions allow named imports from root `effect`.
- **`Journal` `fs.watch` arming-yield heuristic.** Maintainer comment, not a public contract; `JournalConfig` already documents directory derivation.
- **Runtime `@effected/*` identity** in `assertCap` TypeError and `JsonlEventTypeId`.
- **Extra titled Examples, empty When-to-use/Details, title polish.** Not opened.

---

## Pack notes (no extra items)

### jsonc

13/13 exporting modules have a purpose-first lead, `@packageDocumentation`, and `@since 0.0.0`. Exported schemas carry `$I.annote` / `$I.annoteSchema`. Value constructors and facades call the owning symbol and log an observable field or Result. Pretty-print expected comments use the quoted JS-literal grammar (`'{\n  "a": 1,\n  "b": 2\n}'`). Depth-cap and `"__proto__"` contracts are on the class and the walker/equality members that return the placeholder / `false`. Barrel re-exports are graph edges.

### jsonl

11/11 modules documented. Gotchas lifted from implementation comments still hold (torn tail vs hole, empty `events: []`, asymmetric `canMerge`, BOM probe, bind-once layers, `Schema.Void` → `null`). `EnvelopeFrame` same-name alias is type-level. `JsonlEventTypeId = "~effected/jsonl/JsonlEvent"` remains a runtime brand.

### toml

15/15 modules documented. Round-2 closures hold: `TomlFormat` lead is conservative span-preserving format/modify; stringify/format/bind/`renderKey` expected comments match `stringifyValue` (`// 'name = "Alice"\n'`, `// '"has space"'`); `TomlFormattingOptions` keeps the quoted CRLF JS-literal. 1.1-parse / 1.0-stringify asymmetry and `__proto__` own-property stay in facade Gotchas.

### claudecode

65/65 exporting modules have `@packageDocumentation`. Event constructors (`Input`, `Output`, `define`, `allow`/`block`/`passthrough`, matchers) call the owning symbol and log a field. Tool adapters `decodePostToolUseWith` and log a decoded field. MCP/plugin/Testing harnesses run against in-memory FS or construct `.make` values. Error classes log `_tag` / a payload field. `export declare namespace` companions stay type-level.

---

## Pack verdict

- files reviewed: 104 (jsonc 13, jsonl 11, toml 15, claudecode 65)
- owning exports reviewed: 905 (jsonc 55, jsonl 46 including the `EnvelopeFrame` same-name alias, toml 92, claudecode 712)
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 22
- accepted findings: 0

Every exporting module and every owning export in the four packs was reviewed. Barrel re-exports were not treated as documentation subjects. Round-3 closures hold on the live sources. jsonl and toml remain clean. jsonc and claudecode have no residual editorial defect that cites law or a concrete caller-confusion risk.
