/**
 * gUFO typing for registry terms and the audit that checks a typed
 * specialization hierarchy against the gUFO meta-properties.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { namespace } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { makeNamedNode, serializeTerm } from "@beep/rdf/Rdf";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import type { Dataset, ObjectTerm, Quad } from "@beep/rdf/Rdf";

const $I = $OntologyId.create("Gufo");

const byEntryKey = <Value>() => Order.mapInput(Order.String, (entry: readonly [string, Value]) => entry[0]);

const sortedEntries = <Type, Encoded>(
  entry: S.Codec<readonly [string, Encoded]>,
  map: S.Codec<HashMap.HashMap<TermIri, Type>, HashMap.HashMap<string, Encoded>>
) =>
  S.Array(entry).pipe(
    S.decodeTo(
      map,
      SchemaTransformation.transform({
        decode: (entries: ReadonlyArray<readonly [string, Encoded]>) => HashMap.fromIterable(entries),
        encode: (encoded: HashMap.HashMap<string, Encoded>): ReadonlyArray<readonly [string, Encoded]> =>
          A.sort(HashMap.toEntries(encoded), byEntryKey<Encoded>()),
      })
    )
  );

const termKeyed = <Type, Encoded>(value: S.Codec<Type, Encoded>) =>
  sortedEntries(S.Tuple([S.toEncoded(TermIri), S.toEncoded(value)]), S.HashMap(TermIri, value));

/**
 * A gUFO class type: the meta-class a term instantiates.
 *
 * **Example** (Check a class type)
 *
 * ```ts import.meta.vitest name="Check a class type"
 * import { GufoClassType } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * S.is(GufoClassType)("RoleMixin") // => true
 * S.is(GufoClassType)("Mode") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GufoClassType = LiteralKit([
  "Kind",
  "SubKind",
  "Category",
  "Role",
  "Phase",
  "RoleMixin",
  "PhaseMixin",
  "Mixin",
]).pipe(
  $I.annoteSchema("GufoClassType", {
    description: "A gUFO class type, each literal naming a declared gufo: term.",
  })
);

/**
 * **Example** (Type a class type)
 *
 * ```ts
 * import type { GufoClassType } from "@beep/ontology/Gufo"
 *
 * const classType: GufoClassType = "Kind"
 * console.log(classType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GufoClassType = typeof GufoClassType.Type;

/**
 * A gUFO instance category: what the instances of a typed term are.
 *
 * **Details**
 *
 * gUFO 1.0.0 declares no `Mode` class, so the category has no `Mode` literal.
 *
 * **Example** (Check an instance category)
 *
 * ```ts import.meta.vitest name="Check an instance category"
 * import { GufoInstanceCategory } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * S.is(GufoInstanceCategory)("Relator") // => true
 * S.is(GufoInstanceCategory)("Mode") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GufoInstanceCategory = LiteralKit(["Object", "Relator", "Event", "Quality"]).pipe(
  $I.annoteSchema("GufoInstanceCategory", {
    description: "A gUFO instance category, each literal naming a declared gufo: term.",
  })
);

/**
 * **Example** (Type an instance category)
 *
 * ```ts
 * import type { GufoInstanceCategory } from "@beep/ontology/Gufo"
 *
 * const category: GufoInstanceCategory = "Relator"
 * console.log(category)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GufoInstanceCategory = typeof GufoInstanceCategory.Type;

/**
 * **Example** (Check a cardinality)
 *
 * ```ts import.meta.vitest name="Check a cardinality"
 * import { MediationCardinality } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * S.is(MediationCardinality)(2) // => true
 * S.is(MediationCardinality)(0) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MediationCardinality = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("MediationCardinality", {
    description: "The minimum number of individuals of one mediated type a relator connects, a positive integer.",
  })
);

/**
 * **Example** (Type a cardinality)
 *
 * ```ts
 * import type { MediationCardinality } from "@beep/ontology/Gufo"
 *
 * const cardinality: MediationCardinality = 1
 * console.log(cardinality)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MediationCardinality = typeof MediationCardinality.Type;

const hasMediationExactlyForRelators = (typing: {
  readonly instanceCategory: GufoInstanceCategory;
  readonly mediates: HashMap.HashMap<TermIri, MediationCardinality>;
}) => (typing.instanceCategory === "Relator") === !HashMap.isEmpty(typing.mediates);

/**
 * The gUFO typing of one term: its class type, its instance category and,
 * for a relator, the types it mediates.
 *
 * **Details**
 *
 * `mediates` is non-empty exactly when the instance category is `Relator`. A
 * relator whose two parties play one role type, such as a marriage between
 * two spouses, records that type with cardinality 2.
 *
 * **Example** (Type a marriage relator)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { GufoTyping } from "@beep/ontology/Gufo"
 * import * as HashMap from "effect/HashMap"
 * import * as S from "effect/Schema"
 *
 * const spouse = S.decodeUnknownSync(TermIri)("https://example.test/Spouse")
 * const marriage = GufoTyping.make({
 *   classType: "Kind",
 *   instanceCategory: "Relator",
 *   mediates: HashMap.make([spouse, 2])
 * })
 * console.log(marriage.instanceCategory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GufoTyping extends S.Opaque<GufoTyping, { readonly brand: unique symbol }>()(
  S.Struct({
    classType: GufoClassType,
    instanceCategory: GufoInstanceCategory,
    mediates: termKeyed(MediationCardinality),
  }).pipe(
    S.check(
      S.makeFilter(
        hasMediationExactlyForRelators,
        $I.annote("GufoTypingMediation", {
          title: "Relator Mediation",
          description: "A typing mediates at least one type exactly when its instance category is Relator.",
          message: "Expected mediated types exactly for a Relator.",
        })
      )
    ),
    $I.annoteSchema("GufoTyping", {
      description: "The gUFO class type, instance category and mediated types of one term.",
    })
  )
) {}

/**
 * **Example** (Encode typings in IRI order)
 *
 * ```ts import.meta.vitest name="Encode typings in IRI order"
 * import { GufoTypings } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const typing = { classType: "Category", instanceCategory: "Object", mediates: [] }
 * const typings = S.decodeUnknownSync(GufoTypings)([
 *   ["https://example.test/b", typing],
 *   ["https://example.test/a", typing]
 * ])
 * S.encodeSync(GufoTypings)(typings).map(([iri]) => iri) // => ["https://example.test/a", "https://example.test/b"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GufoTypings = S.Tuple([S.toEncoded(TermIri), S.toEncoded(GufoTyping)]).pipe(
  S.Array,
  S.decodeTo(
    S.HashMap(TermIri, GufoTyping),
    SchemaTransformation.transform({
      decode: HashMap.fromIterable,
      encode: (
        typings: HashMap.HashMap<string, typeof GufoTyping.Encoded>
      ): ReadonlyArray<readonly [string, typeof GufoTyping.Encoded]> =>
        A.sort(HashMap.toEntries(typings), byEntryKey<typeof GufoTyping.Encoded>()),
    })
  ),
  $I.annoteSchema("GufoTypings", {
    description: "gUFO typings keyed by term IRI, encoded as entries sorted by IRI.",
  })
);

/**
 * **Example** (Type typings)
 *
 * ```ts
 * import type { GufoTypings } from "@beep/ontology/Gufo"
 * import * as HashMap from "effect/HashMap"
 *
 * const typings: GufoTypings = HashMap.empty()
 * console.log(HashMap.size(typings))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GufoTypings = typeof GufoTypings.Type;

/**
 * **Details**
 *
 * `specializes` maps each term to its direct supertypes. A term absent from
 * `typing` is untyped, and the audit never guesses its type.
 *
 * **Example** (Build a hierarchy)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { GufoTyping, TypedHierarchy } from "@beep/ontology/Gufo"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 *
 * const person = S.decodeUnknownSync(TermIri)("https://example.test/Person")
 * const student = S.decodeUnknownSync(TermIri)("https://example.test/Student")
 * const hierarchy = TypedHierarchy.make({
 *   typing: HashMap.make(
 *     [person, GufoTyping.make({ classType: "Kind", instanceCategory: "Object", mediates: HashMap.empty() })],
 *     [student, GufoTyping.make({ classType: "Role", instanceCategory: "Object", mediates: HashMap.empty() })]
 *   ),
 *   specializes: HashMap.make([student, HashSet.make(person)])
 * })
 * console.log(HashMap.size(hierarchy.typing))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypedHierarchy extends S.Opaque<TypedHierarchy, { readonly brand: unique symbol }>()(
  S.Struct({
    typing: GufoTypings,
    specializes: termKeyed(TermIri.pipe(CanonicalHashSet)),
  }).pipe(
    $I.annoteSchema("TypedHierarchy", {
      description: "Direct specializations between term IRIs and a partial gUFO typing of those terms.",
    })
  )
) {}

/**
 * A Role or Phase whose supertypes hold no Kind and no untyped term.
 *
 * **Example** (Record a role without a kind)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { RoleWithoutKind } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const violation = RoleWithoutKind.make({ term: S.decodeUnknownSync(TermIri)("https://example.test/Student") })
 * console.log(violation._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RoleWithoutKind extends S.Opaque<RoleWithoutKind, { readonly brand: unique symbol }>()(
  S.TaggedStruct("RoleWithoutKind", { term: TermIri }).pipe(
    $I.annoteSchema("RoleWithoutKind", {
      description: "A Role or Phase that specializes no Kind, with every supertype typed.",
    })
  )
) {}

/**
 * A rigid term that specializes an anti-rigid one.
 *
 * **Example** (Record a rigid term under a role)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { RigidSpecializesAntiRigid } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const violation = RigidSpecializesAntiRigid.make({
 *   term: S.decodeUnknownSync(TermIri)("https://example.test/Person"),
 *   supertype: S.decodeUnknownSync(TermIri)("https://example.test/Student")
 * })
 * console.log(violation.supertype)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RigidSpecializesAntiRigid extends S.Opaque<RigidSpecializesAntiRigid, { readonly brand: unique symbol }>()(
  S.TaggedStruct("RigidSpecializesAntiRigid", { term: TermIri, supertype: TermIri }).pipe(
    $I.annoteSchema("RigidSpecializesAntiRigid", {
      description: "A Kind, SubKind or Category that specializes a Role, Phase, RoleMixin or PhaseMixin.",
    })
  )
) {}

/**
 * A relator whose mediation cardinalities sum to less than two.
 *
 * **Example** (Record an undermediated relator)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { RelatorUndermediated } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const violation = RelatorUndermediated.make({ term: S.decodeUnknownSync(TermIri)("https://example.test/Enrollment") })
 * console.log(violation._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelatorUndermediated extends S.Opaque<RelatorUndermediated, { readonly brand: unique symbol }>()(
  S.TaggedStruct("RelatorUndermediated", { term: TermIri }).pipe(
    $I.annoteSchema("RelatorUndermediated", {
      description: "A relator that connects fewer than two individuals.",
    })
  )
) {}

/**
 * A violation the gUFO audit reports for one term.
 *
 * **Example** (Match a violation)
 *
 * ```ts import.meta.vitest name="Match a violation"
 * import { OntoViolation } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const violation = S.decodeUnknownSync(OntoViolation)({ _tag: "RelatorUndermediated", term: "https://example.test/r" })
 * violation._tag // => "RelatorUndermediated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntoViolation = S.Union([RoleWithoutKind, RigidSpecializesAntiRigid, RelatorUndermediated]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OntoViolation", {
    description: "A role without a kind, a rigid term under an anti-rigid one, or an undermediated relator.",
  })
);

/**
 * **Example** (Type a violation)
 *
 * ```ts
 * import { TermIri } from "@beep/identity/Term"
 * import { RelatorUndermediated } from "@beep/ontology/Gufo"
 * import type { OntoViolation } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const violation: OntoViolation = RelatorUndermediated.make({ term: S.decodeUnknownSync(TermIri)("https://example.test/r") })
 * console.log(violation._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntoViolation = typeof OntoViolation.Type;

const Rigidity = LiteralKit(["rigid", "anti-rigid", "semi-rigid"]).pipe(
  $I.annoteSchema("Rigidity", {
    description: "Whether a gUFO class type is rigid, anti-rigid or semi-rigid.",
  })
);

const rigidityOf = GufoClassType.match({
  Kind: () => Rigidity.Enum.rigid,
  SubKind: () => Rigidity.Enum.rigid,
  Category: () => Rigidity.Enum.rigid,
  Role: () => Rigidity.Enum["anti-rigid"],
  Phase: () => Rigidity.Enum["anti-rigid"],
  RoleMixin: () => Rigidity.Enum["anti-rigid"],
  PhaseMixin: () => Rigidity.Enum["anti-rigid"],
  Mixin: () => Rigidity.Enum["semi-rigid"],
});

const isSortalRole = GufoClassType.match({
  Kind: () => false,
  SubKind: () => false,
  Category: () => false,
  Role: () => true,
  Phase: () => true,
  RoleMixin: () => false,
  PhaseMixin: () => false,
  Mixin: () => false,
});

const specializationGraph = (hierarchy: TypedHierarchy) => {
  const indices = MutableHashMap.empty<TermIri, Graph.NodeIndex>();
  const nodeFor = (mutable: Graph.MutableDirectedGraph<TermIri, undefined>, term: TermIri) =>
    O.getOrElse(MutableHashMap.get(indices, term), () => {
      const index = Graph.addNode(mutable, term);
      MutableHashMap.set(indices, term, index);
      return index;
    });
  const graph = Graph.directed<TermIri, undefined>((mutable) => {
    for (const [term, supertypes] of HashMap.toEntries(hierarchy.specializes)) {
      const source = nodeFor(mutable, term);
      for (const supertype of supertypes) {
        Graph.addEdge(mutable, source, nodeFor(mutable, supertype), undefined);
      }
    }
  });
  return { graph, indices };
};

/**
 * The reflexive-transitive supertypes of a term, sorted by IRI.
 *
 * **Example** (Read the supertypes of a role)
 *
 * ```ts import.meta.vitest name="Read the supertypes of a role"
 * import { TermIri } from "@beep/identity/Term"
 * import { supertypes, TypedHierarchy } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const hierarchy = S.decodeUnknownSync(TypedHierarchy)({
 *   typing: [],
 *   specializes: [
 *     ["https://example.test/Student", ["https://example.test/Person"]],
 *     ["https://example.test/Person", ["https://example.test/Agent"]]
 *   ]
 * })
 * supertypes(hierarchy)(TermIri.make("https://example.test/Student")).length // => 3
 * ```
 *
 * @param hierarchy - The specialization hierarchy.
 * @returns A function from a term IRI to the term and every term it specializes.
 * @category getters
 * @since 0.0.0
 */
