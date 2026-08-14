/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, P, Struct } from "@beep/utils";
import { SchemaAST as AST, Match, pipe, Tuple } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { EncodedAbsenceKind as EncodedAbsenceKindSchema } from "./EntitySchema.persist.ts";
import { $I } from "./EntitySchema.shared.ts";
import type { EncodedAbsenceKind } from "./EntitySchema.persist.ts";

class AstAbsence extends S.Class<AstAbsence>($I`AstAbsence`)(
  {
    allowsNull: S.Boolean,
    allowsUndefined: S.Boolean,
    isAmbiguous: S.Boolean,
  },
  $I.annote("AstAbsence", {
    description:
      "Represents the absence of a value in an AST declaration, with options for null, undefined, and ambiguity.",
  })
) {}

type EncodedFieldShapeMember<T extends EncodedAbsenceKind> = {
  readonly absenceKind: T;
  readonly allowsNull: boolean;
  readonly allowsUndefined: boolean;
  readonly isAmbiguous: boolean;
  readonly isOptional: boolean;
};

class SelectedRowFieldShapeError extends S.TaggedError<SelectedRowFieldShapeError>($I`SelectedRowFieldShapeError`)(
  "SelectedRowFieldShapeError",
  {
    field: S.String,
    message: S.String,
  },
  $I.annote("SelectedRowFieldShapeError", {
    description: "Selected-row field shape validation failure.",
  })
) {}

