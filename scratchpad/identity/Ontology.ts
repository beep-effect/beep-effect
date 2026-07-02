import { Effect, pipe, SchemaAST } from "effect";
import * as A from "effect/Array";
import * as Data from "effect/Data";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { expand, expandPredicate } from "./Curie.ts";
import type { IdentityComposer } from "./Composer.ts";
import type { CoreVocab, Curie, Predicate } from "./Vocab.ts";

export type AbsoluteIri = `${"http" | "https"}://${string}`;
export type SchemaHandle = S.Top;
export type Subject = SchemaHandle | Curie<CoreVocab> | AbsoluteIri;
export type LiteralScalar = string | number | boolean;
export type TypedLiteral = {
  readonly value: LiteralScalar;
  readonly datatype?: Curie<CoreVocab> | AbsoluteIri;
  readonly language?: string;
};
export type Object = Subject | TypedLiteral;
export type Triple = readonly [Subject, Predicate<CoreVocab>, Object];

export type KeyAnnotation<Term extends string = Predicate<CoreVocab>> = {
  readonly term?: Term;
  readonly description?: string;
};

export type AssembledPredicate = {
  readonly key: string;
  readonly term: string;
  readonly termIri: string;
  readonly kind: "datatype" | "object";
  readonly description?: string;
  readonly rangeIri?: string;
  readonly reverse?: true;
};

export type AssembledClass = {
  readonly name: string;
  readonly iri: string;
  readonly curie: string;
  readonly description?: string;
  readonly predicates: ReadonlyArray<AssembledPredicate>;
};

export type FactObject =
  | string
  | {
      readonly value: LiteralScalar;
      readonly datatypeIri?: string;
      readonly language?: string;
    };

export type AssembledFact = {
  readonly subjectIri: string;
  readonly predicateIri: string;
  readonly object: FactObject;
  readonly reverse?: true;
};

export type AssembledOntology = {
  readonly label: string;
  readonly baseIri: string;
  readonly prefix: string;
  readonly classes: ReadonlyArray<AssembledClass>;
  readonly facts: ReadonlyArray<AssembledFact>;
};

type OntologyInput = {
  readonly label: string;
  readonly schemas: ReadonlyArray<SchemaHandle>;
  readonly triples: ReadonlyArray<Triple>;
};

type ClassIdentity = {
  readonly schema: SchemaHandle;
  readonly identifier: string;
  readonly name: string;
  readonly iri: string;
  readonly curie: string;
  readonly description?: string;
};

export class MissingClassAnnotation extends Data.TaggedError("MissingClassAnnotation")<{
  readonly message: string;
}> {}

export class UnresolvedHandle extends Data.TaggedError("UnresolvedHandle")<{
  readonly message: string;
  readonly identifier?: string;
}> {}

export class UnknownTerm extends Data.TaggedError("UnknownTerm")<{
  readonly message: string;
  readonly term: string;
}> {}

export class UnsupportedFieldAst extends Data.TaggedError("UnsupportedFieldAst")<{
  readonly message: string;
  readonly field: string;
}> {}

export class InvalidTriple extends Data.TaggedError("InvalidTriple")<{
  readonly message: string;
}> {}

export type OntologyAssemblyError =
  | MissingClassAnnotation
  | UnresolvedHandle
  | UnknownTerm
  | UnsupportedFieldAst
  | InvalidTriple;

export function key<const Term extends Predicate<CoreVocab>>(term: Term): KeyAnnotation<Term>;
export function key<const Term extends Predicate<CoreVocab>>(options: KeyAnnotation<Term>): KeyAnnotation<Term>;
export function key(options: { readonly description: string }): { readonly description: string };
export function key(input: Predicate<CoreVocab> | KeyAnnotation = {}): KeyAnnotation {
  if (P.isString(input)) {
    return { term: input };
  }

  return {
    ...R.getSomes({
      term: O.fromUndefinedOr(input.term),
      description: O.fromUndefinedOr(input.description),
    }),
  };
}

const isAbsoluteIri = (value: string): value is AbsoluteIri =>
  pipe(value, Str.startsWith("http://")) || pipe(value, Str.startsWith("https://"));

const isKnownCurie = (value: string): value is Curie<CoreVocab> => pipe(O.fromUndefinedOr(expand(value)), O.isSome);

const isTermString = (value: string) => isAbsoluteIri(value) || isKnownCurie(value);

const isKnownPredicate = (value: string): value is Predicate<CoreVocab> =>
  pipe(O.fromUndefinedOr(expandPredicate(value)), O.isSome);

const isSchemaHandle = (value: unknown): value is SchemaHandle => P.hasProperty(value, "ast");

