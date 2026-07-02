import { Effect, pipe, SchemaAST } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { classLabel, draftMetadataComment, keyLeafTermName, predicateLabel } from "./annotations.js";
import {
  AssembledDatatypePredicate,
  AssembledObjectPredicate,
  AssembledOntology,
  AssembledOntologyClass,
  getOntologyKeyMetadata,
  getOntologyMetadata,
  isOntologyClassAnnotationDraft,
  isOntologyPredicateAnnotationDraft,
  makeOntologyDatatypePredicateMetadata,
  makeOntologyObjectPredicateMetadata,
  makeOntologyTermName,
  makeTermIri,
  OntologyClassMetadata,
  OntologyIriReferenceTarget,
  OntologyJsonSchemaDocument,
  OntologyJsonSchemaSidecar,
  OntologyJsonSchemaSidecarOptions,
  OntologySkosConceptProfile,
  OntologySkosConceptSchemeProfile,
  OntologyValidationIssue,
  OntologyValidationReport,
} from "./model.js";
import {
  failAssembly,
  resolveReferenceTarget,
  resolveReferenceTargets,
  schemaIdentifier,
  schemaIdentity,
  schemaKeyIdentifier,
  schemaKeyIdentity,
} from "./references.js";
import type {
  AssembledOntologyPredicate,
  IRI,
  OntologyAssemblyError,
  OntologyAssemblyErrorReason,
  OntologyClassAnnotationDraft,
  OntologyDefinitionMetadata,
  OntologyPredicateAnnotationDraft,
  OntologyReference,
  OntologyReferenceTarget,
  OntologySkosProfile,
  OntologySkosProfileDraft,
  OntologyValidationIssueCode,
  OntologyValidationIssueSeverity,
} from "./model.js";
import type { ReferenceResolutionContext } from "./references.js";

type ClassAssemblySeed = {
  readonly schema: S.Top;
  readonly schemaIdentity: string;
  readonly identifier: string;
  readonly termName: ReturnType<typeof makeOntologyTermName>;
  readonly iri: IRI;
  readonly draft: OntologyClassAnnotationDraft;
};

const fail = (
  reason: OntologyAssemblyErrorReason,
  message: string,
  schemaIdentifierValue: O.Option<string>,
  fieldName: O.Option<string> = O.none()
) => failAssembly({ reason, message, schemaIdentifier: schemaIdentifierValue, fieldName });

const resolveTargets = (
  context: ReferenceResolutionContext,
  ownerSchemaId: O.Option<string>,
  targets: ReadonlyArray<OntologyReferenceTarget>
): Effect.Effect<ReadonlyArray<OntologyReference>, OntologyAssemblyError> =>
  resolveReferenceTargets({ context, ownerSchemaId, targets });

const jsonSchemaSidecarOptions = {
  additionalProperties: false,
  generateDescriptions: true,
  includeAnnotationKey: Str.startsWith("x-"),
};

const jsonSchemaSidecarOptionsSummary = OntologyJsonSchemaSidecarOptions.make({
  additionalProperties: false,
  generateDescriptions: true,
  includedAnnotationKeys: ["x-*"],
});

const makeJsonSchemaSidecar = (seed: ClassAssemblySeed): OntologyJsonSchemaSidecar => {
  const document = S.toJsonSchemaDocument(seed.schema, jsonSchemaSidecarOptions);

  return OntologyJsonSchemaSidecar.make({
    classIri: seed.iri,
    schemaIdentity: seed.schemaIdentity,
    document: OntologyJsonSchemaDocument.make({
      dialect: document.dialect,
      schema: document.schema,
      definitions: document.definitions,
    }),
    options: jsonSchemaSidecarOptionsSummary,
  });
};

