# Instance

- id: `html-datalist-child-grammar`
- disposition: source-proven candidate; provisional P2 design only
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus origin/main: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:1888`
- owner: `inspectElementOrder.datalist`, the datalist Match callback
- members: `optionMode`, `mixed`; kind sibling-state
- evidence: E4 at `Html.conformance.ts:1889-1899`, mixed implies optionMode
- cardinality: 4 representable / 3 legal; derived / internal / LiteralKit / Tier 1
- independent candidate: `sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-foundation-modeling-rest.jsonl`
- source audit: `design-refresh-2026-09-09-r28-modeling-carriers.md`

No canonical admission, status update, current-design edit, implementation, or
independent P3 acceptance is performed by this provisional document. Source
paths below are relative to `packages/foundation/modeling/html/src/`.

# Current shape

`inspectElementOrder` derives HTML element tags from direct children, removes
script/template tags for sequenceTags (`Html.conformance.ts:1736-1747`), and
selects the parent's generated childGrammar at `:1777`. Its datalist callback
at `:1887-1903` computes optionMode from the presence of an option tag, then
computes mixed by short-circuiting that Boolean with a scan of the original
children. Only mixed controls the one elementOrder issue.

The mixed-content predicate recognizes direct foreign children, direct text
with a string value containing non-HTML-ASCII-whitespace, and direct HTML
elements other than option/script/template. Comments and ASCII whitespace do
not trigger it. Descendant text inside an option is not direct mixed text.
`isScriptSupporting` at `:1644` includes exactly script and template.

Both flags are derived together within this callback. The outer
significantText local at `:1754` serves other grammar callbacks and is not a
third locally stored datalist field; keep it for those readers. Required child
arrays, sequence arrays, paths, tag values, and string payloads are not invented
Boolean axes. Do not combine locals from the other grammar callbacks into a
single cross-owner census row.

# Cardinality gap

| optionMode | mixed | This order check's disposition | Concrete input |
| --- | --- | --- | --- |
| false | false | without-options | Empty datalist, or direct phrasing content without option |
| true | false | option-content | Option children, with permitted comments/whitespace/script/template |
| true | true | mixed-content | Option plus direct significant text, foreign node, or another HTML element |
| false | true | Impossible | The mixed assignment short-circuits when optionMode is false |

Four Boolean tuples admit exactly three computed states. This is E4 even
though the state is transient: the old D1 note itself describes mixed as an
AND-alias of optionMode, which disproves independence. All three reachable
states have explicit input witnesses in the existing datalist test fixtures.

"Without-options" intentionally does not claim global phrasing validity.
A div-only or foreign-only datalist can fail a different child-model rule while
this order check returns no issue. Keep that separation and all supported
invalid-tree diagnostics. Do not rename this state to "valid" or add content
repair, filtering, or parsing.

# Target schema

Add one private annotated LiteralKit and a private pure classifier in the
existing authored `Html.conformance.ts`. No generated model or metadata edit
is needed. No existing datalist-specific result literal was found; generated
HtmlChildGrammar selects which validator to execute and is a different domain.

The following is the intended shape, using existing A, Str, HtmlTag,
HtmlChildView, isString, isHtmlTag, isScriptSupporting, whitespace helper, and
identity composer. Add LiteralKit beside the existing SchemaUtils import.

```ts
const DatalistChildGrammar = LiteralKit([
  "without-options",
  "option-content",
  "mixed-content",
]).pipe(
  $I.annoteSchema("DatalistChildGrammar", {
    description: "Derived option-content disposition for one datalist order check.",
  })
);

