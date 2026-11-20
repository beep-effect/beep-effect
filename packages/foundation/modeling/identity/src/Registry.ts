/**
 * The one CURIE codec over the identity registry: expansion, contraction,
 * bindings, deprecation chains and instance minting.
 *
 * **Details**
 *
 * Every lookup is exact. A CURIE expands only when its prefix is a registry
 * namespace and its local is a live term of that namespace, and an IRI
 * contracts only when it is a live term IRI, so nested namespaces never fall
 * back to a longest-prefix guess. The module-level functions read the
 * generated registry; {@link view} builds the same codec over any
 * {@link RegistryTable}, which tests and fixture registries use.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { IRI } from "./Iri.ts";
import { RegistryBindings, RegistryDeprecations, RegistryVocab } from "./internal/generated/Registry.data.ts";
import { SegmentSchema } from "./internal/Segment.ts";
import { $IdentityId } from "./packages.ts";
import { isNamespaceShapedIri, Namespace, Term, TermIri, TermLocal } from "./Term.ts";
import type { RegistryTable } from "./Term.ts";
import type { Curie, Expand, VocabShape } from "./Vocab.ts";

const $I = $IdentityId.create("Registry");

// Internal invariant guard for the literal-typed lookups (`iri`, `mint`,
// `mintEncoded`): their argument is registered by its literal type, so the
// unresolved branch is type-level unreachable. Not exported: never a caught
// public failure.
class RegistryInvariantError extends S.TaggedError<RegistryInvariantError, { readonly brand: unique symbol }>(
  "@beep/identity/Registry/RegistryInvariantError"
)(
  "RegistryInvariantError",
  { value: S.String },
  $I.annoteError<RegistryInvariantError>("RegistryInvariantError", {
    description: "A CURIE or prefix asserted registered by its literal type is absent from the registry.",
  })
) {}

/**
 * Every namespace of the generated registry: its IRI and its live term locals, keyed by prefix.
 *
 * **When to use**
 *
 * Use when a projection needs a namespace's whole term list as literal types,
 * such as the generated `@beep/rdf` term modules; use {@link expand} and
 * {@link contract} to resolve one term.
 *
 * **Example** (Read a namespace term list)
 *
 * ```ts import.meta.vitest name="Read a namespace term list"
 * import { RegistryVocab } from "@beep/identity/Registry"
 *
 * RegistryVocab.as.iri // => "http://www.w3.org/ns/activitystreams#"
 * RegistryVocab.as.terms // => ["generator"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export { RegistryVocab } from "./internal/generated/Registry.data.ts";

/**
 * A prefix of the generated registry.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RegistryPrefix = keyof typeof RegistryVocab & string;

/**
 * A CURIE of a live term of the generated registry, as a literal union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RegistryCurie = Curie<typeof RegistryVocab>;

/**
 * The exact IRI literal a registry CURIE expands to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RegistryIri<C extends RegistryCurie> = Expand<C, typeof RegistryVocab>;

/**
 * The literal namespace row of a registry prefix.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RegistryNamespace<P extends RegistryPrefix> = {
  readonly prefix: P;
  readonly iri: (typeof RegistryVocab)[P]["iri"];
};

/**
 * A predicate CURIE expanded to its term IRI, with `inverse` set for a `^`-marked (SPARQL inverse-path) predicate.
 *
 * **Example** (Check an expanded predicate)
 *
 * ```ts import.meta.vitest name="Check an expanded predicate"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ExpandedPredicate, expandPredicate } from "@beep/identity/Registry"
 *
 * O.exists(expandPredicate("^skos:broader"), S.is(ExpandedPredicate)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpandedPredicate extends S.Opaque<ExpandedPredicate, { readonly brand: unique symbol }>()(
  S.Struct({
    inverse: S.Boolean,
    iri: TermIri,
  }).pipe(
    $I.annoteSchema("ExpandedPredicate", {
      description: "A predicate CURIE expanded to its term IRI and its direction.",
    })
  )
) {}

/**
 * The exact lookups of one registry, generated or built from a table.
 *
 * @category models
 * @since 0.0.0
 */
