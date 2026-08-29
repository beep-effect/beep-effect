/**
 * Assembly walk for the identity-backed ontology fold.
 *
 * Follows propose → gate → record: tuples and schema handles are validated
 * and resolved, hard SKOS integrity violations fail with typed
 * {@link OntologyAssemblyError} diagnostics, observable warnings ride the
 * assembled value, and projections stay pure downstream.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CoreVocab, expand, expandOption, expandPredicate } from "@beep/identity";
import { IRI } from "@beep/rdf/Iri";
import { LanguageTag } from "@beep/rdf/Rdf";
import { Effect, flow, MutableHashMap, MutableHashSet, pipe, SchemaAST } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AssembledClass,
  AssembledFact,
  AssembledOntology,
  AssembledPredicate,
  FactLiteral,
  isFactLiteral,
  isSchemaHandle,
  OntologyAssemblyError,
  OntologyValidationWarning,
  TripleValue,
} from "./Fold.models.ts";
import { registryPrefix } from "./internal/Fold.ts";
import type { IdentityComposer, SkosClassification as SkosClassificationMarker, VocabShape } from "@beep/identity";
import type {
  FactObject,
  OntologyFoldInput,
  SchemaHandle,
  Subject,
  Triple,
  TupleObject,
  TypedLiteral,
} from "./Fold.models.ts";

/**
 * Bound identity composer accepted by the fold.
 *
 * One-argument `make(...)` composers are unbound and expose no IRI/CURIE
 * projections; the fold requires a bound composer.
 *
 * **Example** (Usage)
 * ```ts
 * import { make } from "@beep/identity"
 * import type { BoundComposer } from "@beep/ontology"
 *
 * const composer: BoundComposer = make("beep", {
 *   authority: "https://ns.beep.sh/",
 *   prefix: "beep",
 * }).$BeepId.create("patent")
 * console.log(composer.iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoundComposer = IdentityComposer<string, string, string, VocabShape>;

type ClassIdentity = {
  readonly schema: SchemaHandle;
  readonly identifier: string;
  readonly name: string;
  readonly iri: IRI;
  readonly curie: string;
  readonly description: O.Option<string>;
  readonly skos: O.Option<SkosClassificationMarker>;
};

type ErrorExtras = Partial<{
  readonly term: string;
  readonly field: string;
  readonly identifier: string;
  readonly subjectIri: IRI;
  readonly objectIri: IRI;
}>;

const assemblyError = (
  reason: OntologyAssemblyError["reason"],
  message: string,
  extras: ErrorExtras = {}
): OntologyAssemblyError =>
  OntologyAssemblyError.make({
    reason,
    message,
    term: O.fromUndefinedOr(extras.term),
    field: O.fromUndefinedOr(extras.field),
    identifier: O.fromUndefinedOr(extras.identifier),
    subjectIri: O.fromUndefinedOr(extras.subjectIri),
    objectIri: O.fromUndefinedOr(extras.objectIri),
  });

const fail = (
  reason: OntologyAssemblyError["reason"],
  message: string,
  extras: ErrorExtras = {}
): Effect.Effect<never, OntologyAssemblyError> => Effect.fail(assemblyError(reason, message, extras));

const decodeIriEffect = S.decodeUnknownEffect(IRI);
const decodeLabelEffect = S.decodeUnknownEffect(S.NonEmptyString);

const requireIri = (value: string, term: string): Effect.Effect<IRI, OntologyAssemblyError> =>
  pipe(
    decodeIriEffect(value),
    Effect.mapError(() => assemblyError("unknownTerm", `Term does not resolve to a valid IRI: ${term}`, { term }))
  );

const annotationString = (annotations: unknown, property: string): O.Option<string> =>
  P.hasProperty(annotations, property) && P.isString(annotations[property]) ? O.some(annotations[property]) : O.none();

const isSkosMarker = (value: string): value is SkosClassificationMarker =>
  value === "concept" || value === "conceptScheme";

const isIri = S.is(IRI);

const classIdentity = (schema: SchemaHandle): O.Option<ClassIdentity> => {
  const annotations = S.resolveAnnotations(schema);

  return pipe(
    O.all({
      identifier: annotationString(annotations, "identifier"),
      iri: pipe(annotationString(annotations, "iri"), O.filter(isIri)),
      curie: annotationString(annotations, "curie"),
    }),
    O.map(({ curie, identifier, iri }) => ({
      schema,
      identifier,
      iri,
      curie,
      name: pipe(
        annotationString(annotations, "title"),
        O.getOrElse(() => identifier)
      ),
      description: annotationString(annotations, "description"),
      skos: pipe(annotationString(annotations, "skosClassification"), O.filter(isSkosMarker)),
    }))
  );
};

const requireClassIdentity = (schema: SchemaHandle): Effect.Effect<ClassIdentity, OntologyAssemblyError> =>
  pipe(
    classIdentity(schema),
    O.match({
      onNone: () => fail("missingClassAnnotation", "Schema is missing owned identity annotations."),
      onSome: Effect.succeed,
    })
  );

const objectAstFromSchema = (schema: SchemaHandle): O.Option<SchemaAST.Objects> => {
  if (SchemaAST.isObjects(schema.ast)) {
    return O.some(schema.ast);
  }

  if (SchemaAST.isDeclaration(schema.ast)) {
    return pipe(schema.ast.typeParameters, A.findFirst(SchemaAST.isObjects));
  }

  return O.none();
};

const classIdentityFromAst = (ast: SchemaAST.AST): O.Option<ClassIdentity> => {
  const schema = S.make<SchemaHandle>(ast);

  return pipe(
    objectAstFromSchema(schema),
    O.filter((objects) => A.isReadonlyArrayNonEmpty(objects.propertySignatures)),
    O.flatMap(() => classIdentity(schema))
  );
};

const classIdentitiesInAst = (ast: SchemaAST.AST): ReadonlyArray<ClassIdentity> => {
  const direct = classIdentityFromAst(ast);
  if (O.isSome(direct)) {
    return [direct.value];
  }

  const children: ReadonlyArray<SchemaAST.AST> = SchemaAST.isArrays(ast)
    ? [...ast.elements, ...ast.rest]
    : SchemaAST.isDeclaration(ast)
      ? ast.typeParameters
      : SchemaAST.isUnion(ast)
        ? ast.types
        : [];

  return pipe(
    children,
    A.flatMap(classIdentitiesInAst),
    A.dedupeWith((left, right) => left.identifier === right.identifier)
  );
};

const scalarLeafGuards: ReadonlyArray<(ast: SchemaAST.AST) => boolean> = [
  SchemaAST.isString,
  SchemaAST.isNumber,
  SchemaAST.isBoolean,
  SchemaAST.isBigInt,
  SchemaAST.isLiteral,
];

const scalarChildren = (ast: SchemaAST.AST): O.Option<ReadonlyArray<SchemaAST.AST>> => {
  if (SchemaAST.isArrays(ast)) {
    return O.some([...ast.elements, ...ast.rest]);
  }

  if (SchemaAST.isDeclaration(ast)) {
    return O.some(ast.typeParameters);
  }

  if (SchemaAST.isUnion(ast)) {
    return O.some(ast.types);
  }

  return O.none();
};

const isScalarAst = (ast: SchemaAST.AST): boolean => {
  if (
    pipe(
      scalarLeafGuards,
      A.some((guard) => guard(ast))
    )
  ) {
    return true;
  }

  if (SchemaAST.isObjects(ast)) {
    return !A.isReadonlyArrayNonEmpty(ast.propertySignatures);
  }

  return pipe(
    scalarChildren(ast),
    O.match({
      onNone: () => false,
      onSome: A.every(isScalarAst),
    })
  );
};

const includedClass = (classes: ReadonlyArray<ClassIdentity>, identifier: string): O.Option<ClassIdentity> =>
  pipe(
    classes,
    A.findFirst((item) => item.identifier === identifier)
  );

const requireIncludedClass = (
  classes: ReadonlyArray<ClassIdentity>,
  identity: ClassIdentity
): Effect.Effect<ClassIdentity, OntologyAssemblyError> =>
  pipe(
    includedClass(classes, identity.identifier),
    O.match({
      onNone: () =>
        fail("unresolvedHandle", `Schema handle is not part of this ontology fold: ${identity.identifier}`, {
          identifier: identity.identifier,
        }),
      onSome: Effect.succeed,
    })
  );

const appendLocal = (base: string, name: string): string =>
  pipe(base, Str.endsWith("/")) || pipe(base, Str.endsWith("#")) ? `${base}${name}` : `${base}/${name}`;

const isIriValue = S.is(IRI);

const isAbsoluteIri = (vocab: VocabShape, value: string): boolean =>
  O.isNone(registryPrefix(vocab, value)) && isIriValue(value);

const resolvePredicate = (
  vocab: VocabShape,
  term: string
): Effect.Effect<{ readonly term: string; readonly iri: IRI; readonly reverse: boolean }, OntologyAssemblyError> =>
  pipe(
    O.fromUndefinedOr(expandPredicate(term, vocab)),
    O.match({
      onNone: () => fail("unknownTerm", `Unknown predicate CURIE: ${term}`, { term }),
      onSome: ({ inverse, iri }) =>
        pipe(
          requireIri(iri, term),
          Effect.map((predicateIri) => ({ term, iri: predicateIri, reverse: inverse }))
        ),
    })
  );

const resolveStringTerm = (vocab: VocabShape, term: string): Effect.Effect<IRI, OntologyAssemblyError> => {
  if (isAbsoluteIri(vocab, term)) {
    return requireIri(term, term);
  }

  return pipe(
    expandOption(term, vocab),
    O.match({
      onNone: () => fail("unknownTerm", `Unknown term: ${term}`, { term }),
      onSome: (iri) => requireIri(iri, term),
    })
  );
};

const resolveHandle = Effect.fnUntraced(function* (classes: ReadonlyArray<ClassIdentity>, schema: SchemaHandle) {
  const identity = yield* requireClassIdentity(schema);
  const included = yield* requireIncludedClass(classes, identity);
  return included.iri;
});

const isLiteralScalar = (value: unknown): value is string | number | boolean =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

const isTypedLiteral = (value: unknown): value is TypedLiteral =>
  P.isObject(value) && P.hasProperty(value, "value") && isLiteralScalar(value.value);
const decodeLanguageTag = S.decodeUnknownOption(LanguageTag);

const resolveTypedLiteral = Effect.fnUntraced(function* (vocab: VocabShape, literal: TypedLiteral) {
  const datatypeIri =
    literal.datatype === undefined ? O.none<IRI>() : O.some(yield* resolveStringTerm(vocab, literal.datatype));

  return FactLiteral.make({
    value: literal.value,
    datatypeIri,
    language: O.flatMap(O.fromUndefinedOr(literal.language), decodeLanguageTag),
  });
});

const resolveObject = (
  vocab: VocabShape,
  classes: ReadonlyArray<ClassIdentity>,
  value: TupleObject
): Effect.Effect<FactObject, OntologyAssemblyError> => {
  if (isSchemaHandle(value)) {
    return resolveHandle(classes, value);
  }

  if (P.isString(value)) {
    return resolveStringTerm(vocab, value);
  }

  if (isTypedLiteral(value)) {
    return resolveTypedLiteral(vocab, value);
  }

  return fail("invalidTriple", "Object is not a schema handle, term, or typed literal.");
};

const resolveSubject = (
  vocab: VocabShape,
  classes: ReadonlyArray<ClassIdentity>,
  value: Subject
): Effect.Effect<IRI, OntologyAssemblyError> => {
  if (isSchemaHandle(value)) {
    return resolveHandle(classes, value);
  }

  return resolveStringTerm(vocab, value);
};

const inferPredicateKind = (
  classes: ReadonlyArray<ClassIdentity>,
  field: string,
  ast: SchemaAST.AST
): Effect.Effect<
  | { readonly kind: "datatype"; readonly rangeIri: O.Option<IRI> }
  | { readonly kind: "object"; readonly rangeIri: O.Option<IRI> },
  OntologyAssemblyError
> => {
  const identities = classIdentitiesInAst(ast);

  if (identities.length > 1) {
    return fail(
      "unsupportedFieldAst",
      `Field references a union of multiple class ranges; model one range or reject explicitly: ${field}`,
      { field }
    );
  }

  return pipe(
    A.head(identities),
    O.match({
      onSome: (identity) =>
        pipe(
          requireIncludedClass(classes, identity),
          Effect.map((included) => ({ kind: "object" as const, rangeIri: O.some(included.iri) }))
        ),
      onNone: () =>
        isScalarAst(ast)
          ? Effect.succeed({ kind: "datatype" as const, rangeIri: O.none<IRI>() })
          : fail("unsupportedFieldAst", `Unsupported field AST for ontology predicate inference: ${field}`, {
              field,
            }),
    })
  );
};

const requireStringFieldName = (property: SchemaAST.PropertySignature): Effect.Effect<string, OntologyAssemblyError> =>
  P.isString(property.name) && Str.isNonEmpty(property.name)
    ? Effect.succeed(property.name)
    : fail("unsupportedFieldAst", "Only string field names are supported.");

const fieldPredicate = Effect.fnUntraced(function* (
  composer: BoundComposer,
  vocab: VocabShape,
  classes: ReadonlyArray<ClassIdentity>,
  property: SchemaAST.PropertySignature
) {
  const field = yield* requireStringFieldName(property);
  const propertySchema = S.make<SchemaHandle>(property.type);
  const annotations = S.resolveAnnotationsKey(propertySchema);
  const description = annotationString(annotations, "description");
  const kind = yield* inferPredicateKind(classes, field, property.type);
  const borrowed = annotationString(annotations, "ontologyTerm");

  if (O.isSome(borrowed)) {
    const resolved = yield* resolvePredicate(vocab, borrowed.value);
    return AssembledPredicate.make({
      key: field,
      term: borrowed.value,
      termIri: resolved.iri,
      kind: kind.kind,
      description,
      rangeIri: kind.rangeIri,
      reverse: resolved.reverse,
    });
  }

  const ownedIri = yield* requireIri(appendLocal(composer.iri, field), field);

  return AssembledPredicate.make({
    key: field,
    term: field,
    termIri: ownedIri,
    kind: kind.kind,
    description,
    rangeIri: kind.rangeIri,
    reverse: false,
  });
});

const assembleClass = Effect.fnUntraced(function* (
  composer: BoundComposer,
  vocab: VocabShape,
  classes: ReadonlyArray<ClassIdentity>,
  identity: ClassIdentity
) {
  const objectAst = yield* pipe(
    objectAstFromSchema(identity.schema),
    O.match({
      onNone: () =>
        fail("unsupportedFieldAst", `Schema does not expose object fields: ${identity.identifier}`, {
          identifier: identity.identifier,
        }),
      onSome: Effect.succeed,
    })
  );
  const predicates = yield* Effect.forEach(
    objectAst.propertySignatures,
    (property) => fieldPredicate(composer, vocab, classes, property),
    { concurrency: 1 }
  );

  return AssembledClass.make({
    name: identity.name,
    iri: identity.iri,
    curie: identity.curie,
    description: identity.description,
    skos: identity.skos,
    predicates,
  });
});

const unknownEndpointTerm = (vocab: VocabShape, value: unknown): O.Option<string> =>
  pipe(
    O.liftPredicate(value, P.isString),
    O.filter((term) => O.isNone(expandOption(term, vocab)) && !isAbsoluteIri(vocab, term))
  );

const invalidTripleTerm = (vocab: VocabShape, triple: Triple): O.Option<string> => {
  const [subject, predicate, object] = triple;
  const unknownPredicate = pipe(
    O.liftPredicate(predicate, P.isString),
    O.filter((term) => expandPredicate(term, vocab) === undefined)
  );
  const unknownDatatype = isTypedLiteral(object) ? unknownEndpointTerm(vocab, object.datatype) : O.none<string>();

  return O.firstSomeOf([
    unknownEndpointTerm(vocab, subject),
    unknownPredicate,
    unknownEndpointTerm(vocab, object),
    unknownDatatype,
  ]);
};

const decodeTripleEffect = S.decodeUnknownEffect(TripleValue);

const validateTriple = (vocab: VocabShape, triple: Triple): Effect.Effect<Triple, OntologyAssemblyError> =>
  pipe(
    decodeTripleEffect(triple),
    Effect.as(triple),
    Effect.mapError(() =>
      pipe(
        invalidTripleTerm(vocab, triple),
        O.match({
          onNone: () => assemblyError("invalidTriple", "Invalid ontology triple tuple."),
          onSome: (term) => assemblyError("unknownTerm", `Unknown term in ontology triple: ${term}`, { term }),
        })
      )
    )
  );

const assembleFact = Effect.fnUntraced(function* (
  vocab: VocabShape,
  classes: ReadonlyArray<ClassIdentity>,
  triple: Triple
) {
  const [subject, predicate, object] = yield* validateTriple(vocab, triple);
  const subjectIri = yield* resolveSubject(vocab, classes, subject);
  const resolvedPredicate = yield* resolvePredicate(vocab, predicate);
  const resolvedObject = yield* resolveObject(vocab, classes, object);

  if (resolvedPredicate.reverse && isFactLiteral(resolvedObject)) {
    return yield* fail(
      "invalidTriple",
      `Reverse predicate ${resolvedPredicate.term} cannot take a literal object: literals are not RDF subjects.`,
      { term: resolvedPredicate.term, subjectIri }
    );
  }

  return AssembledFact.make({
    subjectIri,
    predicateIri: resolvedPredicate.iri,
    object: resolvedObject,
    reverse: resolvedPredicate.reverse,
  });
});

const semanticFact = (fact: AssembledFact): AssembledFact =>
  fact.reverse && P.isString(fact.object)
    ? AssembledFact.make({
        subjectIri: fact.object,
        predicateIri: fact.predicateIri,
        object: fact.subjectIri,
        reverse: false,
      })
    : fact;

const SKOS_PREF_LABEL = expand("skos:prefLabel");
const SKOS_ALT_LABEL = expand("skos:altLabel");
const SKOS_HIDDEN_LABEL = expand("skos:hiddenLabel");
const SKOS_BROADER = expand("skos:broader");
const SKOS_NARROWER = expand("skos:narrower");
const SKOS_RELATED = expand("skos:related");
const SKOS_IN_SCHEME = expand("skos:inScheme");

type LabelFact = {
  readonly subjectIri: IRI;
  readonly bucket: "pref" | "alt" | "hidden";
  readonly value: string;
  readonly language: string;
};

const labelBucket = (predicateIri: string): O.Option<LabelFact["bucket"]> => {
  if (predicateIri === SKOS_PREF_LABEL) {
    return O.some("pref");
  }

  if (predicateIri === SKOS_ALT_LABEL) {
    return O.some("alt");
  }

  if (predicateIri === SKOS_HIDDEN_LABEL) {
    return O.some("hidden");
  }

  return O.none();
};

const labelFacts: (facts: ReadonlyArray<AssembledFact>) => ReadonlyArray<LabelFact> = flow(
  A.map(
    (fact): O.Option<LabelFact> =>
      pipe(
        labelBucket(fact.predicateIri),
        O.flatMap((bucket) =>
          isFactLiteral(fact.object) && P.isString(fact.object.value)
            ? O.some({
                subjectIri: fact.subjectIri,
                bucket,
                value: fact.object.value,
                language: pipe(
                  fact.object.language,
                  O.getOrElse(() => "")
                ),
              })
            : O.none()
        )
      )
  ),
  A.getSomes
);

type HierarchyEdge = {
  readonly subjectIri: IRI;
  readonly objectIri: IRI;
};

const hierarchyCycleEdge = (edges: ReadonlyArray<HierarchyEdge>): O.Option<HierarchyEdge> => {
  const successors = MutableHashMap.empty<IRI, ReadonlyArray<HierarchyEdge>>();
  for (const edge of edges) {
    MutableHashMap.set(
      successors,
      edge.subjectIri,
      pipe(
        MutableHashMap.get(successors, edge.subjectIri),
        O.getOrElse((): ReadonlyArray<HierarchyEdge> => []),
        A.append(edge)
      )
    );
  }

  const settled = MutableHashSet.empty<IRI>();
  const walking = MutableHashSet.empty<IRI>();

  const walk = (node: IRI): O.Option<HierarchyEdge> => {
    if (MutableHashSet.has(settled, node)) {
      return O.none();
    }

    MutableHashSet.add(walking, node);
    const outgoing = pipe(
      MutableHashMap.get(successors, node),
      O.getOrElse((): ReadonlyArray<HierarchyEdge> => [])
    );

    for (const edge of outgoing) {
      if (MutableHashSet.has(walking, edge.objectIri)) {
        return O.some(edge);
      }

      const nested = walk(edge.objectIri);
      if (O.isSome(nested)) {
        return nested;
      }
    }

    MutableHashSet.remove(walking, node);
    MutableHashSet.add(settled, node);
    return O.none();
  };

  for (const edge of edges) {
    const found = walk(edge.subjectIri);
    if (O.isSome(found)) {
      return found;
    }
  }

  return O.none();
};

const skosHardIssue = (facts: ReadonlyArray<AssembledFact>): O.Option<OntologyAssemblyError> => {
  const labels = labelFacts(facts);

  const duplicatePref = pipe(
    labels,
    A.filter((label) => label.bucket === "pref"),
    (prefs) =>
      pipe(
        prefs,
        A.findFirst((label, index) =>
          pipe(
            prefs,
            A.some(
              (candidate, candidateIndex) =>
                candidateIndex > index &&
                candidate.subjectIri === label.subjectIri &&
                candidate.language === label.language
            )
          )
        )
      )
  );

  if (O.isSome(duplicatePref)) {
    return O.some(
      assemblyError(
        "skosIntegrity",
        duplicatePref.value.language === ""
          ? "SKOS subjects may only have one preferred label without a language tag."
          : `SKOS subjects may only have one preferred label for language '${duplicatePref.value.language}'.`,
        { term: "skos:prefLabel", subjectIri: duplicatePref.value.subjectIri }
      )
    );
  }

  const bucketConflict = pipe(
    labels,
    A.findFirst((label) =>
      pipe(
        labels,
        A.some(
          (candidate) =>
            candidate.subjectIri === label.subjectIri &&
            candidate.bucket !== label.bucket &&
            candidate.value === label.value &&
            candidate.language === label.language
        )
      )
    )
  );

  if (O.isSome(bucketConflict)) {
    return O.some(
      assemblyError(
        "skosIntegrity",
        `SKOS label literal '${bucketConflict.value.value}' appears in conflicting pref/alt/hidden buckets.`,
        { subjectIri: bucketConflict.value.subjectIri }
      )
    );
  }

  const hierarchy: ReadonlyArray<HierarchyEdge> = pipe(
    facts,
    A.map((fact): O.Option<HierarchyEdge> => {
      if (!P.isString(fact.object)) {
        return O.none();
      }

      if (fact.predicateIri === SKOS_BROADER) {
        return O.some({ subjectIri: fact.subjectIri, objectIri: fact.object });
      }

      if (fact.predicateIri === SKOS_NARROWER) {
        return O.some({ subjectIri: fact.object, objectIri: fact.subjectIri });
      }

      return O.none();
    }),
    A.getSomes
  );

  const hierarchyViolation = hierarchyCycleEdge(hierarchy);

  if (O.isSome(hierarchyViolation)) {
    return O.some(
      assemblyError(
        "skosIntegrity",
        "SKOS hierarchy direction violation: broader/narrower edges form a cycle or contradiction.",
        {
          subjectIri: hierarchyViolation.value.subjectIri,
          objectIri: hierarchyViolation.value.objectIri,
        }
      )
    );
  }

  return O.none();
};

const skosWarnings = (
  classes: ReadonlyArray<AssembledClass>,
  facts: ReadonlyArray<AssembledFact>
): ReadonlyArray<OntologyValidationWarning> => {
  const labels = labelFacts(facts);
  const concepts = pipe(
    classes,
    A.filter((assembled) =>
      pipe(
        assembled.skos,
        O.exists((marker) => marker === "concept")
      )
    )
  );

  const missingScheme = pipe(
    concepts,
    A.filter(
      (assembled) =>
        !pipe(
          facts,
          A.some((fact) => fact.subjectIri === assembled.iri && fact.predicateIri === SKOS_IN_SCHEME)
        )
    ),
    A.map((assembled) =>
      OntologyValidationWarning.make({
        code: "missingConceptScheme",
        message: "SKOS concept has no concept-scheme membership.",
        subjectIri: O.some(assembled.iri),
      })
    )
  );

  const missingPrefLabel = pipe(
    concepts,
    A.filter(
      (assembled) =>
        !pipe(
          labels,
          A.some((label) => label.subjectIri === assembled.iri && label.bucket === "pref")
        )
    ),
    A.map((assembled) =>
      OntologyValidationWarning.make({
        code: "missingPrefLabel",
        message: "SKOS concept has no preferred label; display falls back to the class name.",
        subjectIri: O.some(assembled.iri),
      })
    )
  );

  const relatedDuplicates = pipe(
    facts,
    A.filter((fact) => fact.predicateIri === SKOS_RELATED && P.isString(fact.object)),
    A.filter((fact) =>
      pipe(
        facts,
        A.some(
          (candidate) =>
            (candidate.predicateIri === SKOS_BROADER || candidate.predicateIri === SKOS_NARROWER) &&
            candidate.subjectIri === fact.subjectIri &&
            candidate.object === fact.object
        )
      )
    ),
    A.map((fact) =>
      OntologyValidationWarning.make({
        code: "relatedDuplicatesHierarchy",
        message: "SKOS related link duplicates direct broader or narrower hierarchy.",
        subjectIri: O.some(fact.subjectIri),
      })
    )
  );

  return [...missingScheme, ...missingPrefLabel, ...relatedDuplicates];
};

const composerPrefix = (composer: BoundComposer): string =>
  pipe(
    composer.curie,
    Str.indexOf(":"),
    O.map((separator) => pipe(composer.curie, Str.slice(0, separator))),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => "beep")
  );

/**
 * Fold schemas and triples-as-tuples into a deterministic assembled ontology.
 *
 * The composer supplies the owned namespace: class IRIs resolve through their
 * identity annotations, owned predicates default their local names from
 * struct keys, and borrowed predicates ride the `ontologyTerm` channel.
 *
 * **Example** (Usage)
 * ```ts
 * import { make } from "@beep/identity"
 * import { fold } from "@beep/ontology"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)(
 *   {
 *     prefLabel: S.String.pipe($I.key("skos:prefLabel")),
 *     text: S.String,
 *   },
 *   $I.class("Claim", { description: "A patent claim." })
 * ) {}
 *
 * const assembled = Effect.runSync(
 *   fold($I, {
 *     label: "Patent Core",
 *     schemas: [Claim],
 *     triples: [[Claim, "rdfs:subClassOf", "owl:Thing"]],
 *   })
 * )
 * console.log(assembled.classes[0]?.iri) // "https://ns.beep.sh/patent/Claim"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fold = Effect.fn("Ontology.fold")(function* (composer: BoundComposer, input: OntologyFoldInput) {
  const vocab = pipe(
    O.fromUndefinedOr(composer.vocabRegistry),
    O.getOrElse((): VocabShape => CoreVocab)
  );
  const prefix = composerPrefix(composer);
  if (P.hasProperty(vocab, prefix)) {
    return yield* fail("reservedPrefix", `Owned prefix collides with a registered vocabulary prefix: ${prefix}`, {
      term: prefix,
    });
  }

  const label = yield* pipe(
    decodeLabelEffect(input.label),
    Effect.mapError(() => assemblyError("invalidLabel", "Ontology label must be non-empty."))
  );
  const baseIri = yield* requireIri(composer.iri, composer.identifier);
  const classes = yield* Effect.forEach(input.schemas, requireClassIdentity, { concurrency: 1 });
  const assembledClasses = yield* Effect.forEach(
    classes,
    (identity) => assembleClass(composer, vocab, classes, identity),
    { concurrency: 1 }
  );
  const facts = yield* Effect.forEach(input.triples, (triple) => assembleFact(vocab, classes, triple), {
    concurrency: 1,
  });
  const semanticFacts = pipe(facts, A.map(semanticFact));

  const hardIssue = skosHardIssue(semanticFacts);
  if (O.isSome(hardIssue)) {
    return yield* hardIssue.value;
  }

  return AssembledOntology.make({
    label,
    baseIri,
    prefix,
    classes: assembledClasses,
    facts,
    warnings: skosWarnings(assembledClasses, semanticFacts),
  });
});
