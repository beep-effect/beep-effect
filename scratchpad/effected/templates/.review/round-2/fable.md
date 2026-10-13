### fable-2-1
- file: scratchpad/effected/templates/internal/reconcile.ts:263
- class: bug   severity: required
- standard: D9 with section 14 cause 2 (upstream-bug); the package's own promise at ManagedSection.ts:200-205 ("every byte outside a managed span survives"), SectionDocument.ts:365-366 ("preserved byte-for-byte") and README Features ("including a leading BOM").   evidence: `output.trim() === ""` is the blank-document test and `String.prototype.trim` strips U+FEFF (probe: `"﻿".trim() === ""` -> true). Probe on the lab: `SectionDocument.parseResult(text).reconcile([id.section("body")])` for text in ["﻿", "﻿\n", "﻿\n\n"] -> output starts with "# --- BEGIN", bomKept=false in all three. Same probe against ~/YeeBois/references/effect/effected/packages/templates/src (reconcile.ts byte-identical to the pinned oracle, verified with diff) -> bomKept=false, so upstream has the bug and its tests do not cover it. The lab property SectionDocument.property.test.ts:33 only generates `"﻿user:" + prefix`, never a blank prefix, so the S3 floor misses it.
- failure: The first sync of a BOM-only (or BOM plus blank lines) file silently deletes the BOM; the second sync reports Unchanged, so the byte loss is permanent and contradicts the documented byte-preservation guarantee the BOM-aware decoder exists to uphold.
- fix: Peel the BOM before the blank test: `const bom = output.startsWith("﻿") ? "﻿" : ""; for (const block of appended) { output = output.slice(bom.length).trim() === "" ? `${bom}${block}${eol}` : `${output.replace(/(?:\r?\n)+$/, "")}${eol}${eol}${block}${eol}`; }`. Section 14 order: write the ledger `upstream-bug` entry first, change the code, extend "preserves a byte-order mark" in SectionDocument.reconcile.test.ts:130 with the "﻿" and "﻿\n" sources, let the property's prefix be empty, add the README Port notes entry.

