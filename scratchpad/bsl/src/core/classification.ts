/** Dialect-neutral encoded-AST classification algorithm. */
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import type * as Field from "./Field.ts";
import type * as Meta from "./Meta.ts";

/** Failure to derive one unambiguous SQL column from an encoded schema. */
export class DeriveColumnError extends S.TaggedError<DeriveColumnError>(
  "@beep/effect-drizzle/DeriveColumnError",
)(
  "DeriveColumnError",
  { message: S.String, fieldName: S.String, astTag: S.String },
  {
    description: "A bare schema field's column could not be derived from its encoded AST.",
  },
) {}

/** Dialect hooks consumed by the shared classification algorithm. */
export interface Classifier<Column extends Meta.ColumnSpec> {
  readonly selectSchemaOf: (schema: Field.AnySchema) => S.Top;
  readonly entityTableName: (schema: S.Top) => O.Option<string>;
  readonly entityColumn: (tableName: string) => Column;
  readonly fromSchemaAST: (ast: AST.AST) => O.Option<Column>;
}

/** Dialect-neutral result of encoded-AST classification. */
export interface Classified<Column extends Meta.ColumnSpec> {
  readonly column: Column;
  readonly nullable: boolean;
}

const fail = (fieldName: string, astTag: string, message: string): never => {
  throw DeriveColumnError.make({ message, fieldName, astTag });
};

/** Derive one dialect column and nullability from a field's encoded AST. */
export const classify = <Column extends Meta.ColumnSpec>(
  schema: Field.AnySchema,
  fieldName: string,
  classifier: Classifier<Column>,
): Classified<Column> => {
  const select = classifier.selectSchemaOf(schema);
  const encoded = AST.toEncoded(select.ast);
  const members = P.isTagged(encoded, "Union") ? encoded.types : A.of(encoded);
  const invalidAbsence = A.findFirst(members, P.or(P.isTagged("Undefined"), P.isTagged("Void")));
  if (O.isSome(invalidAbsence)) {
    fail(
      fieldName,
      invalidAbsence.value._tag,
      "Encoded 'undefined' cannot reach a SQL row; represent absence as null.",
    );
  }
  const nullable = A.some(members, P.isTagged("Null"));
  const rest = A.filter(members, P.not(P.isTagged("Null")));
  if (A.isArrayEmpty(rest)) {
    fail(
      fieldName,
      encoded._tag,
      "Only null remains after stripping; provide explicit column metadata.",
    );
  }
  const entity = classifier.entityTableName(select);
  if (O.isSome(entity) && A.every(rest, P.isTagged("Number"))) {
    return { column: classifier.entityColumn(entity.value), nullable };
  }
  const specs = A.map(rest, (member) =>
    O.getOrElse(classifier.fromSchemaAST(member), () =>
      fail(
        fieldName,
        member._tag,
        `Encoded AST node '${member._tag}' does not derive a column; provide explicit metadata.`,
      ),
    ),
  );
  const first = O.getOrElse(A.head(specs), () =>
    fail(fieldName, encoded._tag, "No encoded members remain after null stripping."),
  );
  if (!A.every(specs, (spec) => Eq.equals(spec.kind, first.kind))) {
    fail(
      fieldName,
      "Union",
      `Union members derive different columns (${A.join(
        A.map(specs, (spec) => spec.kind),
        ", ",
      )}); provide explicit metadata.`,
    );
  }
  return { column: first, nullable };
};
