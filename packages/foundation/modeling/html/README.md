# @beep/html

`@beep/html` is the schema-first HTML document model. It provides a generated,
exhaustive HTML AST; pure conformance and browser-output policy checks; and a
canonical serializer with explicit trust provenance.

It is not an HTML parser or sanitizer. Arbitrary HTML source must be parsed and
sanitized by a conforming external implementation before it is converted into
this AST. This package intentionally has no parser or sanitizer runtime
dependency.

## Model

The pinned WHATWG/webref data generates every conforming and obsolete HTML
element, its element-specific attributes, typed attribute microsyntaxes,
content metadata, and exact tag unions.

- `HtmlChildNode` is any element/fragment child.
- `HtmlDocumentChild` is a comment or the `html` document element.
- `HtmlDocument` directly enforces `HtmlDocumentChild`; the generated
  `Document` remains broad for lossless decoding and diagnostics.
- `HtmlFragment` is the canonical fragment root name.
- `HtmlRoot` covers document, fragment, element, text, comment, and foreign
  roots.
- `HtmlNode` additionally includes standalone doctype nodes.

Use the root contract for boundaries. Import the complete generated catalog
from `@beep/html/Html.model`, for example:

```ts
import { Div, P } from "@beep/html/Html.model"
import { Text } from "@beep/html/Html.nodes"

const tree = Div.make({
  children: [
    P.make({ children: [Text.make({ value: "Hello" })] })
  ]
})
```

All nullable/optional wire fields decode to `Option`; encoding restores optional
wire keys. Boolean attributes accept only presence forms (`true` or `""`).
Integer and token-list attributes use their HTML microsyntaxes rather than a
broad string fallback; element-qualified overrides cover domains such as the
signed integer `li/value` attribute. Encoded enumerated keywords are matched
ASCII-case-insensitively and decode to canonical semantic values; direct
construction accepts only that fixed point. The case-distinguishing `ol/type`
domain is explicitly modeled as a non-enumerated exception.

## Proof and serialization pipeline

The trust boundary is deliberately staged:

```text
HtmlRoot
  -> conform
ConformantHtmlNode
  -> enforceSafeHtml
SafeHtmlNode
  -> serializeSafe
SafeHtml
  -> safeHtmlValue (only at the final browser/framework sink)
```

```ts
import {
  conform,
  enforceSafeHtml,
  HtmlFragment,
  safeHtmlValue,
  serializeSafe
} from "@beep/html"
import { P } from "@beep/html/Html.model"
import { Text } from "@beep/html/Html.nodes"
import { Effect } from "effect"

const root = HtmlFragment.make({
  children: [
    P.make({ children: [Text.make({ value: "Hello <world>" })] })
  ]
})

const program = conform(root).pipe(
  Effect.flatMap(enforceSafeHtml),
  Effect.flatMap(serializeSafe),
  Effect.map(safeHtmlValue)
)
```

The root `Html` facade exposes the same first two stages as
`Html.Conformant.decode/issues` and `Html.Safe.decode/issues`. The short
functions remain first-class exports for pipelines; the facade makes admission
and issue inspection discoverable without flattening the two trust decisions.

`ConformantHtmlNode`, `SafeHtmlNode`, and `SafeHtml` are runtime-issued opaque
proofs. Structural copies, prototype forgeries, spreads, and JSON
reconstruction do not satisfy their schemas. Conformance issuance stores a
detached, recursively frozen schema snapshot rather than the caller's mutable
AST. `serializeSafe` rechecks conformance and policy immediately before issuing
the final string, closing mutation and time-of-check/time-of-use gaps.

`serialize` and `serializeConformant` return `UntrustedHtml`. Canonical escaping
does not imply a safe browser-insertion policy. In particular, ordinary
serialization preserves browser-fixed foreign-element attributes, including
active ones; names that the HTML parser would lowercase or adjust are rejected
instead of silently changing the modeled tree. Contextual foreign-content
breakouts and the exact SVG/MathML HTML integration points are validated at
each opaque child boundary. The safe policy rejects all foreign SVG/MathML.
Element attributes named `content`, `name`, or `value` remain attributes; only
node-kind-specific structural fields are excluded.

## Conservative safe-output policy