const TermString = S.String.check(
  S.makeFilter(isTermString, {
    identifier: "identity/Ontology/TermString",
    title: "Term String",
    description: "A known CURIE or absolute IRI term string.",
    message: "Term strings must be known CURIEs or absolute IRIs.",
  })
);

const PredicateString = S.String.check(
  S.makeFilter(isKnownPredicate, {
    identifier: "identity/Ontology/PredicateString",
    title: "Predicate String",
    description: "A known borrowed predicate CURIE, optionally reverse-marked.",
    message: "Predicates must be known CURIEs, optionally prefixed with ^.",
  })
);

const SchemaHandleValue = S.declare(isSchemaHandle, {
  identifier: "identity/Ontology/SchemaHandle",
  title: "Schema Handle",
  description: "An Effect Schema class or schema handle.",
});

const TypedLiteralValue = S.Struct({
  value: S.Union([S.String, S.Number, S.Boolean]),
  datatype: S.optionalKey(TermString),
  language: S.optionalKey(S.String),
});

const SubjectValue = S.Union([SchemaHandleValue, TermString]);
const ObjectValue = S.Union([SchemaHandleValue, TermString, TypedLiteralValue]);
export const TripleValue = S.Tuple([SubjectValue, PredicateString, ObjectValue]);

const annotationString = (annotations: unknown, property: string): O.Option<string> =>
  P.hasProperty(annotations, property) && P.isString(annotations[property])
    ? O.some(annotations[property])
    : O.none();

const classIdentity = (schema: SchemaHandle): O.Option<ClassIdentity> => {
  const annotations = S.resolveAnnotations(schema);

  return pipe(
    O.all({
      identifier: annotationString(annotations, "identifier"),
      iri: annotationString(annotations, "iri"),
      curie: annotationString(annotations, "curie"),
    }),
    O.map(({ identifier, iri, curie }) => ({
      schema,
      identifier,
      iri,
      curie,
      name: pipe(
        annotationString(annotations, "title"),
        O.getOrElse(() => identifier)
      ),
      ...R.getSomes({
        description: annotationString(annotations, "description"),
      }),
    }))
  );
};

