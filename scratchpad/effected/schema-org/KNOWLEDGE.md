# schema-org — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/schema-org/CLAUDE.md -->
# @effected/schema-org

schema.org vocabulary as Effect Schema classes, a `JsonLdDocument` that assembles them into one JSON-LD document, a script-safe serializer, and offline conformance validation against the vendored vocabulary.

**Pure tier:** `dependencies: {}`, peer-depends on `effect` only, no IO, `"sideEffects": false`. The vendored vocabulary is a compiled TypeScript literal, never a file read — if validation ever needed to *fetch* the vocabulary this would become a boundary package. Never add a filesystem, network or clock dependency.

**Design docs:**

- `@./okf/modules/schema-org.md` — load before changing the `.` entrypoint: the node vocabulary, `JsonLdDocument`, node identity or the serializer.
- `@./okf/interfaces/schema-org-validate.md` — load before changing the `./validate` entrypoint: `Conformance`, `Vocabulary`, the interned table, the committed data file or the generator.

## The one invariant

**Every string in a graph originates in author-written TSDoc, and `JSON.stringify` does not escape `<`.** A description containing the literal `</script>` closes the JSON-LD block early and injects markup. `JsonLdDocument.toScriptBody()` escapes `<`, `>` and `&` after stringify; there is deliberately **no unescaped text serializer**, because the escaped form is semantically identical to every parser and a second entry point could only be chosen wrongly.

`toJsonLd()` returns the wire *value* and carries the loudest TSDoc in the package: **never `JSON.stringify` it into a page.** It exists because `Schema.encode(JsonLdDocument)` is public regardless, so naming it is the only way to attach the warning.

The `__test__/serializer.test.ts` fixture is mandatory and includes a **positive control** asserting `JSON.stringify` of the same graph *does* contain `</script>`. Without it the escaping assertions pass against an empty graph or a stubbed serializer.

## Two entrypoints

- `.` — node classes, `NodeRef`, `JsonLdDocument`. Loads no vocabulary data.
- `./validate` (`src/conformance-entry.ts`) — `Vocabulary`, `Conformance`, and the only path reaching `src/internal/vocabulary.ts` (~73 KB).

`__test__/entrypoints.test.ts` asserts the boundary structurally, with a positive control — review cannot enforce it, since one convenience import would silently undo it and nothing would fail.

**A subpath export key must not differ from a module name only in case.** `"./conformance"` + `src/Conformance.ts` emits `Conformance.d.ts` and `conformance2.d.ts`, and API Extractor's entry `conformance.d.ts` resolves case-insensitively onto the *module*, producing a CI-fatal `ae-forgotten-export` for `JsonLdDocument`. The subpath is `./validate` for that reason. The same collision at the source layer is a TS1149 error, which is why the entry file is `conformance-entry.ts` rather than `conformance.ts`.

## Conventions and gotchas

- **`Schema.optional`, not `Schema.optionalKey` — a scoped exception, not a kit-wide precedent.** Every field originates in a possibly-absent TSDoc tag, so `optionalKey` would make every call site a wall of conditional spreads. Explicit `undefined` is legal and the key is dropped at serialization, which is required anyway: JSON-LD has no undefined and no meaningful null.
- **No schema inheritance.** `APIReference` does not extend `TechArticle`. The `rdfs:subClassOf` chain lives in the vendored vocabulary — the thing the validator reads — and duplicating it in TypeScript would give two sources of truth. Shared fields are spread from the `@public` records `ThingFields`, `CreativeWorkFields`, `TechArticleFields`.
- **One arity per property, always the wire shape.** No `T | ReadonlyArray<T>` anywhere. A repeatable property is always an array, even at length one, which is identical to a scalar in the JSON-LD data model. Where arity is uncertain the choice is **many**, because the error costs are asymmetric: wrong toward many costs one pair of brackets, wrong toward one costs a breaking change. `mainEntity` is singular **by schema.org's own definition** — that collapse is not ours to revisit.
- **Node-valued properties hold a `NodeRef`, never an embedded node.** The package declines the inline form at the type level rather than silently flattening one representation into the other.
- **`additional` is the catch-all and the reason the validator is not tautological.** Typed fields are correct by construction; the catch-all is the one door an undefined-on-this-type property can enter through. It is flattened into the node at serialization — a key colliding with a typed field, `@id` or `@type` fails at `JsonLdDocument.buildResult`.
- **Identity is validated at graph assembly, not node construction.** `NodeRef.to` and every `make` are total; `JsonLdDocument.buildResult` raises `InvalidNodeIdError`, `DuplicateNodeIdError` and `ConflictingTermError` on the `E` channel. The `@id` rule is deliberately loose (non-empty, no whitespace, no control characters) because absolute IRIs, `_:blank` and fragments are all legal.
- **A dangling reference is not an error** — it is how a node points at something described on another page. `JsonLdDocument.danglingReferences` reports them so a closed-world consumer can gate; the package refuses to decide whether your graph is closed.
- **The decode direction is declared unimplemented.** Decoding the wire form **succeeds and silently drops the catch-all**, because a flattened term is an excess key — a half-working round trip, which is worse than a failing one. `__test__/JsonLdDocument.test.ts` pins that asymmetry so it cannot start half-working by accident.
- **The `./validate` side has its own rules** — the interned table's comma-joined index rows, the generator at `lib/scripts/generate-data.ts` over the committed `lib/data/schemaorg-current-https.jsonld` (v30.0, replaced and regenerated in the same commit), and the three-way resolution of prefixed terms. Read the conformance design doc before touching any of them.
- `package.json` stays `"private": true`. The bundler emits the publishable manifest.

