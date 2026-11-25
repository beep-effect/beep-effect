/**
 * SKOS mapping relations between concepts and registry terms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { $OntologyId } from "@beep/identity/packages";
import * as Registry from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Measurement, makeSignal } from "@beep/schema/Signal";
import { SpdxExpression } from "@beep/spdx/SpdxExpression";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { supertypes } from "./Gufo.ts";
import type { TypedHierarchy } from "./Gufo.ts";

const $I = $OntologyId.create("Mapping");

/**
 * The five SKOS mapping relations, spelled as registry CURIEs.
 *
 * **Example** (Guard a mapping predicate)
 *
 * ```ts import.meta.vitest name="Guard a mapping predicate"
 * import { MappingPredicate } from "@beep/ontology/Mapping"
 *
 * MappingPredicate.is["skos:closeMatch"]("skos:closeMatch") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MappingPredicate = LiteralKit([
  "skos:exactMatch",
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:narrowMatch",
  "skos:relatedMatch",
]).pipe(
  $I.annoteSchema("MappingPredicate", {
    description: "A SKOS mapping relation, as the registry CURIE of its predicate.",
  })
);

/**
 * **Example** (Type a mapping predicate)
 *
 * ```ts
 * import type { MappingPredicate } from "@beep/ontology/Mapping"
 *
 * const predicate: MappingPredicate = "skos:exactMatch"
 * console.log(predicate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MappingPredicate = typeof MappingPredicate.Type;

/**
 * Expand a mapping predicate to its predicate IRI through the registry.
 *
 * **Example** (Expand closeMatch)
 *
 * ```ts import.meta.vitest name="Expand closeMatch"
 * import { mappingPredicateIri } from "@beep/ontology/Mapping"
 *
 * mappingPredicateIri("skos:closeMatch") // => "http://www.w3.org/2004/02/skos/core#closeMatch"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mappingPredicateIri = (predicate: MappingPredicate): IRI => IRI.make(Registry.iri(predicate));

/**
 * The SEMAPV justifications a mapping row may carry, spelled as registry CURIEs.
 *
 * **Example** (Guard a justification)
 *
 * ```ts import.meta.vitest name="Guard a justification"
 * import { MappingJustification } from "@beep/ontology/Mapping"
 * import * as S from "effect/Schema"
 *
 * S.is(MappingJustification)("semapv:ManualMappingCuration") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MappingJustification = LiteralKit([
  "semapv:ManualMappingCuration",
  "semapv:LexicalMatching",
  "semapv:LogicalReasoning",
  "semapv:SemanticSimilarityThresholdMatching",
  "semapv:UnspecifiedMatching",
]).pipe(
  $I.annoteSchema("MappingJustification", {
    description: "An SSSOM mapping justification, as the registry CURIE of its SEMAPV term.",
  })
);

/**
 * **Example** (Type a justification)
 *
 * ```ts
 * import type { MappingJustification } from "@beep/ontology/Mapping"
 *
 * const justification: MappingJustification = "semapv:LexicalMatching"
 * console.log(justification)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MappingJustification = typeof MappingJustification.Type;

/**
 * **Example** (Record a curated row's confidence)
 *
 * ```ts
 * import { MappingConfidence } from "@beep/ontology/Mapping"
 *
 * const confidence = MappingConfidence.cases.Absent.make({ reason: "not-assessed" })
 * console.log(confidence._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MappingConfidence = makeSignal(Measurement).pipe(
  $I.annoteSchema("MappingConfidence", {
    description: "The measured confidence of a mapping row, or the reason it is absent.",
  })
);

/**
 * **Example** (Type a confidence)
 *
 * ```ts
 * import { MappingConfidence } from "@beep/ontology/Mapping"
 * import type { MappingConfidence as Confidence } from "@beep/ontology/Mapping"
 *
 * const confidence: Confidence = MappingConfidence.cases.Absent.make({ reason: "not-assessed" })
 * console.log(confidence._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MappingConfidence = typeof MappingConfidence.Type;

const isRegistryTerm = (iri: string): boolean => O.isSome(Registry.contract(iri));

/**
 * **Example** (Map an annotation kind to DoCO)
 *
 * ```ts
 * import { iri } from "@beep/identity/Registry"
 * import { TermIri } from "@beep/identity/Term"
 * import { Mapping, MappingConfidence } from "@beep/ontology/Mapping"
 *
 * const row = Mapping.make({
 *   subject: TermIri.make(iri("annotation:Section")),
 *   predicate: "skos:exactMatch",
 *   object: TermIri.make(iri("doco:Section")),
 *   justification: "semapv:ManualMappingCuration",
 *   confidence: MappingConfidence.cases.Absent.make({ reason: "not-assessed" })
 * })
 * console.log(row.predicate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Mapping extends S.Opaque<Mapping, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: TermIri,
    predicate: MappingPredicate,
    object: TermIri,
    justification: MappingJustification,
    confidence: MappingConfidence,
  }).pipe(
    S.check(
      S.makeFilter(
        (row: { readonly subject: string; readonly object: string }) =>
          isRegistryTerm(row.subject) && isRegistryTerm(row.object),
        $I.annote("MappingRegistryTerms", {
          title: "Registry Terms",
          description: "The subject and object of a mapping are terms the identity registry knows.",
          message: "Expected registry terms as the subject and object.",
        })
      )
    ),
    $I.annoteSchema("Mapping", {
      description: "An SSSOM mapping row between two registry terms, with its justification and confidence.",
    })
  )
) {}

const byTriple = <Row extends { readonly subject: string; readonly predicate: string; readonly object: string }>() =>
  Order.combine(
    Order.combine(
      Order.mapInput(Order.String, (row: Row) => row.subject),
      Order.mapInput(Order.String, (row: Row) => row.predicate)
    ),
    Order.mapInput(Order.String, (row: Row) => row.object)
  );

const tripleKey = (row: Mapping): string => `${row.subject} ${row.predicate} ${row.object}`;

const MappingRows = Mapping.pipe(
  S.toEncoded,
  S.Array,
  S.decodeTo(
    S.HashSet(Mapping),
    SchemaTransformation.transform({
      decode: HashSet.fromIterable,
      encode: (rows: HashSet.HashSet<typeof Mapping.Encoded>): ReadonlyArray<typeof Mapping.Encoded> =>
        A.sort(A.fromIterable(rows), byTriple<typeof Mapping.Encoded>()),
    })
  )
);

const hasUniqueTriples = (rows: HashSet.HashSet<Mapping>): boolean =>
  HashSet.size(HashSet.map(rows, tripleKey)) === HashSet.size(rows);

/**
 * An SSSOM mapping set: identified, versioned, licensed rows with one row
 * per (subject, predicate, object).
 *
 * **Details**
 *
 * `mappings` encodes as an array sorted by (subject, predicate, object). The
 * uniqueness filter keeps that sort key total: a triple carries one
 * justification and one confidence, a narrowing of SSSOM.
 *
 * **Example** (Decode a one-row set)
 *
 * ```ts import.meta.vitest name="Decode a one-row set"
 * import { iri } from "@beep/identity/Registry"
 * import { MappingSet } from "@beep/ontology/Mapping"
 * import * as S from "effect/Schema"
 *
 * const set = S.decodeUnknownSync(MappingSet)({
 *   id: "https://example.test/mapping-set",
 *   version: "1",
 *   license: "Apache-2.0",
 *   mappings: [{
 *     subject: iri("annotation:Word"),
 *     predicate: "skos:exactMatch",
 *     object: iri("nif:Word"),
 *     justification: "semapv:ManualMappingCuration",
 *     confidence: { _tag: "Absent", reason: "not-assessed" }
 *   }]
 * })
 * set.version // => "1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MappingSet extends S.Opaque<MappingSet, { readonly brand: unique symbol }>()(
  S.Struct({
    id: IRI,
    version: S.NonEmptyString,
    license: SpdxExpression.FromString,
    mappings: MappingRows.check(
      S.makeFilter(
        hasUniqueTriples,
        $I.annote("MappingSetUniqueTriples", {
          title: "Unique Triples",
          description: "A mapping set holds one row per subject, predicate and object.",
          message: "Expected one row per subject, predicate and object.",
        })
      )
    ),
  }).pipe(
    $I.annoteSchema("MappingSet", {
      description: "A versioned, licensed SSSOM mapping set, encoded with its rows sorted by triple.",
    })
  )
) {}

/**
 * Two typed members of one comparison group whose upper types are disjoint.
 *
 * **Example** (Record disjoint upper types)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { DisjointUpperTypes } from "@beep/ontology/Mapping"
 *
 * const finding = DisjointUpperTypes.make({
 *   subject: TermIri.make("https://example.test/a"),
 *   left: TermIri.make("https://example.test/a"),
 *   right: TermIri.make("https://example.test/b")
 * })
 * console.log(finding._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DisjointUpperTypes extends S.Opaque<DisjointUpperTypes, { readonly brand: unique symbol }>()(
  S.TaggedStruct("DisjointUpperTypes", { subject: TermIri, left: TermIri, right: TermIri }).pipe(
    $I.annoteSchema("DisjointUpperTypes", {
      description: "Two typed terms mapped together whose instance categories or ultimate Kinds differ.",
    })
  )
) {}

/**
 * Mapping predicates that SKOS, or the repository, forbids on one pair of
 * exact classes.
 *
 * **Example** (Record conflicting predicates)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { ConflictingPredicates } from "@beep/ontology/Mapping"
 * import type { MappingPredicate } from "@beep/ontology/Mapping"
 * import * as HashSet from "effect/HashSet"
 *
 * const a = TermIri.make("https://example.test/a")
 * const finding = ConflictingPredicates.make({
 *   subject: a,
 *   object: a,
 *   predicates: HashSet.fromIterable<MappingPredicate>(["skos:exactMatch", "skos:broadMatch"])
 * })
 * console.log(finding._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConflictingPredicates extends S.Opaque<ConflictingPredicates, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ConflictingPredicates", {
    subject: TermIri,
    object: TermIri,
    predicates: CanonicalHashSet(MappingPredicate),
  }).pipe(
    $I.annoteSchema("ConflictingPredicates", {
      description: "Mapping predicates whose SKOS closure contradicts itself on a pair of exact classes.",
    })
  )
) {}

/**
 * A coherence or consistency finding over a mapping set.
 *
 * **Example** (Match a finding)
 *
 * ```ts import.meta.vitest name="Match a finding"
 * import { MappingIncoherence } from "@beep/ontology/Mapping"
 * import * as S from "effect/Schema"
 *
 * const finding = S.decodeUnknownSync(MappingIncoherence)({
 *   _tag: "DisjointUpperTypes",
 *   subject: "https://example.test/a",
 *   left: "https://example.test/a",
 *   right: "https://example.test/b"
 * })
 * finding._tag // => "DisjointUpperTypes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MappingIncoherence = S.Union([DisjointUpperTypes, ConflictingPredicates]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MappingIncoherence", {
    description: "Disjoint upper types or conflicting predicates found in a mapping set's SKOS closure.",
  })
);

/**
 * **Example** (Type a finding)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { DisjointUpperTypes } from "@beep/ontology/Mapping"
 * import type { MappingIncoherence } from "@beep/ontology/Mapping"
 *
 * const a = TermIri.make("https://example.test/a")
 * const finding: MappingIncoherence = DisjointUpperTypes.make({ subject: a, left: a, right: a })
 * console.log(finding._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MappingIncoherence = typeof MappingIncoherence.Type;

const exactClasses = (terms: ReadonlyArray<TermIri>, rows: ReadonlyArray<Mapping>) => {
  const indices = MutableHashMap.empty<TermIri, Graph.NodeIndex>();
  const graph = Graph.undirected<TermIri, undefined>((mutable) => {
    for (const term of terms) {
      MutableHashMap.set(indices, term, Graph.addNode(mutable, term));
    }
    for (const row of A.filter(rows, (candidate) => candidate.predicate === "skos:exactMatch")) {
      O.map(
        O.all([MutableHashMap.get(indices, row.subject), MutableHashMap.get(indices, row.object)]),
        ([source, target]) => Graph.addEdge(mutable, source, target, undefined)
      );
    }
  });
  return HashMap.fromIterable(
    A.flatMap(Graph.connectedComponents(graph), (component) =>
      A.match(A.sort(A.getSomes(A.map(component, (index) => Graph.getNode(graph, index))), Order.String), {
        onEmpty: A.empty,
        onNonEmpty: (members) => A.map(members, (member) => [member, A.headNonEmpty(members)] as const),
      })
    )
  );
};

type BroaderEdge = readonly [TermIri, TermIri, MappingPredicate];

const broaderGraph = (classes: ReadonlyArray<TermIri>, edges: ReadonlyArray<BroaderEdge>) => {
  const indices = MutableHashMap.empty<TermIri, Graph.NodeIndex>();
  const graph = Graph.directed<TermIri, MappingPredicate>((mutable) => {
    for (const name of classes) {
      MutableHashMap.set(indices, name, Graph.addNode(mutable, name));
    }
    for (const [from, to, predicate] of edges) {
      O.map(O.all([MutableHashMap.get(indices, from), MutableHashMap.get(indices, to)]), ([source, target]) =>
        Graph.addEdge(mutable, source, target, predicate)
      );
    }
  });
  return { graph, indices };
};

const conflicting = (
  subject: TermIri,
  object: TermIri,
  predicates: Iterable<MappingPredicate>
): ConflictingPredicates =>
  ConflictingPredicates.make({ subject, object, predicates: HashSet.fromIterable(predicates) });

const findingKey = (finding: ConflictingPredicates): string =>
  `${finding.subject} ${finding.object} ${A.sort(A.fromIterable(finding.predicates), Order.String)}`;

const byFindingKey = Order.mapInput(Order.String, findingKey);

const neighbourPredicates = HashSet.fromIterable<MappingPredicate>([
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:narrowMatch",
]);

/**
 * Check a mapping set's SKOS closure for consistency and, against a gUFO
 * typing, for coherence.
 *
 * **Details**
 *
 * Exact matches partition the terms into exact classes, each named by its
 * least IRI. Broad matches, and narrow matches reversed, link classes in a
 * broader graph whose reachability is `skos:broaderTransitive`.
 * `ConflictingPredicates` reports a related pair inside one exact class or an
 * exact class that is its own broader (SKOS S46), a related pair whose
 * classes are linked by `broaderTransitive` (S27), and a broader cycle across
 * two or more classes (a repository rule). `DisjointUpperTypes` compares
 * every two typed members of a comparison group, an exact class plus every
 * class one close, broad or narrow edge away: they conflict when their
 * instance categories differ, or when each reaches exactly one Kind and the
 * Kinds differ. Untyped terms never conflict.
 *
 * **Example** (Find exact and broad on one pair)
 *
 * ```ts import.meta.vitest name="Find exact and broad on one pair"
 * import { iri } from "@beep/identity/Registry"
 * import { TypedHierarchy } from "@beep/ontology/Gufo"
 * import { checkMappingCoherence, MappingSet } from "@beep/ontology/Mapping"
 * import * as S from "effect/Schema"
 *
 * const row = (predicate: string) => ({
 *   subject: iri("annotation:Word"),
 *   predicate,
 *   object: iri("nif:Word"),
 *   justification: "semapv:ManualMappingCuration",
 *   confidence: { _tag: "Absent", reason: "not-assessed" }
 * })
 * const set = S.decodeUnknownSync(MappingSet)({
 *   id: "https://example.test/mapping-set",
 *   version: "1",
 *   license: "Apache-2.0",
 *   mappings: [row("skos:exactMatch"), row("skos:broadMatch")]
 * })
 * const empty = S.decodeUnknownSync(TypedHierarchy)({ typing: [], specializes: [] })
 * checkMappingCoherence(empty)(set).map((finding) => finding._tag) // => ["ConflictingPredicates"]
 * ```
 *
 * @param hierarchy - The gUFO typing the coherence check reads.
 * @returns A function from a mapping set to its findings, sorted.
 * @category validation
 * @since 0.0.0
 */