const resolveSkosProfile = Effect.fn("Ontology.resolveSkosProfile")(function* (
  context: ReferenceResolutionContext,
  ownerSchemaId: O.Option<string>,
  profile: O.Option<OntologySkosProfileDraft>
) {
  if (O.isNone(profile)) {
    return O.none<OntologySkosProfile>();
  }

  const current = profile.value;
  if (current.kind === "concept") {
    const resolvedProfile: OntologySkosProfile = OntologySkosConceptProfile.make({
      kind: "concept",
      prefLabels: current.prefLabels,
      altLabels: current.altLabels,
      hiddenLabels: current.hiddenLabels,
      definitions: current.definitions,
      scopeNotes: current.scopeNotes,
      editorialNotes: current.editorialNotes,
      historyNotes: current.historyNotes,
      broader: yield* resolveTargets(context, ownerSchemaId, current.broader),
      narrower: yield* resolveTargets(context, ownerSchemaId, current.narrower),
      related: yield* resolveTargets(context, ownerSchemaId, current.related),
      exactMatches: yield* resolveTargets(context, ownerSchemaId, current.exactMatches),
      closeMatches: yield* resolveTargets(context, ownerSchemaId, current.closeMatches),
      broadMatches: yield* resolveTargets(context, ownerSchemaId, current.broadMatches),
      narrowMatches: yield* resolveTargets(context, ownerSchemaId, current.narrowMatches),
      relatedMatches: yield* resolveTargets(context, ownerSchemaId, current.relatedMatches),
      inSchemes: yield* resolveTargets(context, ownerSchemaId, current.inSchemes),
      topConceptOf: yield* resolveTargets(context, ownerSchemaId, current.topConceptOf),
    });

    return O.some(resolvedProfile);
  }

  const resolvedProfile: OntologySkosProfile = OntologySkosConceptSchemeProfile.make({
    kind: "conceptScheme",
    prefLabels: current.prefLabels,
    altLabels: current.altLabels,
    hiddenLabels: current.hiddenLabels,
    definitions: current.definitions,
    scopeNotes: current.scopeNotes,
    editorialNotes: current.editorialNotes,
    historyNotes: current.historyNotes,
    hasTopConcepts: yield* resolveTargets(context, ownerSchemaId, current.hasTopConcepts),
  });

  return O.some(resolvedProfile);
});

const requireSchemaIdentifier = Effect.fn("Ontology.requireSchemaIdentifier")(function* (schema: S.Top) {
  return yield* pipe(
    schemaIdentifier(schema),
    O.match({
      onNone: () => fail("invalidClassMetadata", "Schema is missing identity annotation identifier.", O.none()),
      onSome: Effect.succeed,
    })
  );
});

const requireSchemaIdentity = Effect.fn("Ontology.requireSchemaIdentity")(function* (schema: S.Top) {
  return yield* pipe(
    schemaIdentity(schema),
    O.match({
      onNone: () =>
        fail("invalidClassMetadata", "Schema is missing identity annotation schemaId.", schemaIdentifier(schema)),
      onSome: Effect.succeed,
    })
  );
});

const requireClassDraft = Effect.fn("Ontology.requireClassDraft")(function* (schema: S.Top) {
  const metadata = getOntologyMetadata(schema);
  if (metadata === undefined) {
    return yield* fail("missingClassMetadata", "Schema is missing ontology class metadata.", schemaIdentifier(schema));
  }

  if (isOntologyClassAnnotationDraft(metadata)) {
    return metadata;
  }

  return yield* fail(
    "invalidClassMetadata",
    "Schema ontology metadata is not class authoring metadata.",
    schemaIdentifier(schema)
  );
});

const classAssemblySeed = Effect.fn("Ontology.classAssemblySeed")(function* (baseIri: IRI, schema: S.Top) {
  const draft = yield* requireClassDraft(schema);
  const identifier = yield* requireSchemaIdentifier(schema);
  const currentSchemaIdentity = yield* requireSchemaIdentity(schema);
  const termName = pipe(
    draft.termName,
    O.getOrElse(() => makeOntologyTermName(identifier))
  );
  const iri = pipe(
    draft.iri,
    O.getOrElse(() => makeTermIri(baseIri, termName))
  );

  return {
    schema,
    schemaIdentity: currentSchemaIdentity,
    identifier,
    termName,
    iri,
    draft,
  } satisfies ClassAssemblySeed;
});

const classReferenceIndex: (
  seeds: ReadonlyArray<ClassAssemblySeed>
) => ReferenceResolutionContext["classesBySchemaIdentity"] = A.reduce(
  R.empty<string, { readonly iri: IRI }>(),
  (current, seed) => R.set(current, seed.schemaIdentity, { iri: seed.iri })
);