## Test and build

```bash
pnpm vitest run packages/schema-org        # this package's tests
pnpm build --filter @effected/schema-org   # dev + prod, from the repo root
```

Tests live in `__test__/`, use `@effect/vitest`, and assert with `assert.*` — **never `expect`**.

Never run `node savvy.build.ts --target prod` directly: it skips `build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` shaped exactly like a clean gate. A clean build log does not prove a build ran either — a turbo cache hit replays the previous output, so check `dist/prod/issues.json`'s `generatedAt` postdates your last edit.

Inline class factories synthesize `_base` heritage symbols; `savvy.build.ts` suppresses `ae-forgotten-export` narrowly on that pattern. Never widen it — an internal type named on a `@public` signature is genuine surface and must be exported or inlined.


---
<!-- okf/modules/schema-org.md -->
---
type: Module
title: "@effected/schema-org"
description: The schema.org vocabulary as pure Effect Schema classes, a JsonLdDocument graph assembler with a script-safe serializer, and offline conformance validation over the vendored vocabulary.
status: stable
kind: package
resource: ../../packages/schema-org
tags: [architecture, bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 2142a75997af3fbcf289f8cbf5486d38277d857f143fc5cdbcc02fcc87b5f3e9
---

# @effected/schema-org

`@effected/schema-org` is the schema.org vocabulary as Effect Schema
classes, a `JsonLdDocument` that assembles them into one JSON-LD document
with `@id` cross-references, a single script-safe serializer and an
offline conformance validator over schema.org's own released vocabulary.
All pure.

It follows [`@effected/spdx`](spdx.md)'s shape: a validated vocabulary plus
a small algebra over it, the dataset vendored as generated TypeScript, and
the mapping onto any particular domain left to the consumer. `spdx` knows
what `Apache-2.0 WITH LLVM-exception` means and nothing about
`package.json`; this package knows what a `TechArticle` is and nothing
about TypeScript.

The package exists because tsdoctor — see [the tsdoctor
consumer](../consumers/tsdoctor.md) — derives JSON-LD for a documented
TypeScript package. The vocabulary half of that work is domain-neutral, so
it lives upstream; tsdoctor holds exactly one thing: API model + manifest →
these nodes.

The central invariant is not the vocabulary. It is [the
serializer](#the-serializer-is-the-invariant): every string in a graph
originates in author-written TSDoc, and a summary containing the literal
`</script>` closes the JSON-LD block early and injects markup.
`JSON.stringify` does not escape it. Everything else in this Module is a
vocabulary package; that one thing is a security boundary.

The validator, the vocabulary read API and the vendored dataset have their
own contract: [the schema-org validate interface](../interfaces/schema-org-validate.md).

## Tier and dependencies

Pure tier, per [the tier taxonomy](../glossary/library-tier.md), and the
argument is not just "no `FileSystem` import":

- **No IO, including for the vendored data.** The vocabulary is a
  TypeScript literal compiled into the bundle, not a JSON file read at
  load. The generator that produces it reads files, and it is a hand-run
  script in `lib/scripts/`, never shipped and never on any code path in
  `src/`. If validation ever needed to *fetch* the vocabulary, this would
  be a boundary package; it deliberately does not.
- **No services, no layers, no `R`.** Inputs are values and strings,
  outputs are values, typed errors and one string.
- **No external runtime dependency.** `effect` is the only peer,
  `dependencies` is `{}` and `"sideEffects": false`.

Two `@effected/*` edges are available and both are declined — see [why
schema-org declines both kit edges](../decisions/schema-org-declines-kit-edges.md).
The package ships with **zero** `@effected/*` runtime edges.

## Module layout and the two entrypoints

Module-per-concept; only entrypoints re-export.

- `src/NodeRef.ts` — `NodeId` (branded scalar), `NodeRef` (the `{"@id": …}`
  reference node), `InvalidNodeIdError`.
- `src/Thing.ts` — `ThingFields`, the shared field record every node
  spreads.
- `src/CreativeWork.ts`, `src/Person.ts`, `src/Organization.ts`,
  `src/SoftwareSourceCode.ts`, `src/TechArticle.ts`, `src/APIReference.ts`
  — one node class per module, plus that class's field record where it is
  shared.
- `src/JsonLdDocument.ts` — `JsonLdDocument`, `JsonLdNode`, the identity
  errors and the serializer.
- `src/Vocabulary.ts`, `src/Conformance.ts`, `src/internal/vocabulary.ts` —
  the validator half, covered in [the validate interface](../interfaces/schema-org-validate.md).
- `src/index.ts` — the `.` entrypoint; `src/conformance-entry.ts` — the
  `./validate` entrypoint.

**Two published entrypoints, and the split is the answer to "does a
consumer that only builds graphs pay for the validator".** `.` exports the
node classes, `NodeRef` and `JsonLdDocument`. `./validate` exports
`Vocabulary` and `Conformance`, and is the only path that reaches
`src/internal/vocabulary.ts` (roughly 73 KB as vendored). A bundler sees
through a re-export barrel, but an unbundled Node consumer importing
`TechArticle` from a single entrypoint would load the whole vocabulary
table it never reads. The subpath makes that cost zero for the common
case, and `__test__/entrypoints.test.ts` asserts the boundary with a
positive control, since review cannot enforce it. Validation is also the
build-time half of a consumer's work — a CI gate — while graph assembly
runs in the page render path; the split matches how the two are used. See
[the second-published-entrypoint decision](../decisions/second-published-entrypoint.md)
for the general rule this package instantiates, and [the bundle
reachability convention](../conventions/bundle-reachability-suite.md) for
the test shape.

`./validate` re-exports the graph types as `export type` — with exactly
one value exception, `JsonLdDocument`, which is the parameter type of every
validator entry point and which API Extractor needs declared as a class by
that entrypoint. The accepted cost, reported by the first consumer:
importing *everything* from `./validate` gets `"only refers to a type"` on
`NodeRef.to`, and the error does not point at the subpath. The README's
import example shows both entrypoints side by side for that reason.

**The subpath is `./validate`, not `./conformance`.** A subpath export key
must not differ from a concept module's name only in case — it collides at
the source layer (TS1149) and, worse, at the declaration layer, where API
Extractor resolves the emitted `conformance.d.ts` case-insensitively onto
`Conformance.d.ts` and reports a CI-fatal `ae-forgotten-export` for a
symbol the entry visibly exports. This package is where that trap bit.

**Public names clear `effect`'s root exports.** The document is
`JsonLdDocument`, its node union `JsonLdNode` and the reference `NodeRef` —
not `Graph`, `GraphNode` and `Ref`, all of which `effect` exports from its
root. The collision was not hypothetical here: the generator imports
`effect`'s `Graph` for an acyclicity assertion, so the two names met inside
this package.

## Modeling the vocabulary

schema.org is rampantly optional and rampantly polymorphic: nearly every
property is omissible, and any property may hold a literal, an embedded
node, a `{"@id"}` reference or an array mixing all three. Modeling that
faithfully produces per-property unions that typecheck everything and tell
the author nothing. Four rules narrow it, each a deliberate restriction of
what schema.org permits to what a `@graph` document actually needs.

**Every node is a `Schema.Class`; no schema inheritance.** Each node is a
flat `Schema.Class` declaring its full field set inline. `TechArticle` does
not extend `Article` extends `CreativeWork`. Reproducing schema.org's
`rdfs:subClassOf` chain as TypeScript inheritance would create a second
source of truth for a fact that already lives in the vendored dataset — the
one the validator reads — and the two would drift the first time
schema.org moves a property up a level. Shared fields are handled by
spreading a `@public` field record (`...ThingFields`, `...CreativeWorkFields`,
`...TechArticleFields`): one source of the field definitions, no heritage
chain, and each class's emitted `.d.ts` lists its own fields. `make` is the
right constructor for a node — unlike `spdx`, a node has no string form to
parse, so `make` is not competing with anything.

**Optionality: `Schema.optional`, not `Schema.optionalKey` — a scoped
exception.** This diverges from the kit's schema standard, which says
`optionalKey` for omissible fields. It is licensed by this package's
construction pattern and is explicitly not a kit-wide precedent: a package
whose fields do not originate in possibly-absent upstream metadata has no
claim on it. Under `optionalKey`, passing an explicit `undefined` throws —
so every consumer call site becomes a wall of conditional spreads, because
every field of every node originates in a possibly-absent TSDoc tag. Under
`optional`, `description: undefined` is legal and the key is dropped at
serialize time, which the serializer has to do regardless: JSON-LD has no
`undefined` and no meaningful `null`, so "omit the key" is the only correct
wire behaviour and it belongs in the one place that produces the wire
form. `@id` and `@type` are the only non-optional members of any node.

**Arity: one shape per property, always the wire shape.** A property that
schema.org permits to repeat is modeled as `ReadonlyArray<T>` and always
emitted as an array, even at length one. A single-valued property is a
scalar and always emitted as a scalar. There is no `T | ReadonlyArray<T>`
anywhere in the surface and no "collapse a one-element array" option. This
is legal rather than merely convenient: in the JSON-LD data model a value
and a one-element array of that value are the same thing, so every
conforming processor reads them identically. Where arity is genuinely
uncertain, the package chooses many, because the error costs are
asymmetric: wrong toward many costs one pair of brackets at a call site,
wrong toward one costs a breaking change. See [the arity
decision](../decisions/schema-org-property-arity-declines-collapse.md).

**References, not embedding.** A property whose value is another node is
typed as `NodeRef` — never as the node class, never as a union of the two.
The `@graph` form exists precisely so that nodes are siblings addressed by
`@id`; supporting embedding too would double the value space of every
node-valued property for zero capability and make a graph's node set
ambiguous. `NodeRef.to(node)` builds one from a node you are already
holding, so the common case is not stringly-typed. The residual cost is
accepted: a consumer who wants a genuinely nested document has to give the
nested node an `@id` and put it in the graph.

**The catch-all, and why the validator exists.** Six classes cannot cover
schema.org, so each node carries an open
`additional: Record<string, JsonValue>` whose entries are flattened into
the node's JSON object at serialize time. This is the design's spine and
what makes offline conformance validation worth shipping rather than
tautological: typed fields are correct by construction, proven once by the
self-conformance test; the catch-all is unchecked by the compiler and is
the one door a plausible-looking property that schema.org does not define
on that type can enter through. A key in `additional` that collides with a
typed field, with `@id` or with `@type` is caller error and fails at graph
construction (`ConflictingTermError`), not at validation.

## Node identity and cross-references

`@id` is required on every node. A node without one cannot be referenced or
deduplicated, and is indistinguishable from a second copy of itself. Ids
are caller-supplied; the package never derives one — an `@id` is an IRI in
the consumer's namespace, and the package has no idea what the consumer's
base URL is. A derived opaque id (a content hash) would be unlinkable from
outside and would change when an unrelated field changed, so there is no
synthesis helper.

`NodeId` is a branded string with a deliberately loose check: non-empty, no
whitespace, no control characters (spelled `\p{Cc}`, not a hand-written
range, since a hand-written C0 range silently admits the C1 block and a
`NodeId` is interpolated into a serialized document). It accepts absolute
IRIs, blank-node ids (`_:pkg`) and relative or fragment forms, because all
three are legal JSON-LD and a stricter IRI grammar would reject legal input
to catch a typo.

**A dangling reference is not an error.** A `NodeRef` pointing outside the
graph is legal, common and often correct — the referenced organization is
described on another page. `JsonLdDocument.buildResult` fails on a
duplicate `@id` and on a colliding `additional` key, and never fails on a
dangling reference: `graph.danglingReferences` exposes them, and
`Conformance` reports each as a `DanglingReference` issue, so a
closed-world consumer can gate on it and an open-world one ignores it. Hard
failure for identity errors, reported issue for openness — the package
refuses to decide whether a consumer's graph is closed.

## `JsonLdDocument`

`JsonLdDocument` is a `Schema.Class` carrying `@context` and the node list,
because the kit's named domain models are schema classes and this is the
shape to be in if JSON-LD → typed nodes ever ships. The `@context` is fixed
at `"https://schema.org"`, matching the vocabulary document vendored.

The validating constructor is `buildResult`, because `Schema.Class`
reserves `make`. Per [the sync-primitive policy](../conventions/sync-primitive-policy.md)
it is the primitive, returning
`Result<JsonLdDocument, DuplicateNodeIdError | ConflictingTermError>`, with
`JsonLdDocument.build` as its `Effect.fromResult` twin behind a span.
`JsonLdDocument.make` remains the raw structural constructor `Schema.Class`
provides — it runs none of the identity checks and is not the documented
entry point.

There is deliberately no `SchemaOrg` facade object. Collecting the
package's surface behind one binding is the kit's namespace-object ban, and
here it would be load-bearing: a single binding would make the vocabulary
dataset reachable from every importer and undo the entrypoint split.

**The decode direction is declared unimplemented, and that is a
statement, not an omission.** See [the decode-direction
limitation](../limitations/schema-org-decode-direction-unimplemented.md).

## The serializer is the invariant

The package exposes exactly one text serializer, and it is the escaped
one. `graph.toScriptBody(): string` returns the JSON-LD body,
script-embeddable, and there is no unescaped twin.

The mechanism: after `JSON.stringify`, replace every `<`, `>` and `&` with
its `\uXXXX` escape. Four properties make this the correct fix rather than
a defensive hack:

1. **It is exhaustive.** In a JSON document those characters can only occur
   inside string literals, so a blanket post-stringify replacement cannot
   corrupt structure.
2. **It is lossless.** `\uXXXX` is a valid JSON string escape; every
   conforming parser produces the original character.
3. **It makes the element unclosable from inside.** With no `<` in the
   body, neither `</script` nor `<!--` can appear.
4. **`&` is included** for documents served as XHTML, where script content
   is ordinary element content and a raw `&` is a well-formedness error.
   `U+2028`/`U+2029` are deliberately not escaped: they only matter inside
   JavaScript source, and this is never JavaScript source.

**Why there is no unsafe twin.** The escaped output is semantically
identical to the unescaped output for every consumer that parses it, and
every consumer parses it. An unsafe serializer beside a safe one would
exist only to be chosen wrongly, by the caller with the shortest deadline.

**The escape hatch that cannot be closed, and is therefore documented.**
`Schema.encode(JsonLdDocument)` is public whether the package likes it or
not, so `graph.toJsonLd()` — the plain encoded value, for a framework that
takes an object rather than a string — ships named for what it is, with the
loudest TSDoc in the package: if you are producing text, use
`toScriptBody`; never `JSON.stringify` this value into a page.

`toScriptBody` returns the body only, not a `<script>` element. Returning
an element would make this an HTML generator and drag in
attribute-escaping decisions; the README documents the wrapper.

## What the consumer must do that this package will not

- Mint `@id`s. The package never derives one and does not know your base
  URL.
- Map its domain onto nodes. No node is populated by default; there are no
  smart defaults.
- Wrap the body in a `<script>` element and place it in the document.
- Own Google eligibility. Conformance says schema.org defines the term; it
  does not say Google will show a rich result.
- Convert an SPDX id to a license URL, and a SemVer to a version string, at
  the call site — see [why schema-org declines both kit
  edges](../decisions/schema-org-declines-kit-edges.md).
- Decide whether its graph must be closed — whether a `DanglingReference`
  is a warning or a gate failure.

## Testing

`@effect/vitest`, `assert.*` and never `expect`, in `__test__/`. The
validator's corpus is described in [the validate
interface](../interfaces/schema-org-validate.md); the suites that belong to
this half:

**The escaping fixture is mandatory and needs a positive control.**
`__test__/serializer.test.ts` carries a payload that is the real attack
(`</script><img …>` inside a description) and asserts that `toScriptBody`
contains no `<`, `>` or `&` at all, that `JSON.parse` of the body returns
the original string, and — the assertion that makes the others mean
anything — that `JSON.stringify(graph.toJsonLd())` of the same graph does
contain `</script>`. Without the positive control the escaping assertions
pass against an empty graph, a stubbed serializer or a sanitized fixture.
A property test generalizes it over strings drawn from an alphabet of `<`,
`>`, `&`, controls, lone surrogates and newlines.

**The self-conformance test.** Every field of every shipped node class is
`domainIncludes`-legal on that class's `@type`, checked against the
vendored dataset. It keeps the hand-written classes honest, fails the day
someone adds a plausible-sounding field and fails again the day
schema.org moves one.

**Never pin an emitted graph as a fixture.** A snapshot of what the
serializer currently emits asserts only that it has not changed. Every
assertion in this suite is against the vendored vocabulary or against a
property (losslessness, absence of `<`, idempotence).

## Out of scope

Each is a cut with a reason, not an oversight:

- **`BreadcrumbList`** and its kin (`ListItem`, `WebSite`, `WebPage`).
  Ordered, positional structure is a different modeling problem from the
  flat nodes above and deserves its own round.
- **Parsing existing JSON-LD back into typed nodes.** No consumer needs it;
  the decode direction's non-implementation is explicit and tested.
- **Embedded node values.** Ruled out permanently, not pending.
- **`rangeIncludes` validation** and **Google rich-results policy** — see
  [the validate interface](../interfaces/schema-org-validate.md).
- **`toScriptElement`**, `@context` customization, term aliasing and
  non-JSON-LD RDF output.

## Build

Class factories written inline, with `savvy.build.ts` suppressing
`ae-forgotten-export` narrowly on the `_base` pattern — never widened. The
`@public` shared field records are genuine surface, documented as such
rather than suppressed. Two entrypoints means two `exports` keys and
`src/conformance-entry.ts` beside `src/index.ts`; everything else is the
standard pure-tier manifest.


---
<!-- okf/interfaces/schema-org-validate.md -->
---
type: Interface
title: "@effected/schema-org validate entrypoint"
description: The offline conformance validator and vocabulary read API over the vendored schema.org dataset, exposed only from the ./validate subpath.
status: stable
kind: api
resource: ../../packages/schema-org/src/conformance-entry.ts
tags: [architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: ae2a903ac75d1d3610f7f16085e14425f16dd37ab23fc7cc820e79a7183fe862
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:42.785Z
---

# @effected/schema-org validate entrypoint

The `./validate` entrypoint of [`@effected/schema-org`](../modules/schema-org.md):
`Conformance`, the offline validator; `Vocabulary`, the read API over the
vendored schema.org dataset; and the generator that produces that dataset.
It is a separate entrypoint so that a consumer that only builds graphs
never loads the vocabulary table — see [the module layout and two
entrypoints](../modules/schema-org.md#module-layout-and-the-two-entrypoints).

The gate answers one question offline: does schema.org define this
`@type`, and is every property on it `domainIncludes`-legal for that type?
That is the failure a consumer actually hits — not malformed JSON, but a
plausible property schema.org does not define on that type. The authentic
example is that `softwareVersion` is defined on `SoftwareApplication`, not
on `SoftwareSourceCode` (which spells it `version`): it reads correct,
serializes fine and is silently ignored downstream. See [the
property-not-on-type gotcha](../gotchas/schema-org-property-not-on-type-silently-ignored.md).

## How legality is resolved: five traps

A naive `domainIncludes.includes(type)` check is wrong in five separate
ways, and the first one rejects the consumer's very first graph. Each was
confirmed against the vendored document; `src/Vocabulary.ts` is the
implementation.

1. **Legality is inherited, so the check is set membership over the full
   ancestor closure.** `schema:license` carries a single `domainIncludes`
   entry, `CreativeWork`, so `license` on a `SoftwareSourceCode` is legal
   only through `SoftwareSourceCode → CreativeWork → Thing`. A gate that
   fails a correct graph gets switched off, and a switched-off gate
   protects nothing.
2. **A property may name many domains, so it is membership, not
   equality.** The check is a non-empty intersection between the
   property's domain set and the node type's ancestor closure.
3. **The hierarchy is a DAG, not a tree, so the ancestor walk is a
   cycle-guarded set union.** Dozens of classes have multiple parents; a
   parent-chain walk silently truncates the closure and produces false
   rejections indistinguishable from trap 1.
4. **Foreign parents appear on real classes, and the walk must
   tolerate-and-skip them.** A handful of native classes carry a parent
   outside the schema namespace beside a native one that carries the real
   chain. A walk that throws crashes; one that abandons the class drops a
   legitimate chain and false-rejects. It skips that branch and keeps the
   others.
5. **The vocabulary document contains foreign alignment terms, which must
   not be ingested as schema.org terms.** They carry the same `@type` as
   native terms, so the generator filters by `@id` prefix, never by
   `@type`.

**A prefixed term at validation time is resolved three ways, and two are
easy to get silently wrong** (`src/Conformance.ts` documents each):
`schema:license` is native and validates identically to `license`; a
prefix the vocabulary document's own `@context` declares (`gs1:`,
`fibo-…`) is skipped in silence, because a consumer who wrote it opted
into a vocabulary this package does not claim to validate; an undeclared
prefix (`bogus:`) is reported as unknown, because it is at least as likely
a typo. A "has a colon, skip it" rule would stop validating everything a
consumer writes in prefixed form.

## The surface

Two entry points, following the [sync-primitive
policy](../conventions/sync-primitive-policy.md):

- **`Conformance.check(graph)` — total, never fails.** Reporting is not a
  failure mode; a lint host wants a list.
- **`Conformance.validateResult(graph, options?)`** — the gate
  (`src/Conformance.ts:400`), whose `NonConformantGraphError` carries the
  full issue array. `Conformance.validate` is its `Effect.fromResult` twin
  behind a span. `validateResult` is defined in terms of `check`, so the
  two cannot drift.

`ConformanceIssue` is a tagged union of `Schema.TaggedClass` variants —
unknown term, property-not-on-type (`src/Conformance.ts:66`), the two
deprecation kinds and dangling reference — each carrying the offending
node's `@id`, its `@type` and the property name. Deprecated
(`supersededBy`) terms are valid-but-flagged, never rejected, exactly as
`@effected/spdx` treats deprecated ids.

**The outcome is three-valued, and the three are never conflated.**
*Legal*, *property-not-on-type* (a real term in the wrong place) and
*unknown term* (a term schema.org does not define at all) are distinct
answers with different fixes. Unknown terms are always reported; the
`unknownTerms: "fail"` option promotes them to a failure for a
closed-world caller. This distinction is only honest because [the table is
complete](#vendored-data-and-regeneration): under a scoped subset,
"unknown" is irreducibly ambiguous between *you misspelled it* and *we did
not ship that part*.

Issues carry no severity field. Severity is the consumer's policy, not a
fact about the graph; `validateResult` fails on the structural kinds by
default and takes `ConformanceOptions` to widen the gate for deprecations
and dangling references.

**The per-kind gate is exhaustiveness-checked with `satisfies never`, and
that is load-bearing.** A `default: return false` would silently pass any
issue kind added later — reported by `check`, ignored by every gate, CI
green. Adding an issue kind without deciding its gate behaviour is a
compile error instead.

`Vocabulary` is the same data as a read API — `hasType`, `isPropertyOn`,
`propertiesOf`, `ancestorsOf`, `supersededBy`, `version` — exported because
a consumer building a different algebra over schema.org should not have to
re-vendor the dataset, and because the package's own tests read it. It is
a static class.

### What conformance is not

schema.org conformance is not Google rich-results eligibility. Google
requires properties schema.org does not, forbids nothing schema.org
allows and changes its policy on its own schedule. A Google-policy checker
is a different artifact with a different cadence and does not belong in a
pure vocabulary package; the README says so, because a consumer's CI gate
will otherwise be read as a Google gate.

`rangeIncludes` is not validated either, deliberately: a range check needs
the value's schema.org type, and a literal's type is ambiguous
(`"2026-01-01"` is `Text`, `Date` and arguably `URL`-adjacent), so range
checking produces false positives on correct input. Domain checking is the
high-signal half. `rangeIncludes` data is therefore not shipped — it is
used only to justify the full table below, never carried at runtime.

## Vendored data and regeneration

`lib/data/schemaorg-current-https.jsonld` is schema.org's published
`-current` release document, committed into this package; the release it
carries is recorded as `Vocabulary.version`. Full provenance, what derives
from it and what breaks if it falls out of sync are in [the vocabulary data
model](../models/schema-org-vocabulary-data.md); the regeneration procedure
is [its own runbook](../runbooks/regenerate-schema-org-vocabulary.md).

### What ships: the full table

The whole schema-native vocabulary ships — every class and every property,
including `pending` and the hosted extensions — interned, with no scoping
by closure and no section cut. Two arguments settle it:

- **The range closure.** The six modeled types' properties name dozens of
  non-datatype range types, and nearly all fall outside any closure scoped
  to those six (`Organization.address` → `PostalAddress`,
  `CreativeWork.image` → `ImageObject`). Correct graphs reach those types
  on day one, so a scoped table does not merely lag the vocabulary, it
  fails the first realistic graph — trap 1 by a different road.
- **Honesty of `UnknownTerm`.** A scoped table cannot distinguish "you
  misspelled it" from "we did not ship that part", which is precisely the
  distinction the three-valued outcome depends on. Completeness is not a
  size decision; it is what makes the answer honest.

Interning is what makes "everything" affordable: type and property names
are stored once in string tables and referenced by index from the parent
and domain rows. Index rows are comma-joined strings, not nested number
arrays — a long nested array is re-wrapped by Biome, so the generator and
the formatter would fight forever and the file would never be a fixpoint; a
string literal is one Biome cannot break, and it is smaller. Rows decode
lazily and memoize per type index. `__test__/Vocabulary.test.ts` pins the
table's byte size with both a ceiling and a floor — the floor is the
load-bearing half, because a half-run generation produces a truncated table
that passes every legality test by simply knowing nothing.

`src/internal/vocabulary.ts` carries the interned name tables, the parent
rows, the domain rows, both `supersededBy` maps, the declared foreign
prefixes and the version constant. They answer the two questions the
validator asks and nothing else: no labels, comments, examples or ranges.

### The upstream document is data, not truth

The `-current` document is internally inconsistent: a few properties carry
a `domainIncludes` target that the document never declares as a class (it
exists only in `-all`). A generator that indexes the type table by name
gets `undefined`, and `undefined` flowing into an interned index is a
silent corruption that ships. So the generator asserts rather than
assumes, and fails regeneration rather than emitting a damaged table:

1. Every `domainIncludes` target resolves to a declared native class, or
   the generator fails naming the term and its target. The known
   exceptions are dropped with a recorded note in the generated header,
   never silently.
2. Every parent resolves to a declared native class or carries a prefix
   the document's own `@context` declares. An unrecognized prefix is a new
   alignment vocabulary and a decision for a human.
3. Every interned index is in range.

The generated header's notes block records what the document could not
answer, so the next regeneration can tell a new inconsistency from a known
one.

## Testing

`__test__/Conformance.test.ts` and `__test__/Vocabulary.test.ts`, with
small hand-authored graphs each pinning one answer and a `README.md`
beside the fixtures carrying the fixture provenance. The cases that matter
most:

- **`license` on `SoftwareSourceCode` → clean.** Legal only by inheritance
  (trap 1), and a property the consumer's first graph passes. This is the
  most important fixture in the suite.
- A multi-parent type carrying a property inherited through its second
  parent → clean. Kills the single-parent-walk mutant that the trap-1
  fixture alone does not.
- A property with many domains on a type matching a non-first entry →
  clean. Kills equality-instead-of-membership.
- A declared-foreign-prefix term in a catch-all → no issue at all; an
  undeclared prefix → reported. Pins the three-way prefix rule.
- `softwareVersion` in a `SoftwareSourceCode`'s `additional` →
  `PropertyNotOnType`. The authentic false-acceptance case.
- A `supersededBy` term → the deprecation issue carrying the successor, and
  not rejected by the default gate.
- An invented `@type` → `UnknownTerm`, and under `unknownTerms: "fail"` a
  failure. A `pending` term → clean, which pins the full table.
- Duplicate `@id` and colliding `additional` key → build-time failures, not
  issues; a dangling `NodeRef` → an issue and a clean `buildResult`.

The generator's own assertions are exercised at regeneration time, not by
a graph fixture. Nothing in the suite invokes the generator.

**On the oracle.** The vendored vocabulary document *is* the oracle, and
every legality assertion is checked against it rather than against a
snapshot of the validator's output.