export const supertypes =
  (hierarchy: TypedHierarchy) =>
  (term: TermIri): ReadonlyArray<TermIri> => {
    const { graph, indices } = specializationGraph(hierarchy);
    return O.match(MutableHashMap.get(indices, term), {
      onNone: () => [term],
      onSome: (start) =>
        graph.pipe(
          Graph.dfs({ start: [start], direction: "outgoing" }),
          Graph.values,
          A.fromIterable,
          A.sort(Order.String)
        ),
    });
  };

const strictSupertypes = (hierarchy: TypedHierarchy, term: TermIri): ReadonlyArray<TermIri> =>
  A.filter(supertypes(hierarchy)(term), (supertype) => supertype !== term);

const roleWithoutKind = (
  hierarchy: TypedHierarchy,
  term: TermIri,
  typing: GufoTyping,
  supertypes: ReadonlyArray<TermIri>
): ReadonlyArray<OntoViolation> =>
  isSortalRole(typing.classType) &&
  A.every(supertypes, (supertype) =>
    O.exists(HashMap.get(hierarchy.typing, supertype), (typed) => typed.classType !== "Kind")
  )
    ? [RoleWithoutKind.make({ term })]
    : [];

const rigidUnderAntiRigid = (
  hierarchy: TypedHierarchy,
  term: TermIri,
  typing: GufoTyping,
  supertypes: ReadonlyArray<TermIri>
): ReadonlyArray<OntoViolation> =>
  rigidityOf(typing.classType) === "rigid"
    ? pipe(
        supertypes,
        A.filter((supertype) =>
          O.exists(HashMap.get(hierarchy.typing, supertype), (typed) => rigidityOf(typed.classType) === "anti-rigid")
        ),
        A.map((supertype): OntoViolation => RigidSpecializesAntiRigid.make({ term, supertype }))
      )
    : [];

