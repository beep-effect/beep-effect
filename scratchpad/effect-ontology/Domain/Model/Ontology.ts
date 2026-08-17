/**
 * Versioned ontology references, class and property definitions, and immutable
 * ontology snapshots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf/Iri";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as PrimaryKey from "effect/PrimaryKey";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ContentHash, Namespace, OntologyName } from "../Identity.ts";
import { PathLayout } from "../PathLayout.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/Ontology");

const emptyIris = (): ReadonlyArray<IRI> => [];

const localName = (iri: string): string =>
  pipe(
    Str.split(/[/#]/)(iri),
    A.filter(Str.isNonEmpty),
    A.last,
    O.getOrElse(() => iri)
  );

const enhanceLabel = (label: string): string => {
  const split = pipe(label, Str.replace(/([a-z0-9])([A-Z])/g, "$1 $2"), Str.toLowerCase);
  return Bool.match(split === Str.toLowerCase(label), {
    onFalse: () => `${label} ${split}`,
    onTrue: () => label,
  });
};

const semanticLabels = (
  label: string,
  prefLabels: ReadonlyArray<string>,
  altLabels: ReadonlyArray<string>,
  hiddenLabels: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const primary = pipe(
    A.head(prefLabels),
    O.getOrElse(() => label)
  );
  return pipe(
    A.of(enhanceLabel(primary)),
    A.appendAll(pipe(prefLabels, A.drop(1), A.map(enhanceLabel))),
    A.appendAll(A.map(altLabels, enhanceLabel)),
    A.appendAll(A.map(hiddenLabels, enhanceLabel))
  );
};

const optionalNamesLine: {
  (prefix: string, iris: ReadonlyArray<IRI>): O.Option<string>;
  (iris: ReadonlyArray<IRI>): (prefix: string) => O.Option<string>;
} = dual(
  2,
  (prefix: string, iris: ReadonlyArray<IRI>): O.Option<string> =>
    pipe(
      iris,
      A.map(localName),
      A.match({
        onEmpty: O.none<string>,
        onNonEmpty: (names) => O.some(`${prefix}: ${A.join(names, ", ")}`),
      })
    )
);

const relatedLine = (
  broader: ReadonlyArray<IRI>,
  narrower: ReadonlyArray<IRI>,
  related: ReadonlyArray<IRI>
): O.Option<string> =>
  pipe(
    A.getSomes([
      optionalNamesLine("Broader", broader),
      optionalNamesLine("Narrower", narrower),
      optionalNamesLine("Related", related),
    ]),
    A.match({
      onEmpty: O.none<string>,
      onNonEmpty: (parts) => O.some(A.join(parts, " | ")),
    })
  );

const SkosFields = {
  prefLabels: S.Array(S.NonEmptyString).pipe(
    SchemaUtils.withEmptyArrayDefaults<string>(),
    S.annotateKey({ description: "Preferred SKOS labels in display order." })
  ),
  altLabels: S.Array(S.NonEmptyString).pipe(
    SchemaUtils.withEmptyArrayDefaults<string>(),
    S.annotateKey({ description: "Alternative SKOS labels and synonyms." })
  ),
  hiddenLabels: S.Array(S.NonEmptyString).pipe(
    SchemaUtils.withEmptyArrayDefaults<string>(),
    S.annotateKey({ description: "Hidden SKOS labels such as abbreviations or common misspellings." })
  ),
  definition: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Formal SKOS definition when supplied." })
  ),
  scopeNote: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "SKOS note clarifying the intended conceptual scope." })
  ),
  example: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Illustrative SKOS example when supplied." })
  ),
  broader: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Broader SKOS concepts." })
  ),
  narrower: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Narrower SKOS concepts." })
  ),
  related: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Non-hierarchical related SKOS concepts." })
  ),
  exactMatch: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "SKOS concepts judged interchangeable across vocabularies." })
  ),
  closeMatch: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Closely aligned SKOS concepts in other vocabularies." })
  ),
};

/**
 * Whether an ontology property links resources or carries a literal datatype.
 *
 * **Example** (Check property range kinds)
 *
 * ```ts
 * import { PropertyRangeKind } from "@effect-ontology/Model/Ontology"
 *
 * console.log(PropertyRangeKind.is.object("object")) // true
 * console.log(PropertyRangeKind.is.datatype("object")) // false
 * ```
 *
 * @invariant Exactly one of `object` or `datatype`.
 * @category schemas
 * @since 0.0.0
 */
