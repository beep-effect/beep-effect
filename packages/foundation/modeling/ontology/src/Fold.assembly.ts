/**
 * Assembly walk for the identity-backed ontology fold.
 *
 * **Details**
 *
 * Follows propose → gate → record: tuples and schema handles are validated
 * and resolved, hard SKOS integrity violations fail with typed
 * {@link OntologyAssemblyError} diagnostics, observable warnings ride the
 * assembled value, and projections stay pure downstream.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import * as Registry from "@beep/identity/Registry";
import { Literal } from "@beep/rdf/Rdf";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import {
  AssembledClass,
  AssembledFact,
  AssembledOntology,
  AssembledPredicate,
  isSchemaHandle,
  OntologyAssemblyError,
  OntologyValidationWarning,
  TripleValue,
} from "./Fold.models.ts";
import { coreNamespaces, rebindsCorePrefix } from "./internal/CoreNamespaces.ts";
import type { SkosClassification as SkosClassificationMarker } from "@beep/identity";
import type { Namespace } from "@beep/identity/Term";
import type { LiteralParts } from "@beep/rdf/Rdf";
import type {
  FactObject,
  LiteralScalar,
  OntologyFoldInput,
  SchemaHandle,
  Subject,
  Triple,
  TupleObject,
  TypedLiteral,
} from "./Fold.models.ts";

// The identity annotations of a schema: its code identity and display metadata, no IRI.
type SchemaIdentity = {
  readonly schema: SchemaHandle;
  readonly identifier: string;
  readonly name: string;
  readonly description: O.Option<string>;
  readonly skos: O.Option<SkosClassificationMarker>;
};

// A schema identity bound in the registry: the term IRI and CURIE its code identity is bound to.
type ClassIdentity = SchemaIdentity & {
  readonly iri: IRI;
  readonly curie: string;
};

type ErrorExtras = Partial<{
  readonly term: string | undefined;
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

const classIdentity = (schema: SchemaHandle): O.Option<SchemaIdentity> => {
  const annotations = S.resolveAnnotations(schema);

  return O.map(annotationString(annotations, "identifier"), (identifier) => ({
    schema,
    identifier,
    name: pipe(
      annotationString(annotations, "title"),
      O.getOrElse(() => identifier)
    ),
    description: annotationString(annotations, "description"),
    skos: pipe(annotationString(annotations, "skosClassification"), O.filter(isSkosMarker)),
  }));
};

const requireClassIdentity = (schema: SchemaHandle): Effect.Effect<SchemaIdentity, OntologyAssemblyError> =>
  pipe(
    classIdentity(schema),
    O.match({
      onNone: () => fail("missingClassAnnotation", "Schema is missing owned identity annotations."),
      onSome: Effect.succeed,
    })
  );

const requireBoundClass = (
  registry: Registry.RegistryView,
  identity: SchemaIdentity
): Effect.Effect<ClassIdentity, OntologyAssemblyError> =>
  pipe(
    registry.bindingOf(identity.identifier),
    O.match({
      onNone: () =>
        fail("unboundClass", `Schema identity is not bound to a registry term: ${identity.identifier}`, {
          identifier: identity.identifier,
        }),
      onSome: (term) =>
        Effect.succeed({ ...identity, iri: IRI.make(term.iri), curie: `${term.namespace}:${term.local}` }),
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

const classIdentityFromAst = (ast: SchemaAST.AST): O.Option<SchemaIdentity> => {
  const schema = S.make<SchemaHandle>(ast);

  return pipe(
    objectAstFromSchema(schema),
    O.filter((objects) => A.isReadonlyArrayNonEmpty(objects.propertySignatures)),
    O.flatMap(() => classIdentity(schema))
  );
};

const classIdentitiesInAst = (ast: SchemaAST.AST): ReadonlyArray<SchemaIdentity> => {
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
  identity: SchemaIdentity
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

const isIriValue = S.is(IRI);

const isAbsoluteIri = (registry: Registry.RegistryView, value: string): boolean =>
  O.isNone(registry.curieNamespace(value)) && isIriValue(value);

const resolvePredicate = (
  registry: Registry.RegistryView,
  term: string
): Effect.Effect<{ readonly term: string; readonly iri: IRI; readonly reverse: boolean }, OntologyAssemblyError> =>
  pipe(
    registry.expandPredicate(term),
    O.match({
      onNone: () => fail("unknownTerm", `Unknown predicate CURIE: ${term}`, { term }),
      onSome: ({ inverse, iri }) =>
        pipe(
          requireIri(iri, term),
          Effect.map((predicateIri) => ({ term, iri: predicateIri, reverse: inverse }))
        ),
    })
  );

const resolveStringTerm = (
  registry: Registry.RegistryView,
  term: string
): Effect.Effect<IRI, OntologyAssemblyError> => {
  if (isAbsoluteIri(registry, term)) {
    return requireIri(term, term);
  }

  return pipe(
    registry.expand(term),
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
const XSD_STRING = IRI.make(Registry.iri("xsd:string"));
const XSD_BOOLEAN = IRI.make(Registry.iri("xsd:boolean"));
const XSD_INTEGER = IRI.make(Registry.iri("xsd:integer"));
const XSD_DECIMAL = IRI.make(Registry.iri("xsd:decimal"));
const XSD_DOUBLE = IRI.make(Registry.iri("xsd:double"));
const RDF_LANG_STRING = IRI.make(Registry.iri("rdf:langString"));

const invalidLiteral = (literal: TypedLiteral, why: string) =>
  fail("invalidLiteral", `Invalid literal "${literal.value}": ${why}.`, { term: literal.datatype });

const numberDatatype = (lexical: string, value: number): IRI => {
  if (Str.includes("e")(lexical)) {
    return XSD_DOUBLE;
  }

  return Number.isInteger(value) ? XSD_INTEGER : XSD_DECIMAL;
};

const impliedDatatype = (value: LiteralScalar, lexical: string): IRI => {
  if (P.isString(value)) {
    return XSD_STRING;
  }

  return P.isBoolean(value) ? XSD_BOOLEAN : numberDatatype(lexical, value);
};

const literalOfParts = (literal: TypedLiteral, parts: typeof LiteralParts.Encoded, why: string) =>
  pipe(
    Literal.fromParts(parts),
    Effect.fromResult,
    Effect.catch(() => invalidLiteral(literal, why))
  );

const resolveTypedLiteral = Effect.fnUntraced(function* (registry: Registry.RegistryView, literal: TypedLiteral) {
  const lexical = `${literal.value}`;
  const datatype =
    literal.datatype === undefined
      ? O.none<IRI>()
      : yield* Effect.asSome(resolveStringTerm(registry, literal.datatype));

  if (literal.language === undefined) {
    return yield* literalOfParts(
      literal,
      { value: lexical, datatype: O.getOrElse(datatype, () => impliedDatatype(literal.value, lexical)) },
      "its datatype names no literal form"
    );
  }

  if (O.exists(datatype, (iri) => iri !== RDF_LANG_STRING)) {
    return yield* invalidLiteral(literal, "a language tag takes no datatype other than rdf:langString");
  }

  return yield* literalOfParts(
    literal,
    { value: lexical, datatype: RDF_LANG_STRING, language: literal.language },
    "its language tag is not well formed"
  );
});

const resolveObject = (
  registry: Registry.RegistryView,
  classes: ReadonlyArray<ClassIdentity>,
  value: TupleObject
): Effect.Effect<FactObject, OntologyAssemblyError> => {
  if (isSchemaHandle(value)) {
    return resolveHandle(classes, value);
  }

  if (P.isString(value)) {
    return resolveStringTerm(registry, value);
  }

  if (isTypedLiteral(value)) {
    return resolveTypedLiteral(registry, value);
  }

  return fail("invalidTriple", "Object is not a schema handle, term, or typed literal.");
};

const resolveSubject = (
  registry: Registry.RegistryView,
  classes: ReadonlyArray<ClassIdentity>,
  value: Subject
): Effect.Effect<IRI, OntologyAssemblyError> => {
  if (isSchemaHandle(value)) {
    return resolveHandle(classes, value);
  }

  return resolveStringTerm(registry, value);
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
  namespace: Namespace,
  registry: Registry.RegistryView,
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
    const resolved = yield* resolvePredicate(registry, borrowed.value);
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

  const ownedIri = yield* pipe(
    registry.expand(`${namespace.prefix}:${field}`),
    O.match({
      onNone: () =>
        fail("undeclaredProperty", `Owned field is not a declared term of namespace ${namespace.prefix}: ${field}`, {
          field,
        }),
      onSome: (iri) => requireIri(iri, field),
    })
  );

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
  namespace: Namespace,
  registry: Registry.RegistryView,
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
    (property) => fieldPredicate(namespace, registry, classes, property),
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

const unknownEndpointTerm = (registry: Registry.RegistryView, value: unknown): O.Option<string> =>
  pipe(
    O.liftPredicate(value, P.isString),
    O.filter((term) => O.isNone(registry.expand(term)) && !isAbsoluteIri(registry, term))
  );

const invalidTripleTerm = (registry: Registry.RegistryView, triple: Triple): O.Option<string> => {
  const [subject, predicate, object] = triple;
  const unknownPredicate = pipe(
    O.liftPredicate(predicate, P.isString),
    O.filter((term) => O.isNone(registry.expandPredicate(term)))
  );
  const unknownDatatype = isTypedLiteral(object) ? unknownEndpointTerm(registry, object.datatype) : O.none<string>();

  return O.firstSomeOf([
    unknownEndpointTerm(registry, subject),
    unknownPredicate,
    unknownEndpointTerm(registry, object),
    unknownDatatype,
  ]);
};

const decodeTripleEffect = S.decodeUnknownEffect(TripleValue);

const isNonFiniteLiteral = (object: TupleObject): object is TypedLiteral =>
  isTypedLiteral(object) && P.isNumber(object.value) && !Number.isFinite(object.value);

const validateTriple = (
  registry: Registry.RegistryView,
  triple: Triple
): Effect.Effect<Triple, OntologyAssemblyError> =>
  pipe(
    decodeTripleEffect(triple),
    Effect.as(triple),
    Effect.mapError(() =>
      pipe(
        invalidTripleTerm(registry, triple),
        O.match({
          onNone: () =>
            isNonFiniteLiteral(triple[2])
              ? assemblyError("invalidLiteral", `Invalid literal "${triple[2].value}": a number must be finite.`)
              : assemblyError("invalidTriple", "Invalid ontology triple tuple."),
          onSome: (term) => assemblyError("unknownTerm", `Unknown term in ontology triple: ${term}`, { term }),
        })
      )
    )
  );

const assembleFact = Effect.fnUntraced(function* (
  registry: Registry.RegistryView,
  classes: ReadonlyArray<ClassIdentity>,
  triple: Triple
) {
  const [subject, predicate, object] = yield* validateTriple(registry, triple);
  const subjectIri = yield* resolveSubject(registry, classes, subject);
  const resolvedPredicate = yield* resolvePredicate(registry, predicate);
  const resolvedObject = yield* resolveObject(registry, classes, object);

  if (resolvedPredicate.reverse && Literal.is(resolvedObject)) {
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

const SKOS_PREF_LABEL = Registry.iri("skos:prefLabel");
const SKOS_ALT_LABEL = Registry.iri("skos:altLabel");
const SKOS_HIDDEN_LABEL = Registry.iri("skos:hiddenLabel");
const SKOS_BROADER = Registry.iri("skos:broader");
const SKOS_NARROWER = Registry.iri("skos:narrower");
const SKOS_RELATED = Registry.iri("skos:related");
const SKOS_IN_SCHEME = Registry.iri("skos:inScheme");

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
          Literal.is(fact.object) && fact.object.form._tag !== "Typed"
            ? O.some({
                subjectIri: fact.subjectIri,
                bucket,
                value: fact.object.value,
                language: pipe(
                  Literal.languageOf(fact.object),
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

// The projections bind the core prefixes themselves, so a registry must bind each to the same namespace or not at all.
const requireCorePrefixes = (registry: Registry.RegistryView): Effect.Effect<void, OntologyAssemblyError> =>
  pipe(
    coreNamespaces,
    A.map((core) => registry.namespaceOf(core.prefix)),
    A.getSomes,
    A.findFirst(rebindsCorePrefix),
    O.match({
      onNone: () => Effect.void,
      onSome: ({ iri, prefix }) =>
        fail("reservedPrefix", `Registry rebinds the core prefix ${prefix} to ${iri}.`, { term: prefix }),
    })
  );

const assembleWith = (registry: Registry.RegistryView) =>
  Effect.fn("Ontology.foldWith")(function* (prefix: string, input: OntologyFoldInput) {
    yield* requireCorePrefixes(registry);
    const namespace = yield* pipe(
      registry.namespaceOf(prefix),
      O.match({
        onNone: () => fail("unknownTerm", `Unknown registry namespace: ${prefix}`, { term: prefix }),
        onSome: Effect.succeed,
      })
    );
    const label = yield* pipe(
      decodeLabelEffect(input.label),
      Effect.mapError(() => assemblyError("invalidLabel", "Ontology label must be non-empty."))
    );
    const identities = yield* Effect.forEach(input.schemas, requireClassIdentity, { concurrency: 1 });
    const classes = yield* Effect.forEach(identities, (identity) => requireBoundClass(registry, identity), {
      concurrency: 1,
    });
    const assembledClasses = yield* Effect.forEach(
      classes,
      (identity) => assembleClass(namespace, registry, classes, identity),
      { concurrency: 1 }
    );
    const facts = yield* Effect.forEach(input.triples, (triple) => assembleFact(registry, classes, triple), {
      concurrency: 1,
    });
    const semanticFacts = pipe(facts, A.map(semanticFact));

    const hardIssue = skosHardIssue(semanticFacts);
    if (O.isSome(hardIssue)) {
      return yield* hardIssue.value;
    }

    return AssembledOntology.make({
      label,
      baseIri: namespace.iri,
      prefix: namespace.prefix,
      classes: assembledClasses,
      facts,
      warnings: skosWarnings(assembledClasses, semanticFacts),
    });
  });

/**
 * Fold schemas and triples-as-tuples into a deterministic assembled ontology over a given registry.
 *
 * **When to use**
 *
 * Use with a fixture registry, such as one built with `view` from
 * `@beep/identity/Registry` in a test. Production code calls {@link fold}.
 *
 * **Details**
 *
 * The registry namespace `prefix` is the owned namespace and the ontology
 * base. Each schema's code identity must be bound in the registry, and the
 * bound term is the class IRI; an unbound schema fails with `unboundClass`.
 * An owned field must be a declared term of the namespace, or the fold fails
 * with `undeclaredProperty`. Borrowed predicates ride the `ontologyTerm`
 * channel. An unknown namespace fails with `unknownTerm`, and a registry that
 * binds a core prefix (`dcterms`, `owl`, `rdf`, `rdfs`, `skos`) to another
 * namespace than the core one fails with `reservedPrefix`.
 *
 * **Example** (Fold over a fixture registry)
 * ```ts
 * import { $I as $BeepId } from "@beep/identity/packages"
 * import { view } from "@beep/identity/Registry"
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 * import { foldWith } from "@beep/ontology/Fold.assembly"
 * import * as Effect from "effect/Effect"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const $I = $BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)({ text: S.String }, $I.class("Claim")) {}
 *
 * const patent = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "patent", iri: "https://example.test/patent/" },
 *   terms: ["Claim", "text"],
 *   bindings: [{ code: "@beep/patent/Claim", local: "Claim", since: "1.0.0" }],
 *   deprecations: []
 * })
 * const registry = view(Result.getOrThrow(RegistryTable.fromShards([patent])))
 * const assembled = Effect.runSync(foldWith(registry)("patent", { label: "Patent", schemas: [Claim], triples: [] }))
 * console.log(assembled.classes[0]?.iri) // "https://example.test/patent/Claim"
 * ```
 *
 * @param registry - The registry the namespace, class bindings and terms are read from.
 * @returns The fold over `registry`.
 * @category constructors
 * @since 0.0.0
 */
export const foldWith: (
  registry: Registry.RegistryView
) => (prefix: string, input: OntologyFoldInput) => Effect.Effect<AssembledOntology, OntologyAssemblyError> =
  assembleWith;

/**
 * Fold schemas and triples-as-tuples into a deterministic assembled ontology over the generated registry.
 *
 * **Details**
 *
 * The registry namespace `prefix` is the owned namespace and the ontology
 * base. Each schema is bound to its class term in the registry, owned fields
 * are declared terms of the namespace, and borrowed predicates ride the
 * `ontologyTerm` channel. {@link foldWith} lists the refusals.
 *
 * **Example** (Fold an empty ontology under a registry namespace)
 * ```ts
 * import { fold } from "@beep/ontology/Fold.assembly"
 * import * as Effect from "effect/Effect"
 *
 * const assembled = Effect.runSync(fold("research-library", { label: "Research Library", schemas: [], triples: [] }))
 * console.log(assembled.baseIri) // "https://beep-effect.com/ns/research-library/"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fold = Effect.fn("Ontology.fold")(function* (prefix: Registry.RegistryPrefix, input: OntologyFoldInput) {
  return yield* foldWith(Registry.generatedView)(prefix, input);
});
