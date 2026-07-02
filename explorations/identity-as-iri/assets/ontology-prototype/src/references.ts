import { $OntologyId } from "@beep/identity/packages";
import { NamedNode } from "@beep/rdf/Rdf";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  IRI,
  isOntologyReference,
  isOntologyReferenceTarget,
  makeIri,
  makeOntologyReference,
  makeOntologyTermName,
  makeTermIri,
  OntologyAssemblyError,
  OntologyAssemblyErrorReason,
  OntologyIriReferenceTarget,
  OntologyReference,
  OntologyReferenceTarget,
  OntologySchemaReferenceTarget,
  OntologyTermName,
  OntologyTermReferenceTarget,
} from "./model.js";

const $I = $OntologyId.create("references");

const isNamedNode = S.is(NamedNode);
export const OntologyIriInput = S.Union([S.String, NamedNode]).pipe(
  $I.annoteSchema("OntologyIriInput", {
    description: "Input type for ontology IRI references, which can be a string or a NamedNode.",
  })
);

export type OntologyIriInput = typeof OntologyIriInput.Type;

export const OntologyTermNameInput = S.Union([S.String, OntologyTermName]).pipe(
  $I.annoteSchema("OntologyTermNameInput", {
    description: "Input type for ontology term names, which can be a string or an OntologyTermName object.",
  })
);

export type OntologyTermNameInput = typeof OntologyTermNameInput.Type;

export const OntologyReferenceTargetInput = S.Union([
  OntologyIriInput,
  OntologyTermNameInput,
  OntologyReference,
  OntologyReferenceTarget,
  S.declare(
    /* istanbul ignore next -- reference target schema inputs are accepted directly and not decoded through this union */
    (u: unknown): u is S.Top => S.isSchema(u)
  ),
]).pipe(
  $I.annoteSchema("OntologyReferenceTargetInput", {
    description:
      "Input type for ontology reference targets, which can be an IRI, term name, reference, reference target, or schema top type.",
  })
);
export type OntologyReferenceTargetInput = typeof OntologyReferenceTargetInput.Type;

class ReferenceResolutionClassMetadata extends S.Class<ReferenceResolutionClassMetadata>(
  $I`ReferenceResolutionClassMetadata`
)(
  {
    iri: IRI,
  },
  $I.annote("ReferenceResolutionClassMetadata", {
    description: "Class metadata stored in the ontology reference-resolution index.",
  })
) {}

export class ReferenceResolutionContext extends S.Class<ReferenceResolutionContext>($I`ReferenceResolutionContext`)(
  {
    baseIri: IRI,
    classesBySchemaIdentity: S.Record(S.String, ReferenceResolutionClassMetadata),
  },
  $I.annote("ReferenceResolutionContext", {
    description: "Ontology reference-resolution context built during assembly.",
  })
) {}

export const schemaIdentifier = (schema: S.Top): O.Option<string> =>
  pipe(S.resolveAnnotations(schema)?.identifier, O.fromUndefinedOr, O.filter(P.isString));

export const schemaIdentity = (schema: S.Top): O.Option<string> =>
  pipe(
    S.resolveAnnotations(schema)?.schemaId,
    O.fromUndefinedOr,
    O.filter(P.isSymbol),
    O.flatMap((current) => O.fromUndefinedOr(current.description))
  );

export const schemaKeyIdentifier = (schema: S.Top): O.Option<string> =>
  pipe(S.resolveAnnotationsKey(schema)?.identifier, O.fromUndefinedOr, O.filter(P.isString));

export const schemaKeyIdentity = (schema: S.Top): O.Option<string> =>
  pipe(
    S.resolveAnnotationsKey(schema)?.schemaId,
    O.fromUndefinedOr,
    O.filter(P.isSymbol),
    O.flatMap((current) => O.fromUndefinedOr(current.description))
  );

export const normalizeIriInput = (value: OntologyIriInput): IRI => (isNamedNode(value) ? value.value : makeIri(value));

export const normalizeTermNameInput = (value: OntologyTermNameInput): OntologyTermName => makeOntologyTermName(value);