export const PropertyRangeKind = LiteralKit(["object", "datatype"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("object", "datatype"),
  })
  .annotate(
    $I.annote("PropertyRangeKind", {
      description: "Closed property-range taxonomy distinguishing resource links from literal values.",
    })
  );

/**
 * Decoded `object` or `datatype` literal produced by the {@link PropertyRangeKind} schema.
 *
 * **Example** (Decode PropertyRangeKind)
 *
 * ```ts
 * import { PropertyRangeKind } from "@effect-ontology/Domain/Model/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizePropertyRangeKind = (_value: PropertyRangeKind): string => "valid property range kind"
 *
 * console.log(O.map(S.decodeUnknownOption(PropertyRangeKind)({}), summarizePropertyRangeKind))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PropertyRangeKind = typeof PropertyRangeKind.Type;

const OntologyRefFields = {
  namespace: Namespace.annotateKey({
    description: "Validated storage namespace containing the ontology.",
  }),
  name: OntologyName.annotateKey({
    description: "Validated ontology name within its namespace.",
  }),
  contentHash: ContentHash.annotateKey({
    description: "Full content digest identifying the exact ontology bytes.",
  }),
};

/**
 * Content-addressed reference to one immutable ontology version.
 *
 * **Details**
 *
 * Namespace and name select the logical ontology while the full SHA-256 digest
 * selects its exact bytes.
 *
 * **Example** (Create a content-addressed reference)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyRef } from "@effect-ontology/Model/Ontology"
 *
 * const ref = S.decodeUnknownOption(OntologyRef)({
 *   namespace: "legal",
 *   name: "claims",
 *   contentHash: "a".repeat(64)
 * })
 * console.log(O.map(ref, (value) => value.shortId))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class OntologyRef extends S.Class<OntologyRef>($I`OntologyRef`)(
  OntologyRefFields,
  $I.annote("OntologyRef", {
    description: "Content-addressed reference to one immutable ontology version.",
  })
) {
  /**
   * Effect primary key for identity-aware collections.
   *
   * **Example** (Build a stable primary key)
   *
   * ```ts
   * import { PrimaryKey } from "effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyRef } from "@effect-ontology/Model/Ontology"
   *
   * const ref = S.decodeUnknownOption(OntologyRef)({
   *   namespace: "legal",
   *   name: "claims",
   *   contentHash: "a".repeat(64)
   * })
   * console.log(O.map(ref, (value) => value[PrimaryKey.symbol]()))
   * ```
   *
   * @returns Stable namespace, name, and full-content-hash identity.
   */
  [PrimaryKey.symbol](): string {
    return `${this.namespace}:${this.name}@${this.contentHash}`;
  }

  /**
   * Canonical storage path for the referenced Turtle document.
   *
   * **Example** (Encode a storage path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyRef } from "@effect-ontology/Model/Ontology"
   *
   * const ref = S.decodeUnknownOption(OntologyRef)({
   *   namespace: "legal",
   *   name: "claims",
   *   contentHash: "a".repeat(64)
   * })
   * console.log(O.map(ref, (value) => value.storagePath))
   * ```
   *
   * @returns Reversible path produced by the shared ontology path layout.
   */
  get storagePath(): string {
    return PathLayout.ontology.encode(this.namespace, this.name, this.contentHash);
  }

  /**
   * Compact human-readable namespace and name.
   *
   * **Example** (Read a compact identifier)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyRef } from "@effect-ontology/Model/Ontology"
   *
   * const ref = S.decodeUnknownOption(OntologyRef)({
   *   namespace: "legal",
   *   name: "claims",
   *   contentHash: "a".repeat(64)
   * })
   * console.log(O.map(ref, (value) => value.shortId))
   * ```
   *
   * @returns Slash-delimited logical ontology identity without its version hash.
   */
  get shortId(): string {
    return `${this.namespace}/${this.name}`;
  }

  /** Decodes an unknown input into a validated ontology reference. */
  static readonly fromUnknown = S.decodeUnknownSync(OntologyRef);

  /** Parses a canonical ontology storage path. */
  static readonly fromPath = (path: unknown) =>
    pipe(
      PathLayout.ontology.decode(path),
      Result.map(([namespace, name, contentHash]) =>
        OntologyRef.make({
          namespace,
          name,
          contentHash,
        })
      )
    );
}