const finalizeClassMetadata = Effect.fn("Ontology.finalizeClassMetadata")(function* (
  context: ReferenceResolutionContext,
  seed: ClassAssemblySeed
) {
  const ownerSchemaId = O.some(seed.schemaIdentity);
  const draft = seed.draft;
  const comment = draftMetadataComment(draft.description, draft.comment);
  const defaultIsDefinedBy = [OntologyIriReferenceTarget.make({ kind: "iri", iri: seed.iri })];

  const parents = yield* resolveTargets(context, ownerSchemaId, draft.parents);
  const children = yield* resolveTargets(context, ownerSchemaId, draft.children);
  const seeAlso = yield* resolveTargets(context, ownerSchemaId, draft.seeAlso);
  const isDefinedBy = yield* resolveTargets(
    context,
    ownerSchemaId,
    pipe(
      draft.isDefinedBy,
      O.getOrElse(() => defaultIsDefinedBy)
    )
  );
  const equivalentClasses = yield* resolveTargets(context, ownerSchemaId, draft.equivalentClasses);
  const exactMatches = yield* resolveTargets(context, ownerSchemaId, draft.exactMatches);
  const closeMatches = yield* resolveTargets(context, ownerSchemaId, draft.closeMatches);
  const sameAs = yield* resolveTargets(context, ownerSchemaId, draft.sameAs);
  const skosProfile = yield* resolveSkosProfile(context, ownerSchemaId, draft.skosProfile);

  return OntologyClassMetadata.make({
    kind: "class",
    schemaIdentity: seed.schemaIdentity,
    termName: seed.termName,
    iri: seed.iri,
    label: pipe(
      draft.label,
      O.getOrElse(() => classLabel(seed.termName))
    ),
    altLabels: draft.altLabels,
    deprecated: draft.deprecated,
    parents,
    children,
    seeAlso,
    isDefinedBy,
    equivalentClasses,
    exactMatches,
    closeMatches,
    sameAs,
    comment,
    definition: draft.definition,
    source: draft.source,
    skosProfile,
    provenance: draft.provenance,
  });
});

const objectAstFromSchema = (schema: S.Top): O.Option<SchemaAST.Objects> => {
  if (SchemaAST.isObjects(schema.ast)) {
    return O.some(schema.ast);
  }

  if (SchemaAST.isDeclaration(schema.ast)) {
    return pipe(schema.ast.typeParameters, A.findFirst(SchemaAST.isObjects));
  }

  return O.none();
};

const requireObjectAst = Effect.fn("Ontology.requireObjectAst")(function* (schema: S.Top) {
  return yield* pipe(
    objectAstFromSchema(schema),
    O.match({
      onNone: () =>
        fail("unsupportedClassAst", "Schema does not expose object property signatures.", schemaIdentity(schema)),
      onSome: Effect.succeed,
    })
  );
});

const requireStringFieldName = Effect.fn("Ontology.requireStringFieldName")(function* (
  schema: S.Top,
  property: SchemaAST.PropertySignature
) {
  if (P.isString(property.name) && Str.isNonEmpty(property.name)) {
    return property.name;
  }

  return yield* fail("unsupportedFieldName", "Only string field names are supported.", schemaIdentity(schema));
});

const requirePredicateDraft = Effect.fn("Ontology.requirePredicateDraft")(function* (
  schema: S.Top,
  fieldName: string,
  property: SchemaAST.PropertySignature
) {
  const propertySchema = S.make<S.Top>(property.type);
  const metadata = getOntologyKeyMetadata(propertySchema);
  if (metadata === undefined) {
    return yield* fail(
      "missingPredicateMetadata",
      "Field is missing ontology predicate metadata.",
      schemaIdentity(schema),
      O.some(fieldName)
    );
  }

  if (isOntologyPredicateAnnotationDraft(metadata)) {
    return {
      draft: metadata,
      schemaIdentity: yield* pipe(
        schemaKeyIdentity(propertySchema),
        O.match({
          onNone: () =>
            fail(
              "invalidPredicateMetadata",
              "Field ontology metadata is missing schema identity.",
              schemaIdentity(schema),
              O.some(fieldName)
            ),
          onSome: Effect.succeed,
        })
      ),
      identifier: yield* pipe(
        schemaKeyIdentifier(propertySchema),
        O.match({
          onNone: () =>
            fail(
              "invalidPredicateMetadata",
              "Field ontology metadata is missing key identifier.",
              schemaIdentity(schema),
              O.some(fieldName)
            ),
          onSome: Effect.succeed,
        })
      ),
    };
  }

  return yield* fail(
    "invalidPredicateMetadata",
    "Field ontology metadata is not predicate authoring metadata.",
    schemaIdentity(schema),
    O.some(fieldName)
  );
});