export interface RegistryView {
  /** The live term a code identity is bound to. */
  readonly bindingOf: (code: string) => O.Option<Term>;
  /** The CURIE of a live term IRI; `None` for any other IRI. */
  readonly contract: (iri: string) => O.Option<string>;
  /** The namespace the prefix of a CURIE-shaped value names, whether or not its local is a term. */
  readonly curieNamespace: (value: string) => O.Option<Namespace>;
  /** The live term IRI a CURIE names; `None` for an unregistered prefix or local. */
  readonly expand: (curie: string) => O.Option<TermIri>;
  /** The term IRI and direction of a forward or `^`-inverse predicate CURIE. */
  readonly expandPredicate: (predicate: string) => O.Option<ExpandedPredicate>;
  /** The namespace a prefix names. */
  readonly namespaceOf: (prefix: string) => O.Option<Namespace>;
  /** The live term (or, for a retired namespace IRI, the namespace IRI) a deprecated IRI is replaced by, following the chain. */
  readonly replacementOf: (iri: string) => O.Option<TermIri>;
}

// The generated data shape, which a table is projected to, so the generated registry and a
// table view share one code path.
type RegistryData = {
  readonly vocab: VocabShape;
  readonly bindings: Readonly<Record<string, { readonly iri: string }>>;
  readonly deprecations: Readonly<Record<string, { readonly replacement?: string | undefined }>>;
};

const curieOf = (term: Term): string => `${term.namespace}:${term.local}`;

const makeView = (data: RegistryData): RegistryView => {
  const namespaces = A.map(R.toEntries(data.vocab), ([prefix, entry]) => ({
    namespace: Namespace.make({ prefix, iri: IRI.make(entry.iri) }),
    locals: entry.terms,
  }));
  const terms = A.flatMap(namespaces, ({ namespace, locals }) =>
    A.map(locals, (local) => Term.of(namespace, TermLocal.make(local)))
  );
  const namespaceByPrefix = HashMap.fromIterable(
    A.map(namespaces, ({ namespace }): readonly [string, Namespace] => [namespace.prefix, namespace])
  );
  const termByCurie = HashMap.fromIterable(A.map(terms, (term): readonly [string, Term] => [curieOf(term), term]));
  const termByIri = HashMap.fromIterable(A.map(terms, (term): readonly [string, Term] => [term.iri, term]));
  const bindingByCode = HashMap.fromIterable(
    A.map(R.toEntries(data.bindings), ([code, binding]): readonly [string, string] => [code, binding.iri])
  );
  const replacementByTerm = HashMap.fromIterable(
    A.map(R.toEntries(data.deprecations), ([term, deprecation]): readonly [string, O.Option<string>] => [
      term,
      O.fromUndefinedOr(deprecation.replacement),
    ])
  );

  const namespaceIris = HashSet.fromIterable(A.map(namespaces, ({ namespace }): string => namespace.iri));
  // A retired namespace IRI is succeeded by a namespace IRI, a retired term by a term, as the table requires.
  const isSuccessor =
    (origin: string) =>
    (iri: string): boolean =>
      isNamespaceShapedIri(origin) ? HashSet.has(namespaceIris, iri) : HashMap.has(termByIri, iri);

  const follow = (origin: string, current: string, seen: HashSet.HashSet<string>): O.Option<TermIri> =>
    pipe(
      HashMap.get(replacementByTerm, current),
      O.flatten,
      O.filter((next) => !HashSet.has(seen, next)),
      O.flatMap((next) =>
        isSuccessor(origin)(next) ? TermIri.makeOption(next) : follow(origin, next, HashSet.add(seen, next))
      )
    );

  const expandCurie = (curie: string): O.Option<TermIri> => O.map(HashMap.get(termByCurie, curie), (term) => term.iri);

  return {
    namespaceOf: (prefix) => HashMap.get(namespaceByPrefix, prefix),
    curieNamespace: (value) =>
      pipe(
        Str.indexOf(":")(value),
        O.flatMap((separator) => HashMap.get(namespaceByPrefix, Str.slice(0, separator)(value)))
      ),
    expand: expandCurie,
    expandPredicate: (predicate) => {
      const inverse = Str.startsWith("^")(predicate);
      return O.map(expandCurie(inverse ? Str.slice(1)(predicate) : predicate), (iri) =>
        ExpandedPredicate.make({ inverse, iri })
      );
    },
    contract: (iri) => O.map(HashMap.get(termByIri, iri), curieOf),
    bindingOf: (code) =>
      pipe(
        HashMap.get(bindingByCode, code),
        O.flatMap((term) => HashMap.get(termByIri, term))
      ),
    replacementOf: (iri) => follow(iri, iri, HashSet.make(iri)),
  };
};

