import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";

/**
 * The `_tag` a tagged schema encodes, read from its encoded AST, as the
 * library reads a declared rejection's tag (`rejectionTag` in its
 * `internal.ts`): none when the schema is not a struct with a literal `_tag`.
 *
 * **Example** (A rejection's tag)
 * ```ts
 * import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
 * import { encodedTagOf } from "@proto/tooling/RejectionClass";
 *
 * const tag = encodedTagOf(MissingGrant); // Option.some("MissingGrant")
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const encodedTagOf = (schema: S.Top): O.Option<string> => {
  const encoded = SchemaAST.toEncoded(schema.ast);
  return SchemaAST.isObjects(encoded)
    ? pipe(
        A.findFirst(encoded.propertySignatures, (property) => property.name === "_tag"),
        O.map((property) => property.type),
        O.filter(SchemaAST.isLiteral),
        O.map((literal) => String(literal.literal)),
      )
    : O.none();
};

/**
 * Whether a value is what a command's `rejects` takes: a schema class of a
 * tagged error, such as one declared with `S.TaggedError`.
 *
 * **Example** (A rejection class, and a plain object)
 * ```ts
 * import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
 * import { isRejectionClass } from "@proto/tooling/RejectionClass";
 *
 * const yes = isRejectionClass(MissingGrant);
 * const no = isRejectionClass({ kind: "Rejection" });
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isRejectionClass = (value: unknown): boolean =>
  S.isSchema(value) &&
  P.isFunction(value) &&
  P.hasProperty(value, "prototype") &&
  value.prototype instanceof Error &&
  value.pipe(encodedTagOf, O.isSome);
