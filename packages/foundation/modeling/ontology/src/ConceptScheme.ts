/**
 * Generic SKOS concept schemes, their edition pins and the `skos:broader`
 * profile a loader checks them against.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { $OntologyId } from "@beep/identity/packages";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { MappingPredicate } from "./Mapping.ts";

const $I = $OntologyId.create("ConceptScheme");

const IriSet = CanonicalHashSet(IRI);

/**
 * A mapping from a concept to a concept or class outside its scheme.
 *
 * **Example** (Align a concept by closeMatch)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptAlignment } from "@beep/ontology/ConceptScheme"
 * import * as O from "effect/Option"
 *
 * const alignment = ConceptAlignment.make({
 *   predicate: "skos:closeMatch",
 *   target: IRI.make("https://example.test/vendor/Email"),
 *   source: O.none()
 * })
 * console.log(alignment.predicate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConceptAlignment extends S.Opaque<ConceptAlignment, { readonly brand: unique symbol }>()(
  S.Struct({
    predicate: MappingPredicate,
    target: IRI,
    source: S.OptionFromOptionalKey(IRI),
  }).pipe(
    $I.annoteSchema("ConceptAlignment", {
      description: "A SKOS mapping from a concept to an external target, with the IRI it was vetted from.",
    })
  )
) {}

const alignmentKey = (alignment: typeof ConceptAlignment.Encoded): string =>
  `${alignment.predicate} ${alignment.target}`;

const AlignmentSet = ConceptAlignment.pipe(
  S.toEncoded,
  S.Array,
  S.decodeTo(
    S.HashSet(ConceptAlignment),
    SchemaTransformation.transform({
      decode: HashSet.fromIterable,
      encode: (
        alignments: HashSet.HashSet<typeof ConceptAlignment.Encoded>
      ): ReadonlyArray<typeof ConceptAlignment.Encoded> =>
        A.sort(A.fromIterable(alignments), Order.mapInput(Order.String, alignmentKey)),
    })
  )
);

/**
 * One concept of a scheme.
 *
 * **Example** (Make a concept)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { Concept } from "@beep/ontology/ConceptScheme"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const concept = Concept.make({
 *   iri: IRI.make("https://example.test/scheme/a"),
 *   prefLabel: "A",
 *   notation: O.none(),
 *   definition: O.none(),
 *   source: O.none(),
 *   scopeNote: O.none(),
 *   broader: HashSet.empty(),
 *   alignments: HashSet.empty()
 * })
 * console.log(concept.prefLabel)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Concept extends S.Opaque<Concept, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: IRI,
    prefLabel: S.NonEmptyString,
    notation: S.OptionFromOptionalKey(S.NonEmptyString),
    definition: S.OptionFromOptionalKey(S.NonEmptyString),
    source: S.OptionFromOptionalKey(IRI),
    scopeNote: S.OptionFromOptionalKey(S.NonEmptyString),
    broader: IriSet,
    alignments: AlignmentSet,
  }).pipe(
    $I.annoteSchema("Concept", {
      description: "A SKOS concept with its labels, its broader concepts and its external alignments.",
    })
  )
) {}

const ConceptSet = Concept.pipe(
  S.toEncoded,
  S.Array,
  S.decodeTo(
    S.HashSet(Concept),
    SchemaTransformation.transform({
      decode: HashSet.fromIterable,
      encode: (concepts: HashSet.HashSet<typeof Concept.Encoded>): ReadonlyArray<typeof Concept.Encoded> =>
        A.sort(
          A.fromIterable(concepts),
          Order.mapInput(Order.String, (concept: typeof Concept.Encoded) => concept.iri)
        ),
    })
  )
);

const hasUniqueConceptIris = (concepts: HashSet.HashSet<Concept>): boolean =>
  HashSet.size(HashSet.map(concepts, (concept) => concept.iri)) === HashSet.size(concepts);

/**
 * A versioned SKOS concept scheme whose concepts have distinct IRIs.
 *
 * **Details**
 *
 * The encoded concepts are sorted by IRI, so one scheme always encodes to the
 * same JSON. Two concepts with one IRI are refused on decode.
 *
 * **Example** (Decode a one-concept scheme)
 *
 * ```ts import.meta.vitest name="Decode a one-concept scheme"
 * import { ConceptScheme } from "@beep/ontology/ConceptScheme"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 *
 * const scheme = S.decodeUnknownSync(ConceptScheme)({
 *   iri: "https://example.test/scheme",
 *   version: "1",
 *   prefLabel: "Example",
 *   concepts: [{ iri: "https://example.test/scheme/a", prefLabel: "A", broader: [], alignments: [] }]
 * })
 * HashSet.size(scheme.concepts) // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConceptScheme extends S.Opaque<ConceptScheme, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: IRI,
    version: S.NonEmptyString,
    prefLabel: S.NonEmptyString,
    concepts: ConceptSet.check(
      S.makeFilter(
        hasUniqueConceptIris,
        $I.annote("ConceptSchemeUniqueIris", {
          title: "Unique Concept IRIs",
          description: "Every concept of a scheme has its own IRI.",
          message: "Expected distinct concept IRIs.",
        })
      )
    ),
  }).pipe(
    $I.annoteSchema("ConceptScheme", {
      description: "A versioned SKOS concept scheme, encoded with its concepts sorted by IRI.",
    })
  )
) {}

/**
 * A pin naming one edition of a concept scheme.
 *
 * **Example** (Pin an edition)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptSchemePin } from "@beep/ontology/ConceptScheme"
 *
 * const pin = ConceptSchemePin.make({ scheme: IRI.make("https://example.test/scheme"), version: "1" })
 * console.log(pin.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConceptSchemePin extends S.Opaque<ConceptSchemePin, { readonly brand: unique symbol }>()(
  S.Struct({
    scheme: IRI,
    version: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ConceptSchemePin", {
      description: "The scheme IRI and the exact version a caller requires; there is no latest.",
    })
  )
) {}

/**
 * A `skos:broader` cycle: a strongly connected component, or a self-loop.
 *
 * **Example** (Record a self-loop)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { BroaderCycle } from "@beep/ontology/ConceptScheme"
 * import * as HashSet from "effect/HashSet"
 *
 * const a = IRI.make("https://example.test/scheme/a")
 * const cycle = BroaderCycle.make({ scheme: IRI.make("https://example.test/scheme"), members: HashSet.make(a) })
 * console.log(cycle._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BroaderCycle extends S.Opaque<BroaderCycle, { readonly brand: unique symbol }>()(
  S.TaggedStruct("BroaderCycle", {
    scheme: IRI,
    members: IriSet,
  }).pipe(
    $I.annoteSchema("BroaderCycle", {
      description: "Concepts of one scheme whose broader links form a cycle.",
    })
  )
) {}

/**
 * A `skos:broader` link whose target is not a concept of the scheme.
 *
 * **Example** (Record an out-of-scheme target)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { BroaderOutsideScheme } from "@beep/ontology/ConceptScheme"
 *
 * const violation = BroaderOutsideScheme.make({
 *   scheme: IRI.make("https://example.test/scheme"),
 *   concept: IRI.make("https://example.test/scheme/a"),
 *   target: IRI.make("https://example.test/other/b")
 * })
 * console.log(violation._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BroaderOutsideScheme extends S.Opaque<BroaderOutsideScheme, { readonly brand: unique symbol }>()(
  S.TaggedStruct("BroaderOutsideScheme", {
    scheme: IRI,
    concept: IRI,
    target: IRI,
  }).pipe(
    $I.annoteSchema("BroaderOutsideScheme", {
      description: "A broader link from a concept of the scheme to an IRI the scheme does not hold.",
    })
  )
) {}

/**
 * A violation of the `skos:broader` profile.
 *
 * **Example** (Match a violation)
 *
 * ```ts import.meta.vitest name="Match a violation"
 * import { BroaderViolation } from "@beep/ontology/ConceptScheme"
 * import * as S from "effect/Schema"
 *
 * const violation = S.decodeUnknownSync(BroaderViolation)({
 *   _tag: "BroaderCycle",
 *   scheme: "https://example.test/scheme",
 *   members: ["https://example.test/scheme/a"]
 * })
 * violation._tag // => "BroaderCycle"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BroaderViolation = S.Union([BroaderCycle, BroaderOutsideScheme]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("BroaderViolation", {
    description: "A broader cycle or a broader link that leaves its scheme.",
  })
);

/**
 * Runtime type for {@link BroaderViolation}.
 *
 * **Example** (Type a violation)
 *
 * ```ts
 * import type { BroaderViolation } from "@beep/ontology/ConceptScheme"
 *
 * const tagOf = (violation: BroaderViolation) => violation._tag
 * console.log(tagOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BroaderViolation = typeof BroaderViolation.Type;

const byIri = Order.mapInput(Order.String, (concept: Concept) => concept.iri);

const sortedMembers = (members: ReadonlyArray<IRI>): string => A.join(A.sort(members, Order.String), " ");

const broaderGraph = (concepts: ReadonlyArray<Concept>) => {
  const indices = MutableHashMap.empty<IRI, Graph.NodeIndex>();
  const graph = Graph.directed<IRI, undefined>((mutable) => {
    for (const concept of concepts) {
      MutableHashMap.set(indices, concept.iri, Graph.addNode(mutable, concept.iri));
    }
    for (const concept of concepts) {
      for (const target of concept.broader) {
        const source = MutableHashMap.get(indices, concept.iri);
        const sink = MutableHashMap.get(indices, target);
        if (O.isSome(source) && O.isSome(sink)) {
          Graph.addEdge(mutable, source.value, sink.value, undefined);
        }
      }
    }
  });
  return graph;
};

/**
 * Check a scheme's `skos:broader` links: every cycle and every link that
 * leaves the scheme.
 *
 * **Details**
 *
 * The links form an `effect/Graph` directed graph. Each strongly connected
 * component with more than one member, and each self-loop, is a
 * {@link BroaderCycle}; each target that is not a concept of the scheme is a
 * {@link BroaderOutsideScheme}. Cycles come first, ordered by their least
 * member, then outside links ordered by concept and target.
 *
 * **Example** (Find a two-cycle)
 *
 * ```ts import.meta.vitest name="Find a two-cycle"
 * import { checkBroader, ConceptScheme } from "@beep/ontology/ConceptScheme"
 * import * as S from "effect/Schema"
 *
 * const scheme = S.decodeUnknownSync(ConceptScheme)({
 *   iri: "https://example.test/scheme",
 *   version: "1",
 *   prefLabel: "Example",
 *   concepts: [
 *     { iri: "https://example.test/scheme/a", prefLabel: "A", broader: ["https://example.test/scheme/b"], alignments: [] },
 *     { iri: "https://example.test/scheme/b", prefLabel: "B", broader: ["https://example.test/scheme/a"], alignments: [] }
 *   ]
 * })
 * checkBroader(scheme).map((violation) => violation._tag) // => ["BroaderCycle"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkBroader = (scheme: ConceptScheme): ReadonlyArray<BroaderViolation> => {
  const concepts = A.sort(A.fromIterable(scheme.concepts), byIri);
  const graph = broaderGraph(concepts);
  const selfLoops = pipe(
    A.filter(concepts, (concept) => HashSet.has(concept.broader, concept.iri)),
    A.map((concept) => concept.iri),
    HashSet.fromIterable
  );
  const cycles = pipe(
    Graph.stronglyConnectedComponents(graph),
    A.map((component) => A.getSomes(A.map(component, (index) => Graph.getNode(graph, index)))),
    A.filter((members) => members.length > 1 || A.some(members, (iri) => HashSet.has(selfLoops, iri))),
    A.sort(Order.mapInput(Order.String, sortedMembers)),
    A.map(
      (members): BroaderViolation => BroaderCycle.make({ scheme: scheme.iri, members: HashSet.fromIterable(members) })
    )
  );
  const iris = HashSet.map(scheme.concepts, (concept) => concept.iri);
  const outside = A.flatMap(concepts, (concept) =>
    pipe(
      A.sort(A.fromIterable(concept.broader), Order.String),
      A.filter((target) => !HashSet.has(iris, target)),
      A.map(
        (target): BroaderViolation => BroaderOutsideScheme.make({ scheme: scheme.iri, concept: concept.iri, target })
      )
    )
  );
  return [...cycles, ...outside];
};
