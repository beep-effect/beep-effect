# schema-org round-2 merged inventory

Read all six reports, `part-1/{grok,sol,fable}.md` and `part-2/{grok,sol,fable}.md`, and both adjacent `BRIEF.md` files. The 20 seat records review `a12bef261998d2ad92153dada46373be06950692` against pinned upstream `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. At merge time HEAD is `2f515ae2519cc72223c94917019bf7ebfe92a4a5` on `@lab/effected-2`, rather than the requested `@lab/effected`; the module's source/tests have no diff from the reviewed commit. Both part-2 grok and sol report no findings. Seat ids include their part directory because ids repeat between parts.

Counts after deduplication and clause-level classification: **Required 5; Backlog 10; Codemod 1; Rejected 0; Groups 2**. Applied the complete operator revision block, including both 2026-10-09 rulings, D1-D20, sections 12.4-12.5 and 14, and this task's explicit docs/JSDoc/coverage/canon deferral. The briefs' claim that S2/S3 ran does not override that classification instruction. `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/schema-org/**`; no `allow-<n>` findings are needed. Evidence was assessed through read-only reports, source, standards and git history; no gates or probes were run by this merger.

Write ownership: **g1** owns `JsonLdDocument.ts`, `NodeRef.ts`, `Conformance.ts`, `JsonLdDocument.test.ts` and `Conformance.test.ts`; **g2** owns only `internal/vocabulary.ts`. Existing serializer, diagnostic and policy tests remain unchanged unless a concrete regression requires extending a file already owned by g1. No source/test file belongs to both groups, and neither group exceeds six source files. The upstream-bug receipt in backlog-10 is central work before req-4; required groups own no ledger, README Port notes, shared runner, manifest, lockfile or repo configuration.

## Required

### req-1
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:553,61,109; scratchpad/effected/schema-org/NodeRef.ts:61; scratchpad/effected/schema-org/Conformance.ts:101,156,304
- class: law   severity: required
- standard: standards/effect-first-development.md EF-3 and EF-19, checklist item 16; D11.
- evidence: All three contributing records identify `JSON.stringify(this.toJsonLd())`; grok and sol also enumerate six quoted diagnostic fields. EF-3 explicitly says never to use JSON.parse/JSON.stringify. The reports identify the diagnostic's actual scope: preferSchemaOverJson inspects Effect contexts, leaving these plain methods/getters uncovered. Sol reports byte-equivalence probes covering script-closing text, lone surrogates, control escapes, quotes, backslashes and supplementary Unicode. The calls remain in current source. Fable's severity disagreement does not negate the cited standard or gate gap.
- failure: The serializer and diagnostic formatters retain native JSON encoding on domain paths despite green gates.
- fix: Use `Result.getOrThrow(S.encodeResult(S.fromJsonString(S.Json))(this.toJsonLd()))` for document encoding and `S.fromJsonString(S.String)` with the synchronous Result encoder for quoted diagnostic strings. Preserve return types, exact diagnostic bytes and script escapes; apply req-2 to the resulting JSON text. Do not use encodeSync/decodeSync. Existing upstream serializer and diagnostic assertions remain intact.
- seats: part-1/grok-2-1, part-1/sol-2-2, part-1/fable-2-7

### req-2
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:553
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5, checklist item 6; effect-laws-v1 law 21; round-1 req-11's demonstrated scanner gap.
- evidence: toScriptBody chains three String.prototype.replace calls. Fable identifies these as new round-1 fix-wave code replacing upstream's SCRIPT_ESCAPES lookup; Effect String.replace delegates to the same native operation, including global-regexp behavior. The module's index.property.test.ts already uses Effect string replacement for these escapes. NoNativeRuntime's string-method hotspot scope excludes this module, so this is an uncovered violation rather than a gate-enforced duplicate.
- failure: Script serialization uses direct native string helpers below the same idiom bar already applied to decodeRow in round 1.
- fix: Import Str from effect/String and pipe from effect/Function; pipe the req-1 encoded JSON through `Str.replace(/</g, "\\u003c")`, `Str.replace(/>/g, "\\u003e")` and `Str.replace(/&/g, "\\u0026")`. Preserve the literal backslash-u escape bytes and all existing script-escaping tests. No test rewrite is required for this behavior-preserving helper substitution.
- seats: part-1/grok-2-2, part-1/fable-2-1

### req-3
- file: scratchpad/effected/schema-org/Conformance.ts:438-454,683-693
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-34 and EF-35b; effect-laws-v1 laws 13 and 19; round-1 req-7.
- evidence: ConformanceOptions declares decoding defaults from the three LiteralKit enums, while validateResult independently repeats report/ignore/ignore and compares raw fail/report strings. Production never decodes that schema. Conformance.test.ts:349-365 pins schema defaults, explicit undefined and tolerant non-union policy inputs. The reports identify that schema-first enforcement does not cover this lab; current source confirms the duplicate literals.
- failure: Changing a schema default can leave the gate on a different policy; hand-written comparisons also duplicate the named domains.
- fix: Hoist one constant per default from UnknownTermPolicy.Enum.report, DeprecationPolicy.Enum.ignore and DanglingReferencePolicy.Enum.ignore, and reference those constants in both withDecodingDefault and each per-field fallback. Use the policy kits' .is helpers or .Enum members for comparisons. Preserve per-field nullish fallback and tolerant out-of-union inputs; whole-object decoding would change their pinned behavior. Keep upstream test lines unchanged.
- seats: part-1/grok-2-3, part-1/fable-2-2

### req-4
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:195-216
- class: bug   severity: required
- standard: D9 verified upstream-bug exception; D11; section 14; JSON-LD 1.1 section 9.7, Lists and Sets, https://www.w3.org/TR/json-ld11/#lists-and-sets.
- evidence: Sol's read-only probes on the lab and pinned upstream put `{ "@list": [{ "@id": "#missing" }] }` or the corresponding @set under CreativeWork.additional. Both build successfully, report no dangling references or conformance issues, and pass the explicitly enabled dangling-reference gate; an @list containing a malformed string id also builds. Current referencesOf recognizes only direct reference objects and array elements, so container-wrapped references escape it. The collector's existing exclusion of arbitrary nested/value objects does not cover recognized JSON-LD list/set containers.
- failure: Valid JSON-LD containers bypass identifier validation and graph-closure checks while the serializer emits the contained references.
- fix: Extend the shared referencesOf collector to recognize @list and @set containers and inspect their contained reference objects, preserving the originating property, discovery order and duplicate handling. Keep value objects, including @json payloads, and unrelated nested objects excluded. Add missing-target, present-target, malformed-id, ordering and value-object regressions in JsonLdDocument.test.ts and Conformance.test.ts. Keep existing upstream assertions; obtain the central upstream-bug receipt in backlog-10 before changing behavior.
- seats: part-1/sol-2-1

### req-5
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4783-4786
- class: bug   severity: required
- standard: D9; section 14; operator grilling 2026-10-09, restore changes no law, diagnostic or ruling forced.
- evidence: The per-file git log identifies b4b07aa74e as the S3 change. Its diff replaces `const [from, to] = decodeRow(row)` and the two undefined checks with Str.split and unconditional Number coercion. The parent 7929b1f529 already had MutableHashMap plus the upstream decoder/guard shape, so the native collection and string-helper laws did not force the new coercion. The merged history records schema-org step-2 and S1 law work separately; the S3 diff is the later independent rewrite. Pinned upstream skips empty/singleton rows; the changed implementation inserts NaN -> NaN or 5 -> NaN. Complete shipped pairs hide this from current tests.
- failure: An unforced decoder rewrite changes malformed-row handling and duplicates decodeRow, accepting missing indices through Number's optional argument.
- fix: Restore the upstream shape using the existing law-compliant MutableHashMap: destructure decodeRow(row), then call MutableHashMap.set only when both indices are defined. Remove the generated-pairs justification comment and the duplicated Str.split/Number conversion in decodePairs; retain Str.split inside decodeRow and all Effect collection replacements. Do not replace this restore with a new branch-free implementation merely to satisfy coverage. The S3 diff rewrote no Vocabulary.test.ts lines, so there are no upstream test lines to restore for this finding; keep the existing upstream tests unchanged and defer any coverage concern.
- seats: part-2/fable-2-3

## Backlog

### backlog-1
- file: scratchpad/effected/schema-org/Conformance.ts:578
- class: docs   severity: backlog
- standard: This task's docs/S2 deferral; D11.
- evidence: The doc says a prefixed term is skipped entirely. nativeTerm strips schema:, checks undeclared prefixes, and skips only declared foreign prefixes. Sol reports PropertyNotOnType for schema:softwareVersion, UnknownTerm for bogus:telephone and no issue for gs1:telephone.
- failure: The public documentation overstates the prefix exemption.
- fix: During documentation work, say that declared foreign prefixes are skipped while schema: terms and undeclared prefixes are checked. Preserve nativeTerm behavior and issue order.
- seats: part-1/grok-2-4, part-1/sol-2-3

### backlog-2
- file: scratchpad/effected/schema-org/Thing.ts:29; scratchpad/effected/schema-org/TechArticle.ts:22; scratchpad/effected/schema-org/CreativeWork.ts:34; scratchpad/effected/schema-org/Conformance.ts:28,424
- class: jsdoc   severity: backlog
- standard: This task's JSDoc/S2 deferral; standards/effect-first-development.md EF-3.
- evidence: Five published examples call S.decodeUnknownSync; docgen compiles examples but does not enforce the preferred Result decoder form.
- failure: Examples teach the throwing sync decoder instead of the preferred synchronous Result form.
- fix: At S2, use Result.getOrThrow(S.decodeUnknownResult(Schema)(input)) in those five examples and preserve their displayed values.
- seats: part-1/grok-2-5

### backlog-3
- file: scratchpad/effected/schema-org/Vocabulary.ts:241,295
- class: effect-idiom   severity: backlog
- standard: D11; effect-laws-v1 law 21; round-1 backlog-5 precedent.
- evidence: Both ordered queries use A.getSomes(A.map(indices, ... A.get(...))). A.filterMap preserves the output with one traversal and no intermediate Option array. The reports provide no measured regression, algorithmic-class improvement or forbidden gate-missed pattern.
- failure: An avoidable allocation and equivalent-helper cleanup, with no demonstrated functional failure.
- fix: When doing optional cleanup, use A.filterMap with the existing A.get callbacks for both ordered queries; preserve missing-name filtering and traversal order.
- seats: part-1/grok-2-6, part-1/fable-2-6

### backlog-4
- file: scratchpad/effected/schema-org/Conformance.ts:612-639
- class: effect-idiom   severity: backlog
- standard: D11; standards/effect-first-development.md EF-2 and EF-7; effect-laws-v1 law 12.
- evidence: check uses Option combinators to append issues and discards Option<void>/none results. Fable explicitly reports upstream-equivalent behavior, no enforcing diagnostic and a readability-only consequence.
- failure: Control flow through discarded Option results makes the issue accumulator harder to follow; no observable divergence is shown.
- fix: During optional cleanup, compute issue lists as values with Option/Array helpers, then append them, preserving node/term order and all Conformance.test.ts expectations.
- seats: part-1/fable-2-3

### backlog-5
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:28,74,116; scratchpad/effected/schema-org/CreativeWork.ts:26
- class: jsdoc   severity: backlog
- standard: This task's JSDoc/S2 deferral; .patterns/jsdoc-documentation.md section grammar.
- evidence: Fable identifies four unprefixed blank lines in JSDoc blocks between prose and Example sections; docgen does not inspect those comment-line prefixes.
- failure: Cosmetic carrier formatting can render or indent inconsistently.
- fix: During S2, delete each orphan blank line or prefix it with ` *`, preserving all prose and examples.
- seats: part-1/fable-2-5

### backlog-6
- file: scratchpad/test/schema-org/Vocabulary.test.ts:64
- class: test   severity: backlog
- standard: This task's docs/coverage deferral; D11; D9 and sections 10.2/11.1 for any eventual test retarget; central recording is outside the port's write surface.
- evidence: The whole-file size test retains its upstream 60,000-80,000 byte bounds. Read-only history confirms 80,543 bytes at 7929b1f529 and 79,999 after S3 shortened prose and decodePairs. Fable reports identical generated spans between lab and oracle. The size test itself was not rewritten by b4b07aa74e.
- failure: Documentation growth competes with the table-size assertion. This is a documentation/coverage coupling issue, not a demonstrated runtime bug or measured regression requiring a new test contract now.
- fix: Defer the proposed measurement of generated marker spans to the documentation/test work. Establish its law-forced justification before retargeting, keep the numeric bounds and upstream rationale, and arrange any test-environment receipt centrally. Do not weaken or delete the size assertion to make req-5 green; do not assign ledger or README Port-notes edits to a fix group.
- seats: part-2/fable-2-1

### backlog-7
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:5-13
- class: docs   severity: backlog
- standard: This task's docs/S2 deferral; D4 and section 10.1, carried prose must survive.
- evidence: The b4b07aa74e diff shortens the upstream header, removing the explicit warning about filtering by type, the formatter/generator rationale, the three-types lazy-decoding example, schemaorg/schemaorg attribution and foreign-prefix examples. The header is below imports and names upstream generator/data paths without qualifying them. The evidence is concrete, but its subject remains documentation.
- failure: Carried warning/rationale/attribution prose is missing and lab readers are directed to absent generator paths.
- fix: During S2, restore the carried upstream paragraphs, move the vendoring notice above imports, and identify generator/data paths as upstream-only at the pinned commit. Coordinate the size-contract issue in backlog-6 without deleting prose to meet the ceiling.
- seats: part-2/fable-2-2

### backlog-8
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:2556,3517,4471,4506,4603-4604
- class: jsdoc   severity: backlog
- standard: This task's JSDoc/S2 deferral; AGENTS.md Effect helper preference; .patterns/jsdoc-documentation.md example aliases.
- evidence: Four example fences map decoded rows with native .map; the foreign-prefix example uses .includes. Public Vocabulary examples already use A.contains, and docgen only compiles these bodies.
- failure: Internal examples teach helper forms inconsistent with the module's canonical Effect examples.
- fix: During S2, import A from effect/Array in the fences and use A.map/A.contains, preserving each demonstrated result; coordinate any added bytes with backlog-6.
- seats: part-2/fable-2-4

### backlog-9
- file: scratchpad/effected/schema-org/index.ts; scratchpad/effected/schema-org/conformance-entry.ts:39
- class: docs   severity: backlog
- standard: D11; D2 preserves upstream exports and permits additions; this task's docs deferral.
- evidence: The record-only part of fable-2-4 is codemod-1. Its separate barrel suggestion concerns isNodeRef and referencesOf, currently reachable through their source paths, and the ConformanceOptions schema value, currently absent from the type-only conformance entrypoint. The same report notes their examples already import source paths; it establishes no missing upstream export or runtime failure.
- failure: Optional convenience exports and documentation visibility need a decision; D2 does not require promoting every added file-level symbol to a package barrel.
- fix: During public documentation/API cleanup, either add and record chosen barrel exports or explicitly document the file-level/internal status. Preserve every upstream export and its kind. Do not dispatch an optional barrel redesign with required fixes.
- seats: part-1/fable-2-4 (barrel/visibility clause)

### backlog-10
- file: scratchpad/effected/PORT_LEDGER.json; scratchpad/effected/schema-org/README.md Port notes
- class: bug   severity: backlog
- standard: Section 14 upstream-bug recording; outside the port's write surface.
- evidence: Sol establishes the same recognized-container reference failure in the lab and pinned upstream and explicitly requires recording the additional upstream-bug evidence before changing behavior. The law-forced systemic-class codemod does not itself justify this new upstream-bug deviation.
- failure: The req-4 behavior fix needs a central deviation receipt before implementation; those bookkeeping files are excluded from group ownership.
- fix: The orchestrator records an upstream-bug receipt citing the pinned-oracle @list/@set probes and the exact added/adjusted JsonLdDocument.test.ts and Conformance.test.ts regressions before req-4 is applied. Reason for backlog: outside the port's write surface. No fix group edits PORT_LEDGER.json or README Port notes.
- seats: part-1/sol-2-1 (section-14 recording clause)

## Handled by the deviation codemod

### codemod-1
- file: scratchpad/effected/schema-org/README.md:124-126; scratchpad/effected/PORT_LEDGER.json; scratchpad/effected/schema-org/NodeRef.ts:121,287; scratchpad/effected/schema-org/JsonLdDocument.ts:195,399; scratchpad/effected/schema-org/Conformance.ts:432; scratchpad/effected/schema-org/Vocabulary.ts:238,292
- class: docs   severity: backlog
- standard: Operator grilling 2026-10-09, per-module/per-class bookkeeping and added exports in exportsAdded; D2.
- evidence: Fable reports README Added exports as None and exportsAdded as empty despite seven additions from the schema/native-collection fixes: isNodeRef, referencesOf, the NodeId type, the ConformanceOptions schema value, Vocabulary.ancestorsInOrder, Vocabulary.propertiesInOrder and JsonLdDocument.nodeIdsInOrder. The round-1 inventory already routed these systemic receipts centrally. This clause only asks to record accepted additions.
- failure: Added-export bookkeeping is incomplete; it is not an independent required source defect.
- fix: The central deviation codemod inventories actual added values/types/members with their file-level or entrypoint exposure in exportsAdded and regenerates README Added exports. Record the law-forced representation/order sites and adjusted upstream tests in the appropriate systemic-class receipt. The optional barrel question remains backlog-9; no group owns ledger or README Port-notes edits.
- seats: part-1/fable-2-4 (added-export recording clause)

The severity field is backlog for this non-dispatched record; its disposition is this section and it is not counted again in Backlog.

## Rejected

None. Every distinct retained defect has evidence and a concrete fix, and required findings show a gate gap or an unforced later rewrite. Conflicting severity advice was merged using the cited standard and strongest evidence; optional and deferred clauses were classified above rather than discarded.
