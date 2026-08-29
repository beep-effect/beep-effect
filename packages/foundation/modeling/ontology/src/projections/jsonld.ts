// cspell:words SKOS DCTERMS skos dcterms
import { pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  AssembledDatatypePredicate,
  AssembledObjectPredicate,
  AssembledOntology,
  AssembledOntologyClass,
  DCTERMS_NAMESPACE,
  decodeJsonLdOntologyDocumentResult,
  isJsonLdClassNode,
  isJsonLdPredicateNode,
  makeIri,
  makeOntologyDefinitionMetadata,
  makeOntologyReference,
  OntologyAssemblyError,
  OntologyLanguageLiteral,
  OntologySkosConceptProfile,
  OntologySkosConceptSchemeProfile,
  OntologyValidationReport,
  OWL_PREFIX_IRI,
  RDFS_PREFIX_IRI,
  RDFS_SUB_CLASS_OF,
  SKOS_NAMESPACE,
  schemaIssueToError,
} from "../model.js";
import type {
  AssembledOntologyPredicate,
  IRI,
  JsonLdClassNode,
  JsonLdContextDocument,
  JsonLdDefinitionValue,
  JsonLdIdReference,
  JsonLdLabelValue,
  JsonLdLanguageLiteral,
  JsonLdOntologyDocument,
  JsonLdPredicateNode,
  JsonLdTermBinding,
  OntologyProvenanceMetadata,
  OntologyReference,
  OntologySkosProfile,
} from "../model.js";

const jsonLdClassBinding = (value: AssembledOntologyClass): typeof JsonLdTermBinding.Encoded => ({
  "@id": value.iri,
});

const jsonLdPredicateBinding = (value: AssembledOntologyPredicate): typeof JsonLdTermBinding.Encoded =>
  value.kind === "datatypePredicate"
    ? {
        "@id": value.iri,
        "@type": value.rangeDatatypeIri,
      }
    : {
        "@id": value.iri,
        "@type": "@id",
      };

/**
 * Projects an assembled ontology into a reusable JSON-LD context document.
 *
 * @category projections
 * @since 0.0.0
 */
export const projectJsonLdContext = (ontology: AssembledOntology): typeof JsonLdContextDocument.Encoded => {
  const initialTerms: Readonly<Record<string, IRI | typeof JsonLdTermBinding.Encoded>> = {
    "@vocab": ontology.metadata.baseIri,
  };

  const terms = pipe(
    ontology.classes,
    A.reduce(initialTerms, (currentTerms, ontologyClass) => {
      const withClass = R.set(currentTerms, ontologyClass.termName, jsonLdClassBinding(ontologyClass));
      return pipe(
        ontologyClass.predicates,
        A.reduce(withClass, (predicateTerms, predicate) =>
          R.set(predicateTerms, predicate.termName, jsonLdPredicateBinding(predicate))
        )
      );
    })
  );

  return { "@context": terms };
};

const jsonLdIdReference = (reference: OntologyReference): typeof JsonLdIdReference.Encoded => ({
  "@id": reference.iri,
});

const jsonLdIdReferences = (
  references: ReadonlyArray<OntologyReference>
): ReadonlyArray<typeof JsonLdIdReference.Encoded> => pipe(references, A.map(jsonLdIdReference));

const profileLiterals = (
  ontologyClass: AssembledOntologyClass,
  select: (profile: OntologySkosProfile) => ReadonlyArray<OntologyLanguageLiteral>
): ReadonlyArray<OntologyLanguageLiteral> =>
  pipe(ontologyClass.skosProfile, O.map(select), O.getOrElse(A.empty<OntologyLanguageLiteral>));

const conceptReferences = (
  ontologyClass: AssembledOntologyClass,
  select: (profile: OntologySkosConceptProfile) => ReadonlyArray<OntologyReference>
): ReadonlyArray<OntologyReference> =>
  pipe(
    ontologyClass.skosProfile,
    O.flatMap((profile) => (profile.kind === "concept" ? O.some(select(profile)) : O.none())),
    O.getOrElse(A.empty<OntologyReference>)
  );

const schemeReferences = (
  ontologyClass: AssembledOntologyClass,
  select: (profile: OntologySkosConceptSchemeProfile) => ReadonlyArray<OntologyReference>
): ReadonlyArray<OntologyReference> =>
  pipe(
    ontologyClass.skosProfile,
    O.flatMap((profile) => (profile.kind === "conceptScheme" ? O.some(select(profile)) : O.none())),
    O.getOrElse(A.empty<OntologyReference>)
  );

