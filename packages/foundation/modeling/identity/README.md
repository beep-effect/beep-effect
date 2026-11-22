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

## Publish an IRI: declared terms and bindings

A composer identity such as `@beep/schema/Example/Title` is a code id. It
names code (schema identifiers, `Symbol.for` keys, JSON Schema `$defs`) and is
not, by itself, a published IRI. An IRI that leaves the process, in Turtle,
SHACL, SPARQL or an exported entry, is a declared term of a registry shard,
and the code that publishes it is bound to that term by a `TermBinding`.
Look a code id's term up with `bindingOf`; a code id with no binding has no
published IRI.

```ts
import { bindingOf } from "@beep/identity/Registry";
import * as O from "effect/Option";

const publishedIri = (code: string): string =>
  O.match(bindingOf(code), {
    onNone: () => "No published IRI",
    onSome: ({ iri }) => iri,
  });

console.log(publishedIri("@beep/test-runner/Vitest/PositiveTimeoutMillis"));
// https://beep-effect.com/ns/vitest/PositiveTimeoutMillis
console.log(publishedIri("@beep/schema/Example/Title"));
// No published IRI
```

A new internal term lives in a namespace named for its vocabulary, under the
identity authority `https://beep-effect.com/ns/`, never under a package or file
path, so renaming a module changes no published IRI. An instance that is not
content-addressed is minted under a declared term or namespace with `mint`
(or `mintEncoded` for a free-text key), which refuses to mint an IRI the
registry already publishes as a term.

The composers still carry a path-derived `.iri`. It equals the declared term
only at the kept read sites, which `test/KeptValues.test.ts` pins byte for
byte; new code reads a published IRI from the registry. The composer surface
stays registry-free because the CI runner handlers bundle `Id.ts` and must
not load the registry (`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts`).

### Changing the term set

The shards in [registry/namespaces](registry/namespaces) are the source; the
generated `src/internal/generated/Registry.data.ts` and the committed
[term snapshot](registry/term-snapshot.json) are written from them.

| Change | Command |
| --- | --- |
| Add a term or binding | edit the shard, then `bun run beep identity registry --write` |
| Retire a published term | `bun run beep identity deprecate <curie> [--replacement <curie>]` |
| Move the bindings of a renamed module | `bun run beep identity rebind @beep/<package>/<old path> @beep/<package>/<new path>` |
| Move the bindings of a renamed package | `bun run beep identity rebind @beep/<old package> @beep/<new package>` |
| Check generated drift | `bun run beep identity registry --check` |
| Check the published set against a base ref | `bun run beep lint identity-registry [--base <ref>]` |

The snapshot's `release` is the vocabulary release a binding or deprecation
names as `since`: an addition bumps the minor and a deprecation the major. It
is a property of the whole change against a base ref, the merge base of `HEAD`
with `origin/main` unless `--base <ref>` names another. `registry --write`,
`deprecate` and `rebind` compute it from the snapshot that base publishes, so a
branch of two additions is one minor and a branch of two deprecations is one
major, however many commands made it. The regenerated release is never below a
`since` a row records. Where the base commit publishes no term set, the registry
is still unreleased: the writers keep the release the checkout's snapshot has,
however many commands run, and a deprecation records that release. `--check`
reads no git state and succeeds the checkout's own snapshot, as the writers do
in a checkout with no base commit at all (no `origin/main`, or not a git work
tree).

Against a base that publishes a term set, the lint wants exactly that release
and the same release in every row the change adds. It reports:

| Kind | State | Repair |
| --- | --- | --- |
| `release-regressed` | the release is below the base's, or below the one the change calls for | `bun run beep identity registry --write` |
| `release-overstated` | the release is above the one the change calls for | the same |
| `since-misstated` | an added binding or deprecation records another release | set that `since` in its shard, then the same |

Each message names the release and the command, with the `--base` the lint was
given. Merge the base first when it is not merged yet. A rebind keeps the term
bound, so it keeps its `since`; a binding added in the same branch as a later
deprecation moves to the major with it. In a stack, keep the default base: until
its parent merges, a layer is part of one change against `main`. While `main`
publishes no term set, that change is unreleased and the writers leave the
release alone. Once the parent's release is on `main`, merge `main` into the
layer; the lint then names the layer's next release and every row to move to it.

Renaming a package that a shard projects into (`@beep/test-runner`) takes two
source edits before the rebind, because a package move rewrites binding codes
only: put the new name in the `RegistryProjection` literal of
[src/Term.ts](src/Term.ts), put it in the shard's `projection`, then run the
package rebind above. Until then every registry command refuses the shard,
because the checkout has no package of the old name.

A bound term is deprecated only after its binding is removed from the shard; a
rebind keeps the term bound. When the last shard drops its `projection`, the
generated projection module is drift and `--write` removes it. An edit command
that stops while it writes says how to finish: the shards are written first, so
a failure after them is finished with `bun run beep identity registry --write`.

Removing a term, changing a namespace prefix, dropping a deprecation or
reviving a retired IRI without a deprecation record fails the writer and the
lint, and so does deleting the whole registry against a base that published it.
The lint reads the snapshot where the base tree has its `@beep/identity` package,
so moving the package hides no removal. Law
`L0-3` in [TermStability.test.ts](test/TermStability.test.ts) is the
acceptance test.

## Module map

| Import | Responsibility |
| --- | --- |
| `@beep/identity/packages` | Registered package composers; the normal starting point for consumers. |
| `@beep/identity/Id` | Composer contracts, identity construction, and schema annotation helpers. |
| `@beep/identity/Registry` | The generated term registry and the one CURIE codec: expansion, contraction, bindings, deprecations and instance minting. |
| `@beep/identity/Term` | Declared terms, namespaces, bindings, deprecations, registry shards, the term snapshot and `snapshotViolations`. |
| `@beep/identity/Authority` | `IdentityAuthority`, the root of the internal namespaces. |
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
metadata and schema statics, template guards, vocabulary conversion, registry
behavior, and the `L0-1` and `L0-3` laws (`Curie.laws.test.ts`,
`TermStability.test.ts`).

## License

Apache-2.0, as declared in [package.json](package.json).