const requireClassIdentity = (schema: SchemaHandle): Effect.Effect<ClassIdentity, MissingClassAnnotation> =>
  pipe(
    classIdentity(schema),
    O.match({
      onNone: () => Effect.fail(new MissingClassAnnotation({ message: "Schema is missing owned identity annotations." })),
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

const classIdentityFromAst = (ast: SchemaAST.AST): O.Option<ClassIdentity> => classIdentity(S.make<SchemaHandle>(ast));

const findClassIdentityInAst = (ast: SchemaAST.AST): O.Option<ClassIdentity> => {
  const direct = classIdentityFromAst(ast);
  if (O.isSome(direct)) {
    return direct;
  }

  if (SchemaAST.isArrays(ast)) {
    return pipe(
      [...ast.elements, ...ast.rest],
      A.findFirst((item) => O.isSome(findClassIdentityInAst(item))),
      O.flatMap(findClassIdentityInAst)
    );
  }

  if (SchemaAST.isDeclaration(ast)) {
    return pipe(
      ast.typeParameters,
      A.findFirst((item) => O.isSome(findClassIdentityInAst(item))),
      O.flatMap(findClassIdentityInAst)
    );
  }

  if (SchemaAST.isUnion(ast)) {
    return pipe(
      ast.types,
      A.findFirst((item) => O.isSome(findClassIdentityInAst(item))),
      O.flatMap(findClassIdentityInAst)
    );
  }

  return O.none();
};

const isScalarAst = (ast: SchemaAST.AST): boolean => {
  if (
    SchemaAST.isString(ast) ||
    SchemaAST.isNumber(ast) ||
    SchemaAST.isBoolean(ast) ||
    SchemaAST.isBigInt(ast) ||
    SchemaAST.isLiteral(ast)
  ) {
    return true;
  }

  if (SchemaAST.isArrays(ast)) {
    return pipe([...ast.elements, ...ast.rest], A.every(isScalarAst));
  }

  if (SchemaAST.isDeclaration(ast)) {
    return pipe(ast.typeParameters, A.every(isScalarAst));
  }

  if (SchemaAST.isUnion(ast)) {
    return pipe(ast.types, A.every(isScalarAst));
  }

  return false;
};

const includedClass = (classes: ReadonlyArray<ClassIdentity>, identifier: string): O.Option<ClassIdentity> =>
  pipe(classes, A.findFirst((item) => item.identifier === identifier));

const requireIncludedClass = (
  classes: ReadonlyArray<ClassIdentity>,
  identity: ClassIdentity
): Effect.Effect<ClassIdentity, UnresolvedHandle> =>
  pipe(
    includedClass(classes, identity.identifier),
    O.match({
      onNone: () =>
        Effect.fail(
          new UnresolvedHandle({
            identifier: identity.identifier,
            message: `Schema handle is not part of this ontology fold: ${identity.identifier}`,
          })
        ),
      onSome: Effect.succeed,
    })
  );

const reverseOption = (reverse: boolean): O.Option<true> => (reverse ? O.some(true) : O.none());

const appendLocal = (base: string, name: string) =>
  pipe(base, Str.endsWith("/")) || pipe(base, Str.endsWith("#")) ? `${base}${name}` : `${base}/${name}`;

const resolvePredicate = (term: string): Effect.Effect<
  { readonly term: string; readonly iri: string; readonly reverse: boolean },
  UnknownTerm
> =>
  pipe(
    O.fromUndefinedOr(expandPredicate(term)),
    O.match({
      onNone: () =>
        Effect.fail(new UnknownTerm({ term, message: `Unknown predicate CURIE: ${term}` })),
      onSome: ({ iri, inverse }) => Effect.succeed({ term, iri, reverse: inverse }),
    })
  );

const resolveStringTerm = (term: string): Effect.Effect<string, UnknownTerm> => {
  if (isAbsoluteIri(term)) {
    return Effect.succeed(term);
  }

  return pipe(
    O.fromUndefinedOr(expand(term)),
    O.match({
      onNone: () => Effect.fail(new UnknownTerm({ term, message: `Unknown term: ${term}` })),
      onSome: Effect.succeed,
    })
  );
};

const resolveHandle = (
  classes: ReadonlyArray<ClassIdentity>,
  schema: SchemaHandle
): Effect.Effect<string, MissingClassAnnotation | UnresolvedHandle> =>
  Effect.gen(function* () {
    const identity = yield* requireClassIdentity(schema);
    const included = yield* requireIncludedClass(classes, identity);
    return included.iri;
  });

const isLiteralScalar = (value: unknown): value is LiteralScalar =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

const isTypedLiteral = (value: unknown): value is TypedLiteral =>
  P.isObject(value) && P.hasProperty(value, "value") && isLiteralScalar(value.value);

const resolveTypedLiteral = (literal: TypedLiteral): Effect.Effect<FactObject, UnknownTerm> =>
  Effect.gen(function* () {
    const datatypeIri =
      literal.datatype === undefined ? O.none<string>() : O.some(yield* resolveStringTerm(literal.datatype));

    return {
      value: literal.value,
      ...R.getSomes({
        datatypeIri,
        language: O.fromUndefinedOr(literal.language),
      }),
    };
  });

const resolveObject = (
  classes: ReadonlyArray<ClassIdentity>,
  value: Object
): Effect.Effect<FactObject, MissingClassAnnotation | UnresolvedHandle | UnknownTerm> => {
  if (isSchemaHandle(value)) {
    return resolveHandle(classes, value);
  }

  if (P.isString(value)) {
    return resolveStringTerm(value);
  }

  if (isTypedLiteral(value)) {
    return resolveTypedLiteral(value);
  }

  return Effect.fail(new UnknownTerm({ term: "object", message: "Object is not a schema handle, term, or literal." }));
};

const resolveSubject = (
  classes: ReadonlyArray<ClassIdentity>,
  value: Subject
): Effect.Effect<string, MissingClassAnnotation | UnresolvedHandle | UnknownTerm> => {
  if (isSchemaHandle(value)) {
    return resolveHandle(classes, value);
  }

  return resolveStringTerm(value);
};

const inferPredicateKind = (
  classes: ReadonlyArray<ClassIdentity>,
  field: string,
  ast: SchemaAST.AST
): Effect.Effect<
  { readonly kind: "datatype" } | { readonly kind: "object"; readonly rangeIri: string },
  UnresolvedHandle | UnsupportedFieldAst
> =>
  pipe(
    findClassIdentityInAst(ast),
    O.match({
      onSome: (identity) =>
        pipe(
          requireIncludedClass(classes, identity),
          Effect.map((included) => ({ kind: "object", rangeIri: included.iri }))
        ),
      onNone: () =>
        isScalarAst(ast)
          ? Effect.succeed({ kind: "datatype" })
          : Effect.fail(
              new UnsupportedFieldAst({
                field,
                message: `Unsupported field AST for ontology predicate inference: ${field}`,
              })
            ),
    })
  );

const requireStringFieldName = (
  property: SchemaAST.PropertySignature
): Effect.Effect<string, UnsupportedFieldAst> =>
  P.isString(property.name) && Str.isNonEmpty(property.name)
    ? Effect.succeed(property.name)
    : Effect.fail(new UnsupportedFieldAst({ field: "unknown", message: "Only string field names are supported." }));

const fieldPredicate = (
  composer: IdentityComposer<string, string, string>,
  classes: ReadonlyArray<ClassIdentity>,
  property: SchemaAST.PropertySignature
): Effect.Effect<AssembledPredicate, OntologyAssemblyError> =>
  Effect.gen(function* () {
    const field = yield* requireStringFieldName(property);
    const propertySchema = S.make<SchemaHandle>(property.type);
    const annotations = S.resolveAnnotationsKey(propertySchema);
    const description = annotationString(annotations, "description");
    const kind = yield* inferPredicateKind(classes, field, property.type);
    const borrowed = annotationString(annotations, "term");

    if (O.isSome(borrowed)) {
      const resolved = yield* resolvePredicate(borrowed.value);
      return {
        key: field,
        term: borrowed.value,
        termIri: resolved.iri,
        kind: kind.kind,
        ...R.getSomes({
          description,
          rangeIri: kind.kind === "object" ? O.some(kind.rangeIri) : O.none(),
          reverse: reverseOption(resolved.reverse),
        }),
      };
    }

    return {
      key: field,
      term: field,
      termIri: appendLocal(composer.iri, field),
      kind: kind.kind,
      ...R.getSomes({
        description,
        rangeIri: kind.kind === "object" ? O.some(kind.rangeIri) : O.none(),
      }),
    };
  });

const assembleClass = (
  composer: IdentityComposer<string, string, string>,
  classes: ReadonlyArray<ClassIdentity>,
  identity: ClassIdentity
): Effect.Effect<AssembledClass, OntologyAssemblyError> =>
  Effect.gen(function* () {
    const objectAst = yield* pipe(
      objectAstFromSchema(identity.schema),
      O.match({
        onNone: () =>
          Effect.fail(
            new UnsupportedFieldAst({
              field: identity.name,
              message: `Schema does not expose object fields: ${identity.identifier}`,
            })
          ),
        onSome: Effect.succeed,
      })
    );
    const predicates = yield* Effect.forEach(
      objectAst.propertySignatures,
      (property) => fieldPredicate(composer, classes, property),
      { concurrency: 1 }
    );

    return {
      name: identity.name,
      iri: identity.iri,
      curie: identity.curie,
      predicates,
      ...R.getSomes({
        description: O.fromUndefinedOr(identity.description),
      }),
    };
  });

const invalidTripleTerm = (triple: Triple): O.Option<string> => {
  const [subject, predicate, object] = triple;

  if (P.isString(subject) && !isTermString(subject)) {
    return O.some(subject);
  }

  if (P.isString(predicate) && !isKnownPredicate(predicate)) {
    return O.some(predicate);
  }

  if (P.isString(object) && !isTermString(object)) {
    return O.some(object);
  }

  if (isTypedLiteral(object) && object.datatype !== undefined && !isTermString(object.datatype)) {
    return O.some(object.datatype);
  }

  return O.none();
};

const validateTriple = (triple: Triple): Effect.Effect<Triple, UnknownTerm | InvalidTriple> =>
  pipe(
    S.decodeUnknownEffect(TripleValue)(triple),
    Effect.as(triple),
    Effect.mapError(() =>
      pipe(
        invalidTripleTerm(triple),
        O.match({
          onNone: () => new InvalidTriple({ message: "Invalid ontology triple tuple." }),
          onSome: (term) => new UnknownTerm({ term, message: `Unknown term in ontology triple: ${term}` }),
        })
      )
    )
  );

const assembleFact = (
  classes: ReadonlyArray<ClassIdentity>,
  triple: Triple
): Effect.Effect<AssembledFact, OntologyAssemblyError> =>
  Effect.gen(function* () {
    const [subject, predicate, object] = yield* validateTriple(triple);
    const subjectIri = yield* resolveSubject(classes, subject);
    const resolvedPredicate = yield* resolvePredicate(predicate);
    const resolvedObject = yield* resolveObject(classes, object);

    return {
      subjectIri,
      predicateIri: resolvedPredicate.iri,
      object: resolvedObject,
      ...R.getSomes({
        reverse: reverseOption(resolvedPredicate.reverse),
      }),
    };
  });

export const ontology = (
  composer: IdentityComposer<string, string, string>,
  input: OntologyInput
): Effect.Effect<AssembledOntology, OntologyAssemblyError> =>
  Effect.gen(function* () {
    const classes = yield* Effect.forEach(input.schemas, requireClassIdentity, { concurrency: 1 });
    const assembledClasses = yield* Effect.forEach(
      classes,
      (identity) => assembleClass(composer, classes, identity),
      { concurrency: 1 }
    );
    const facts = yield* Effect.forEach(input.triples, (triple) => assembleFact(classes, triple), { concurrency: 1 });

    return {
      label: input.label,
      baseIri: composer.iri,
      prefix: composer.prefix,
      classes: assembledClasses,
      facts,
    };
  });