### fable-2-2
- file: scratchpad/effected/templates/SectionDocument.ts:431
- class: bug   severity: required
- standard: D9 (lab-introduced divergence from the method's own contract at SectionDocument.ts:399-402: blank lines "collapse into a single separator, so repeated removals never accumulate gaps"); the round-1 sol-1-1 BOM deviation covers parse/reconcile only.   evidence: Probe: `parseResult("﻿" + block + "\nfooter\n").remove(id)` -> `"﻿\n\nfooter\n"`; the same document without the BOM -> `"footer\n"`. Cause: `before = this.text.slice(0, found.start)` is `"﻿"` (sol-1-1 made the first-line marker start at offset 1), so it is non-empty and the two-sided branch at :433-435 inserts `eol + eol` between the BOM and `after`. Upstream rejected this document as orphanedEnd, so the path is new in the lab.
- failure: Removing the first-line section of a BOM document leaves two blank lines at the top of the file; a later sync appends below them and a later remove keeps them, so the gap never collapses.
- fix: Peel the BOM off the preserved prefix: `const bom = found.start > 0 && this.text.startsWith("﻿") ? "﻿" : ""; const before = this.text.slice(bom.length, found.start).replace(/(?:\r?\n)+$/, "");` and prefix `bom` to all three returns. Add the remove case (expect `"﻿footer" + eol`) to the BOM regression block in SectionDocument.test.ts:273.

### fable-2-3
- file: scratchpad/effected/templates/SectionDialect.ts:396
- class: bug   severity: required
- standard: D9 (upstream served copies; lab throws); Effect marks every `S.Class` `static [immerable] = true` (node_modules/effect/dist/Schema.js makeClass), so immer `produce` copies are a sanctioned path; the 2026-10-09 ruling ("matchers computed with their owner") is preserved by the fix.   evidence: Probe with the installed immer: `const next = produce(SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] }), (d) => { d.phrase = "OTHER PHRASE" })` -> `next instanceof SectionDialect` true, then `next.matchers()` and `next.render(id.section("x"))` both throw `TypeError: Cannot access invalid private field (evaluating 'this.#compiledMatchers')`. Oracle SectionDialect.ts:199-237 keys a WeakMap by instance, misses on the copy and recompiles, so upstream renders (with the new phrase). The decode path is unaffected (verified: `S.decodeUnknownSync` reconstructs via `new`).
- failure: Any prototype-preserving copy of a dialect (immer finalize, `Object.assign(Object.create(proto), ...)`) turns `matchers`, `containsMarker`, `render` and through them `scan`/`parseResult` into a TypeError defect instead of a typed result.
- fix: Ergonomic brand check in `matchers()`: `return #compiledMatchers in this ? this.#compiledMatchers : this.compileMatchers();` (owner field kept; copies recompute uncached). Regression in SectionDialect.test.ts: `const copy: unknown = Object.assign(Object.create(SectionDialect.prototype), { phrase: "MANAGED SECTION", styles: [CommentStyle.hash] })`, narrow with `S.is(SectionDialect)`, assert `copy.render(...)` succeeds and `copy.containsMarker(text)` is true.

### fable-2-4
- file: scratchpad/effected/templates/internal/attributes.ts:51
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18; standards/effect-first-development.md EF-12c; round-1 fable-1-7 and fable-1-8 closed the identical shape for SectionKey and Delimiter.   evidence: `AttributeName = S.String.check(S.isPattern(ATTRIBUTE_NAME_PATTERN))` (:51) and `AttributeValue = S.String.check(S.isPattern(/^(?![\s\S]*["\r\n])/))` (:79) carry only the schema-level `$I.annote`; neither `S.isPattern` call has identifier/title/description/message, unlike Section.ts:43-48 and CommentStyle.ts:25-30 after round 1. Both schemas are exported and reused: `isValidAttributeName`/`isValidAttributeValue` (:105, :122) and `SectionDialect.render` (:320). The green S1 gate runs effect-imports, effect-fn, terse-effect and native-runtime, not law 18.
- failure: Reusable validation grammar without check metadata; a decode failure surfaces the raw regex instead of a user-facing message, and the JSON Schema carries an anonymous pattern.
- fix: Add `{ identifier: $I`AttributeNameCheck`, title: "Attribute name grammar", description: ..., message: ... }` and the AttributeValue twin to the two `S.isPattern` calls, keeping both regexes byte-identical; SectionAttributes.test.ts:368-397 already pins acceptance so no assertion changes.

### fable-2-5
- file: scratchpad/effected/templates/internal/attributes.ts:35
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md Hard requirements ("Every public export has a useful lead description") and section grammar ("The lead explains the symbol's purpose or the problem it solves").   evidence: Leads: attributes.ts:35 "Attribute names retain the original JavaScript dollar-anchor semantics." (AttributeName); scan.ts:70 "A scanner failure retains its required, explicitly undefined-capable key." (ScanFailure); scan.ts:98 "Plain scan results keep the boolean `ok` discriminant and variant-specific fields." (ScanResult). Each records a round-1 fix decision rather than what the value is. docgen `enforceDescriptions` checks presence only, so the green S2 gate cannot see it.
- failure: Hover docs for AttributeName, ScanFailure and ScanResult describe review history instead of the symbol; a reader cannot learn the attribute-name grammar or the failure payload from the lead.
- fix: Rewrite the three leads (e.g. "The name grammar for a marker attribute: an ASCII letter followed by letters, digits, `_` or `-`."; "The first structural ambiguity the scanner refused, with the marker's 1-based line and, when known, its key."; "Either every located section in source order or the first structural failure.") and move the dollar-anchor / required-key notes into `**Details**`.

### fable-2-6
- file: scratchpad/effected/templates/SectionOutcome.ts:20
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.1 (never delete an upstream sentence that teaches a rationale); JSDoc law ("demonstrate a useful, observable result").   evidence: Oracle SectionOutcome.ts:8-11: "`Updated` carries **both sides** rather than a diff, so a pure line reordering is never reported as 'nothing changed'. A caller wanting a rendering diffs `before.content` against `after.content`..."; lab :21-22 keeps only "Callers can compare `before.content` and `after.content` with their preferred diff library." The Examples at :45-50 and :92-97 call `$is("Updated")(undefined)` / `$is("Drifted")(undefined)` and print without an expected comment; `**Details**` (:20) and both Example headings (:45, :92) lack the blank line every other block in the module uses.
- failure: The reordering rationale is lost and neither Example shows a constructor or a match, which is the API the statics exist for.
- fix: Restore the sentence; make each Example construct a variant (`SyncOutcome.Updated({ before, after })`, `CheckOutcome.Drifted({...})`) and `$match` it with a `// expected` comment; add the blank lines.

### fable-2-7
- file: scratchpad/effected/templates/README.md:98
- class: docs   severity: backlog
- standard: D2 (additions listed under Port notes -> Added exports); 2026-10-09 grilling ("added exports go to `exportsAdded`"); round-1 codemod-2.   evidence: README "Added exports: None" and ledger `rows.templates.exportsAdded == []` (read from PORT_LEDGER.json) while the module now exports values absent upstream: `Eol` (SectionDialect.ts:31), `SectionReconciliation` value (SectionDocument.ts:143), `ManagedSectionTestError` (ManagedSection.ts:332), `ScanFailureReason`/`ScanFailure`/`ScanResult` values (scan.ts:42,84,112), `ReconcileInput`/`ReconcileOutput` values (reconcile.ts:45,75), `AttributeName`/`AttributeValue`/`isValidAttributeName` (attributes.ts:51,79,105) and the `SectionKey` type (Section.ts:57). The central codemod that wrote the 13 deviation entries left this list empty.
- failure: The port's added-export inventory is still empty after the pass that was to fill it, so D2 parity cannot be checked from the record.
- fix: List each added export with its source entry and kind under README Added exports and in `exportsAdded`.

### fable-2-8
- file: scratchpad/effected/templates/README.md:110
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 (a deviation entry describes the lab behaviour).   evidence: README and ledger "type-safety" entry: "ManagedSection.sync checks nonemptiness and calls Array.headNonEmpty"; ManagedSection.ts:288 is `return O.getOrThrow(A.head(outcomes));` with no nonemptiness check and no `headNonEmpty` (round-1 backlog-5 is the still-open row for that redesign).
- failure: The recorded deviation misdescribes the code it claims to record.
- fix: Reword the entry to the actual `A.head` + `O.getOrThrow` shape, or land backlog-5 and keep the text.

### fable-2-9
- file: scratchpad/effected/templates/README.md:12
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md sections 10.1 (rewrite carried prose that is wrong after the port) and 10.3 (drop packaging boilerplate).   evidence: "All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` ... fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED`" survives verbatim; the lab module has no package exports map and is not published.
- failure: A false statement about the lab's packaging in the adapted README.
- fix: Delete the paragraph or reduce it to one sentence saying the lab modules are ESM `.ts` sources imported by path.

### fable-2-10
- file: scratchpad/effected/templates/SectionOutcome.ts:9
- class: effect-idiom   severity: backlog
- standard: Round-1 inventory sol-1-5 fix text ("Use lazy references where necessary to avoid new initialization cycles"); EF-33.   evidence: `S.suspend(() => Section)` x5 (SectionOutcome.ts:9-14, 58-62), `S.suspend(() => PlacedSection | Section | SectionDialect | SyncOutcome)` (reconcile.ts:47-49, 77) and `S.suspend(() => PlacedSection)` (scan.ts:115) all wrap direct value imports; the import graph has no cycle (SectionDocument -> reconcile -> SectionOutcome -> Section -> CommentStyle; scan -> Section, attributes; SectionDialect -> CommentStyle, attributes), and SectionDocument.ts:198,204 and Section.ts:96 reference the same classes directly without suspend.
- failure: The suspends advertise recursion that does not exist and route Arbitrary and JSON Schema derivation through the recursive-schema path for nothing.
- fix: Reference `Section`, `SectionId`, `PlacedSection`, `SectionDialect` and `SyncOutcome` directly in those field schemas.

### fable-2-11
- file: scratchpad/test/templates/SectionOutcome.property.test.ts:9
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.4 (D10 floor); goals/effect-vitest-canon/SPEC.md section 1.5 ("extend, never duplicate").   evidence: `roundTrips` is pasted into nine files (CommentStyle, Section, SectionDialect, SectionDocument, SectionOutcome, ManagedSection .property.test.ts and internal/{attributes,reconcile,scan}.property.test.ts); the internal variant also asserts `encode(decode(x))` deep-equals the original encoding (reconcile.property.test.ts:16), the six top-level copies do not.
- failure: Two divergent definitions of the module's round-trip floor; the weaker one guards the public schemas.
- fix: One shared `roundTrips` helper under scratchpad/test/templates (or the canon kit) carrying the stronger assertion, imported by all nine files.

### fable-2-12
- file: scratchpad/test/templates/fixtures.ts:36
- class: jsdoc   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.2 ("Forbidden anywhere in new blocks: `@remarks`"), section 16, D13 (no `@effected/*` references inside the lab).   evidence: `rg -n "@remarks|@effected/" scratchpad/test/templates` -> fixtures.ts:33 "(`@effected/memfs`)", fixtures.ts:36 `@remarks`. The docgen and jsdoc-ratchet gates scope `src` only, so neither sees the test helper.
- failure: A legacy carrier and the upstream package name survive in the module's test helper.
- fix: Convert the block to `**Details**` and name the ported `memfs` module (`../../effected/memfs`).

### fable-2-13
- file: scratchpad/test/templates/SectionDocument.prop.test.ts:32
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 16 ("never use native `Set`/`Map`"); the README native-runtime deviation claims the module's test sites were converted; beep law 6 scopes tests out, so the green native-runtime gate does not see it.   evidence: `const seen = new Set<string>();` with `seen.has`/`seen.add` at :32-40 (upstream-carried). No other native Set/Map/sort remains in scratchpad/test/templates (rg sweep).
- failure: One native Set remains in the module's tests after the native-runtime replacement wave.
- fix: `MutableHashSet.empty<string>()` with `MutableHashSet.has`/`MutableHashSet.add` from `effect/MutableHashSet`.

REQUIRED: 5
BACKLOG: 8