const relatorUndermediated = (term: TermIri, typing: GufoTyping): ReadonlyArray<OntoViolation> =>
  typing.instanceCategory === "Relator" &&
  HashMap.reduce(typing.mediates, 0, (total, cardinality) => total + cardinality) < 2
    ? [RelatorUndermediated.make({ term })]
    : [];

/**
 * Audit one term of a typed hierarchy against the gUFO meta-properties.
 *
 * **Details**
 *
 * An untyped term yields no violation. `RoleWithoutKind` holds for a Role or
 * Phase whose reflexive-transitive supertypes contain no Kind and no untyped
 * term, since an untyped supertype could be a Kind; a RoleMixin is exempt,
 * because a mixin is played across kinds. `RigidSpecializesAntiRigid` covers
 * typed pairs only, with `Mixin` semi-rigid and exempt. `RelatorUndermediated`
 * holds for a relator whose mediation cardinalities sum to less than two.
 * Every violation reported on a partial typing therefore holds on every
 * completion of it.
 *
 * **Example** (Audit a role with no kind)
 *
 * ```ts import.meta.vitest name="Audit a role with no kind"
 * import { TermIri } from "@beep/identity/Term"
 * import { audit, TypedHierarchy } from "@beep/ontology/Gufo"
 * import * as S from "effect/Schema"
 *
 * const hierarchy = S.decodeUnknownSync(TypedHierarchy)({
 *   typing: [
 *     ["https://example.test/Agent", { classType: "Category", instanceCategory: "Object", mediates: [] }],
 *     ["https://example.test/Student", { classType: "Role", instanceCategory: "Object", mediates: [] }]
 *   ],
 *   specializes: [["https://example.test/Student", ["https://example.test/Agent"]]]
 * })
 * const student = S.decodeUnknownSync(TermIri)("https://example.test/Student")
 * audit(hierarchy)(student).map((violation) => violation._tag) // => ["RoleWithoutKind"]
 * ```
 *
 * @param hierarchy - The specialization hierarchy and its partial typing.
 * @returns A function from a term IRI to its violations.
 * @category validation
 * @since 0.0.0
 */