const ClassDefinitionFields = {
  id: IRI.annotateKey({ description: "Full IRI of the OWL or RDFS class." }),
  label: S.NonEmptyString.annotateKey({ description: "Primary human-readable class label." }),
  comment: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Informal RDFS class description when supplied." })
  ),
  properties: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Property IRIs applicable to this class." })
  ),
  ...SkosFields,
  equivalentClass: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "OWL classes declared equivalent to this class." })
  ),
};

class ClassDefinitionModel extends S.Class<ClassDefinitionModel>($I`ClassDefinition`)(
  ClassDefinitionFields,
  $I.annote("ClassDefinition", {
    description: "OWL or RDFS class metadata normalized for lookup and semantic search.",
  })
) {
  /**
   * Builds a stable semantic-search document.
   *
   * **Example** (Render a semantic-search document)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { ClassDefinition } from "@effect-ontology/Model/Ontology"
   *
   * const definition = S.decodeUnknownOption(ClassDefinition)({
   *   id: "https://schema.org/Person",
   *   label: "Person"
   * })
   * console.log(O.map(definition, (value) => value.toDocument()))
   * ```
   *
   * @returns Newline-delimited labels, description, properties, and related concepts.
   */
  toDocument(): string {
    const description = O.orElse(this.definition, () => this.comment);
    return pipe(
      semanticLabels(this.label, this.prefLabels, this.altLabels, this.hiddenLabels),
      A.appendAll(O.toArray(description)),
      A.appendAll(O.toArray(this.scopeNote)),
      A.appendAll(O.toArray(O.map(this.example, (value) => `Example: ${value}`))),
      A.appendAll(O.toArray(optionalNamesLine("Properties", this.properties))),
      A.appendAll(O.toArray(relatedLine(this.broader, this.narrower, this.related))),
      A.join("\n")
    );
  }
}

/**
 * Normalized OWL or RDFS class definition.
 *
 * **Details**
 *
 * Optional prose is represented with `Option`; all repeatable RDF and SKOS
 * predicates default to empty immutable arrays. `toDocument` preserves
 * synonyms and local property names for search without duplicating indexing
 * logic elsewhere.
 *
 * **Example** (Decode ClassDefinition)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClassDefinition } from "@effect-ontology/Model/Ontology"
 *
 * const person = S.decodeUnknownOption(ClassDefinition)({
 *   id: "https://schema.org/Person",
 *   label: "Person",
 *   properties: ["https://schema.org/name"]
 * })
 * console.log(O.map(person, (value) => value.toDocument().includes("Properties: name")))
 * ```
 *
 * @invariant The class has a valid IRI and a non-empty primary label.
 * @category models
 * @since 0.0.0
 */