const jsonLdLanguageLiteral = (literal: OntologyLanguageLiteral): typeof JsonLdLanguageLiteral.Encoded => ({
  "@value": literal.value,
  ...R.getSomes({ "@language": literal.language }),
});

const jsonLdLanguageLiterals = (
  literals: ReadonlyArray<OntologyLanguageLiteral>
): ReadonlyArray<typeof JsonLdLanguageLiteral.Encoded> => pipe(literals, A.map(jsonLdLanguageLiteral));

const jsonLdDefinitionValue = (
  ontologyClass: AssembledOntologyClass
): O.Option<typeof JsonLdDefinitionValue.Encoded> => {
  const definitions = profileLiterals(ontologyClass, (profile) => profile.definitions);

  if (A.length(definitions) > 0) {
    return O.some([
      ...pipe(
        ontologyClass.definition,
        O.map((definition) => [definition]),
        O.getOrElse(A.empty<string>)
      ),
      ...jsonLdLanguageLiterals(definitions),
    ]);
  }

  return ontologyClass.definition;
};

const jsonLdProvenance = (provenance: OntologyProvenanceMetadata): typeof OntologyProvenanceMetadata.Encoded =>
  R.getSomes({
    sourceIri: provenance.sourceIri,
    sourceUri: provenance.sourceUri,
    sourceLabel: provenance.sourceLabel,
    sourceCitation: provenance.sourceCitation,
    sourceSpan: provenance.sourceSpan,
    sourceSelector: provenance.sourceSelector,
    extractionMethod: provenance.extractionMethod,
    verificationStatus: provenance.verificationStatus,
    updatedAt: provenance.updatedAt,
  });

const classJsonLdType = (ontologyClass: AssembledOntologyClass): (typeof JsonLdClassNode.Encoded)["@type"] =>
  pipe(
    ontologyClass.skosProfile,
    O.match({
      onNone: () => "rdfs:Class",
      onSome: (profile) =>
        profile.kind === "concept" ? ["rdfs:Class", "skos:Concept"] : ["rdfs:Class", "skos:ConceptScheme"],
    })
  );

const jsonLdReferences = (
  topLevelReferences: ReadonlyArray<OntologyReference>,
  profileReferences: ReadonlyArray<OntologyReference>
): ReadonlyArray<typeof JsonLdIdReference.Encoded> => jsonLdIdReferences([...topLevelReferences, ...profileReferences]);

const ontologyJsonLdContext = (ontology: AssembledOntology): (typeof JsonLdOntologyDocument.Encoded)["@context"] => ({
  ...projectJsonLdContext(ontology)["@context"],
  rdfs: RDFS_PREFIX_IRI,
  owl: OWL_PREFIX_IRI,
  skos: makeIri(SKOS_NAMESPACE),
  dcterms: makeIri(DCTERMS_NAMESPACE),
  children: {
    "@reverse": RDFS_SUB_CLASS_OF,
    "@type": "@id",
  },
});