export const audit =
  (hierarchy: TypedHierarchy) =>
  (term: TermIri): ReadonlyArray<OntoViolation> =>
    O.match(HashMap.get(hierarchy.typing, term), {
      onNone: A.empty,
      onSome: (typing) => {
        const supertypes = strictSupertypes(hierarchy, term);
        return [
          ...roleWithoutKind(hierarchy, term, typing, supertypes),
          ...rigidUnderAntiRigid(hierarchy, term, typing, supertypes),
          ...relatorUndermediated(term, typing),
        ];
      },
    });

/**
 * **Details**
 *
 * A relator needs a mediated type to have a {@link GufoTyping}, so a dataset
 * that types a term as a relator and states no `gufo:mediates` restriction
 * for it lists the term in `unmediated` instead of `hierarchy.typing`.
 *
 * **Example** (Read stated typings)
 *
 * ```ts
 * import { StatedTypings, TypedHierarchy } from "@beep/ontology/Gufo"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const stated = StatedTypings.make({
 *   hierarchy: TypedHierarchy.make({ typing: HashMap.empty(), specializes: HashMap.empty() }),
 *   unmediated: HashSet.empty()
 * })
 * console.log(HashSet.size(stated.unmediated))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatedTypings extends S.Opaque<StatedTypings, { readonly brand: unique symbol }>()(
  S.Struct({
    hierarchy: TypedHierarchy,
    unmediated: TermIri.pipe(CanonicalHashSet),
  }).pipe(
    $I.annoteSchema("StatedTypings", {
      description: "The gUFO typings and specializations a dataset states, and its relators stated without mediation.",
    })
  )
) {}

const GUFO_NAMESPACE = namespace("gufo").iri;
const OWL_NAMESPACE = namespace("owl").iri;
const RDF_TYPE_IRI = `${namespace("rdf").iri}type`;
const SUBCLASS_OF_IRI = `${namespace("rdfs").iri}subClassOf`;
const MEDIATES_IRI = `${GUFO_NAMESPACE}mediates`;
const ON_PROPERTY_IRI = `${OWL_NAMESPACE}onProperty`;
const SOME_VALUES_FROM_IRI = `${OWL_NAMESPACE}someValuesFrom`;
const ON_CLASS_IRI = `${OWL_NAMESPACE}onClass`;
const CARDINALITY_IRIS = HashSet.make(
  `${OWL_NAMESPACE}qualifiedCardinality`,
  `${OWL_NAMESPACE}minQualifiedCardinality`
);

const CardinalityLexical = S.FiniteFromString.pipe(
  S.decodeTo(MediationCardinality),
  $I.annoteSchema("CardinalityLexical", {
    description: "The lexical form of an OWL qualified cardinality read as a mediation cardinality.",
  })
);

const decodeCardinality = S.decodeUnknownOption(CardinalityLexical);
const decodeTermIri = S.decodeUnknownOption(TermIri);
const decodeClassType = S.decodeUnknownOption(GufoClassType);

type QuadIndex = HashMap.HashMap<string, ReadonlyArray<Quad>>;

const indexBySubject = (dataset: Dataset): QuadIndex =>
  dataset.quads.pipe(
    A.groupBy((quad) => serializeTerm(quad.subject)),
    R.toEntries,
    HashMap.fromIterable
  );

const objectsOf = (index: QuadIndex, subject: string, predicate: string): ReadonlyArray<ObjectTerm> =>
  pipe(
    HashMap.get(index, subject),
    O.getOrElse(A.empty<Quad>),
    A.filter((quad) => quad.predicate.value === predicate),
    A.map((quad) => quad.object)
  );

const namedIris = A.flatMap(
  (term: ObjectTerm): ReadonlyArray<string> => (term.termType === "NamedNode" ? [term.value] : [])
);

const namedKey = (value: string) => serializeTerm(makeNamedNode(value));

const isGufoIri = Str.startsWith(GUFO_NAMESPACE);

const classTypeOf = (index: QuadIndex, subject: string): O.Option<GufoClassType> =>
  pipe(
    namedIris(objectsOf(index, subject, RDF_TYPE_IRI)),
    A.filter(isGufoIri),
    A.flatMap((type) => O.toArray(decodeClassType(Str.slice(GUFO_NAMESPACE.length)(type)))),
    A.dedupe,
    O.liftPredicate((types) => types.length === 1),
    O.flatMap(A.head)
  );

const superclassClosure = (index: QuadIndex, term: string): HashSet.HashSet<string> => {
  let seen = HashSet.make(term);
  let frontier: ReadonlyArray<string> = [term];
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    const next = pipe(
      frontier,
      A.flatMap((current) => namedIris(objectsOf(index, namedKey(current), SUBCLASS_OF_IRI))),
      A.filter((supertype) => !HashSet.has(seen, supertype)),
      A.dedupe
    );
    seen = HashSet.union(seen, HashSet.fromIterable(next));
    frontier = next;
  }
  return seen;
};

const instanceCategoryOf = (closure: HashSet.HashSet<string>): GufoInstanceCategory =>
  pipe(
    A.make(GufoInstanceCategory.Enum.Relator, GufoInstanceCategory.Enum.Quality, GufoInstanceCategory.Enum.Event),
    A.findFirst((category) => HashSet.has(closure, `${GUFO_NAMESPACE}${category}`)),
    O.getOrElse(() => GufoInstanceCategory.Enum.Object)
  );

const mediationsOf = (
  index: QuadIndex,
  closure: HashSet.HashSet<string>
): HashMap.HashMap<TermIri, MediationCardinality> =>
  pipe(
    A.fromIterable(closure),
    A.flatMap((type) => objectsOf(index, namedKey(type), SUBCLASS_OF_IRI)),
    A.filter((restriction) => restriction.termType !== "NamedNode" && restriction.termType !== "Literal"),
    A.map(serializeTerm),
    A.filter((restriction) => A.contains(namedIris(objectsOf(index, restriction, ON_PROPERTY_IRI)), MEDIATES_IRI)),
    A.flatMap((restriction): ReadonlyArray<readonly [TermIri, MediationCardinality]> => {
      const someValuesFrom = A.map(
        namedIris(objectsOf(index, restriction, SOME_VALUES_FROM_IRI)),
        (target) => [target, 1] as const
      );
      const qualified = A.flatMap(namedIris(objectsOf(index, restriction, ON_CLASS_IRI)), (target) =>
        pipe(
          HashMap.get(index, restriction),
          O.getOrElse(A.empty<Quad>),
          A.filter((quad) => HashSet.has(CARDINALITY_IRIS, quad.predicate.value)),
          A.flatMap((quad) =>
            quad.object.termType === "Literal" ? O.toArray(decodeCardinality(quad.object.value)) : []
          ),
          A.map((cardinality) => [target, cardinality] as const)
        )
      );
      return A.flatMap([...someValuesFrom, ...qualified], ([target, cardinality]) =>
        A.map(O.toArray(decodeTermIri(target)), (term) => [term, cardinality] as const)
      );
    }),
    A.reduce(HashMap.empty<TermIri, MediationCardinality>(), (mediations, [target, cardinality]) =>
      HashMap.set(
        mediations,
        target,
        O.match(HashMap.get(mediations, target), {
          onNone: () => cardinality,
          onSome: (stated) => Math.max(stated, cardinality),
        })
      )
    )
  );

/**
 * Read the gUFO typings and specializations a dataset states.
 *
 * **Details**
 *
 * A named non-gUFO subject is typed when it states exactly one
 * `rdf:type gufo:<ClassType>`; a term that states none or several is
 * untyped, and the audit is silent on it. Its instance category is the first
 * of `gufo:Relator`, `gufo:Quality` and `gufo:Event` its `rdfs:subClassOf`
 * closure reaches, otherwise `Object`. A relator's mediations are the
 * `owl:onProperty gufo:mediates` restrictions its closure states, with
 * `owl:someValuesFrom` read as cardinality 1 and `owl:qualifiedCardinality` or
 * `owl:minQualifiedCardinality` with `owl:onClass` read as its value; the
 * largest cardinality per mediated type wins. `specializes` holds the named
 * non-gUFO superclasses each subject states.
 *
 * **Example** (Read a role without a kind)
 *
 * ```ts import.meta.vitest name="Read a role without a kind"
 * import { TermIri } from "@beep/identity/Term"
 * import { audit, typingsFromDataset } from "@beep/ontology/Gufo"
 * import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf"
 *
 * const student = makeNamedNode("https://example.test/Student")
 * const stated = typingsFromDataset(
 *   makeDataset([makeQuad(student, RDF_TYPE, makeNamedNode("http://purl.org/nemo/gufo#Role"))])
 * )
 * audit(stated.hierarchy)(TermIri.make(student.value)).map((violation) => violation._tag) // => ["RoleWithoutKind"]
 * ```
 *
 * @param dataset - The dataset whose assertions state the typings.
 * @returns The stated typings, specializations and unmediated relators.
 * @category constructors
 * @since 0.0.0
 */
