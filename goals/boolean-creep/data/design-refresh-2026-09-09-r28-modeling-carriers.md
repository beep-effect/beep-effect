# R28 modeling carriers: source adjudication and provisional design

Bounded native Codex P2 source audit on frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7` and origin/main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This is not independent P3 or a
replacement independent census. No canonical inventory/status/current-design,
product source, tests, services, frozen R27/R28 reports, or archives were edited.
The completed R28 Docgen/Files audit remains unchanged.

Read the binding SPEC/DECISIONS, the completed independent
`data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-foundation-modeling-rest.jsonl`
and its execution receipt, and current source via graft followed by exact
spans. The receipt reports exit 0, a completed turn, three schema-valid rows,
two qualified candidates, and one D2 record. Those execution/schema facts do
not establish scope or semantic qualification.

## Disposition

| Record | Source-backed proposal |
| --- | --- |
| html-datalist-child-grammar | Correct stable D1 seed to confirmed E4, 4/3 derived/internal/Tier1. Provisional design at `data/provisional-html-datalist-child-grammar.md`. |
| html-element-meta-void-rawtext | Reject out-of-corpus raw qualification; archive/remove existing stable D1 seed because its declaration is in a generated-header file. No metadata design or replacement row is authorized. |
| r28-foundation-modeling-rest-bun-glob-scan-options | Admit the independent D2 object-literal census record after verified SDK-boundary proof. No design. |
| allow-list-url-policy-relative-flags | Repair line 191 to 125; retain the three-member D1 configuration owner. |
| html-picture-source-sizes-auto | Repair line 1060 to 1082; retain D1. |
| r3-foundation-attribute-requirement-gates | Repair line 1319 to 1341; retain D1. |
| r2-foundation-html-foreign-entry-flags | Repair line 2015 to 2023; retain D1. |
| html-media-child-grammar | Repair line 1843 to 1851; retain D1 with four concrete computed-pair witnesses. |
| r3-foundation-source-size-sum-spacing | Archive/remove synthetic cross-function/callable cluster. |
| r3-foundation-glob-entry-facts | Archive/remove the joint entry projection; early hidden-entry return precedes acquisition of the directory fact. |

The provisional metadata path from the original assignment is intentionally
absent, following parent's subsequent explicit steering. Metadata disposition
lives only here. The parent separately confirmed Html.meta.ts was erroneously
included in the frozen R28 map and is preparing a scope correction. Preserve
that historical map/report unchanged; this audit supplies no corpus exception.

## Datalist: actual owner and complete local cluster

`html/src/Html.conformance.ts:1887-1903` contains the only two Boolean locals
inside the datalist Match callback. optionMode is A.contains(sequenceTags,
option) at :1888; mixed is optionMode AND the direct-child predicate at
:1889-1899. FF, TF, TT are computable; FT cannot be produced. Existing tests
provide empty (:1212-1234 in Html.conformance-hardening.test.ts), option plus
comment (:172-177 in Html.coverage-matrix.test.ts), and mixed foreign/text/span
(:154-168 in the same file) witnesses. The sole direct reader is :1900.

The old D1 note states the very implication it mistakenly treated as independent
flags. This is a genuine E4 correction, not a successful-operation count based
on diagnostics. The pair is a computed classification of arbitrary AST children;
its mixed state is itself a supported validation outcome. Preserve that error
rather than rejecting the AST before the existing conformance boundary.

The full **locally co-carried** set is these two flags. Outer significantText at
:1754 belongs to inspectElementOrder's common preprocessing and is consumed by
other Match callbacks; do not fabricate a larger stored object spanning those
separate callback scopes. Children, sequenceTags, significantChildren, paths,
and tag/string payloads are not extra Boolean/presence axes. The design keeps
other callbacks and shared preprocessing unchanged.

The replacement is a private LiteralKit without-options|option-content|
mixed-content, derived by one pure classifier from the existing child arrays.
It removes both Boolean aliases and their reader while preserving the actual
presence/significance tests. Without-options describes only this order check:
non-phrasing children can still trigger the separate child-model checker.
The independent report's phrasing-or-empty label would overstate validity.

Construction remains the generated Datalist class with required HtmlChildren
at Html.model.ts:2139-2146, schema-supplied datalist tag, and no new children
default. Its existing constructor and encoded examples explicitly provide []
(:2132/:2155). Option attribute defaults remain None at :6043-6047 and its
children remain required. Neither generated model nor metadata is edited by
this authored conformance refactor.

## Datalist writers, readers, exports, and compatibility

- Source inputs are original children plus elementTags/sequenceTags at
  Html.conformance.ts:1736-1747. isScriptSupporting at :1644 is exactly script
  or template. The mixed scan uses original direct children, not the filtered
  significantChildren array, and strips only HTML ASCII whitespace.
- One callback writes/reads the pair at :1888-1900. Its issue closure at :1761
  produces the existing path, elementOrder rule, and exact message. The issue
  schema/helper live at internal/conformance/Html.conformance-contracts.ts:
  189-213; arrays and messages remain full payloads.
- inspectChild concatenates child-model issues before order issues and then
  descendants at :2153-2175. inspectConformance handles root/fragment/document
  traversal and later document checks at :2194-2236. conform validates both
  supplied and detached snapshot trees at :2260-2270.
- Public consumers are unchanged: Html.Conformant.decode/issues in Html.ts:
  15-16/44-52, index.ts:76-91 re-exports, direct Html.conformance package subpath,
  policy proof consumption in Html.policy.ts:808/:893, serializeConformant and
  safe-AST revalidation in Html.serialize.ts:636-654. None receives the local
  grammar value. Graft's complete incoming trace plus focused call-site reads
  established these boundaries; missing edges were not treated as absence.
- The actual affected fixtures are Html.coverage-matrix.test.ts:154-177 and
  Html.conformance-hardening.test.ts:663-665/:1212-1234. Extend through public
  functions for all three states, exact nested paths, issue order, typed failure,
  and unchanged serialization; do not export a private test helper.

There is no encoded carrier for the private literal, so Tier 1 is appropriate.
The observable diagnostics/proofs/HTML remain unchanged. No incoming JSON codec,
metadata generator run, constructor narrowing, or new exported enum is needed.
All eight design sections, precise guard-deletion accounting, and the full
migration/test inventory are in the provisional design.

## Generated metadata: no authorized design

Html.meta.ts:2 says GENERATED FILE. SPEC scope and DECISIONS corpus point 7,
explicitly retained by the 2026-09-03 amendment, exclude generated headers.
The source template emits the declaration at html/scripts/generate.ts:3987-4008
and generated table rows at :2995-3007; scripts are also outside this source
corpus. The header is controlling evidence, irrespective of the erroneous
frozen path-map inclusion or the existing D1 seed. Archive/remove that seed,
retain the raw independent error as history, and admit no replacement owner.

The bounded contract read also explains why the reported table-only 4/3,
internal/Tier1 proposal would be insufficient even without this scope stop:

- HtmlElementMeta at :1754-1776 publicly co-carries required void, rawText, and
  four-valued HtmlTextMode (normal, raw-text, rcdata, plaintext at :1324), plus
  tag, interface, conformance, complete content/attribute/rule arrays, and
  optional childSequencePattern/childGrammar. No flag constructor defaults are
  declared. The generator explicitly sets rawText from textMode at :3005.
- The schema is publicly re-exported by index.ts:144-156 and the Html.meta
  package subpath. Generated source encodings are decoded at :4931-4933 and
  deeply frozen into ELEMENT_META at :4949-4951. Public does not mean internal.
- Html.test.ts:218-255 explicitly constructs and encodes a custom metadata
  object with chosen categories and empty currentAttributes, unlike the table's
  full anchor entry. This proves the table is not the entire supported metadata
  constructor/encoding contract. The generic arbitrary round trip at :258-279
  alone does not prove every contradictory flag tuple is a meaningful input.
  No claim that a both-true metadata input is legitimate is established here.
- Actual consumers use void to omit end tags (Html.serialize.ts:523), textMode
  to handle normal/raw-text/rcdata/plaintext content (:481-514), and textMode
  for structural-content/attribute handling (serialize:305-306,
  conformance:596-625). RawText is also an exported inspectable field tested at
  Html.test.ts:296. A pair-only rewrite cannot silently drop any of those fields
  or rules, nor rely solely on the reported 142 static pairs for public compatibility.

No replacement cardinality, target schema, or implementation migration is
proposed. Scope exclusion is sufficient and avoids pretending this bounded
read resolves every external metadata consumer or hypothetical custom tuple.
No provisional metadata file is created.

## Footer drift and withdrawal proof

AllowListUrlPolicySpec now begins at md/src/Md.escape.ts:119; its first Boolean
is :125, then :128/:131. Documentation at :99-105 explicitly treats the three
settings independently, with defaults true/false/false. The reader at :400-409
lets allowRelative gate narrower permissions. All configurations remain legal,
including inactive permissions when allowRelative=false; do not confuse legal
configuration combinations with guaranteed acceptance of every URL category.

Html.conformance footer anchors were verified directly:

| Seed | Current Boolean anchors | Action |
| --- | --- | --- |
| r3-foundation-img-responsive-presence | hasSrcset :987, hasSizes :988 | See contained-cluster supersession below, rather than line-only repair |
| r3-foundation-link-responsive-presence | hasImageSrcset :1033, hasImageSizes :1034 | See contained-cluster supersession below |
| html-picture-source-sizes-auto | :1082/:1083 | D1 line repair |
| r3-foundation-attribute-requirement-gates | :1341/:1348 | D1 line repair |
| r2-foundation-html-foreign-entry-flags | :2023/:2024 | D1 line repair |
| html-media-child-grammar | hasSrc :1851, valid :1859 | D1 line repair |

For media the four computed states have direct witnesses: no-src/empty and
src/empty both validate; no-src with source after fallback fails; src with a
source child fails. For foreign entry, root/HTML versus already-foreign context
and integration versus non-integration element names remain independently
observed; invalid entry emits its diagnostic. Requirement applicability and
violation are independently computed before the conjunction. These repairs do
not assert every constructed invalid AST passes conformance.

`r3-foundation-source-size-sum-spacing` is not a three-Boolean owner.
Html.source-size.ts:639 defines callable hasSumOperator; :645 takes
hasLeadingSpace as a function parameter; :647 declares hasTrailingSpace locally.
parseSum itself has a local hasLeadingSpace at :658 and calls the predicate at
:659 before passing the value at :665. Neither scope stores the alleged three
members. Archive/remove the synthetic row; do not reinterpret callable returns
or excluded parameters as a new state model. Preserve CSS spacing/rollback logic.

`r3-foundation-glob-entry-facts` similarly misstates a joint entry projection.
utils/src/Glob.ts:401 computes an exclusion gate, !options.dot AND hidden path,
not an unconditional filesystem hidden fact. It returns at :403-405 before
resolving a directory flag at :407 and declaring isDirectory at :411. By then
the earlier gate is false and no longer read. The code carries no stored
hidden/directory record or reader reconstructing a phase; it runs sequential
filters, including a missing-directory-fact return at :408-410. Archive/remove
the synthetic tuple rather than inferring an E4 phase from early-return control
flow or claiming both-true is materialized in this scope. Preserve dot filtering,
symlink handling, recursion, and missing-path behavior.

The execution footer also names unchanged Iri.ts parseIpv6Side facts. Those
remain the parent's existing nontooling source audit responsibility; this task
neither re-adjudicates nor changes that row.

## Duplicate-cluster accounting

Three narrow D records are wholly contained in already qualified full clusters:

- r3-foundation-img-responsive-presence and
  r25-foundation-modeling-rest-img-lazy-auto-sizes are subsets of the six-member
  html-img-sizes-disposition owner at :987-1002.
- r3-foundation-link-responsive-presence is a subset of
  html-link-imagesizes-disposition at :1033-1037.

Recommend archival supersession of those three D rows while retaining their
exact D1 reasoning and original independent/history receipts. The broader
qualified rows keep their stable ids, complete members, cardinalities, and
current designs; this task changes none of them. Do not add duplicate broader
rows or retain both broad and contained narrow records without explicit
accounting. The r24 link issue-flags D row additionally owns iconSizesMisplaced
at :1039, which is outside the qualified triple; it is not wholly contained and
is left unchanged. Other independent member clusters remain intact.

## Bun.Glob D2 addition

The independent row is valid: scanOptions is a named object literal explicitly
typed Bun.GlobScanOptions at Glob.ts:491-495, with dot and onlyFiles Boolean
members and cwd string payload. BunGlobConstructor is typeof Bun.Glob at :276;
the discovered SDK constructor is used by compileGlobs at :301-302, and
scanSync receives this exact bag at :501. dot copies resolved dot and onlyFiles
copies resolved nodir directly. Resolved defaults are false/false at :110/:112.

This is a real SDK-boundary mirror, so D2 controls and no design is authorized.
It is distinct from the already recorded GlobOptions/ResolvedGlobOptions owners
and from the withdrawn sequential entry-filter projection. Required cwd is not
an extra presence axis. The existing backend fixture at test/Glob.test.ts:
291-318 covers directory inclusion versus omission; no test run or new SDK
behavior is claimed by this audit.

## Exact proposed surviving rows

Seven rows below are proposals only: one confirmed stable-seed correction,
one new D2 record, and five existing D1 anchor/explanation repairs. Withdrawals
and contained-cluster supersessions receive no replacement row. The datalist
status is proposed confirmed; provisional design existence does not advance
canonical status or constitute P3 acceptance.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"html-datalist-child-grammar","file":"packages/foundation/modeling/html/src/Html.conformance.ts","line":1888,"symbol":"inspectElementOrder.datalist","kind":"sibling-state","members":["optionMode","mixed"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/foundation/modeling/html/src/Html.conformance.ts","line":1889},"note":"mixed is assigned as optionMode && non-option content, so mixed implies optionMode; the FF/TF/TT triple is written and optionMode=false with mixed=true is unwritable."}],"cardinality":{"representable":4,"legal":3},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"R28 native source adjudication confirms the two locals in the datalist Match callback at 1887-1903: mixed implies optionMode. Preserve original children/sequence tags, script/template filtering, significant-text/foreign/other-element predicate, and exact issue order/path/message. Use private without-options|option-content|mixed-content LiteralKit; without-options does not imply overall child-model validity. Outer significantText serves other grammar callbacks and is not an additional locally stored datalist field; required arrays/strings/counts are not extra axes. This corrects the old D1 note. Provisional P2: data/provisional-html-datalist-child-grammar.md; no independent P3 acceptance is claimed."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-foundation-modeling-rest-bun-glob-scan-options","file":"packages/foundation/modeling/utils/src/Glob.ts","line":493,"symbol":"scanWithBunGlob.scanOptions","kind":"object-literal","members":["dot","onlyFiles"],"status":"disqualified","disqualifier":{"class":"D2","note":"Named object-literal scanOptions at Glob.ts:491-495 is explicitly typed Bun.GlobScanOptions, with dot copied from options.dot and onlyFiles copied from options.nodir. BunGlobConstructor is typeof Bun.Glob at 276 and glob.scanSync(scanOptions) consumes this exact bag at 501. This is the SDK boundary mirror, D2 census only; cwd is payload, not another Boolean axis. Distinct from the public GlobOptions and internal ResolvedGlobOptions owners."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"allow-list-url-policy-relative-flags","file":"packages/foundation/modeling/md/src/Md.escape.ts","line":125,"symbol":"AllowListUrlPolicySpec","kind":"schema-struct","members":["allowRelative","allowProtocolRelative","allowBackslashRelative"],"status":"disqualified","disqualifier":{"class":"D1","note":"Declared independent configuration at Md.escape.ts:99-105, with defaults true/false/false at 125/128/131. All settings remain supported even when allowRelative=false makes the narrower permissions inactive; isAllowedRelativeDestination at 400-409 evaluates that policy rather than rejecting a contradictory stored state."},"notes":"R28 source-anchor and explanation refresh only; same member set and D1 classification. Audit: data/design-refresh-2026-09-09-r28-modeling-carriers.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"html-picture-source-sizes-auto","file":"packages/foundation/modeling/html/src/Html.conformance.ts","line":1082,"symbol":"inspectPictureSourceResponsiveRelationships","kind":"sibling-state","members":["hasSizes","followingImageAllowsAuto"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independently observed source sizes presence and following-image auto-sizes permission at Html.conformance.ts:1082-1083. The missing-sizes check at 1085 uses both without correlating their construction; retain all four combinations and the later size/profile validation."},"notes":"R28 source-anchor and explanation refresh only; same member set and D1 classification. Audit: data/design-refresh-2026-09-09-r28-modeling-carriers.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-foundation-attribute-requirement-gates","file":"packages/foundation/modeling/html/src/Html.conformance.ts","line":1341,"symbol":"inspectAttributeRequirement","kind":"sibling-state","members":["applies","hasViolation"],"status":"disqualified","disqualifier":{"class":"D1","note":"Applicability and violation are independently calculated at Html.conformance.ts:1341-1357 and combined at 1358. A non-applicable requirement may have either satisfied or violated attributes; applicable requirements may likewise pass or fail. Preserve all four observations and issue filtering."},"notes":"R28 source-anchor and explanation refresh only; same member set and D1 classification. Audit: data/design-refresh-2026-09-09-r28-modeling-carriers.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r2-foundation-html-foreign-entry-flags","file":"packages/foundation/modeling/html/src/Html.conformance.ts","line":2023,"symbol":"inspectForeignEntryPoint","kind":"sibling-state","members":["entersFromHtml","usesIntegrationElement"],"status":"disqualified","disqualifier":{"class":"D1","note":"Parent-is-HTML/root and namespace/name integration-element facts are computed independently at Html.conformance.ts:2023-2025. Root/HTML-entry versus already-foreign context may each contain integration or non-integration elements; the former invalid combination is a supported conformance diagnostic at 2026, not an impossible stored state."},"notes":"R28 source-anchor and explanation refresh only; same member set and D1 classification. Audit: data/design-refresh-2026-09-09-r28-modeling-carriers.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"html-media-child-grammar","file":"packages/foundation/modeling/html/src/Html.conformance.ts","line":1851,"symbol":"inspectElementOrder.media","kind":"sibling-state","members":["hasSrc","valid"],"status":"disqualified","disqualifier":{"class":"D1","note":"hasSrc at Html.conformance.ts:1851 and completed valid scan result at 1859 are independent observations over arbitrary constructed ASTs. Empty children validate with or without src; source after fallback invalidates without src, and a source child invalidates with src. All four computed pairs are reachable; retain phase/order logic and diagnostics."},"notes":"R28 source-anchor and explanation refresh only; same member set and D1 classification. Audit: data/design-refresh-2026-09-09-r28-modeling-carriers.md."}
```