/**
 * Build the registry codec over a table, for fixture registries and tests.
 *
 * **When to use**
 *
 * Use when a caller must expand and contract against a registry other than
 * the generated one, such as a fixture table in a test.
 *
 * **Example** (Expand and contract over a fixture table)
 *
 * ```ts import.meta.vitest name="Expand and contract over a fixture table"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { view } from "@beep/identity/Registry"
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 *
 * const qa = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "qa", iri: "https://beep-effect.com/ns/qa/" },
 *   terms: ["receipts/accepted/v2"],
 *   bindings: [],
 *   deprecations: []
 * })
 * const registry = view(Result.getOrThrow(RegistryTable.fromShards([qa])))
 * O.getOrThrow(registry.expand("qa:receipts/accepted/v2")) // => "https://beep-effect.com/ns/qa/receipts/accepted/v2"
 * O.getOrThrow(registry.contract("https://beep-effect.com/ns/qa/receipts/accepted/v2")) // => "qa:receipts/accepted/v2"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const view = (table: RegistryTable): RegistryView => {
  const localsByPrefix = A.groupBy(table.terms, (term) => term.namespace);
  return makeView({
    vocab: R.fromEntries(
      A.map(table.namespaces, (namespace) => [
        namespace.prefix,
        {
          iri: namespace.iri,
          terms: A.map(O.getOrElse(R.get(localsByPrefix, namespace.prefix), A.empty), (term) => term.local),
        },
      ])
    ),
    bindings: R.fromEntries(A.map(table.bindings, (binding) => [binding.code, { iri: binding.term }])),
    deprecations: R.fromEntries(
      A.map(table.deprecations, (deprecation) => [
        deprecation.term,
        { replacement: O.getOrUndefined(deprecation.replacement) },
      ])
    ),
  });
};

/**
 * Build the registry codec over a bare vocabulary, with no bindings and no deprecations.
 *
 * **When to use**
 *
 * Use with a composer bound to a vocabulary extension, whose terms are not
 * all in the generated registry, such as a fixture vocabulary in an ontology
 * fold test.
 *
 * **Example** (Expand over a fixture vocabulary)
 *
 * ```ts import.meta.vitest name="Expand over a fixture vocabulary"
 * import * as O from "effect/Option"
 * import { fromVocab } from "@beep/identity/Registry"
 *
 * const registry = fromVocab({ ex: { iri: "https://example.test/ns#", terms: ["Thing"] } })
 * O.getOrThrow(registry.expand("ex:Thing")) // => "https://example.test/ns#Thing"
 * O.isNone(registry.expand("skos:prefLabel")) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromVocab = (vocab: VocabShape): RegistryView => makeView({ vocab, bindings: {}, deprecations: {} });

const generated: RegistryView = /*#__PURE__*/ makeView({
  vocab: RegistryVocab,
  bindings: RegistryBindings,
  deprecations: RegistryDeprecations,
});

