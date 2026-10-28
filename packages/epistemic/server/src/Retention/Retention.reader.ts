/**
 * Scoped, read-only retention authority adapter.
 * @packageDocumentation
 * @since 0.0.0
 */
import { RetentionSnapshot } from "@beep/epistemic-domain/values/Retention";
import { DbSchema } from "@beep/epistemic-tables";
import { fromClaimDispositionRow } from "@beep/epistemic-tables/entities/ClaimDisposition";
import { fromEdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion";
import { RetentionAuthorityReader, RetentionUnavailable } from "@beep/epistemic-use-cases/Retention";
import { PostgresDrizzle } from "@beep/postgres";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as SqlError from "effect/sql/SqlError";

/**
 * Read accepted edge versions and associated claim dispositions in one read-only repeatable-read transaction.
 *
 * **Details**
 * Scope always includes organization and explicit logical-edge keys. An empty key set reads no authority.
 * No projection policy enters SQL and no authority write operation is exposed by this adapter.
 *
 * **Example** (Inspect the reader layer)
 * ```ts
 * import { RetentionAuthorityReaderDrizzle } from "@beep/epistemic-server/Retention"
 * console.log(RetentionAuthorityReaderDrizzle)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const RetentionAuthorityReaderDrizzle = Layer.effect(
  RetentionAuthorityReader,
  Effect.gen(function* () {
    const db = yield* PostgresDrizzle;
    const edge = DbSchema.edgeVersion;
    const disposition = DbSchema.claimDisposition;
    return RetentionAuthorityReader.of({
      read: Effect.fn("Retention.readAuthority")(function* (query) {
        if (A.isReadonlyArrayEmpty(query.logicalKeys)) return RetentionSnapshot.make({ edges: [], dispositions: [] });
        const validAt = DateTime.toEpochMillis(query.validAt);
        const knownAt = DateTime.toEpochMillis(query.knownAt);
        return yield* db
          .transaction(
            Effect.fnUntraced(function* (tx) {
              const rows = yield* tx
                .select()
                .from(edge)
                .where(
                  and(
                    eq(edge.orgId, query.orgId),
                    inArray(edge.logicalKey, query.logicalKeys),
                    lte(edge.validFrom, validAt),
                    or(isNull(edge.validTo), gt(edge.validTo, validAt)),
                    lte(edge.recordedAt, knownAt),
                    or(isNull(edge.expiredAt), gt(edge.expiredAt, knownAt))
                  )
                );
              const edges = yield* Effect.forEach(rows, (row) => Effect.fromResult(fromEdgeVersionRow(row)));
              const claimIds = A.dedupe(
                A.flatMap(edges, (version) => A.getSomes([version.sourceClaimId, version.targetClaimId]))
              );
              const dispositions = yield* A.match(claimIds, {
                onEmpty: () => Effect.succeed([]),
                onNonEmpty: (ids) =>
                  tx
                    .select()
                    .from(disposition)
                    .where(
                      and(
                        eq(disposition.orgId, query.orgId),
                        inArray(disposition.claimId, ids),
                        lte(disposition.resolvedAt, knownAt)
                      )
                    )
                    .pipe(
                      Effect.flatMap((results) =>
                        Effect.forEach(results, (row) => Effect.fromResult(fromClaimDispositionRow(row)))
                      )
                    ),
              });
              return RetentionSnapshot.make({ edges, dispositions });
            }),
            { isolationLevel: "repeatable read", accessMode: "read only" }
          )
          .pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Retention authority read failed").pipe(
                Effect.annotateLogs({
                  operation: "read",
                  errorKind: Match.value(error).pipe(
                    Match.when(P.isTagged("EdgeVersionConverterError"), () => "EdgeVersionConverterError"),
                    Match.when(P.isTagged("ClaimDispositionConverterError"), () => "ClaimDispositionConverterError"),
                    Match.when(SqlError.isSqlError, (error) => error.reason._tag),
                    Match.when(P.isTagged("EffectDrizzleQueryError"), (error) =>
                      Match.value(Cause.isCause(error.cause) ? Cause.squash(error.cause) : error.cause).pipe(
                        Match.when(SqlError.isSqlError, (cause) => cause.reason._tag),
                        Match.orElse(() => "QueryError")
                      )
                    ),
                    Match.orElse(() => "DatabaseError")
                  ),
                })
              )
            ),
            Effect.mapError(() =>
              RetentionUnavailable.make({ operation: "read", message: "Scoped authority snapshot unavailable" })
            )
          );
      }),
    });
  })
);
