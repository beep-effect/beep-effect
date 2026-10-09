# schema-org (lab port of @effected/schema-org)

[![npm](https://img.shields.io/npm/v/@effected%2Fschema-org?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/schema-org)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

schema.org as Effect Schema classes: build a JSON-LD graph, serialize it safely into a `<script>` element, and check it against schema.org's own vocabulary offline. `effect` is the only peer dependency and there are no runtime dependencies at all — the vocabulary is vendored as generated TypeScript, so nothing here reaches the network.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/schema-org

Structured data is usually assembled as an object literal and dropped into a template with `JSON.stringify`, which gets two things wrong at once. The first is a security bug: `JSON.stringify` does not escape `<`, so one description containing the literal `</script>` closes the JSON-LD block early and injects whatever follows into the page. The second is quieter — schema.org has a vocabulary, your object literal does not, and a plausible-looking property the vocabulary does not define on that type is simply ignored by every consumer, with no error anywhere.

This package fixes both at their source. `toScriptBody()` is the only text serializer and it is the escaped one, so the injection case cannot be reached by choosing the wrong function. The vocabulary ships vendored, so a build step can reject a misplaced property offline, in CI, with no network call and no crawler round trip.

## Install

```bash
npm install @effected/schema-org effect
```

```bash
pnpm add @effected/schema-org effect
```

Requires Node.js >=24.11.0.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Assemble nodes into a graph, then serialize it:

```ts
import { JsonLdDocument, NodeRef, SoftwareSourceCode, TechArticle } from "@effected/schema-org";
import { Result } from "effect";

const built = JsonLdDocument.buildResult([
  SoftwareSourceCode.make({ "@id": "https://example.com/pkg#source", name: "example", version: "1.2.3" }),
  TechArticle.make({
    "@id": "https://example.com/pkg/docs#intro",
    headline: "Getting started </script>",
    isPartOf: [NodeRef.to("https://example.com/pkg#source")],
  }),
]);

console.log(Result.getOrThrow(built).toScriptBody());
// {"@context":"https://schema.org","@graph":[{"@id":"https://example.com/pkg#source","@type":"SoftwareSourceCode","name":"example","version":"1.2.3"},{"@id":"https://example.com/pkg/docs#intro","@type":"TechArticle","isPartOf":[{"@id":"https://example.com/pkg#source"}],"headline":"Getting started </script>"}]}
```

Then embed the body verbatim:

```html
<script type="application/ld+json">BODY</script>
```

`buildResult` is the entry point, not `make`: `Schema.Class` reserves `make` for its raw structural constructor, which runs none of the identity checks. `JsonLdDocument.build` is the `Effect` twin of `buildResult`, derived from it — the synchronous form is the primitive, so a static-site build never has to construct a runtime.

Three things fail a build, all of them caller error rather than something to report to a user: a malformed `@id` (`InvalidNodeIdError`), two nodes claiming one `@id` (`DuplicateNodeIdError`), and a catch-all key colliding with a typed field (`ConflictingTermError`). A **dangling reference is legal** — pointing at a node described on another page is correct JSON-LD — so read `danglingReferences` and decide for yourself whether your graph is meant to be closed.

## The serializer is the point

Every string in your graph comes from prose someone wrote. A description containing the literal `</script>` **closes the JSON-LD block early and injects markup into your page**, and `JSON.stringify` does not escape it.

`toScriptBody()` escapes `<`, `>` and `&` after stringify. All three are valid JSON string escapes, so a parser sees the original characters; with no `<` in the body, neither `</script` nor `<!--` can appear, and the element cannot be closed from inside. The `&` escape additionally keeps the output well-formed when the document is served as XHTML. The escaping is idempotent, so a second pass over the output is safe rather than double-escaped.

**There is deliberately no unescaped text serializer.** The escaped output is not a restricted form — it is semantically identical for anyone who parses it, which is everyone — so a second entry point could only ever be chosen wrongly.

`toJsonLd()` returns the wire form as a plain value, for a framework that serializes JSON-LD itself. **If you are producing text, do not use it** — `JSON.stringify(doc.toJsonLd())` reintroduces exactly the bug this package exists to prevent.

## Validate offline

```ts
import { Conformance, Vocabulary } from "@effected/schema-org/validate";

console.log(Vocabulary.version);
// 30.0

for (const issue of Conformance.check(doc)) {
  console.error(issue._tag, issue.message);
}
// PropertyNotOnType https://example.com/pkg#source: schema.org does not define "softwareVersion" on SoftwareSourceCode
```

`Conformance.check` is total — it never fails and never throws, because reporting is not a failure mode. `Conformance.validateResult` is the gate built on top of it, returning the graph back or a `NonConformantGraphError` carrying every issue, and `Conformance.validate` is its `Effect` twin. By default only the structural kinds close the gate; `ConformanceOptions` widens it to deprecations and dangling references.

The vocabulary is vendored, so the gate runs offline and in CI with no network call. It catches the failure that actually happens — not malformed JSON, but a plausible property schema.org does not define on that type. `softwareVersion` on a `SoftwareSourceCode` is the canonical example: it reads correct, serializes fine, and is silently ignored downstream. (The property is `version`.)

Legality is resolved through the full `rdfs:subClassOf` ancestor closure, so inherited properties are accepted — `license` is declared only on `CreativeWork`, and it is legal on `SoftwareSourceCode` because of that chain.

**Import it from the `./validate` subpath.** The vocabulary table is the whole of what a graph-only consumer avoids: importing `@effected/schema-org` loads the node classes and the serializer and nothing else. `./validate` re-exports the node classes **type-only**, for annotating a signature — reaching for a value through it, such as `NodeRef.to`, fails with "only refers to a type". Import values from the root.

**Conformance is not Google rich-results eligibility.** Google requires properties schema.org does not, and changes its policy on its own schedule. This tells you schema.org defines the term; it does not promise you a rich result.

## What this package does not do

- **Mint `@id`s.** They are IRIs in your namespace; the package cannot know your base URL and never derives one.
- **Map your domain onto nodes.** That mapping is yours.
- **Decode JSON-LD back into typed nodes.** The encode direction is the supported one in this release, and a test pins the asymmetry so it cannot start half-working by accident.
- **Model all of schema.org.** Six node types, plus an open `additional` catch-all for any term — which the validator then checks.

## Features

- `SoftwareSourceCode`, `TechArticle`, `APIReference`, `Person`, `Organization`, `CreativeWork` — the six node classes. Every node requires `@id` and nothing else; every other field is optional and may be passed as `undefined`, which is dropped at serialization.
- `ThingFields`, `CreativeWorkFields`, `TechArticleFields` — the shared field records the node classes are assembled from, exported for a consumer building a node type this package does not model.
- `NodeRef` — a reference to another node by `@id`, with `to` (unchecked, validated at build time), the sync `toCheckedResult` and its `Effect` twin `toChecked`, and the `isValidId` predicate. A node-valued property holds a `NodeRef`, never an embedded node.
- `JsonLdDocument` — the graph: `buildResult` / `build` to assemble and check identity, `nodeIds` and `danglingReferences` to inspect, `toScriptBody()` to serialize for a page and `toJsonLd()` for a framework that serializes JSON-LD itself.
- `Vocabulary` — a read API over the vendored schema.org vocabulary: `version`, `hasType`, `hasProperty`, `ancestorsOf`, `propertiesOf`, `isPropertyOn` and `supersededBy`, usable on its own for tooling that never builds a graph.
- `Conformance` — offline conformance checking, reporting `UnknownTerm`, `PropertyNotOnType`, `DeprecatedType`, `DeprecatedProperty` and `DanglingReference` issues, each with a one-line `message`.
- A property that repeats is always an array, even at length one — including `license`, because `MIT AND Apache-2.0` is a real dual-license and collapsing it would be silent data loss.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/schema-org` 0.7.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/schema-org/Conformance.ts:22 * A term the vendored schema.org vocabulary does not define at all.
- scratchpad/effected/schema-org/CreativeWork.ts:26 * The license(s) the work is offered under, as URLs.
- scratchpad/effected/schema-org/CreativeWork.ts:29 * wrong: `MIT AND Apache-2.0` is a real dual-license. A consumer holding
- scratchpad/effected/schema-org/CreativeWork.ts:30 * SPDX identifiers maps them onto the `https://spdx.org/licenses/<id>`
- scratchpad/effected/schema-org/CreativeWork.ts:32 * `@effected/spdx`, because schema.org's `license` range is
- scratchpad/effected/schema-org/CreativeWork.ts:35 license: Schema.optional(Schema.Array(Schema.String)),
- scratchpad/effected/schema-org/Person.ts:9 * `CreativeWork` vocabulary (`license`, `author`, `datePublished`, …) is
- scratchpad/effected/schema-org/SoftwareSourceCode.ts:24 * 	license: ["https://spdx.org/licenses/MIT"],
- scratchpad/effected/schema-org/Thing.ts:9 * lives in the vendored vocabulary — the one the conformance validator reads —
- scratchpad/effected/schema-org/conformance-entry.ts:2 * The offline conformance half of `@effected/schema-org`: the vendored
- scratchpad/effected/schema-org/internal/vocabulary.ts:1 // Vendored schema.org vocabulary. Every literal below is machine-generated by

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
