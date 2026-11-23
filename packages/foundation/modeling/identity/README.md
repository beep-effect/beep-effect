# @beep/identity

Stable identifiers and Effect schema annotations for Beep packages, plus
registered vocabulary expansion and identity lookup. Composers preserve literal
types so a package, module, and symbol have a consistent identity across code
and schema metadata.

This is a private workspace package. Consumers in this repository declare
`"@beep/identity": "workspace:^"` in their dependencies.

## Start with your package's composer

Import the registered composer for the package that owns the code from
`@beep/identity/packages`, then scope it to the module. The example below is for
a module in `@beep/schema`; choose your own package's exported composer when
adapting it.

```ts
import { $SchemaId } from "@beep/identity/packages";

const $I = $SchemaId.create("Example");
const requestId = $I.make("Request");
const exactId: "@beep/schema/Example/Request" = requestId;

console.log(exactId); // @beep/schema/Example/Request
```

`create` returns a composer scoped beneath the current identity; `make` returns
an identifier beneath that scope. Keep these segments stable: renaming one
changes the resulting identity. The exported `$I` is the repository root;
normal package code uses its package-specific composer instead. Local root
construction through `Id.make` outside this package is rejected by the
repository's identity-registry lint policy.

## Annotate schemas

Use `annoteSchema` as a pipeable annotation function for ordinary schemas. It
adds the composed identifier and identity metadata alongside your description.

```ts
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Example");
const Title = S.String.pipe(
  $I.annoteSchema("Title", {
    description: "A human-readable title.",
  })
);

console.log(S.resolveAnnotations(Title)?.identifier);
// @beep/schema/Example/Title
```

Use `annote` when a schema constructor or check accepts an annotation record.
The distinction is the receiving API: `annoteSchema` takes a schema through
`pipe`, while `annote` produces the record to pass to that API.

```ts
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Example");
const Title = S.String.pipe($I.annoteSchema("Title", { description: "A non-empty title." })).check(
  S.isMinLength(1, $I.annote("TitleNotEmpty", { description: "A title must contain text." }))
);

console.log(S.is(Title)("Review identity usage")); // true
console.log(S.is(Title)("")); // false
console.log(S.resolveAnnotations(Title)?.identifier);
// @beep/schema/Example/TitleNotEmpty
```

Annotate the base schema before adding checks to preserve the check's own identity:
applying `annoteSchema` after `.check(...)` merges into the last check's annotations
and replaces any matching identifier or description.
When checks exist, `S.resolveAnnotations` reads the last check's annotations, so
this example resolves to `TitleNotEmpty`. Apply `annoteSchema` after the check
when the overall schema's identity should win; apply it before the check when
the check's own identity should survive.

The [composer contract](src/Id.ts) also documents declaration-specific
`annoteClass`, tagged-error `annoteError`, and field-path `annoteKey` helpers.

## Expand registered vocabulary terms

A CURIE is a compact name such as `skos:prefLabel`; its IRI is the full
vocabulary identifier. Every namespace and term lives in one generated registry,
built from the shards in [registry/namespaces](registry/namespaces) by
`bun run beep identity registry --write`. Use `iri` for a statically known term
when you want the exact IRI literal type preserved.

```ts
import { iri } from "@beep/identity/Registry";

const exactIri: "http://www.w3.org/2004/02/skos/core#prefLabel" = iri("skos:prefLabel");

console.log(exactIri); // http://www.w3.org/2004/02/skos/core#prefLabel
```

For a string read at runtime, use `expand` or `contract`. Both are exact
lookups that return `None` for an unregistered or deprecated term; recognizing
a prefix alone is insufficient, and neither fetches an IRI over the network.
`CurieFromIri` is the same mapping as a schema codec.

```ts
import { expand } from "@beep/identity/Registry";
import * as O from "effect/Option";

const describeTerm = (input: string): string =>
  O.match(expand(input), {
    onNone: () => "Unregistered vocabulary term",
    onSome: (term) => term,
  });

console.log(describeTerm("skos:prefLabel"));
// http://www.w3.org/2004/02/skos/core#prefLabel
console.log(describeTerm("skos:unregisteredTerm"));
// Unregistered vocabulary term
```

## Module map

| Import | Responsibility |
| --- | --- |
| `@beep/identity/packages` | Registered package composers; the normal starting point for consumers. |
| `@beep/identity/Id` | Composer contracts, identity construction, and schema annotation helpers. |
| `@beep/identity/Registry` | The generated term registry and the one CURIE codec: expansion, contraction, bindings, deprecations and instance minting. |
| `@beep/identity/Term` | Declared terms, namespaces, bindings, deprecations, registry shards and the term snapshot. |
| `@beep/identity/Vocab` | Literal CURIE, predicate and IRI types over a vocabulary shape. |
| `@beep/identity/IdentityRegistry` | Exact identity, IRI, and CURIE lookup through a local registry service. |
| `@beep/identity/Iri` | RFC 3987 IRI, IRI-reference, relative-reference, and absolute-IRI schemas. |
| `@beep/identity/PnLocal` | Turtle local-name parsing and safe name emission. |
| `@beep/identity/Fibered` | Schema-validated discrete families and their section metadata. |

## Maintaining package registration

Run `bun run beep create-package` from the repository root to create a workspace
package and register its composer. For existing workspaces, inspect registration
with `bun run beep lint identity-registry`; use its `--fix` option to repair
registration drift. The CLI's registration writers own these updates, including
marker-delimited lab registrations in [packages.ts](src/packages.ts).

The registry is intentionally centralized. Preserve registered names and their
literal types when changing its layout; consumers and compatibility tests rely
on them. Start a refactor by reading [shape-stable.test.ts](test/shape-stable.test.ts)
and the [template guards](test/TemplateGuards.test.ts).

## Development

From the repository root, run the package's audit and documentation checks:

```bash
bun run beep quality package-verify @beep/identity
```

For a focused edit loop, run `bun run check`, `bun run test`, or `bun run lint`
from this package directory. The test suite covers literal identities, annotation
metadata and schema statics, template guards, vocabulary conversion, and registry
behavior.

## License

Apache-2.0, as declared in [package.json](package.json).
