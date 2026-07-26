/**
 * Claim disposition repository adapters.
 *
 * The surface is append and read only in both variants, because a disposition
 * exists to remember a decision: editing one would erase the very thing it was
 * written down for. A claim resolved again gets a NEW row, and the earlier row
 * becomes `superseded`.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DbSchema } from "@beep/epistemic-tables";
import { fromClaimDispositionRow, toClaimDispositionInsert } from "@beep/epistemic-tables/entities/ClaimDisposition";
import {
  ClaimDispositionRepository,
  ClaimDispositionRepositoryUnavailable,
} from "@beep/epistemic-use-cases/ClaimDisposition";
import { PostgresDrizzle } from "@beep/postgres";
import { A, O } from "@beep/utils";
import { asc, eq } from "drizzle-orm";
import { Effect, Equal, pipe, Ref } from "effect";
import type { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import type { ClaimDispositionOperation } from "@beep/epistemic-use-cases/ClaimDisposition";

const DISPOSITION_TABLE_NAME = "epistemic_claim_disposition" as const;
const dispositionTable = DbSchema.claimDisposition;

const repositoryUnavailable =
  (operation: ClaimDispositionOperation) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ClaimDispositionRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Epistemic ClaimDisposition repository dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: DISPOSITION_TABLE_NAME, cause })
        )
      ),
      Effect.mapError((cause) =>
        ClaimDispositionRepositoryUnavailable.during(
          operation,
          `${operation} failed against ${DISPOSITION_TABLE_NAME}`,
          cause
        )
      )
    );

/**
 * Build the in-memory claim disposition repository.
 *
 * It exists so the gate-outcome story can be proved without a database where
 * SQL is not what is under test — the durable-row proof runs against the Drizzle
 * variant, and this one keeps the resolver's admitted/rejected branching honest
 * at unit speed.
 *
 * @example
 * ```ts
 * import { makeInMemoryClaimDispositionRepository } from "@beep/epistemic-server/ClaimDisposition"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* makeInMemoryClaimDispositionRepository()
 *   const claimId = yield* S.decodeUnknownEffect(Epistemic.CandidateClaimId)(1)
 *   return yield* repository.listByClaim(claimId)
 * })
 *
 * console.log(Effect.runSync(program)) // []
 * ```
 *
 * @effects Allocates a process-local `Ref` and appends to it on every recorded
 * disposition.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryClaimDispositionRepository = Effect.fn("Epistemic.ClaimDisposition.makeInMemory")(
  function* () {
    const store = yield* Ref.make<ReadonlyArray<ClaimDisposition>>([]);

    return ClaimDispositionRepository.of({
      listByClaim: Effect.fn("Epistemic.ClaimDisposition.listByClaim")(function* (claimId) {
        const dispositions = yield* Ref.get(store);
        return A.filter(dispositions, (disposition) => Equal.equals(disposition.claimId, claimId));
      }),
      record: Effect.fn("Epistemic.ClaimDisposition.record")(function* (disposition) {
        yield* Ref.update(store, A.append(disposition));
        return disposition;
      }),
    });
  }
);

/**
 * Build the Drizzle-backed claim disposition repository.
 *
 * @example
 * ```ts
 * import { makeDrizzleClaimDispositionRepository } from "@beep/epistemic-server/ClaimDisposition"
 * import { Effect } from "effect"
 *
 * const program = makeDrizzleClaimDispositionRepository().pipe(
 *   Effect.map((repository) => typeof repository.record === "function")
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Requires `PostgresDrizzle`; inserts into and selects from the claim
 * disposition table and translates driver failures to
 * `ClaimDispositionRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleClaimDispositionRepository = Effect.fn("Epistemic.ClaimDisposition.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return ClaimDispositionRepository.of({
    listByClaim: Effect.fn("Epistemic.ClaimDisposition.drizzleListByClaim")(function* (claimId) {
      const rows = yield* db
        .select()
        .from(dispositionTable)
        .where(eq(dispositionTable.claimId, claimId))
        .orderBy(asc(dispositionTable.id))
        .pipe(repositoryUnavailable("listByClaim"));
      return A.map(rows, fromClaimDispositionRow);
    }),
    record: Effect.fn("Epistemic.ClaimDisposition.drizzleRecord")(function* (disposition) {
      const rows = yield* db
        .insert(dispositionTable)
        .values(toClaimDispositionInsert(disposition))
        .returning()
        .pipe(repositoryUnavailable("record"));
      return pipe(
        rows,
        A.head,
        O.map(fromClaimDispositionRow),
        // The database assigns the SERIAL id, so the returned row is the
        // authority; the argument only stands in if the driver returned none.
        O.getOrElse(() => disposition)
      );
    }),
  });
});