export const ClassDefinition = ClassDefinitionModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ClassDefinitionFields))(fc).map((fields) => ClassDefinitionModel.make(fields)),
}).pipe(
  $I.annoteSchema("ClassDefinition", {
    description: "OWL or RDFS class metadata normalized for lookup and semantic search.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded class metadata produced by {@link ClassDefinition}, including its search-document behavior.
 *
 * **Example** (Decode ClassDefinition)
 *
 * ```ts
 * import { ClassDefinition } from "@effect-ontology/Domain/Model/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeClassDefinition = (_value: ClassDefinition): string => "valid class definition"
 *
 * console.log(O.map(S.decodeUnknownOption(ClassDefinition)({}), summarizeClassDefinition))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClassDefinition = typeof ClassDefinition.Type;

const PropertyDefinitionFields = {
  id: IRI.annotateKey({ description: "Full IRI of the RDF or OWL property." }),
  label: S.NonEmptyString.annotateKey({ description: "Primary human-readable property label." }),
  comment: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Informal RDFS property description when supplied." })
  ),
  domain: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Class IRIs valid in the property's subject position." })
  ),
  range: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Class or datatype IRIs valid in the property's object position." })
  ),
  rangeType: PropertyRangeKind.annotateKey({
    description: "Whether values are linked resources or RDF literals.",
  }),
  inverseOf: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "OWL inverse-property IRIs." })
  ),
  isFunctional: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether the property admits at most one value per subject." })
  ),
  ...SkosFields,
};

class PropertyDefinitionModel extends S.Class<PropertyDefinitionModel>($I`PropertyDefinition`)(
  PropertyDefinitionFields,
  $I.annote("PropertyDefinition", {
    description: "RDF or OWL property metadata normalized for validation and semantic search.",
  })
) {
  /**
   * Whether this property links one resource to another.
   *
   * **Example** (Check an object property)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { PropertyDefinition } from "@effect-ontology/Model/Ontology"
   *
   * const property = S.decodeUnknownOption(PropertyDefinition)({
   *   id: "https://schema.org/memberOf",
   *   label: "member of",
   *   rangeType: "object"
   * })
   * console.log(O.map(property, (value) => value.isObjectProperty))
   * ```
   *
   * @returns `true` only for the closed `object` range kind.
   */
  get isObjectProperty(): boolean {
    return PropertyRangeKind.is.object(this.rangeType);
  }

  /**
   * Whether this property carries an RDF literal value.
   *
   * **Example** (Check a datatype property)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { PropertyDefinition } from "@effect-ontology/Model/Ontology"
   *
   * const property = S.decodeUnknownOption(PropertyDefinition)({
   *   id: "https://schema.org/name",
   *   label: "name",
   *   rangeType: "datatype"
   * })
   * console.log(O.map(property, (value) => value.isDatatypeProperty))
   * ```
   *
   * @returns `true` only for the closed `datatype` range kind.
   */
  get isDatatypeProperty(): boolean {
    return PropertyRangeKind.is.datatype(this.rangeType);
  }

  /**
   * Builds a stable semantic-search document.
   *
   * **Example** (Render a semantic-search document)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { PropertyDefinition } from "@effect-ontology/Model/Ontology"
   *
   * const property = S.decodeUnknownOption(PropertyDefinition)({
   *   id: "https://schema.org/name",
   *   label: "name",
   *   rangeType: "datatype"
   * })
   * console.log(O.map(property, (value) => value.toDocument().includes("Type: datatype")))
   * ```
   *
   * @returns Newline-delimited labels, description, domain, range, and constraints.
   */
  toDocument(): string {
    const description = O.orElse(this.definition, () => this.comment);
    const constraints = Bool.match(this.isFunctional, {
      onFalse: () => A.of(this.rangeType),
      onTrue: () => [this.rangeType, "functional"],
    });
    return pipe(
      semanticLabels(this.label, this.prefLabels, this.altLabels, this.hiddenLabels),
      A.appendAll(O.toArray(description)),
      A.appendAll(O.toArray(this.scopeNote)),
      A.appendAll(O.toArray(O.map(this.example, (value) => `Example: ${value}`))),
      A.appendAll(O.toArray(optionalNamesLine("Domain", this.domain))),
      A.appendAll(O.toArray(optionalNamesLine("Range", this.range))),
      A.append(`Type: ${A.join(constraints, ", ")}`),
      A.appendAll(O.toArray(relatedLine(this.broader, this.narrower, this.related))),
      A.join("\n")
    );
  }
}

/**
 * Normalized RDF or OWL property definition.
 *
 * **Details**
 *
 * Domain and range are modeled as IRI collections, range behavior is a closed
 * literal domain, and functional cardinality defaults at construction.
 *
 * **Example** (Decode PropertyDefinition)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PropertyDefinition } from "@effect-ontology/Model/Ontology"
 *
 * const memberOf = S.decodeUnknownOption(PropertyDefinition)({
 *   id: "https://schema.org/memberOf",
 *   label: "member of",
 *   domain: ["https://schema.org/Person"],
 *   range: ["https://schema.org/Organization"],
 *   rangeType: "object"
 * })
 * console.log(O.map(memberOf, (value) => value.isObjectProperty))
 * ```
 *
 * @invariant The property has a valid IRI, non-empty label, and explicit range kind.
 * @category models
 * @since 0.0.0
 */
export const PropertyDefinition = PropertyDefinitionModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(PropertyDefinitionFields))(fc).map((fields) => PropertyDefinitionModel.make(fields)),
}).pipe(
  $I.annoteSchema("PropertyDefinition", {
    description: "RDF or OWL property metadata normalized for validation and semantic search.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded property metadata produced by {@link PropertyDefinition}, including range and search behavior.
 *
 * **Example** (Decode PropertyDefinition)
 *
 * ```ts
 * import { PropertyDefinition } from "@effect-ontology/Domain/Model/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizePropertyDefinition = (_value: PropertyDefinition): string => "valid property definition"
 *
 * console.log(O.map(S.decodeUnknownOption(PropertyDefinition)({}), summarizePropertyDefinition))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PropertyDefinition = typeof PropertyDefinition.Type;

const directParents: {
  (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>, child: string): ReadonlyArray<IRI>;
  (child: string): (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>) => ReadonlyArray<IRI>;
} = dual(
  2,
  (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>, child: string): ReadonlyArray<IRI> =>
    pipe(R.get(hierarchy, child), O.getOrElse(emptyIris))
);

const ancestorsFor: {
  (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>, source: string): ReadonlyArray<IRI>;
  (source: string): (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>) => ReadonlyArray<IRI>;
} = dual(2, (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>, source: string): ReadonlyArray<IRI> => {
  const visit = (frontier: ReadonlyArray<IRI>, visited: ReadonlyArray<IRI>): ReadonlyArray<IRI> =>
    pipe(
      frontier,
      A.match({
        onEmpty: () => visited,
        onNonEmpty: ([head, ...tail]) =>
          pipe(visited, A.contains(head))
            ? visit(tail, visited)
            : visit(pipe(tail, A.appendAll(directParents(hierarchy, head))), pipe(visited, A.append(head))),
      })
    );

  return visit(directParents(hierarchy, source), []);
});

const childrenFor: {
  (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>, parent: IRI): ReadonlyArray<IRI>;
  (parent: IRI): (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>) => ReadonlyArray<IRI>;
} = dual(
  2,
  (hierarchy: Readonly<Record<string, ReadonlyArray<IRI>>>, parent: IRI): ReadonlyArray<IRI> =>
    pipe(
      R.toEntries(hierarchy),
      A.filter(([, parents]) => A.contains(parents, parent)),
      A.map(([child]) => IRI.fromUnknown(child))
    )
);

const IriRecordKey = S.String.check(
  S.makeFilter(IRI.is, {
    identifier: $I`IriRecordKeyCheck`,
    title: "IRI Record Key",
    description: "A string record key accepted by the canonical RDF IRI schema.",
    message: "Ontology hierarchy keys must be valid IRIs.",
    arbitrary: {
      candidate: {
        weight: 10,
        make: (fc) => fc.webUrl().map(IRI.fromUnknown),
      },
    },
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.webUrl().map(IRI.fromUnknown),
  })
  .pipe(
    $I.annoteSchema("IriRecordKey", {
      description: "Canonical RDF IRI represented by a string-compatible record-key schema.",
    })
  );

const OntologyContextFields = {
  classes: S.Array(ClassDefinition).pipe(
    SchemaUtils.withEmptyArrayDefaults<ClassDefinition>(),
    S.annotateKey({ description: "All normalized ontology class definitions." })
  ),
  properties: S.Array(PropertyDefinition).pipe(
    SchemaUtils.withEmptyArrayDefaults<PropertyDefinition>(),
    S.annotateKey({ description: "All normalized ontology property definitions." })
  ),
  metadata: S.Record(S.String, S.String).pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "Open ontology-level metadata such as title and version." })
  ),
  hierarchy: S.Record(IriRecordKey, S.Array(IRI)).pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "Direct class-parent edges keyed by child IRI." })
  ),
  propertyHierarchy: S.Record(IriRecordKey, S.Array(IRI)).pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "Direct property-parent edges keyed by child IRI." })
  ),
};

/**
 * Complete immutable snapshot of ontology classes, properties, and hierarchy.
 *
 * **Details**
 *
 * Hierarchy traversal is cycle-safe, lookups expose `Option`, and inherited
 * property resolution accepts either full IRIs or local class names. Empty
 * collections and metadata are schema defaults.
 *
 * **Example** (Create an empty ontology context)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyContext } from "@effect-ontology/Model/Ontology"
 *
 * const context = S.decodeUnknownOption(OntologyContext)({})
 * console.log(O.map(context, (value) => value.classes.length))
 * console.log(O.map(context, (value) => value.toDocuments().length))
 * ```
 *
 * @invariant Every hierarchy key and edge target is a valid IRI.
 * @category aggregates
 * @since 0.0.0
 */
export class OntologyContext extends S.Class<OntologyContext>($I`OntologyContext`)(
  OntologyContextFields,
  $I.annote("OntologyContext", {
    description: "Immutable ontology snapshot with cycle-safe class and property hierarchy traversal.",
  })
) {
  /** Type guard for decoded ontology contexts. @since 0.0.0 */
  static readonly is = S.is(OntologyContext);

  /** Decode an unknown ontology context or throw a parse error. @since 0.0.0 */
  static readonly fromUnknown = S.decodeUnknownSync(OntologyContext);

  /** Decode an unknown ontology context into an `Option`. @since 0.0.0 */
  static readonly decodeOption = S.decodeUnknownOption(OntologyContext);

  /**
   * Looks up a class by full IRI.
   *
   * **Example** (Look up a class)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ iri: IRI, context: OntologyContext }))({
   *   iri: "https://schema.org/Person",
   *   context: { classes: [{ id: "https://schema.org/Person", label: "Person" }] }
   * })
   * console.log(O.map(input, ({ context, iri }) => O.isSome(context.getClass(iri))))
   * ```
   *
   * @param iri - Full class IRI.
   * @returns The matching definition, or `Option.none`.
   */
  getClass(iri: IRI): O.Option<ClassDefinition> {
    return A.findFirst(this.classes, P.Struct({ id: Eq.equals(iri) }));
  }

  /**
   * Looks up a property by full IRI.
   *
   * **Example** (Look up a property)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ iri: IRI, context: OntologyContext }))({
   *   iri: "https://schema.org/name",
   *   context: { properties: [{ id: "https://schema.org/name", label: "name", rangeType: "datatype" }] }
   * })
   * console.log(O.map(input, ({ context, iri }) => O.isSome(context.getProperty(iri))))
   * ```
   *
   * @param iri - Full property IRI.
   * @returns The matching definition, or `Option.none`.
   */
  getProperty(iri: IRI): O.Option<PropertyDefinition> {
    return A.findFirst(this.properties, (definition) => definition.id === iri);
  }

  /**
   * Gets direct superclasses for a class.
   *
   * **Example** (Read direct superclasses)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ employee: IRI, context: OntologyContext }))({
   *   employee: "https://example.org/Employee",
   *   context: { hierarchy: { "https://example.org/Employee": ["https://schema.org/Person"] } }
   * })
   * console.log(O.map(input, ({ context, employee }) => context.getSuperClasses(employee)))
   * ```
   *
   * @param classIri - Full class IRI.
   * @returns Direct parents in stored order.
   */
  getSuperClasses(classIri: IRI): ReadonlyArray<IRI> {
    return directParents(this.hierarchy, classIri);
  }

  /**
   * Gets every superclass using cycle-safe transitive traversal.
   *
   * **Example** (Traverse all superclasses)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ employee: IRI, context: OntologyContext }))({
   *   employee: "https://example.org/Employee",
   *   context: {
   *     hierarchy: {
   *       "https://example.org/Employee": ["https://schema.org/Person"],
   *       "https://schema.org/Person": ["https://schema.org/Thing"]
   *     }
   *   }
   * })
   * console.log(O.map(input, ({ context, employee }) => context.getAllSuperClasses(employee)))
   * ```
   *
   * @param classIri - Full class IRI.
   * @returns Deduplicated ancestors in breadth-first discovery order.
   */
  getAllSuperClasses(classIri: IRI): ReadonlyArray<IRI> {
    return ancestorsFor(this.hierarchy, classIri);
  }

  /**
   * Gets direct subclasses for a class.
   *
   * **Example** (Read direct subclasses)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ person: IRI, context: OntologyContext }))({
   *   person: "https://schema.org/Person",
   *   context: { hierarchy: { "https://example.org/Employee": ["https://schema.org/Person"] } }
   * })
   * console.log(O.map(input, ({ context, person }) => context.getSubClasses(person)))
   * ```
   *
   * @param parentIri - Full parent-class IRI.
   * @returns Direct children in hierarchy-record order.
   */
  getSubClasses(parentIri: IRI): ReadonlyArray<IRI> {
    return childrenFor(this.hierarchy, parentIri);
  }

  /**
   * Tests reflexive, transitive subclass membership.
   *
   * **Example** (Test subclass membership)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ employee: IRI, person: IRI, context: OntologyContext }))({
   *   employee: "https://example.org/Employee",
   *   person: "https://schema.org/Person",
   *   context: { hierarchy: { "https://example.org/Employee": ["https://schema.org/Person"] } }
   * })
   * console.log(O.map(input, ({ context, employee, person }) => context.isSubClassOf(employee, person)))
   * ```
   *
   * @param childIri - Candidate child class.
   * @param parentIri - Candidate ancestor class.
   * @returns Whether both IRIs are equal or the parent is transitively reachable.
   */
  isSubClassOf(childIri: IRI, parentIri: IRI): boolean {
    return childIri === parentIri || A.contains(this.getAllSuperClasses(childIri), parentIri);
  }

  /**
   * Gets direct superproperties for a property.
   *
   * **Example** (Read direct superproperties)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ givenName: IRI, context: OntologyContext }))({
   *   givenName: "https://example.org/givenName",
   *   context: { propertyHierarchy: { "https://example.org/givenName": ["https://schema.org/name"] } }
   * })
   * console.log(O.map(input, ({ context, givenName }) => context.getSuperProperties(givenName)))
   * ```
   *
   * @param propertyIri - Full property IRI.
   * @returns Direct parents in stored order.
   */
  getSuperProperties(propertyIri: IRI): ReadonlyArray<IRI> {
    return directParents(this.propertyHierarchy, propertyIri);
  }

  /**
   * Gets direct subproperties for a property.
   *
   * **Example** (Read direct subproperties)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ name: IRI, context: OntologyContext }))({
   *   name: "https://schema.org/name",
   *   context: { propertyHierarchy: { "https://example.org/givenName": ["https://schema.org/name"] } }
   * })
   * console.log(O.map(input, ({ context, name }) => context.getSubProperties(name)))
   * ```
   *
   * @param parentIri - Full parent-property IRI.
   * @returns Direct children in hierarchy-record order.
   */
  getSubProperties(parentIri: IRI): ReadonlyArray<IRI> {
    return childrenFor(this.propertyHierarchy, parentIri);
  }

  /**
   * Tests reflexive, transitive subproperty membership.
   *
   * **Example** (Test subproperty membership)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   * import { IRI } from "@beep/rdf"
   *
   * const input = S.decodeUnknownOption(S.Struct({ givenName: IRI, name: IRI, context: OntologyContext }))({
   *   givenName: "https://example.org/givenName",
   *   name: "https://schema.org/name",
   *   context: { propertyHierarchy: { "https://example.org/givenName": ["https://schema.org/name"] } }
   * })
   * console.log(O.map(input, ({ context, givenName, name }) => context.isSubPropertyOf(givenName, name)))
   * ```
   *
   * @param childIri - Candidate child property.
   * @param parentIri - Candidate ancestor property.
   * @returns Whether both IRIs are equal or the parent is transitively reachable.
   */
  isSubPropertyOf(childIri: IRI, parentIri: IRI): boolean {
    return childIri === parentIri || A.contains(ancestorsFor(this.propertyHierarchy, childIri), parentIri);
  }

  /**
   * Resolves properties declared on a class or any of its superclasses.
   *
   * **Details**
   *
   * The query may be a full IRI or a local name. Comparison is case-insensitive
   * over local names because imported ontologies often mix namespace prefixes.
   *
   * **Example** (Resolve inherited properties)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   *
   * const context = S.decodeUnknownOption(OntologyContext)({
   *   properties: [{
   *     id: "https://schema.org/name",
   *     label: "name",
   *     rangeType: "datatype",
   *     domain: ["https://schema.org/Person"]
   *   }]
   * })
   * console.log(O.map(context, (value) => value.getPropertiesForClass("Person").length))
   * ```
   *
   * @param classIri - Full IRI or local class name.
   * @returns Applicable property definitions in ontology order.
   */
  getPropertiesForClass(classIri: string): ReadonlyArray<PropertyDefinition> {
    const canonicalIri = O.filter(IRI.decodeOption(classIri), IRI.is);
    const superClasses = pipe(
      canonicalIri,
      O.map((iri) => this.getAllSuperClasses(iri)),
      O.getOrElse(emptyIris)
    );
    const validDomains = pipe(
      A.of(classIri),
      A.appendAll(superClasses),
      A.map((iri) => Str.toLowerCase(localName(iri))),
      A.dedupe
    );
    return A.filter(this.properties, (property) =>
      A.some(property.domain, (domain) => A.contains(validDomains, Str.toLowerCase(localName(domain))))
    );
  }

  /**
   * Renders every class and property as semantic-search text.
   *
   * **Example** (Render search documents)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { OntologyContext } from "@effect-ontology/Model/Ontology"
   *
   * const context = S.decodeUnknownOption(OntologyContext)({
   *   classes: [{ id: "https://schema.org/Person", label: "Person" }]
   * })
   * console.log(O.map(context, (value) => value.toDocuments()[0]?.[1]))
   * ```
   *
   * @returns Tuples of ontology-element IRI and stable search document.
   */
  toDocuments(): ReadonlyArray<readonly [IRI, string]> {
    return pipe(
      A.map(this.classes, (definition): readonly [IRI, string] => [definition.id, definition.toDocument()]),
      A.appendAll(
        A.map(this.properties, (definition): readonly [IRI, string] => [definition.id, definition.toDocument()])
      )
    );
  }
}