const finalizePredicateMetadata = Effect.fn("Ontology.finalizePredicateMetadata")(function* (
  context: ReferenceResolutionContext,
  schemaIdentityValue: string,
  identifier: string,
  draft: OntologyPredicateAnnotationDraft
) {
  const fallbackTermName = keyLeafTermName(identifier);
  const termName = pipe(
    draft.termName,
    O.getOrElse(() => fallbackTermName)
  );
  const iri = pipe(
    draft.iri,
    O.getOrElse(() => makeTermIri(context.baseIri, termName))
  );
  const label = pipe(
    draft.label,
    O.getOrElse(() => predicateLabel(termName))
  );
  const comment = draftMetadataComment(draft.description, draft.comment);
  const common = {
    schemaIdentity: schemaIdentityValue,
    termName,
    iri,
    label,
    ...R.getSomes({ comment }),
  };

  if (draft.kind === "datatypePredicateDraft") {
    return makeOntologyDatatypePredicateMetadata({
      kind: "datatypePredicate",
      ...common,
      rangeDatatypeIri: draft.rangeDatatypeIri,
    });
  }

  const rangeClass = yield* resolveReferenceTarget(context, O.some(schemaIdentityValue), draft.rangeClass);

  return makeOntologyObjectPredicateMetadata({
    kind: "objectPredicate",
    ...common,
    rangeClassIri: rangeClass.iri,
  });
});

const collectPredicates = Effect.fn("Ontology.collectPredicates")(function* (
  context: ReferenceResolutionContext,
  schema: S.Top,
  classIri: IRI
) {
  const objectAst = yield* requireObjectAst(schema);
  return yield* Effect.forEach(
    objectAst.propertySignatures,
    Effect.fn("Ontology.collectPredicate")(function* (property) {
      const fieldName = yield* requireStringFieldName(schema, property);
      const {
        draft,
        schemaIdentity: predicateSchemaIdentity,
        identifier,
      } = yield* requirePredicateDraft(schema, fieldName, property);
      const metadata = yield* finalizePredicateMetadata(context, predicateSchemaIdentity, identifier, draft);
      return metadata.kind === "datatypePredicate"
        ? AssembledDatatypePredicate.make({
            kind: "datatypePredicate",
            schemaIdentity: metadata.schemaIdentity,
            fieldName,
            termName: metadata.termName,
            iri: metadata.iri,
            label: metadata.label,
            comment: metadata.comment,
            domainClassIri: classIri,
            rangeDatatypeIri: metadata.rangeDatatypeIri,
          })
        : AssembledObjectPredicate.make({
            kind: "objectPredicate",
            schemaIdentity: metadata.schemaIdentity,
            fieldName,
            termName: metadata.termName,
            iri: metadata.iri,
            label: metadata.label,
            comment: metadata.comment,
            domainClassIri: classIri,
            rangeClassIri: metadata.rangeClassIri,
          });
    }),
    { concurrency: 1 }
  );
});