const classToJsonLdNode = (ontologyClass: AssembledOntologyClass): typeof JsonLdClassNode.Encoded => ({
  "@id": ontologyClass.iri,
  "@type": classJsonLdType(ontologyClass),
  schemaIdentity: ontologyClass.schemaIdentity,
  termName: ontologyClass.termName,
  "rdfs:label": ontologyClass.label,
  "skos:prefLabel": jsonLdLanguageLiterals(profileLiterals(ontologyClass, (profile) => profile.prefLabels)),
  "skos:altLabel": [
    ...ontologyClass.altLabels,
    ...jsonLdLanguageLiterals(profileLiterals(ontologyClass, (profile) => profile.altLabels)),
  ],
  "skos:hiddenLabel": jsonLdLanguageLiterals(profileLiterals(ontologyClass, (profile) => profile.hiddenLabels)),
  "owl:deprecated": ontologyClass.deprecated,
  "rdfs:subClassOf": jsonLdIdReferences(ontologyClass.parents),
  children: jsonLdIdReferences(ontologyClass.children),
  "rdfs:seeAlso": jsonLdIdReferences(ontologyClass.seeAlso),
  "rdfs:isDefinedBy": jsonLdIdReferences(ontologyClass.isDefinedBy),
  "owl:equivalentClass": jsonLdIdReferences(ontologyClass.equivalentClasses),
  "skos:exactMatch": jsonLdReferences(
    ontologyClass.exactMatches,
    conceptReferences(ontologyClass, (profile) => profile.exactMatches)
  ),
  "skos:closeMatch": jsonLdReferences(
    ontologyClass.closeMatches,
    conceptReferences(ontologyClass, (profile) => profile.closeMatches)
  ),
  "skos:scopeNote": jsonLdLanguageLiterals(profileLiterals(ontologyClass, (profile) => profile.scopeNotes)),
  "skos:editorialNote": jsonLdLanguageLiterals(profileLiterals(ontologyClass, (profile) => profile.editorialNotes)),
  "skos:historyNote": jsonLdLanguageLiterals(profileLiterals(ontologyClass, (profile) => profile.historyNotes)),
  "skos:broader": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.broader)),
  "skos:narrower": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.narrower)),
  "skos:related": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.related)),
  "skos:broadMatch": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.broadMatches)),
  "skos:narrowMatch": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.narrowMatches)),
  "skos:relatedMatch": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.relatedMatches)),
  "skos:inScheme": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.inSchemes)),
  "skos:topConceptOf": jsonLdIdReferences(conceptReferences(ontologyClass, (profile) => profile.topConceptOf)),
  "skos:hasTopConcept": jsonLdIdReferences(schemeReferences(ontologyClass, (profile) => profile.hasTopConcepts)),
  "owl:sameAs": jsonLdIdReferences(ontologyClass.sameAs),
  ...R.getSomes({
    "rdfs:comment": ontologyClass.comment,
    "skos:definition": jsonLdDefinitionValue(ontologyClass),
    "dcterms:source": ontologyClass.source,
  }),
  ...(O.isSome(ontologyClass.provenance) ? { provenance: jsonLdProvenance(ontologyClass.provenance.value) } : {}),
});

const predicateToJsonLdNode = (predicate: AssembledOntologyPredicate): typeof JsonLdPredicateNode.Encoded => ({
  "@id": predicate.iri,
  "@type": predicate.kind === "datatypePredicate" ? "owl:DatatypeProperty" : "owl:ObjectProperty",
  kind: predicate.kind,
  schemaIdentity: predicate.schemaIdentity,
  fieldName: predicate.fieldName,
  termName: predicate.termName,
  "rdfs:label": predicate.label,
  "rdfs:domain": {
    "@id": predicate.domainClassIri,
  },
  "rdfs:range": {
    "@id": predicate.kind === "datatypePredicate" ? predicate.rangeDatatypeIri : predicate.rangeClassIri,
  },
  ...R.getSomes({
    "rdfs:comment": predicate.comment,
  }),
});

/**
 * Projects an assembled ontology into the POC JSON-LD graph representation.
 *
 * @category projections
 * @since 0.0.0
 */
export const projectJsonLdOntology = (ontology: AssembledOntology): typeof JsonLdOntologyDocument.Encoded => ({
  "@context": ontologyJsonLdContext(ontology),
  "@id": ontology.metadata.baseIri,
  schemaIdentity: ontology.metadata.schemaIdentity,
  preferredPrefix: ontology.metadata.preferredPrefix,
  label: ontology.metadata.label,
  "@graph": [
    ...pipe(ontology.classes, A.map(classToJsonLdNode)),
    ...pipe(
      ontology.classes,
      A.flatMap((ontologyClass) => A.map(ontologyClass.predicates, predicateToJsonLdNode))
    ),
  ],
  ...R.getSomes({
    comment: ontology.metadata.comment,
  }),
});

const jsonLdIdReferenceToOntologyReference = (reference: JsonLdIdReference): OntologyReference =>
  makeOntologyReference(reference["@id"]);

const jsonLdIdReferencesToOntologyReferences = (
  references: ReadonlyArray<JsonLdIdReference>
): ReadonlyArray<OntologyReference> => pipe(references, A.map(jsonLdIdReferenceToOntologyReference));

const predicateNodeToAssembledPredicate = (predicate: JsonLdPredicateNode): AssembledOntologyPredicate =>
  predicate.kind === "datatypePredicate"
    ? AssembledDatatypePredicate.make({
        kind: "datatypePredicate",
        schemaIdentity: predicate.schemaIdentity,
        fieldName: predicate.fieldName,
        termName: predicate.termName,
        iri: predicate["@id"],
        label: predicate["rdfs:label"],
        comment: predicate["rdfs:comment"],
        domainClassIri: predicate["rdfs:domain"]["@id"],
        rangeDatatypeIri: predicate["rdfs:range"]["@id"],
      })
    : AssembledObjectPredicate.make({
        kind: "objectPredicate",
        schemaIdentity: predicate.schemaIdentity,
        fieldName: predicate.fieldName,
        termName: predicate.termName,
        iri: predicate["@id"],
        label: predicate["rdfs:label"],
        comment: predicate["rdfs:comment"],
        domainClassIri: predicate["rdfs:domain"]["@id"],
        rangeClassIri: predicate["rdfs:range"]["@id"],
      });