export const checkMappingCoherence =
  (hierarchy: TypedHierarchy) =>
  (set: MappingSet): ReadonlyArray<MappingIncoherence> => {
    const rows = A.sort(A.fromIterable(set.mappings), byTriple<Mapping>());
    const terms = A.sort(A.dedupe(A.flatMap(rows, (row) => [row.subject, row.object])), Order.String);
    const classes = exactClasses(terms, rows);
    const classOf = (term: TermIri): TermIri => O.getOrElse(HashMap.get(classes, term), constant(term));
    const classNames = A.sort(A.dedupe(A.map(terms, classOf)), Order.String);
    const withPredicate = (predicate: MappingPredicate) => A.filter(rows, (row) => row.predicate === predicate);
    const edges: ReadonlyArray<BroaderEdge> = [
      ...A.map(
        withPredicate("skos:broadMatch"),
        (row): BroaderEdge => [classOf(row.subject), classOf(row.object), row.predicate]
      ),
      ...A.map(
        withPredicate("skos:narrowMatch"),
        (row): BroaderEdge => [classOf(row.object), classOf(row.subject), row.predicate]
      ),
    ];
    const { graph, indices } = broaderGraph(classNames, edges);
    const walk = (name: TermIri, direction: "outgoing" | "incoming") =>
      O.match(MutableHashMap.get(indices, name), {
        onNone: A.empty<TermIri>,
        onSome: (start) => graph.pipe(Graph.dfs({ start: [start], direction }), Graph.values, A.fromIterable),
      });
    const between = (from: TermIri, to: TermIri): ReadonlyArray<MappingPredicate> => {
      const ahead = HashSet.fromIterable(walk(from, "outgoing"));
      const behind = HashSet.fromIterable(walk(to, "incoming"));
      return A.map(
        A.filter(edges, ([source, target]) => HashSet.has(ahead, source) && HashSet.has(behind, target)),
        ([, , predicate]) => predicate
      );
    };
    const related = A.map(
      withPredicate("skos:relatedMatch"),
      (row) => [classOf(row.subject), classOf(row.object)] as const
    );
    const insideRelated = A.map(
      A.filter(related, ([left, right]) => left === right),
      ([name]) => conflicting(name, name, ["skos:exactMatch", "skos:relatedMatch"])
    );
    const selfBroader = A.filterMap(classNames, (name) => {
      const loops = A.filter(edges, ([from, to]) => from === name && to === name);
      return A.isReadonlyArrayNonEmpty(loops)
        ? Result.succeed(conflicting(name, name, ["skos:exactMatch", ...A.map(loops, ([, , predicate]) => predicate)]))
        : Result.failVoid;
    });
    const cycles = graph.pipe(
      Graph.stronglyConnectedComponents,
      A.map((component) => {
        const members = A.sort(A.getSomes(A.map(component, (index) => Graph.getNode(graph, index))), Order.String);
        const inside = HashSet.fromIterable(members);
        const predicates = A.map(
          A.filter(edges, ([from, to]) => from !== to && HashSet.has(inside, from) && HashSet.has(inside, to)),
          ([, , predicate]) => predicate
        );
        return O.map(O.all([A.get(members, 0), A.get(members, 1)]), ([subject, object]) =>
          conflicting(subject, object, predicates)
        );
      }),
      A.getSomes
    );
    const relatedBroader = A.filterMap(
      A.filter(related, ([left, right]) => left !== right),
      ([left, right]) => {
        const linking = [...between(left, right), ...between(right, left)];
        return A.isReadonlyArrayNonEmpty(linking)
          ? Result.succeed(conflicting(left, right, ["skos:relatedMatch", ...linking]))
          : Result.failVoid;
      }
    );
    const typingOf = (term: TermIri) => HashMap.get(hierarchy.typing, term);
    const singleKind = (term: TermIri): O.Option<TermIri> => {
      const kinds = A.filter(supertypes(hierarchy)(term), (supertype) =>
        O.exists(typingOf(supertype), (typing) => typing.classType === "Kind")
      );
      return kinds.length === 1 ? A.head(kinds) : O.none();
    };
    const disjoint = (left: TermIri, right: TermIri): boolean =>
      O.exists(typingOf(left), (leftTyping) =>
        O.exists(
          typingOf(right),
          (rightTyping) =>
            leftTyping.instanceCategory !== rightTyping.instanceCategory ||
            O.exists(singleKind(left), (leftKind) => O.exists(singleKind(right), (rightKind) => leftKind !== rightKind))
        )
      );
    const neighbours = A.flatMap(
      A.filter(rows, (row) => HashSet.has(neighbourPredicates, row.predicate)),
      (row: Mapping) => [
        [classOf(row.subject), classOf(row.object)] as const,
        [classOf(row.object), classOf(row.subject)] as const,
      ]
    );
    const coherence = A.dedupeWith(
      A.flatMap(classNames, (name) => {
        const group = HashSet.fromIterable([
          name,
          ...A.map(
            A.filter(neighbours, ([from]) => from === name),
            ([, to]) => to
          ),
        ]);
        const members = A.filter(terms, (term) => HashSet.has(group, classOf(term)) && O.isSome(typingOf(term)));
        return A.flatMap(members, (left, index) =>
          A.filterMap(A.drop(members, index + 1), (right) =>
            disjoint(left, right)
              ? Result.succeed(DisjointUpperTypes.make({ subject: name, left, right }))
              : Result.failVoid
          )
        );
      }),
      (first: DisjointUpperTypes, second: DisjointUpperTypes) =>
        first.left === second.left && first.right === second.right
    );
    const consistency = A.dedupeWith(
      A.sort([...insideRelated, ...selfBroader, ...cycles, ...relatedBroader], byFindingKey),
      (first: ConflictingPredicates, second: ConflictingPredicates) => findingKey(first) === findingKey(second)
    );
    return [...consistency, ...coherence];
  };