const assembleClass = Effect.fn("Ontology.assembleClass")(function* (
  context: ReferenceResolutionContext,
  seed: ClassAssemblySeed
) {
  const classMetadata = yield* finalizeClassMetadata(context, seed);
  const predicates: ReadonlyArray<AssembledOntologyPredicate> = yield* collectPredicates(
    context,
    seed.schema,
    classMetadata.iri
  );
  return AssembledOntologyClass.make({
    schemaIdentity: classMetadata.schemaIdentity,
    termName: classMetadata.termName,
    iri: classMetadata.iri,
    label: classMetadata.label,
    comment: classMetadata.comment,
    altLabels: classMetadata.altLabels,
    definition: classMetadata.definition,
    deprecated: classMetadata.deprecated,
    source: classMetadata.source,
    parents: classMetadata.parents,
    children: classMetadata.children,
    seeAlso: classMetadata.seeAlso,
    isDefinedBy: classMetadata.isDefinedBy,
    equivalentClasses: classMetadata.equivalentClasses,
    exactMatches: classMetadata.exactMatches,
    closeMatches: classMetadata.closeMatches,
    sameAs: classMetadata.sameAs,
    skosProfile: classMetadata.skosProfile,
    provenance: classMetadata.provenance,
    jsonSchemaSidecar: O.some(makeJsonSchemaSidecar(seed)),
    predicates,
  });
});

const issueForClass = (
  ontologyClass: AssembledOntologyClass,
  code: OntologyValidationIssueCode,
  severity: OntologyValidationIssueSeverity,
  message: string
): OntologyValidationIssue =>
  OntologyValidationIssue.make({
    code,
    severity,
    message,
    classIri: O.some(ontologyClass.iri),
    schemaIdentity: O.some(ontologyClass.schemaIdentity),
  });

const literalLanguageKey = (literal: { readonly language: O.Option<string> }): string =>
  pipe(
    literal.language,
    O.getOrElse(() => "")
  );

const literalConflictKey = (literal: { readonly value: string; readonly language: O.Option<string> }): string =>
  `${literalLanguageKey(literal)}\u0000${literal.value}`;

const duplicatePrefLabelIssues = (
  ontologyClass: AssembledOntologyClass,
  profile: OntologySkosProfile
): ReadonlyArray<OntologyValidationIssue> => {
  const duplicateLanguages = pipe(
    profile.prefLabels,
    A.reduce(
      {
        seen: A.empty<string>(),
        duplicates: A.empty<string>(),
      },
      (state, literal) => {
        const language = literalLanguageKey(literal);
        if (pipe(state.seen, A.contains(language))) {
          return pipe(state.duplicates, A.contains(language))
            ? state
            : {
                ...state,
                duplicates: pipe(state.duplicates, A.append(language)),
              };
        }

        return {
          ...state,
          seen: pipe(state.seen, A.append(language)),
        };
      }
    ),
    (state) => state.duplicates
  );

  return pipe(
    duplicateLanguages,
    A.map((language) =>
      issueForClass(
        ontologyClass,
        "duplicatePrefLabel",
        "error",
        pipe(language, Str.isEmpty)
          ? "SKOS concepts and schemes may only have one preferred label without a language tag."
          : `SKOS concepts and schemes may only have one preferred label for language '${language}'.`
      )
    )
  );
};

const hasLiteralConflict = (
  left: { readonly value: string; readonly language: O.Option<string> },
  right: { readonly value: string; readonly language: O.Option<string> }
): boolean => literalConflictKey(left) === literalConflictKey(right);

const labelBucketConflictIssues = (
  ontologyClass: AssembledOntologyClass,
  profile: OntologySkosProfile
): ReadonlyArray<OntologyValidationIssue> => {
  const prefAlt = pipe(
    profile.prefLabels,
    A.filter((literal) =>
      pipe(
        profile.altLabels,
        A.some((candidate) => hasLiteralConflict(literal, candidate))
      )
    )
  );
  const prefHidden = pipe(
    profile.prefLabels,
    A.filter((literal) =>
      pipe(
        profile.hiddenLabels,
        A.some((candidate) => hasLiteralConflict(literal, candidate))
      )
    )
  );
  const altHidden = pipe(
    profile.altLabels,
    A.filter((literal) =>
      pipe(
        profile.hiddenLabels,
        A.some((candidate) => hasLiteralConflict(literal, candidate))
      )
    )
  );

  return pipe(
    [...prefAlt, ...prefHidden, ...altHidden],
    A.map((literal) =>
      issueForClass(
        ontologyClass,
        "conflictingLabelLiteral",
        "error",
        `SKOS label literal '${literal.value}' appears in conflicting pref/alt/hidden label buckets.`
      )
    )
  );
};

const referenceIriEquals = (reference: OntologyReference, iri: IRI): boolean => reference.iri === iri;