export const typingsFromDataset = (dataset: Dataset): StatedTypings => {
  const index = indexBySubject(dataset);
  const subjects = pipe(
    A.fromIterable(dataset.quads),
    A.flatMap((quad) => (quad.subject.termType === "NamedNode" ? [quad.subject.value] : [])),
    A.filter((subject) => !isGufoIri(subject)),
    A.dedupe,
    A.flatMap((subject) => A.map(O.toArray(decodeTermIri(subject)), (term) => [subject, term] as const))
  );
  const stated = A.map(subjects, ([subject, term]) => {
    const key = namedKey(subject);
    const supertypes = pipe(
      namedIris(objectsOf(index, key, SUBCLASS_OF_IRI)),
      A.filter((supertype) => !isGufoIri(supertype)),
      A.flatMap((supertype) => O.toArray(decodeTermIri(supertype)))
    );
    const typing = O.map(classTypeOf(index, key), (classType) => {
      const closure = superclassClosure(index, subject);
      const instanceCategory = instanceCategoryOf(closure);
      return {
        classType,
        instanceCategory,
        mediates:
          instanceCategory === GufoInstanceCategory.Enum.Relator
            ? mediationsOf(index, closure)
            : HashMap.empty<TermIri, MediationCardinality>(),
      };
    });
    return { term, supertypes, typing };
  });
  const isUnmediated = (typing: (typeof stated)[number]["typing"]) =>
    O.exists(typing, (stated) => !hasMediationExactlyForRelators(stated));
  return StatedTypings.make({
    hierarchy: TypedHierarchy.make({
      typing: pipe(
        stated,
        A.flatMap(({ term, typing }) =>
          isUnmediated(typing) ? [] : A.map(O.toArray(typing), (value) => [term, GufoTyping.make(value)] as const)
        ),
        HashMap.fromIterable
      ),
      specializes: pipe(
        stated,
        A.filter(({ supertypes }) => A.isReadonlyArrayNonEmpty(supertypes)),
        A.map(({ term, supertypes }) => [term, HashSet.fromIterable(supertypes)] as const),
        HashMap.fromIterable
      ),
    }),
    unmediated: pipe(
      stated,
      A.filter(({ typing }) => isUnmediated(typing)),
      A.map(({ term }) => term),
      HashSet.fromIterable
    ),
  });
};