const jsonLdLanguageLiteralToOntologyLiteral = (literal: JsonLdLanguageLiteral): OntologyLanguageLiteral =>
  OntologyLanguageLiteral.make({
    value: literal["@value"],
    language: literal["@language"],
  });

const jsonLdLabelValueToOntologyLiteral = (value: JsonLdLabelValue): OntologyLanguageLiteral =>
  P.isString(value)
    ? OntologyLanguageLiteral.make({ value, language: O.none() })
    : jsonLdLanguageLiteralToOntologyLiteral(value);

const jsonLdLabelValuesToPlainStrings = (values: ReadonlyArray<JsonLdLabelValue>): ReadonlyArray<string> =>
  pipe(values, A.filter(P.isString));

const jsonLdLabelValuesToOntologyLiterals = (
  values: ReadonlyArray<JsonLdLabelValue>
): ReadonlyArray<OntologyLanguageLiteral> =>
  pipe(
    values,
    A.filter((value) => !P.isString(value)),
    A.map(jsonLdLabelValueToOntologyLiteral)
  );

const jsonLdDefinitionToPlainDefinition = (definition: O.Option<JsonLdDefinitionValue>): O.Option<string> =>
  pipe(
    definition,
    O.flatMap((value) => (P.isString(value) ? O.some(value) : A.findFirst(value, P.isString)))
  );

const jsonLdDefinitionToProfileDefinitions = (
  definition: O.Option<JsonLdDefinitionValue>
): ReadonlyArray<OntologyLanguageLiteral> =>
  pipe(
    definition,
    O.map((value) =>
      P.isString(value) ? A.empty<OntologyLanguageLiteral>() : jsonLdLabelValuesToOntologyLiterals(value)
    ),
    O.getOrElse(A.empty<OntologyLanguageLiteral>)
  );

const jsonLdClassTypes = (classNode: JsonLdClassNode): ReadonlyArray<string> =>
  P.isString(classNode["@type"]) ? [classNode["@type"]] : classNode["@type"];

const hasJsonLdClassType = (classNode: JsonLdClassNode, classType: string): boolean =>
  pipe(jsonLdClassTypes(classNode), A.contains(classType));

