/**
 * Driver-failure proof for the Drizzle execution ledger adapter.
 *
 * The PGlite database is deliberately left unmigrated, so every statement comes
 * back as `relation does not exist`, and the adapter must redact that driver
 * failure into `ExecutionLedgerUnavailable` rather than leak the raw cause.
 */

import { ExecutionRunKey } from "@beep/execution-authority-domain/entities/ExecutionRecord";
import { makeDrizzleExecutionLedger } from "@beep/execution-authority-server/ExecutionLedger";
import { ExecutionLedgerUnavailable } from "@beep/execution-authority-use-cases/ExecutionLedger";
import { makeDrizzleLayer } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteSqlTestLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const runKey = ExecutionRunKey.make(Str.repeat(64)("a"));

const UnmigratedDrizzleLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteSqlTestLayer({ mode: "in-process" })))
);

// A failed statement leaves an implicit-transaction PGlite session in the
// aborted state, where the only legal next statement is the rollback that
// quiesces it, so every expected failure is followed by one.
const quiesce = Effect.fn("ExecutionLedgerDriverFailure.quiesce")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.unsafe("ROLLBACK").pipe(Effect.orDie);
});

describe("Execution ledger driver failures", { concurrent: false }, () => {
  it.layer(UnmigratedDrizzleLayer, { timeout: "2 minutes" })((it) => {
    it.effect(
      "redacts every execution ledger read to ExecutionLedgerUnavailable",
      Effect.fnUntraced(function* () {
        const ledger = yield* makeDrizzleExecutionLedger();

        const decisions = yield* ledger.readDecisions(runKey).pipe(Effect.flip, Effect.ensuring(quiesce()));
        const outcomes = yield* ledger.readOutcomes(runKey).pipe(Effect.flip, Effect.ensuring(quiesce()));
        const unsettled = yield* ledger.readUnsettledAllowed(runKey).pipe(Effect.flip, Effect.ensuring(quiesce()));

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