The safe policy is deny-by-default:

- active content, forms, embedded documents, media, foreign SVG/MathML, obsolete
  elements, `style`, event handlers, `srcdoc`, `data-*`, and unknown attributes
  are rejected;
- links accept relative/fragment, `https`, `mailto`, and `tel` destinations;
- image sources accept only relative/fragment and `https` destinations;
- protocol-relative and backslash-containing destinations are rejected;
- `target` is limited to `_self`, or `_blank` with both `noopener` and
  `noreferrer`; named and parent/top browsing targets are rejected;
- structural and conformant `rel` syntax remains open because WHATWG delegates
  extension registration to a mutable external registry that this offline model
  does not certify; SafeHtml intentionally permits only `nofollow`, `noopener`,
  and `noreferrer` on anchors;
- only a small structural global-attribute and ARIA subset is accepted.

This is validation, not repair. `inspectSafeHtml` returns all policy issues;
`enforceSafeHtml` fails with `HtmlPolicyError`.

## Conformance

`inspectConformance` checks generated content metadata, transparent ancestor
contexts, document doctype/root ordering, element-specific ordering,
foreign-content integration, obsolete elements, forbidden descendants, and
cross-attribute relationships. It also rejects obsolete or misplaced
attributes from exact generated per-element inventories and evaluates
attribute-conditional categories such as interactive anchors and media.
`conform` issues the opaque proof only when no issues remain. Generated grammar
profiles cover cardinality, ordering, alternatives, and attribute-conditional
branches for document/head, description lists, disclosure/fieldset/figure,
colgroups, media/picture, ruby, datalist/select, hgroup, and tables.
Reviewed descendant exclusions, permitted-ancestor sets, named-ancestor
accessible-name conditions, and document-visible cardinality limits live only
in `data/overrides/classification.json`; generation validates their complete
tag/category/attribute coverage and publishes them on each element's
`ELEMENT_META[tag].rules` profile.

Responsive-image conformance validates `srcset`, source-size lists, descriptor
pairing, lazy `auto` eligibility, and the `<picture>` source/following-image
relationship at exact attribute paths. `link[sizes]` remains the distinct icon
sizes grammar; it is never interpreted as `imagesizes`. The exact specialized
microsyntax inventory is generated as `HTML_ATTRIBUTE_SYNTAXES`.

Generated cross-attribute rules also require `srclang` when a `track` uses
`kind="subtitles"`; missing singleton attributes are reported at their exact
attribute path.

The model still cannot replace the WHATWG tree-construction algorithm. It
validates an already-built AST and does not imply that arbitrary source text
would parse into the same tree. Opaque foreign roots admit HTML descendants
only at the modeled SVG/MathML integration points. Same-namespace children
that trigger HTML breakout, and namespace changes outside exact `svg`/`math`
re-entry, are rejected. Because `<noscript>` has a scripting-state- and
document-context-dependent content model, the generic conformance API
conservatively rejects it until that context is modeled explicitly.

## Generation

The generated files are committed:

- `src/Html.model.ts`
- `src/Html.meta.ts`

Run:

```sh
bun run generate
bun run generate:check
```

Generation fails when an element lacks exactly one text/void/normal
classification, lacks an explicit content-model source, has an unexplained
pinned/webref attribute gap, or an encountered non-global attribute has no
explicit literal, token, numeric, boolean, or string classification. Exact
current/obsolete inventories, special child grammars, conditional categories,
browser foreign-name adjustment profiles, and specialized attribute
microsyntaxes live in the same generator-owned classification data. Generation
fails if a current `srcset`, source-size, or icon-size attribute is absent from
that exact registry.

## Package entry points

- `@beep/html` — stable boundary API and namespace views
- `@beep/html/Html.model` — complete generated element catalog
- `@beep/html/Html.attributes` — attribute schemas and field bundles
- `@beep/html/Html.meta` — exact generated metadata registries
- `@beep/html/Html.nodes` — text, comment, and doctype nodes
- `@beep/html/Html.contract` — canonical role aliases
- `@beep/html/Html.conformance` — conformance issues and proof
- `@beep/html/Html.policy` — safe-output policy issues and proof
- `@beep/html/Html.serialize` — canonical serializers and output types
