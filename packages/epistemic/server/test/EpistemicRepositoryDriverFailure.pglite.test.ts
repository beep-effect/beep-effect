/**
 * Driver-failure proof for the Drizzle epistemic repository adapters.
 *
 * The durable-row proofs under `test/integration` show what these adapters do
 * when the tables exist. This one shows what they do when the driver refuses:
 * the PGlite database is deliberately left unmigrated, so every statement comes
 * back as `relation does not exist`, and each adapter must redact that driver
 * failure into its own typed error rather than leak the raw cause.
 */

import { ExecutionRunKey } from "@beep/epistemic-domain/values/ExecutionRecord";
import {
  makeDrizzleClaimDispositionRepository,
  makeInMemoryClaimDispositionRepository,
} from "@beep/epistemic-server/ClaimDisposition";
import { makeDrizzleExecutionLedger } from "@beep/epistemic-server/ExecutionLedger";
import { ClaimDispositionRepositoryUnavailable } from "@beep/epistemic-use-cases/ClaimDisposition";
import { ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger";
import { makeDrizzleLayer } from "@beep/postgres";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { makePgliteSqlTestLayer } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const decodeCandidateClaimId = S.decodeUnknownEffect(Epistemic.CandidateClaimId);

const runKey = ExecutionRunKey.make("a".repeat(64));

const UnmigratedDrizzleLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteSqlTestLayer({ mode: "in-process" })))
);

// A failed statement leaves an implicit-transaction PGlite session in the
// aborted state, where the only legal next statement is the rollback that
// quiesces it, so every expected failure is followed by one.
const quiesce = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* Effect.ignore(sql.unsafe("ROLLBACK"));
});

describe("Epistemic repository driver failures", { concurrent: false }, () => {
  layer(UnmigratedDrizzleLayer, { timeout: "2 minutes" })((it) => {
    it.effect(
      "redacts claim disposition reads to ClaimDispositionRepositoryUnavailable",
      Effect.fnUntraced(function* () {
        const repository = yield* makeDrizzleClaimDispositionRepository();
        const claimId = yield* decodeCandidateClaimId(1);

        const failure = yield* Effect.flip(repository.listByClaim(claimId));
        yield* quiesce();

        expect(ClaimDispositionRepositoryUnavailable.is(failure)).toBe(true);
        expect(failure.operation).toBe("listByClaim");
      })
    );

    it.effect(
      "redacts every execution ledger read to ExecutionLedgerUnavailable",
      Effect.fnUntraced(function* () {
        const ledger = yield* makeDrizzleExecutionLedger();

        const decisions = yield* Effect.flip(ledger.readDecisions(runKey));
        yield* quiesce();
        const outcomes = yield* Effect.flip(ledger.readOutcomes(runKey));
        yield* quiesce();
        const unsettled = yield* Effect.flip(ledger.readUnsettledAllowed(runKey));
        yield* quiesce();

        expect(A.map([decisions, outcomes, unsettled], (error) => ExecutionLedgerUnavailable.is(error))).toEqual([
          true,
          true,
          true,
        ]);
        expect(A.map([decisions, outcomes, unsettled], (error) => error.operation)).toEqual([
          "readDecisions",
          "readOutcomes",
          "readUnsettledAllowed",
        ]);
      })
    );
  });
});

describe("In-memory claim disposition repository", () => {
  it.effect(
    "starts empty",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemoryClaimDispositionRepository();
      const claimId = yield* decodeCandidateClaimId(1);

      expect(A.isReadonlyArrayEmpty(yield* repository.listByClaim(claimId))).toBe(true);
    })
  );
});
