/**
 * Classifies encoded Effect schema ASTs into dialect column descriptors.
 *
 * The shared traversal strips nullability, rejects ambiguous unions, and lets
 * each dialect supply the carrier-to-column policy without duplicating it.
 *
 * @since 0.0.0
 */

import {
  append,
  empty,
  every,
  filter,
  findFirst,
  flatMap,
  head,
  isArrayEmpty,
  join,
  map,
  of,
  some,
} from "effect/Array";
import { equals } from "effect/Equal";
import { dual } from "effect/Function";
import { getOrElse, isSome } from "effect/Option";
import { isString, isTagged, not, or } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import { declaredFieldsEquivalence } from "./declaredFieldsEquivalence.ts";
import type { Option } from "effect/Option";
import type { Top } from "effect/Schema";
import type { AST } from "effect/SchemaAST";
import type * as Field from "./Field.ts";
import type * as Meta from "./Meta.ts";

/**
 * Failure to derive one unambiguous SQL column from an encoded schema.
 *
 * @category utilities
 * @since 0.0.0
 */
export class DeriveColumnError extends TaggedError<DeriveColumnError>("@beep/effect-drizzle/DeriveColumnError")(
  "DeriveColumnError",
  {
    message: StringSchema,
    fieldName: StringSchema,
    astTag: StringSchema,
  },
  {
    description: "A bare schema field's column could not be derived from its encoded AST.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<DeriveColumnError>(typeParameters),
  }
) {}

/**
 * Dialect hooks consumed by the shared classification algorithm.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface Classifier<Column extends Meta.ColumnSpec> {
  readonly entityColumn: (tableName: string) => Column;
  readonly entityTableName: (schema: Top) => Option<string>;
  readonly fromSchemaAST: (ast: AST) => Option<Column>;
  readonly selectSchemaOf: (schema: Field.AnySchema) => Top;
}

/**
 * Dialect-neutral result of encoded-AST classification.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface Classified<Column extends Meta.ColumnSpec> {
  readonly column: Column;
  readonly nullable: boolean;
}

const fail = (fieldName: string, astTag: string, message: string): never => {
  throw DeriveColumnError.make({ message, fieldName, astTag });
};

/**
 * Recursively unwrap encoded unions and suspensions for shared runtime checks.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const flattenEncoded: {
  (fieldName: string, visited?: ReadonlyArray<AST>): (node: AST) => ReadonlyArray<AST>;
  (node: AST, fieldName: string, visited?: ReadonlyArray<AST>): ReadonlyArray<AST>;
} = dual(
  (args) => !isString(args[0]),
  (node: AST, fieldName: string, visited: ReadonlyArray<AST> = empty()): ReadonlyArray<AST> => {
    if (some(visited, equals(node))) {
      return fail(fieldName, node._tag, "Encoded schema suspension is cyclic.");
    }
    const nextVisited = append(visited, node);
    if (isTagged(node, "Suspend")) return flattenEncoded(node.thunk(), fieldName, nextVisited);
    if (isTagged(node, "Union")) {
      return flatMap(node.types, (member) => flattenEncoded(member, fieldName, nextVisited));
    }
    return of(node);
  }
);

/**
 * Derive one dialect column and nullability from a field's encoded AST.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const classify: {
  <Column extends Meta.ColumnSpec>(
    fieldName: string,
    classifier: Classifier<Column>
  ): (schema: Field.AnySchema) => Classified<Column>;
  <Column extends Meta.ColumnSpec>(
    schema: Field.AnySchema,
    fieldName: string,
    classifier: Classifier<Column>
  ): Classified<Column>;
} = dual(
  3,
  <Column extends Meta.ColumnSpec>(
    schema: Field.AnySchema,
    fieldName: string,
    classifier: Classifier<Column>
  ): Classified<Column> => {
    const select = classifier.selectSchemaOf(schema);
    const encoded = toEncoded(select.ast);
    const members = flattenEncoded(encoded, fieldName);
    const invalidAbsence = findFirst(members, or(isTagged("Undefined"), isTagged("Void")));
    if (isSome(invalidAbsence)) {
      fail(
        fieldName,
        invalidAbsence.value._tag,
        "Encoded 'undefined' cannot reach a SQL row; represent absence as null."
      );
    }
    const nullable = some(members, isTagged("Null"));
    const rest = filter(members, not(isTagged("Null")));
    if (isArrayEmpty(rest)) {
      fail(fieldName, encoded._tag, "Only null remains after stripping; provide explicit column metadata.");
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
          `Encoded AST node '${member._tag}' does not derive a column; provide explicit metadata.`
        )
      )
    );
    const first = getOrElse(head(specs), () =>
      fail(fieldName, encoded._tag, "No encoded members remain after null stripping.")
    );
    if (!every(specs, (spec) => spec.kind === first.kind)) {
      fail(
        fieldName,
        "Union",
        `Union members derive different columns (${join(
          map(specs, (spec) => spec.kind),
          ", "
        )}); provide explicit metadata.`
      );
    }
    return { column: first, nullable };
  }
);
