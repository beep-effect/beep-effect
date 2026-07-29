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
- `HtmlDocument` and `HtmlFragment` are the canonical root names.
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
signed integer `li/value` attribute.

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
serialization losslessly preserves valid foreign-element attributes, including
active ones; the safe policy rejects all foreign SVG/MathML instead of silently
rewriting it. Element attributes named `content`, `name`, or `value` remain
attributes; only node-kind-specific structural fields are excluded.

## Conservative safe-output policy

The safe policy is deny-by-default:

- active content, forms, embedded documents, media, foreign SVG/MathML, obsolete
  elements, `style`, event handlers, `srcdoc`, `data-*`, and unknown attributes
  are rejected;
- links accept relative/fragment, `https`, `mailto`, and `tel` destinations;
- image sources accept only relative/fragment and `https` destinations;
- protocol-relative and backslash-containing destinations are rejected;
- `target="_blank"` requires both `noopener` and `noreferrer`;
- only a small structural global-attribute and ARIA subset is accepted.

This is validation, not repair. `inspectSafeHtml` returns all policy issues;
`enforceSafeHtml` fails with `HtmlPolicyError`.

## Conformance

`inspectConformance` checks generated content metadata, transparent ancestor
contexts, document doctype/root ordering, element-specific ordering,
foreign-content integration, obsolete elements, forbidden descendants, and
cross-attribute relationships. `conform` issues the opaque proof only when no
issues remain. Generated sequence metadata enforces the table grammar
`caption?`, `colgroup*`, `thead?`, either `tbody*` or `tr+`, then `tfoot?`.

The model still cannot replace the WHATWG tree-construction algorithm. It
validates an already-built AST and does not imply that arbitrary source text
would parse into the same tree. Opaque foreign roots may contain character
data, comments, and same-namespace foreign children; HTML descendants and
namespace switches are rejected until their exact integration points are
modeled. Because `<noscript>` has a scripting-state- and document-context-
dependent content model, the generic conformance API conservatively rejects it
until that context is modeled explicitly.

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
classification, lacks an explicit content-model source, or an encountered
non-global attribute has no explicit literal, token, numeric, boolean, or
string classification. Element-qualified attribute overrides and constrained
child-sequence patterns live in the same generator-owned classification data.

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
