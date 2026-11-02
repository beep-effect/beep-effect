/**
 * Safe retention diagnostic categories, independent of SQL messages and payloads.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as SqlError from "effect/sql/SqlError";

/**
 * Select a bounded diagnostic label without returning error messages or causes.
 *
 * **Example** (Keep error messages out of diagnostics)
 * ```ts
 * import { retentionReadFailureKind } from "./retentionReadFailureKind.ts"
 * console.log(retentionReadFailureKind(new Error("sensitive detail"))) // DatabaseError
 * ```
 * @internal
 * @category diagnostics
 * @since 0.0.0
 */
export const retentionReadFailureKind = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(P.isTagged("EdgeVersionConverterError"), () => "EdgeVersionConverterError"),
    Match.when(P.isTagged("ClaimDispositionConverterError"), () => "ClaimDispositionConverterError"),
    Match.when(SqlError.isSqlError, (error) => error.reason._tag),
    Match.when({ _tag: "EffectDrizzleQueryError", cause: P.isUnknown }, (error) =>
      Match.value(Cause.isCause(error.cause) ? Cause.squash(error.cause) : error.cause).pipe(
        Match.when(SqlError.isSqlError, (cause) => cause.reason._tag),
        Match.orElse(() => "QueryError")
      )
    ),
    Match.orElse(() => "DatabaseError")
  );