/**
 * Raised when an entity field input fails validation while building an
 * entity schema class.
 *
 * **Example** (Make field input error)
 *
 * ```ts
 * import { EntityFieldInputError } from "../../src/EntitySchema/EntitySchema.shape.ts"
 *
 * const error = EntityFieldInputError.make({ field: "name", message: "must be a schema" })
 * console.log(error.field)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EntityFieldInputError extends S.TaggedError<EntityFieldInputError>($I`EntityFieldInputError`)(
  "EntityFieldInputError",
  {
    field: S.String,
    message: S.String,
  },
  $I.annote("EntityFieldInputError", {
    description: "Entity field input validation failure.",
  })
) {}

/**
 * Raised when EntitySchema definition metadata fails to attach to a schema
 * class.
 *
 * **Example** (Make attachment error)
 *
 * ```ts
 * import { EntitySchemaAttachmentError } from "../../src/EntitySchema/EntitySchema.shape.ts"
 *
 * const error = EntitySchemaAttachmentError.make({
 *   message: "Failed to attach EntitySchema definition metadata."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EntitySchemaAttachmentError extends S.TaggedError<EntitySchemaAttachmentError>(
  $I`EntitySchemaAttachmentError`
)(
  "EntitySchemaAttachmentError",
  {
    message: S.String,
  },
  $I.annote("EntitySchemaAttachmentError", {
    description: "EntitySchema metadata attachment invariant failure.",
  })
) {}

const knownAstAbsence = (allowsNull: boolean, allowsUndefined: boolean, isAmbiguous = false): AstAbsence => ({
  allowsNull,
  allowsUndefined,
  isAmbiguous,
});

const combineAstAbsence = (left: AstAbsence, right: AstAbsence): AstAbsence => ({
  allowsNull: left.allowsNull || right.allowsNull,
  allowsUndefined: left.allowsUndefined || right.allowsUndefined,
  isAmbiguous: left.isAmbiguous || right.isAmbiguous,
});

type TypeConstructorAnnotation = {
  readonly _tag: string;
};

type RepresentationAnnotation = {
  readonly id: string;
};

const isTypeConstructorAnnotation = (value: unknown): value is TypeConstructorAnnotation =>
  P.isObject(value) && P.hasProperty(value, "_tag") && P.isString(value._tag);

const isRepresentationAnnotation = (value: unknown): value is RepresentationAnnotation =>
  P.isObject(value) && P.hasProperty(value, "id") && P.isString(value.id);

const declarationTag = (ast: AST.Declaration): string | undefined => {
  const representation = ast.annotations?.representation;
  if (isRepresentationAnnotation(representation)) {
    return representation.id;
  }
  const annotation = ast.annotations?.typeConstructor;
  return isTypeConstructorAnnotation(annotation) ? annotation._tag : undefined;
};

const isJsonDeclaration = (ast: AST.Declaration): boolean => {
  const tag = declarationTag(ast);
  return (
    tag === "effect/schema/Json" ||
    tag === "effect/schema/MutableJson" ||
    tag === "effect/Json" ||
    tag === "effect/MutableJson"
  );
};

const isKnownRequiredDeclaration = (ast: AST.Declaration): boolean => {
  const tag = declarationTag(ast);
  return tag === "effect/schema/Date" || tag === "effect/schema/Uint8Array" || tag === "Date" || tag === "Uint8Array";
};

const astAbsence: (input: AST.AST) => AstAbsence = Match.type<AST.AST>().pipe(
  Match.withReturnType<AstAbsence>(),
  Match.tag("Null", () => knownAstAbsence(true, false)),
  Match.tag("Undefined", "Void", () => knownAstAbsence(false, true)),
  Match.tag("Any", "Unknown", () => knownAstAbsence(true, true)),
  Match.tags({
    Declaration: Match.type<AST.Declaration>().pipe(
      Match.when(isJsonDeclaration, () => knownAstAbsence(true, false)),
      Match.when(isKnownRequiredDeclaration, () => knownAstAbsence(false, false)),
      Match.orElse(() => knownAstAbsence(false, false, true))
    ),
    Suspend: (ast) => astAbsence(ast.thunk()),
    Union: (ast) =>
      A.reduce(ast.types ?? A.empty(), knownAstAbsence(false, false), (accumulator, member) =>
        combineAstAbsence(accumulator, astAbsence(member))
      ),
  }),
  Match.orElse(() => knownAstAbsence(false, false))
);

/**
 * Encoded absence shape for one schema field.
 *
 * **Example** (Decode encoded field shape)
 *
 * ```ts
 * import { EncodedFieldShape } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const shape = S.decodeUnknownSync(EncodedFieldShape)({
 *   absenceKind: "required",
 *   allowsNull: false,
 *   allowsUndefined: false,
 *   isAmbiguous: false,
 *   isOptional: false
 * })
 *
 * console.log(shape.absenceKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EncodedFieldShape = EncodedAbsenceKindSchema.mapMembers((members) => {
  const make = <T extends EncodedAbsenceKind>(literal: S.Literal<T>) =>
    S.Class<EncodedFieldShapeMember<T>>($I`EncodedFieldShapeMember`)(
      {
        absenceKind: S.tag(literal.literal),
        allowsNull: S.Boolean,
        allowsUndefined: S.Boolean,
        isAmbiguous: S.Boolean,
        isOptional: S.Boolean,
      },
      $I.annote("EncodedFieldShapeMember", {
        description: "Encoded field shape member with absence kind and null/undefined handling flags.",
      })
    );

  return pipe(members, Tuple.evolve([make, make, make, make, make, make, make, make, make]));
}).pipe(
  $I.annoteSchema("EncodedFieldShape", {
    description: "Encoded field shape with absence kind and null/undefined handling flags",
  }),
  S.toTaggedUnion("absenceKind")
);

/**
 * Runtime type for encoded field shape metadata.
 *
 * **Example** (Type annotated field shape)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EncodedFieldShape } from "@beep/schema/EntitySchema"
 *
 * const value: EncodedFieldShape = S.decodeUnknownSync(EncodedFieldShape)({
 *   absenceKind: "required",
 *   allowsNull: false,
 *   allowsUndefined: false,
 *   isAmbiguous: false,
 *   isOptional: false
 * })
 *
 * console.log(value.absenceKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EncodedFieldShape = typeof EncodedFieldShape.Type;

/**
 * Return the encoded AST for a schema field.
 *
 * **Example** (Get encoded field AST)
 *
 * ```ts
 * import { encodedAstFor } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const ast = encodedAstFor(S.NullOr(S.String))
 * console.log(ast._tag)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const encodedAstFor = (field: S.Top): AST.AST => AST.toEncoded(field.ast);

const absenceKindFor = (shape: Omit<EncodedFieldShape, "absenceKind">): EncodedAbsenceKind => {
  if (shape.isAmbiguous) {
    return "ambiguous";
  }
  if (shape.isOptional && shape.allowsNull && shape.allowsUndefined) {
    return "optionalNullish";
  }
  if (shape.isOptional && shape.allowsNull) {
    return "optionalNullable";
  }
  if (shape.isOptional && shape.allowsUndefined) {
    return "optionalUndefined";
  }
  if (shape.isOptional) {
    return "optionalKey";
  }
  if (shape.allowsNull && shape.allowsUndefined) {
    return "nullish";
  }
  if (shape.allowsNull) {
    return "nullable";
  }
  if (shape.allowsUndefined) {
    return "undefined";
  }
  return "required";
};

/**
 * Derive encoded nullability and optionality from the encoded schema AST.
 *
 * **Example** (Derive nullability shape)
 *
 * ```ts
 * import { encodedFieldShape } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const shape = encodedFieldShape(S.NullOr(S.String))
 * console.log(shape.allowsNull)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const encodedFieldShape = (field: S.Top): EncodedFieldShape => {
  const ast = encodedAstFor(field);
  const absence = astAbsence(ast);
  const shape = {
    allowsNull: absence.allowsNull,
    allowsUndefined: absence.allowsUndefined,
    isAmbiguous: absence.isAmbiguous,
    isOptional: AST.isOptional(ast),
  };
  return Struct.assign(shape, {
    absenceKind: absenceKindFor(shape),
  });
};

/**
 * Derive and validate selected-row absence semantics for one field.
 *
 * **Example** (Validate selected-row shape)
 *
 * ```ts
 * import { selectedRowFieldShape } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const shape = selectedRowFieldShape("name", S.String)
 * console.log(shape.absenceKind)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const selectedRowFieldShape: {
  (key: string, field: S.Top): EncodedFieldShape;
  (field: S.Top): (key: string) => EncodedFieldShape;
} = dual(2, (key: string, field: S.Top): EncodedFieldShape => {
  const shape = encodedFieldShape(field);
  if (shape.isAmbiguous || shape.isOptional || shape.allowsUndefined) {
    throw SelectedRowFieldShapeError.make({
      field: key,
      message: `Persisted selected-row field '${key}' must encode SQL absence as null, not undefined, a missing key, or an ambiguous declared schema.`,
    });
  }
  return shape;
});

/**
 * True when a field's encoded side allows null.
 *
 * **Example** (Check encoded nullability)
 *
 * ```ts
 * import { isEncodedNullable } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * console.log(isEncodedNullable(S.NullOr(S.String)))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isEncodedNullable = (field: S.Top): boolean => encodedFieldShape(field).allowsNull;

/**
 * True when a field's encoded side is optional.
 *
 * **Example** (Check encoded optionality)
 *
 * ```ts
 * import { isEncodedOptional } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * console.log(isEncodedOptional(S.optionalKey(S.String)))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isEncodedOptional = (field: S.Top): boolean => encodedFieldShape(field).isOptional;
