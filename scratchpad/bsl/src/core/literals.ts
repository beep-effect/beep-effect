/**
 * Collects finite string-literal domains from encoded Effect schemas.
 *
 * Dialect enum combinators share this traversal so runtime values and
 * type-level literal unions follow the same schema boundary.
 *
 * @since 0.0.0
 */
import {
  append,
  appendAll,
  empty,
  every,
  getSomes,
  map,
  match,
  of,
  reduce,
  some,
} from "effect/Array";
import { equals } from "effect/Equal";
import {
  flatMap,
  map as mapOption,
  none,
  some as someOption,
} from "effect/Option";
import type { Option } from "effect/Option";
import { isString } from "effect/Predicate";
import { isTagged } from "effect/Predicate";
import { toEncoded } from "effect/SchemaAST";
import type { AST, Suspend } from "effect/SchemaAST";
import type * as Field from "./Field.ts";

const stringLiteralsFromAST = (
  node: AST,
  selectSchemaOf: (schema: Field.AnySchema) => { readonly ast: AST },
  visited: ReadonlyArray<Suspend> = empty(),
): Option<ReadonlyArray<string>> => {
  if (isTagged(node, "Literal")) return isString(node.literal) ? someOption(of(node.literal)) : none();
  if (isTagged(node, "Null")) return someOption(empty());
  if (isTagged(node, "Enum")) {
    return every(node.enums, ([, value]) => isString(value))
      ? someOption(getSomes(map(node.enums, ([, value]) => isString(value) ? someOption(value) : none())))
      : none();
  }
  if (isTagged(node, "Union")) {
    return reduce(node.types, someOption<ReadonlyArray<string>>(empty()), (values, member) =>
      flatMap(values, (current) =>
        mapOption(stringLiteralsFromAST(member, selectSchemaOf, visited), (next) => appendAll(current, next)),
      ),
    );
  }
  if (isTagged(node, "Suspend")) {
    return some(visited, equals(node))
      ? none()
      : stringLiteralsFromAST(node.thunk(), selectSchemaOf, append(visited, node));
  }
  return none();
};

/**
 * Collect a finite non-empty encoded string-literal union for a dialect adapter.
 *
 * @category getters
 * @since 0.0.0
 */
export const stringLiteralValues = (
  schema: Field.AnySchema,
  selectSchemaOf: (schema: Field.AnySchema) => { readonly ast: AST },
): Option<readonly [string, ...string[]]> =>
  flatMap(stringLiteralsFromAST(toEncoded(selectSchemaOf(schema).ast), selectSchemaOf), (values) =>
    match(values, { onEmpty: none, onNonEmpty: someOption }),
  );