const jsonLdSkosProfile = (classNode: JsonLdClassNode): O.Option<OntologySkosProfile> => {
  if (hasJsonLdClassType(classNode, "skos:Concept")) {
    return O.some(
      OntologySkosConceptProfile.make({
        kind: "concept",
        prefLabels: pipe(classNode["skos:prefLabel"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        altLabels: jsonLdLabelValuesToOntologyLiterals(classNode["skos:altLabel"]),
        hiddenLabels: pipe(classNode["skos:hiddenLabel"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        definitions: jsonLdDefinitionToProfileDefinitions(classNode["skos:definition"]),
        scopeNotes: pipe(classNode["skos:scopeNote"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        editorialNotes: pipe(classNode["skos:editorialNote"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        historyNotes: pipe(classNode["skos:historyNote"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        broader: jsonLdIdReferencesToOntologyReferences(classNode["skos:broader"]),
        narrower: jsonLdIdReferencesToOntologyReferences(classNode["skos:narrower"]),
        related: jsonLdIdReferencesToOntologyReferences(classNode["skos:related"]),
        exactMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:exactMatch"]),
        closeMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:closeMatch"]),
        broadMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:broadMatch"]),
        narrowMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:narrowMatch"]),
        relatedMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:relatedMatch"]),
        inSchemes: jsonLdIdReferencesToOntologyReferences(classNode["skos:inScheme"]),
        topConceptOf: jsonLdIdReferencesToOntologyReferences(classNode["skos:topConceptOf"]),
      })
    );
  }

  if (hasJsonLdClassType(classNode, "skos:ConceptScheme")) {
    return O.some(
      OntologySkosConceptSchemeProfile.make({
        kind: "conceptScheme",
        prefLabels: pipe(classNode["skos:prefLabel"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        altLabels: jsonLdLabelValuesToOntologyLiterals(classNode["skos:altLabel"]),
        hiddenLabels: pipe(classNode["skos:hiddenLabel"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        definitions: jsonLdDefinitionToProfileDefinitions(classNode["skos:definition"]),
        scopeNotes: pipe(classNode["skos:scopeNote"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        editorialNotes: pipe(classNode["skos:editorialNote"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        historyNotes: pipe(classNode["skos:historyNote"], A.map(jsonLdLanguageLiteralToOntologyLiteral)),
        hasTopConcepts: jsonLdIdReferencesToOntologyReferences(classNode["skos:hasTopConcept"]),
      })
    );
  }

  return O.none();
};

const iriEquivalence = S.toEquivalence(S.String);

const classNodeToAssembledClass = (
  classNode: JsonLdClassNode,
  predicates: ReadonlyArray<JsonLdPredicateNode>
): AssembledOntologyClass =>
  AssembledOntologyClass.make({
    schemaIdentity: classNode.schemaIdentity,
    termName: classNode.termName,
    iri: classNode["@id"],
    label: classNode["rdfs:label"],
    comment: classNode["rdfs:comment"],
    altLabels: jsonLdLabelValuesToPlainStrings(classNode["skos:altLabel"]),
    definition: jsonLdDefinitionToPlainDefinition(classNode["skos:definition"]),
    deprecated: classNode["owl:deprecated"],
    source: classNode["dcterms:source"],
    parents: jsonLdIdReferencesToOntologyReferences(classNode["rdfs:subClassOf"]),
    children: jsonLdIdReferencesToOntologyReferences(classNode.children),
    seeAlso: jsonLdIdReferencesToOntologyReferences(classNode["rdfs:seeAlso"]),
    isDefinedBy: jsonLdIdReferencesToOntologyReferences(classNode["rdfs:isDefinedBy"]),
    equivalentClasses: jsonLdIdReferencesToOntologyReferences(classNode["owl:equivalentClass"]),
    exactMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:exactMatch"]),
    closeMatches: jsonLdIdReferencesToOntologyReferences(classNode["skos:closeMatch"]),
    sameAs: jsonLdIdReferencesToOntologyReferences(classNode["owl:sameAs"]),
    skosProfile: jsonLdSkosProfile(classNode),
    provenance: classNode.provenance,
    jsonSchemaSidecar: O.none(),
    predicates: pipe(
      predicates,
      A.filter((predicate) => iriEquivalence(predicate["rdfs:domain"]["@id"], classNode["@id"])),
      A.map(predicateNodeToAssembledPredicate)
    ),
  });

const missingJsonLdClassError = (document: JsonLdOntologyDocument): OntologyAssemblyError =>
  OntologyAssemblyError.make({
    reason: "missingClassMetadata",
    message: "JSON-LD ontology document must contain at least one class node.",
    schemaIdentifier: O.some(document.schemaIdentity),
    fieldName: O.none(),
  });

const jsonLdDocumentToOntologyResult = (
  document: JsonLdOntologyDocument
): Result.Result<AssembledOntology, OntologyAssemblyError> =>
  A.match(
    pipe(
      document["@graph"],
      A.filter(isJsonLdClassNode),
      A.map((classNode) =>
        classNodeToAssembledClass(classNode, pipe(document["@graph"], A.filter(isJsonLdPredicateNode)))
      )
    ),
    {
      onEmpty: () => Result.fail(missingJsonLdClassError(document)),
      onNonEmpty: (classes) =>
        Result.succeed(
          AssembledOntology.make({
            metadata: makeOntologyDefinitionMetadata({
              kind: "ontology",
              schemaIdentity: document.schemaIdentity,
              baseIri: document["@id"],
              preferredPrefix: document.preferredPrefix,
              label: document.label,
              ...R.getSomes({ comment: document.comment }),
            }),
            classes,
            validation: OntologyValidationReport.make({
              errors: [],
              warnings: [],
            }),
          })
        ),
    }
  );

/**
 * Parses the POC JSON-LD graph representation back into an assembled ontology result.
 *
 * @category projections
 * @since 0.0.0
 */
export const parseJsonLdOntology = (
  input: unknown
): Result.Result<AssembledOntology, S.SchemaError | OntologyAssemblyError> =>
  pipe(
    decodeJsonLdOntologyDocumentResult(input),
    Result.mapError(schemaIssueToError),
    Result.flatMap(jsonLdDocumentToOntologyResult)
  );