const hasReference = (references: ReadonlyArray<OntologyReference>, iri: IRI): boolean =>
  pipe(
    references,
    A.some((reference) => referenceIriEquals(reference, iri))
  );

const skosWarningIssues = (
  ontologyClass: AssembledOntologyClass,
  profile: OntologySkosProfile
): ReadonlyArray<OntologyValidationIssue> => {
  const missingPrefLabel =
    A.length(profile.prefLabels) === 0
      ? [
          issueForClass(
            ontologyClass,
            "missingSkosPrefLabel",
            "warning",
            "SKOS profile has no preferred label; browser display will fall back to the class label."
          ),
        ]
      : A.empty<OntologyValidationIssue>();

  if (profile.kind === "conceptScheme") {
    return missingPrefLabel;
  }

  const missingScheme =
    A.length(profile.inSchemes) === 0
      ? [
          issueForClass(
            ontologyClass,
            "missingConceptScheme",
            "warning",
            "SKOS concept has no concept-scheme membership."
          ),
        ]
      : A.empty<OntologyValidationIssue>();

  const selfHierarchy =
    hasReference(profile.broader, ontologyClass.iri) || hasReference(profile.narrower, ontologyClass.iri)
      ? [
          issueForClass(
            ontologyClass,
            "hierarchyCycle",
            "warning",
            "SKOS concept references itself through broader or narrower hierarchy."
          ),
        ]
      : A.empty<OntologyValidationIssue>();

  const relatedHierarchy = pipe(
    profile.related,
    A.filter(
      (reference) => hasReference(profile.broader, reference.iri) || hasReference(profile.narrower, reference.iri)
    )
  );
  const relatedHierarchyIssues =
    A.length(relatedHierarchy) > 0
      ? [
          issueForClass(
            ontologyClass,
            "relatedDuplicatesHierarchy",
            "warning",
            "SKOS related links duplicate direct broader or narrower hierarchy."
          ),
        ]
      : A.empty<OntologyValidationIssue>();

  return [...missingPrefLabel, ...missingScheme, ...selfHierarchy, ...relatedHierarchyIssues];
};

const validateClassSkosProfile = (ontologyClass: AssembledOntologyClass): ReadonlyArray<OntologyValidationIssue> =>
  pipe(
    ontologyClass.skosProfile,
    O.map((profile) => [
      ...duplicatePrefLabelIssues(ontologyClass, profile),
      ...labelBucketConflictIssues(ontologyClass, profile),
      ...skosWarningIssues(ontologyClass, profile),
    ]),
    O.getOrElse(A.empty<OntologyValidationIssue>)
  );

const validateSkosProfiles = (classes: ReadonlyArray<AssembledOntologyClass>): OntologyValidationReport => {
  const issues = pipe(classes, A.flatMap(validateClassSkosProfile));

  return OntologyValidationReport.make({
    errors: pipe(
      issues,
      A.filter((issue) => issue.severity === "error")
    ),
    warnings: pipe(
      issues,
      A.filter((issue) => issue.severity === "warning")
    ),
  });
};

export const assembleOntology = Effect.fn("Ontology.assembleOntology")(function* (
  metadata: OntologyDefinitionMetadata,
  schemas: A.NonEmptyReadonlyArray<S.Top>
) {
  const seeds = yield* Effect.forEach(schemas, (schema) => classAssemblySeed(metadata.baseIri, schema), {
    concurrency: 1,
  });
  const context = {
    baseIri: metadata.baseIri,
    classesBySchemaIdentity: classReferenceIndex(seeds),
  };
  const classes = yield* Effect.forEach(seeds, (seed) => assembleClass(context, seed), { concurrency: 1 });
  const validation = validateSkosProfiles(classes);

  if (A.length(validation.errors) > 0) {
    const firstError = yield* pipe(
      validation.errors,
      A.head,
      O.match({
        onNone: () =>
          fail("invalidSkosProfile", "SKOS profile validation failed.", O.some(metadata.schemaIdentity), O.none()),
        onSome: Effect.succeed,
      })
    );

    return yield* fail("invalidSkosProfile", firstError.message, firstError.schemaIdentity, O.none());
  }

  return AssembledOntology.make({
    metadata,
    classes,
    validation,
  });
});
