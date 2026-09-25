# Instance

- id: `html-dl-child-grammar`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:1798`
- symbol: `inspectElementOrder.description-list`
- members: `direct`, `wrapped`
- evidence: E1 at `Html.conformance.ts:1798-1825` — both booleans are derived from the same child sequence, and a nonempty sequence cannot simultaneously consist of complete top-level dt/dd groups and only div wrappers after script-supporting elements are excluded.
- disposition: retained designed, derived/internal/literalkit/Tier 1; this is a P2 refresh, not independent P3 credit.

# Current shape

The only writes are the two local declarations in the description-list match arm (1797-1829). Their only reader is the acceptance expression at1826. `direct` applies the plural regex to the filtered top-level HTML element tags. `wrapped` requires a nonempty filtered sequence and verifies that each HTML element is either script-supporting or a div containing exactly one complete group. A separate emptiness test admits empty grammar, while an independent `significantText` fact rejects top-level non-whitespace text.

The branch does not inspect parsed HTML source. `Html.conformance.ts:1-5` explicitly operates on already-constructed ASTs without tokenizing or repairing them. Public `inspectConformance` at2201 first checks the recursive conformance view, then calls the traversal; `conform` at2270 inspects, snapshots and re-inspects. Preserve those boundaries.

# Cardinality gap

For this owner there are four representable boolean pairs and exactly three reachable pairs:

| direct | wrapped | Witness / meaning |
| --- | --- | --- |
| true | false | Top-level `dt,dd` (or multiple complete groups) |
| false | true | One div whose children are `dt,dd`, or several individually valid div wrappers |
| false | false | Empty sequence, or invalid grammar such as lone `dd` |
| true | true | Impossible |

Proof for arbitrary sequence length: `direct` requires a nonempty sequence containing only dt and dd, starting with dt and ending with dd in complete groups. `wrapped` requires a nonempty sequence whose only non-script-supporting HTML elements are div. A nonempty sequence cannot have both properties. Empty input makes both false: both regexes require at least one dt and one dd, and wrapped has an explicit nonempty check. The witnesses prove all other pairs reachable. Thus **4/3** is the complete pair abstraction, established from the predicates rather than inferred from a sample count.

`significantText`, `elementChildren`, `sequenceTags` and `invalidNested` are not additional correlated owner flags. Top-level text is an independent veto; nested invalidity is a real structural predicate. The new four-member literal separates the two semantic meanings of `(false,false)`—empty and invalid—rather than claiming that the original pair had four reachable values.

# Target schema

Add one private kit beside the existing sequence patterns at1732-1733:

```ts
const DescriptionListChildGrammar = LiteralKit(["empty", "direct", "wrapped", "invalid"]);
type DescriptionListChildGrammar = typeof DescriptionListChildGrammar.Type;
```

Add `LiteralKit` to the existing `@beep/schema` import (currently only SchemaUtils at13). The private kit needs no new public export or separately annotated/rebuilt wrapper. Use its `.Enum`, `.is` or exhaustive `.$match` helpers directly; no handwritten literal union or tagged payload classes. The live helper implements `.$match` at `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:582-605`.

Derive one local `grammar: DescriptionListChildGrammar` from the current inputs using this ordered decision:

1. If `sequenceTags` is empty, return `empty`.
2. If the unchanged `isDescriptionGroups(sequenceTags)` holds, return `direct`.
3. Otherwise run the current wrapped-child predicate verbatim and return `wrapped` or `invalid`.

The wrapped predicate no longer needs its own `sequenceTags.length > 0` because the empty case was already discharged. Keep the div check, script-supporting exception, nested-child read, nested tag filter, invalidNested predicate, and singular `isDescriptionGroup` test. Do not infer wrapped solely from div tags without checking their contents.

At the reader, match the literal to accept empty/direct/wrapped and reject invalid, then apply the unchanged independent `!significantText` veto. Emit zero issues or exactly the existing parent issue. A single match-derived acceptance boolean is fine; do not recreate parallel direct/wrapped flags. This remains a derivation from existing AST input, with no stored state or new state transition. Keep classification local to this arm; no generic grammar framework or shared classifier is justified.

# Full grammar and shared-helper contract

- `isHtmlTag` filters direct elements at1743-1752. `elementTags` and `sequenceTags` at1753-1754 exclude non-HTML nodes and remove script/template via `isScriptSupporting` at1651. Preserve these shared projections for every other grammar branch.
- `descriptionGroupSequence` (1732) accepts exactly one `dt+ dd+` group; `descriptionGroupsSequence` (1733) accepts one or more groups. Their helper wrappers at1779-1782 are pure, non-global regex tests. Do not replace singular with plural inside each wrapper: `[dt,dd,dt,dd]` is valid directly but invalid inside one div.
- `childrenOf`, imported from `internal/conformance/Html.conformance-contracts.ts:254-255`, returns an absent children field as an empty array. Preserve it rather than reading children unsafely. An empty div remains invalid.
- Nested comments and HTML ASCII whitespace are ignored. Nested script/template are excluded from the group sequence and allowed by the nested predicate. Nested significant text, foreign nodes or any non-script HTML element other than dt/dd reject wrapped grammar (1814-1823).
- `stripHtmlAsciiWhitespace` is the exact HTML ASCII boundary (Html.attributes.ts:1234). NBSP is significant. Do not replace it with broad trim or parser normalization.
- Top-level foreign nodes are absent from `sequenceTags`; they do not independently add a dl order issue. Their content-model issue remains the responsibility of `inspectChildModel` (1702-1710). Top-level significant text, unlike foreign nodes, independently adds the dl order issue. Therefore grammar `empty` does not mean a childless or conformant AST: script-only, comment/whitespace-only, foreign-only, and text-only sequences can all have empty element grammar.
- The `contextual-div` arm at1830-1833 shares the singular helper. It checks the nearest ancestor is dl and emits its own issue if its direct filtered tags do not form one group or if significant text exists. Keep this arm and its message unchanged. In particular it does not itself test nested foreign content; a valid dt/dd group plus foreign child produces a div content-model issue, while the containing dl wrapped predicate separately produces a dl order issue.
- Generated dl metadata (`Html.meta.ts:2605-2616`) permits dt, dd, div and script-supporting elements and selects description-list grammar. Contextual div content tokens at1626-1633 narrow to dt/dd/script-supporting under dl. Do not edit generated metadata, AST models, parser/browser behavior or serializers.

# Migration inventory

1. `Html.conformance.ts:13,1732-1733`: add the shared LiteralKit import and private description grammar owner. Other simultaneous select/datalist proposals may add the same import; integrate once.
2. `Html.conformance.ts:1797-1829`: replace the two boolean bindings and their acceptance OR with the single ordered literal derivation and literal consumption. Only this grammar arm changes behavior representation.
3. `Html.conformance.ts:1651,1743-1765,1779-1782`: reuse existing shared filtering, whitespace and regex helpers unchanged.
4. `Html.conformance.ts:1830-1833`: preserve the contextual-div reader of `isDescriptionGroup` unchanged.
5. `Html.conformance.ts:2174-2181`: preserve child-model-before-element-order and parent-before-descendant concatenation, including all existing duplicate diagnostics and paths.
6. `test/Html.conformance-hardening.test.ts:530-541`: retain current lone-dd/empty-wrapper rejection and direct acceptance fixtures; add exact diagnostics as below.
7. `test/Html.coverage-matrix.test.ts:121-152`: retain wrapped script/comment/whitespace acceptance and nested foreign/text/span rejection; strengthen assertions from presence of any rule to full ordered issues.
8. Package public routes (`src/index.ts:69,90`, `src/Html.ts:7,47`, package manifest exports) expose conformance operations, not these local booleans or the private proposed kit. No exported API consumer needs migration.

The local declarations have no other writes or readers. Other element-order grammar branches and orthogonal table-reference logic remain outside this owner.

# Guard-deletion accounting

| Current code | Accounting |
| --- | --- |
| direct binding1798 and wrapped binding1799-1825 | Delete the parallel boolean representation; compute a single literal instead. |
| `direct || wrapped` in1826 | Delete the reader's reconstruction of mutually exclusive alternatives; consume the derived literal. |
| Separate `sequenceTags.length === 0` acceptance arm1826 | Remove it from the reader and represent it as the empty variant. The classifier still needs an emptiness decision; do not claim that all length checks disappear. |
| `sequenceTags.length > 0` wrapped guard1800 | Delete as redundant once the ordered empty classification has returned. |
| invalidNested, singular/plural regex tests, text veto | Retain: these validate real grammar facts, not coherence of the old pair. |
| contextual-div check1831 and content-model checks | Retain with their own diagnostic responsibilities. |

No comment-only invariant or input validation is falsely counted as deleted. The ordered classifier changes pure evaluation short-circuiting (wrapped checks need not run after direct succeeds), but all called predicates are pure and have no failure effect; no error ordering is changed.

# Encoded-side impact

None to public encodings. The classifier is private pure logic. Preserve public AST schemas, `HtmlConformanceIssue` encoding, report array order, rule/path/message, conformance proof behavior, accepted grammar and serialized HTML. Do not add a compatibility codec, export or generated-file update.

Every rejected dl branch still emits:

- path: the existing parent path;
- rule: `elementOrder`;
- message: `<dl> children must be complete dt+ / dd+ groups, directly or in <div> wrappers`.

The contextual-div message remains `A <div> child of <dl> must contain one complete dt+ / dd+ group`.

# Diagnostic ordering and source probes

`inspectChild` builds all local issues first, with content model at2174 followed by element order at2175, then appends descendants at2177-2181. Do not fuse wrapped validation with recursive inspection or suppress a child error after the parent reports it.

A direct live-source probe of public `inspectConformance` ran **19 selected AST fixtures** on this source, exit0. This is sample behavior evidence, not exhaustive AST enumeration, not a proposed implementation test, and not package verification. Exact fixture/result summary is in the private audit. Notable results:

| Fixture | Ordered issue result |
| --- | --- |
| direct two groups | no issues |
| one wrapper containing two groups | parent dl order, then child div order |
| two wrappers each containing one group | no issues |
| foreign-only dl | foreign child contentModel only |
| direct dt/dd plus foreign | foreign child contentModel only |
| wrapper dt/dd plus foreign | parent dl order, then nested foreign contentModel; no div order |
| wrapper dt/dd plus significant text | parent dl order, nested text contentModel, then div order |
| top-level significant text or NBSP | child contentModel, then parent dl order |

These differences are explicit compatibility requirements rather than opportunities for grammar cleanup.

# Test impact

Use existing package alias imports in tests; do not export private classifier state just for tests. Extend the two named suites with empty and script/template-only cases; one and multiple direct groups; one and multiple valid wrappers; multiple groups within one wrapper; mixed direct/wrapped; lone dt/dd, empty/non-div wrappers; comments and ASCII whitespace; NBSP and ordinary significant text; top-level and nested foreign content; nested non-dt/dd HTML elements. Assert exact issue paths, messages and array order at both root and nested dl locations.

For stronger P4 assurance, compare pre/post issue arrays over a bounded generated AST matrix and state its precise depth/length/alphabet limits. Such a finite matrix still does not prove all ASTs; the mutual-exclusion argument above is the complete predicate proof for the boolean pair. Existing browser parser-restructuring coverage is orthogonal; this change neither parses HTML source nor changes DOM gestures, and needs no new browser-QA milestone.

Run the focused conformance suites and full `bun run beep quality package-verify @beep/html` after implementation, followed by the applicable campaign/Yeet gates. Do not introduce an unsolicited changeset in this P2 task; apply the repository's publication policy at implementation time. No package verification or proposed-source tests ran in this audit.

# Risk and sequencing

Retain Tier 1C and integrate alongside select/datalist work in the shared file, deduplicating only the LiteralKit import. Separate private kits are appropriate; no shared abstraction is needed. Preserve emptiness as a separate semantic state, direct multi-group versus singular wrapped-group behavior, top-level foreign/text asymmetry and duplicate parent/child diagnostics. Independent P3/GATE 2 remains required before implementation.
