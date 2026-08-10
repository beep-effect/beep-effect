/**
 * Internal helpers shared by Next.js config schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

/**
 * Preserve a schema decoder issue or error at the public SchemaError boundary.
 *
 * **Example** (Convert issue to SchemaError)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { schemaIssueToError } from "@beep/repo-configs/next/internal"
 * const error = schemaIssueToError(new S.SchemaError(new S.InvalidValue(undefined, { message: "bad" })))
 * console.log(error instanceof S.SchemaError)
 * ```
 *
 * @internal
 * @param cause - Schema issue or error reported by an Effect schema decoder.
 * @returns Schema error suitable for Result and decoding boundaries.
 * @category utilities
 * @since 0.0.0
 */
export const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Guard unknown values that must be callable plugin/config hooks.
 *
 * **Example** (Test function callability)
 *
 * ```ts
 * import { isFunctionValue } from "@beep/repo-configs/next/internal"
 * console.log(isFunctionValue(() => undefined))
 * console.log(isFunctionValue("not a function"))
 * ```
 *
 * @internal
 * @param value - Unknown value to test for callability.
 * @returns Whether the value is a JavaScript function.
 * @category predicates
 * @since 0.0.0
 */
export const isFunctionValue = <A extends Function>(value: unknown): value is A => P.isFunction(value);