const classifyDatalistChildren = (
  children: ReadonlyArray<HtmlChildView>,
  sequenceTags: ReadonlyArray<HtmlTag>
): typeof DatalistChildGrammar.Type => {
  if (!A.contains(sequenceTags, "option")) {
    return DatalistChildGrammar.Enum["without-options"];
  }
  return A.some(
    children,
    (child) =>
      child._tag === "#foreign" ||
      (child._tag === "#text" &&
        isString(child.value) &&
        Str.isNonEmpty(stripHtmlAsciiWhitespace(child.value))) ||
      (isHtmlTag(child._tag) && child._tag !== "option" && !isScriptSupporting(child._tag))
  )
    ? DatalistChildGrammar.Enum["mixed-content"]
    : DatalistChildGrammar.Enum["option-content"];
};
```

The datalist callback computes this one literal and tests the kit's generated
`is["mixed-content"]` guard before returning the existing issue/empty array.
Use the existing issue closure so path, rule, and message stay identical. The
classifier consumes source values directly and allocates no stored state,
class payload, cache, Option wrapper, or Boolean compatibility alias. LiteralKit
Enum/is behavior is verified in live `@beep/schema` LiteralKit source.

# Migration inventory

| Current writer/reader/boundary | Required change or preservation |
| --- | --- |
| `Html.conformance.ts:13`, `:81` | Reuse schema import and identity composer for the private literal owner; no public export or new role file. |
| `Html.conformance.ts:1887-1903` | Replace the only optionMode/mixed writes and mixed reader with one derived classification and generated guard. |
| `Html.conformance.ts:1736-1757`, `:1644` | Preserve original child/tag preprocessing and other grammar readers. Do not substitute significantChildren for the original children scan or trim using general Unicode whitespace. |
| `Html.conformance.ts:1761`; contracts `:189-213` | Retain makeIssue(path, elementOrder, exact message), issue field order, full path array, and issue schema. |
| `Html.conformance.ts:2153-2175` | Preserve child-model validation before order validation, then descendant traversal; mixed grammar must not suppress other issues or reorder them. |
| `Html.conformance.ts:2194-2236`, `:2260-2270` | Keep inspectConformance root handling and conform's supplied-tree plus detached-snapshot checks and typed error conversion. |
| `Html.ts:15-16`, `:44-52`; `index.ts:76-91`; package exports | Keep Html.Conformant.decode/issues and direct public functions unchanged. The new literal remains private. |
| `Html.policy.ts:808`, `:893`; `Html.serialize.ts:636-654` | Preserve policy's conformance proof consumption, serializeConformant, and safe-AST conformance revalidation. They never receive the local grammar value. |
| `test/Html.coverage-matrix.test.ts:154-177` | Extend actual datalist mixed/option-plus-comment witnesses with the full matrix below. |
| `test/Html.conformance-hardening.test.ts:663-665`, `:1212-1234` | Preserve mixed-text error and empty-datalist no-order-error fixtures, then assert exact nested path/order and conform failure behavior. |

The only direct reader of the pair is the callback's return at :1900. Graft
traced inspectElementOrder through inspectChild, foreign-child recursion, and
inspectConformance to the public facade/tests and serialization/policy imports;
focused source reads verified those boundaries rather than treating missing
graph edges as proof of absence. No downstream API accepts the two flags.

`Html.model.ts:2139-2146` already requires Datalist.children through HtmlChildren
(an array at :90-92) and its tag is schema-owned. Empty children are explicit,
not a new default. Option's attributes at :6043-6047 keep their None defaults;
its children at :6048 stay required. These generated construction and encoded
contracts remain unchanged. Broad AST construction is intentional; conformance
reports contextual errors afterward. Do not narrow that public input boundary.

# Guard-deletion accounting

- Delete the two local Boolean projections optionMode and mixed.
- Delete the convention that readers trust mixed implies optionMode, and the
  mixed Boolean reader at :1900. One schema-derived literal carries the three
  reachable dispositions, tested with the generated mixed-content guard.
- Preserve the actual option-presence boundary test, short-circuiting, and
  mixed-content predicate inside classification. They inspect the AST and
  cannot be removed by a schema for a computed result.
- Preserve isScriptSupporting, child-model checks, path tracking, snapshot
  validation, and other grammar cases. No broad validation-guard deletion is
  claimed; the gain is removing the correlated local representation.

# Encoded-side impact

None for this derived private value. Never add a grammar field to Datalist,
HtmlElementMeta, HtmlConformanceIssue, an opaque proof, or serialized HTML.
The public observable contract still includes exact issue path/rule/message,
issue array ordering, the typed HtmlConformanceError, and conformance-gated
serialization. Those behaviors must remain byte/value compatible even though
this local literal itself has no encoded boundary. No codec, public enum,
version bump, metadata generator run, or persisted migration is required.

# Test impact

Use the existing public conformance entry points and typed model fixtures:

1. Empty, direct text-only, and phrasing-element-only datalists return no
   datalist order issue. A non-phrasing-only example may retain a child-model
   error; assert this order check does not upgrade it to globally valid.
2. Option-only and option plus comment/ASCII whitespace/script/template keep no
   order issue. Text within option descendants is not direct mixed content.
3. Option plus significant direct text, foreign content, span, or another HTML
   element produces the exact existing message and rule. Preserve non-ASCII
   whitespace treatment according to stripHtmlAsciiWhitespace.
4. Assert nested child paths and relative issue ordering when child-model,
   element-order, and descendant issues coexist. Conform must still fail on
   the same invalid trees; valid trees must still serialize identically.
5. Retain the current empty/default-construction and mixed fixtures and broad
   model encoding behavior. Do not export the private classifier solely for a
   truth-table test, change generated constructors, or add tests mirroring its
   implementation without checking public behavior.

Future implementation validation uses focused HTML conformance tests and full
`@beep/html` package verification. No product tests/package commands ran for
this provisional source-only design.

# Risk

Tier 1 internal/derived change. The main risks are treating without-options as
all-conformance-valid, changing which direct children are significant, moving
issue order, or narrowing the broad AST constructor. Keep script/template,
foreign nodes, comments, whitespace, payloads, and array order exact. Coordinate
with existing description-list/select/responsive designs in this file, without
expanding their canonical rows here. Independent exact-source P3 and parent
admission are still required; this provisional file is not an acceptance receipt.