export const makeReferenceTarget = (target: OntologyReferenceTargetInput): OntologyReferenceTarget => {
  if (isOntologyReferenceTarget(target)) {
    return target;
  }

  if (isOntologyReference(target)) {
    return OntologyIriReferenceTarget.make({ kind: "iri", iri: target.iri });
  }

  if (isNamedNode(target)) {
    return OntologyIriReferenceTarget.make({ kind: "iri", iri: target.value });
  }

  if (P.isString(target)) {
    return pipe(target, Str.includes(":"))
      ? OntologyIriReferenceTarget.make({ kind: "iri", iri: makeIri(target) })
      : OntologyTermReferenceTarget.make({
          kind: "term",
          termName: makeOntologyTermName(target),
        });
  }

  return OntologySchemaReferenceTarget.make({
    kind: "schema",
    schemaIdentity: schemaIdentity(target),
    identifier: schemaIdentifier(target),
  });
};

export const optionalReferenceTargets = (
  value: ReadonlyArray<OntologyReferenceTargetInput> | undefined
): ReadonlyArray<OntologyReferenceTarget> =>
  pipe(O.fromUndefinedOr(value), O.getOrElse(A.empty<OntologyReferenceTargetInput>), A.map(makeReferenceTarget));

export const optionalReferenceTargetsOption = (
  value: ReadonlyArray<OntologyReferenceTargetInput> | undefined
): O.Option<ReadonlyArray<OntologyReferenceTarget>> =>
  pipe(O.fromUndefinedOr(value), O.map(A.map(makeReferenceTarget)));

class FailAssemblyInput extends S.Class<FailAssemblyInput>($I`FailAssemblyInput`)(
  {
    reason: OntologyAssemblyErrorReason,
    message: S.NonEmptyString,
    schemaIdentifier: S.Option(S.String),
    fieldName: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("FailAssemblyInput", {
    description: "Normalized input payload for ontology assembly failures.",
  })
) {}

type FailAssemblyInputConstructorInput = Parameters<typeof FailAssemblyInput.make>[0];

export const failAssembly = (input: FailAssemblyInputConstructorInput): Effect.Effect<never, OntologyAssemblyError> => {
  const normalizedInput = FailAssemblyInput.make(input);

  return Effect.fail(
    OntologyAssemblyError.make({
      reason: normalizedInput.reason,
      message: normalizedInput.message,
      schemaIdentifier: normalizedInput.schemaIdentifier,
      fieldName: normalizedInput.fieldName,
    })
  );
};

export const resolveReferenceTarget = Effect.fn("Ontology.resolveReferenceTarget")(function* (
  context: ReferenceResolutionContext,
  ownerSchemaId: O.Option<string>,
  target: OntologyReferenceTarget
) {
  return yield* OntologyReferenceTarget.match(target, {
    iri: (current) => Effect.succeed(makeOntologyReference(current.iri)),
    schema: Effect.fn("Ontology.resolveSchemaReferenceTarget")(function* (current) {
      const targetSchemaIdentity = yield* pipe(
        current.schemaIdentity,
        O.match({
          onNone: () =>
            failAssembly({
              reason: "unresolvedReferenceTarget",
              message: "Relationship target schema is missing identity metadata.",
              schemaIdentifier: ownerSchemaId,
            }),
          onSome: Effect.succeed,
        })
      );

      return yield* pipe(
        R.get(context.classesBySchemaIdentity, targetSchemaIdentity),
        O.map((metadata) => makeOntologyReference(metadata.iri)),
        O.match({
          onNone: () =>
            failAssembly({
              reason: "unresolvedReferenceTarget",
              message: `Relationship target schema was not included in this ontology build: ${targetSchemaIdentity}`,
              schemaIdentifier: ownerSchemaId,
            }),
          onSome: Effect.succeed,
        })
      );
    }),
    term: (current) => Effect.succeed(makeOntologyReference(makeTermIri(context.baseIri, current.termName))),
  });
});

class ResolveReferenceTargetsInput extends S.Class<ResolveReferenceTargetsInput>($I`ResolveReferenceTargetsInput`)(
  {
    context: ReferenceResolutionContext,
    ownerSchemaId: S.Option(S.String),
    targets: S.Array(OntologyReferenceTarget),
  },
  $I.annote("ResolveReferenceTargetsInput", {
    description: "Input payload for resolving ontology reference targets.",
  })
) {}

type ResolveReferenceTargetsConstructorInput = Parameters<typeof ResolveReferenceTargetsInput.make>[0];

export const resolveReferenceTargets = (
  input: ResolveReferenceTargetsConstructorInput
): Effect.Effect<ReadonlyArray<OntologyReference>, OntologyAssemblyError> => {
  const normalizedInput = ResolveReferenceTargetsInput.make(input);

  return Effect.forEach(
    normalizedInput.targets,
    (target) => resolveReferenceTarget(normalizedInput.context, normalizedInput.ownerSchemaId, target),
    {
      concurrency: 1,
    }
  );
};