## Frozen-source receipts and validation boundary

All five primary audited source files matched their git-show blobs at frozen
HEAD before writing this receipt. Html.meta.ts was read for exclusion/contract
proof, not admitted into the corpus.

| Source | SHA-256 |
| --- | --- |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | `3c6833bf944de3f2fcda2219d15d343b827dc3a2b16fec0f9f0360b6baf519b1` |
| `packages/foundation/modeling/html/src/Html.meta.ts` | `d5b6c9bc9230bcf22679e517d70f707d98709f1e40c5c6c8a507b6ac9cfe2b1c` |
| `packages/foundation/modeling/html/src/Html.source-size.ts` | `062d4303e64bd0b1dff06b1801ef60bdf82e0fd7374ff6a47a04017380916cbd` |
| `packages/foundation/modeling/md/src/Md.escape.ts` | `5a595cd350e3d4b5170b9fc555d7af542dd193cd367bbab3bd50eca4c7ea1228` |
| `packages/foundation/modeling/utils/src/Glob.ts` | `7df7185ed6c7bfd9e27affca38542fc814d2a9eeb48e168e243b299781550826` |

Independent raw report SHA-256: `98b2a82e619dab4e7394d05c071897210f483181f872a0d841a14738d48a8a67`.

Final handoff validation passed: all eight provisional-design section headings,
exact source stamps, seven parseable unique proposed rows (one confirmed, one
D2, five D1), basic inventory field checks, and cited line bounds. The recorded
source/report hashes match; the metadata provisional is absent; the completed
Docgen/Files audit retains SHA-256
`49d0d230d4124f87e09c4abe01ba2ab808e665dd8a41565241548bc2f1023d00`.
Product tests/package commands and full inventory validation were not run.
Parent integration and separate independent P3 review remain outstanding.