/**
 * The view over the generated registry, the one the module-level lookups read.
 *
 * **When to use**
 *
 * Use when a caller takes a {@link RegistryView} and should read the
 * generated registry, such as `foldWith` in `@beep/ontology`.
 *
 * **Example** (Read a binding through the generated view)
 *
 * ```ts import.meta.vitest name="Read a binding through the generated view"
 * import * as O from "effect/Option"
 * import { generatedView } from "@beep/identity/Registry"
 *
 * O.getOrThrow(generatedView.expand("skos:prefLabel")) // => "http://www.w3.org/2004/02/skos/core#prefLabel"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const generatedView: RegistryView = generated;

const isRegistryCurie = (curie: string): curie is RegistryCurie => O.isSome(generated.expand(curie));

/**
 * Expand a CURIE of the generated registry to its term IRI.
 *
 * **Details**
 *
 * The registry is a closed world: an unregistered prefix, an undeclared
 * local and a deprecated term all give `None`.
 *
 * **Example** (Expand a CURIE)
 *
 * ```ts import.meta.vitest name="Expand a CURIE"
 * import * as O from "effect/Option"
 * import { expand } from "@beep/identity/Registry"
 *
 * O.getOrThrow(expand("skos:prefLabel")) // => "http://www.w3.org/2004/02/skos/core#prefLabel"
 * O.isNone(expand("skos:notATerm")) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const expand = (curie: string): O.Option<TermIri> => generated.expand(curie);

/**
 * Contract a term IRI of the generated registry to its CURIE.
 *
 * **Details**
 *
 * Contraction is an exact lookup of live term IRIs, not a longest-prefix
 * match, so a namespace IRI or an IRI under a namespace that is not a
 * declared term gives `None`.
 *
 * **Example** (Contract an IRI)
 *
 * ```ts import.meta.vitest name="Contract an IRI"
 * import * as O from "effect/Option"
 * import { contract } from "@beep/identity/Registry"
 *
 * O.getOrThrow(contract("http://purl.org/dc/terms/creator")) // => "dcterms:creator"
 * O.isNone(contract("http://purl.org/dc/terms/")) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const contract = (iri: string): O.Option<RegistryCurie> => O.filter(generated.contract(iri), isRegistryCurie);

/**
 * Expand a forward or `^`-inverse predicate CURIE of the generated registry to its term IRI and direction.
 *
 * **Example** (Expand an inverse predicate)
 *
 * ```ts import.meta.vitest name="Expand an inverse predicate"
 * import * as O from "effect/Option"
 * import { expandPredicate } from "@beep/identity/Registry"
 *
 * O.getOrThrow(expandPredicate("^rdfs:subClassOf")).inverse // => true
 * O.getOrThrow(expandPredicate("rdfs:subClassOf")).iri // => "http://www.w3.org/2000/01/rdf-schema#subClassOf"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const expandPredicate = (predicate: string): O.Option<ExpandedPredicate> => generated.expandPredicate(predicate);

/**
 * The namespace the prefix of a CURIE-shaped value names in the generated registry.
 *
 * **Details**
 *
 * Only the prefix is looked up, so `rdfs:notATerm` still names the `rdfs`
 * namespace. Use it to tell a CURIE under a registered prefix from an
 * absolute IRI such as `urn:x`.
 *
 * **Example** (Look up the namespace of a CURIE)
 *
 * ```ts import.meta.vitest name="Look up the namespace of a CURIE"
 * import * as O from "effect/Option"
 * import { curieNamespace } from "@beep/identity/Registry"
 *
 * O.map(curieNamespace("rdfs:notATerm"), (namespace) => namespace.prefix) // => O.some("rdfs")
 * O.isNone(curieNamespace("urn:example:x")) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const curieNamespace = (value: string): O.Option<Namespace> => generated.curieNamespace(value);

/**
 * The namespace a prefix names in the generated registry.
 *
 * **Example** (Look up a namespace)
 *
 * ```ts import.meta.vitest name="Look up a namespace"
 * import * as O from "effect/Option"
 * import { namespaceOf } from "@beep/identity/Registry"
 *
 * O.map(namespaceOf("rdfs"), (namespace) => namespace.iri) // => O.some("http://www.w3.org/2000/01/rdf-schema#")
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const namespaceOf = (prefix: string): O.Option<Namespace> => generated.namespaceOf(prefix);

/**
 * The live term a code identity is bound to in the generated registry.
 *
 * **Example** (Look up an unbound code identity)
 *
 * ```ts import.meta.vitest name="Look up an unbound code identity"
 * import * as O from "effect/Option"
 * import { bindingOf } from "@beep/identity/Registry"
 *
 * O.isNone(bindingOf("@beep/identity/Registry/Unbound")) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const bindingOf = (code: string): O.Option<Term> => generated.bindingOf(code);

/**
 * The live term that replaces a deprecated IRI of the generated registry, following the deprecation chain.
 *
 * **When to use**
 *
 * Use when reading a stored IRI that may have been re-minted: the stored row
 * keeps its bytes and the reader converts it on read.
 *
 * **Example** (Read a live IRI)
 *
 * ```ts import.meta.vitest name="Read a live IRI"
 * import * as O from "effect/Option"
 * import { replacementOf } from "@beep/identity/Registry"
 *
 * O.isNone(replacementOf("http://www.w3.org/2004/02/skos/core#prefLabel")) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const replacementOf = (iri: string): O.Option<TermIri> => generated.replacementOf(iri);

const unregistered = (value: string) => () => RegistryInvariantError.make({ value });

/**
 * Expand a literal CURIE of the generated registry to its exact IRI literal.
 *
 * **Example** (Expand a literal CURIE)
 *
 * ```ts import.meta.vitest name="Expand a literal CURIE"
 * import { iri } from "@beep/identity/Registry"
 *
 * const label = iri("rdfs:label")
 * label // => "http://www.w3.org/2000/01/rdf-schema#label"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export function iri<const C extends RegistryCurie>(curie: C): RegistryIri<C>;
export function iri(curie: string): string {
  return O.getOrThrowWith(generated.expand(curie), unregistered(curie));
}

/**
 * The literal namespace row of a prefix of the generated registry.
 *
 * **Example** (Read a namespace literal)
 *
 * ```ts import.meta.vitest name="Read a namespace literal"
 * import { namespace } from "@beep/identity/Registry"
 *
 * namespace("skos").iri // => "http://www.w3.org/2004/02/skos/core#"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const namespace = <const P extends RegistryPrefix>(prefix: P): RegistryNamespace<P> => ({
  prefix,
  iri: RegistryVocab[prefix].iri,
});

const baseIri = (base: string): string =>
  O.getOrThrowWith(
    Str.includes(":")(base) ? generated.expand(base) : O.map(generated.namespaceOf(base), (row) => row.iri),
    unregistered(base)
  );

/**
 * Refusal of an instance IRI that the generated registry already publishes, or of an empty raw key.
 *
 * **Details**
 *
 * `reason` is `LiveTerm` when the minted IRI is a live term IRI,
 * `DeprecatedTerm` when it is a deprecated term IRI, `NamespaceIri` when it
 * is a namespace IRI and `EmptyKey` when {@link mintEncoded} gets an empty key.
 *
 * **Example** (Construct a mint refusal)
 *
 * ```ts import.meta.vitest name="Construct a mint refusal"
 * import { RegistryMintError } from "@beep/identity/Registry"
 *
 * const error = RegistryMintError.make({ iri: "http://purl.org/dc/terms/Agent", reason: "LiveTerm" })
 * error.reason // => "LiveTerm"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistryMintError extends S.TaggedError<RegistryMintError, { readonly brand: unique symbol }>(
  "@beep/identity/Registry/RegistryMintError"
)(
  "RegistryMintError",
  {
    iri: S.String,
    reason: S.Literals(["LiveTerm", "DeprecatedTerm", "NamespaceIri", "EmptyKey"]),
  },
  $I.annoteError<RegistryMintError>("RegistryMintError", {
    description: "A minted instance IRI would equal a published registry IRI, or its raw key is empty.",
  })
) {}

const deprecatedTerms: Readonly<Record<string, unknown>> = RegistryDeprecations;

// Every published non-live IRI and the refusal it earns; a deprecation outranks a namespace.
const publishedReasons: Readonly<Record<string, RegistryMintError["reason"]>> = {
  ...R.fromEntries(A.map(R.values(RegistryVocab), (entry) => [entry.iri, "NamespaceIri"] as const)),
  ...R.map(deprecatedTerms, constant<RegistryMintError["reason"]>("DeprecatedTerm")),
};

const publishedAs = (minted: string): O.Option<RegistryMintError["reason"]> =>
  O.isSome(generated.contract(minted)) ? O.some("LiveTerm") : R.get(publishedReasons, minted);

// A minted instance IRI never equals an IRI the registry publishes.
const refusePublished = (minted: string): string => {
  const published = publishedAs(minted);
  if (O.isSome(published)) {
    throw RegistryMintError.make({ iri: minted, reason: published.value });
  }
  return minted;
};

// A namespace IRI ends with its own separator; a term IRI takes "/" before the next segment.
// The segment grammar admits characters an IRI refuses, such as a space, so the result is an `IRI`.
const joinUnder = (base: string, tail: string): string =>
  refusePublished(IRI.make(Str.includes(":")(base) ? `${baseIri(base)}/${tail}` : `${baseIri(base)}${tail}`));

/**
 * Mint an instance IRI under a registry term or namespace with the identity segment grammar.
 *
 * **Details**
 *
 * Each segment passes the same validation as the composer's `create`, so the
 * bytes equal the composer IRI of the same segments under the same base. A
 * CURIE base takes `/` before the first segment; a namespace base already
 * ends with its separator.
 *
 * **Gotchas**
 *
 * Throws the segment schema error for an empty segment or one with a leading
 * or trailing `/`, and the `IRI` schema error when a segment holds a
 * character an IRI refuses, such as a space; {@link mintEncoded} takes free
 * text. Throws {@link RegistryMintError} when the result is an IRI
 * the registry publishes, such as `mint("dcterms", "Agent")`, which is the
 * term `dcterms:Agent`.
 *
 * **Example** (Mint an instance under a term)
 *
 * ```ts import.meta.vitest name="Mint an instance under a term"
 * import { mint } from "@beep/identity/Registry"
 *
 * mint("skos:Concept", "legal", "patent") // => "http://www.w3.org/2004/02/skos/core#Concept/legal/patent"
 * mint("dcterms", "agents", "alice") // => "http://purl.org/dc/terms/agents/alice"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mint = (base: RegistryCurie | RegistryPrefix, ...segments: A.NonEmptyReadonlyArray<string>): string =>
  joinUnder(
    base,
    A.join(
      A.map(segments, (segment) => SegmentSchema.make(segment)),
      "/"
    )
  );

/**
 * Mint an instance IRI under a registry term or namespace from one raw key, percent-encoded.
 *
 * **When to use**
 *
 * Use when the key is free text, such as a fixture key or a canonical URL,
 * that the segment grammar would refuse.
 *
 * **Gotchas**
 *
 * Throws {@link RegistryMintError} for an empty key and when the result is
 * an IRI the registry publishes. A key holding a lone UTF-16 surrogate throws
 * the `URIError` of `encodeURIComponent`.
 *
 * **Example** (Mint an instance from a raw key)
 *
 * ```ts import.meta.vitest name="Mint an instance from a raw key"
 * import { mintEncoded } from "@beep/identity/Registry"
 *
 * mintEncoded("skos:Concept", "a b/c") // => "http://www.w3.org/2004/02/skos/core#Concept/a%20b%2Fc"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mintEncoded: {
  (raw: string): (base: RegistryCurie | RegistryPrefix) => string;
  (base: RegistryCurie | RegistryPrefix, raw: string): string;
} = dual(2, (base: RegistryCurie | RegistryPrefix, raw: string): string => {
  if (Str.isEmpty(raw)) {
    throw RegistryMintError.make({ iri: baseIri(base), reason: "EmptyKey" });
  }
  return joinUnder(base, encodeURIComponent(raw));
});

const unknownCurie = (curie: string) => new SchemaIssue.InvalidValue({ message: `Unknown CURIE: ${curie}` }, curie);
const unknownIri = (term: string) => new SchemaIssue.InvalidValue({ message: `Unknown IRI: ${term}` }, term);

/**
 * The schema codec between a registry CURIE (encoded) and its term IRI (decoded).
 *
 * **Details**
 *
 * Decoding refuses an unregistered or deprecated CURIE and encoding refuses
 * an IRI that is not a live term, so a round trip is the identity on every
 * registered term.
 *
 * **Example** (Decode and encode a CURIE)
 *
 * ```ts import.meta.vitest name="Decode and encode a CURIE"
 * import * as S from "effect/Schema"
 * import { CurieFromIri } from "@beep/identity/Registry"
 *
 * const term = S.decodeUnknownSync(CurieFromIri)("owl:Class")
 * term // => "http://www.w3.org/2002/07/owl#Class"
 * S.encodeSync(CurieFromIri)(term) // => "owl:Class"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CurieFromIri = S.String.pipe(
  S.decodeTo(
    TermIri,
    SchemaTransformation.transformEffect({
      decode: (curie: string) =>
        pipe(
          generated.expand(curie),
          Effect.fromOption(() => unknownCurie(curie))
        ),
      encode: (term: string) =>
        pipe(
          generated.contract(term),
          Effect.fromOption(() => unknownIri(term))
        ),
    })
  ),
  $I.annoteSchema("CurieFromIri", {
    description: "Codec between a registry CURIE and the live term IRI it names.",
  })
);

/**
 * Decoded type of {@link CurieFromIri}: a live term IRI.
 *
 * @category models
 * @since 0.0.0
 */
export type CurieFromIri = typeof CurieFromIri.Type;
