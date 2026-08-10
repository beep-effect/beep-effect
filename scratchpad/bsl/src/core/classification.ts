/**
 * Classifies encoded Effect schema ASTs into dialect column descriptors.
 *
 * The shared traversal strips nullability, rejects ambiguous unions, and lets
 * each dialect supply the carrier-to-column policy without duplicating it.
 *
 * @since 0.0.0
 */
import { every, filter, findFirst, head, isArrayEmpty, join, map, of, some } from "effect/Array";
import { getOrElse, isSome } from "effect/Option";
import type { Option } from "effect/Option";
import { isTagged, not, or } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import type { Top } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import type { AST } from "effect/SchemaAST";
import type * as Field from "./Field.ts";
import type * as Meta from "./Meta.ts";

/** Failure to derive one unambiguous SQL column from an encoded schema. */
export class DeriveColumnError extends TaggedError<DeriveColumnError>(
  "@beep/effect-drizzle/DeriveColumnError",
)(
  "DeriveColumnError",
  { message: StringSchema, fieldName: StringSchema, astTag: StringSchema },
  {
    description: "A bare schema field's column could not be derived from its encoded AST.",
  },
) {}

/** Dialect hooks consumed by the shared classification algorithm. */
export interface Classifier<Column extends Meta.ColumnSpec> {
  readonly selectSchemaOf: (schema: Field.AnySchema) => Top;
  readonly entityTableName: (schema: Top) => Option<string>;
  readonly entityColumn: (tableName: string) => Column;
  readonly fromSchemaAST: (ast: AST) => Option<Column>;
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
  const encoded = toEncoded(select.ast);
  const members = isTagged(encoded, "Union") ? encoded.types : of(encoded);
  const invalidAbsence = findFirst(members, or(isTagged("Undefined"), isTagged("Void")));
  if (isSome(invalidAbsence)) {
    fail(
      fieldName,
      invalidAbsence.value._tag,
      "Encoded 'undefined' cannot reach a SQL row; represent absence as null.",
    );
  }
  const nullable = some(members, isTagged("Null"));
  const rest = filter(members, not(isTagged("Null")));
  if (isArrayEmpty(rest)) {
    fail(
      fieldName,
      encoded._tag,
      "Only null remains after stripping; provide explicit column metadata.",
    );
  }
  const entity = classifier.entityTableName(select);
  if (isSome(entity) && every(rest, isTagged("Number"))) {
    return { column: classifier.entityColumn(entity.value), nullable };
  }
  const specs = map(rest, (member) =>
    getOrElse(classifier.fromSchemaAST(member), () =>
      fail(
        fieldName,
        member._tag,
        `Encoded AST node '${member._tag}' does not derive a column; provide explicit metadata.`,
      ),
    ),
  );
  const first = getOrElse(head(specs), () =>
    fail(fieldName, encoded._tag, "No encoded members remain after null stripping."),
  );
  if (!every(specs, (spec) => spec.kind === first.kind)) {
    fail(
      fieldName,
      "Union",
      `Union members derive different columns (${join(
        map(specs, (spec) => spec.kind),
        ", ",
      )}); provide explicit metadata.`,
    );
  }
  return { column: first, nullable };
};