/**
 * Audit one term against the typings a dataset states.
 *
 * **Details**
 *
 * A relator stated without mediation is `RelatorUndermediated`; every other
 * term is audited by {@link audit} over the stated hierarchy.
 *
 * **Example** (Audit an unmediated relator)
 *
 * ```ts import.meta.vitest name="Audit an unmediated relator"
 * import { TermIri } from "@beep/identity/Term"
 * import { auditStated, typingsFromDataset } from "@beep/ontology/Gufo"
 * import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf"
 *
 * const marriage = makeNamedNode("https://example.test/Marriage")
 * const subClassOf = makeNamedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf")
 * const stated = typingsFromDataset(
 *   makeDataset([
 *     makeQuad(marriage, RDF_TYPE, makeNamedNode("http://purl.org/nemo/gufo#Kind")),
 *     makeQuad(marriage, subClassOf, makeNamedNode("http://purl.org/nemo/gufo#Relator"))
 *   ])
 * )
 * auditStated(stated)(TermIri.make(marriage.value)).map((violation) => violation._tag) // => ["RelatorUndermediated"]
 * ```
 *
 * @param stated - The typings a dataset states.
 * @returns A function from a term IRI to its violations.
 * @category validation
 * @since 0.0.0
 */
export const auditStated =
  (stated: StatedTypings) =>
  (term: TermIri): ReadonlyArray<OntoViolation> =>
    HashSet.has(stated.unmediated, term) ? [RelatorUndermediated.make({ term })] : audit(stated.hierarchy)(term);
