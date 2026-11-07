/**
 * The conformance and consumer suites against a real Postgres, when
 * `DB_PG_URL` names one; skipped otherwise. Each run uses its own table
 * prefix, so runs never see each other's rows.
 */
import { PostgresClient } from "@beep/postgres";
import { describe, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Random from "effect/Random";
import { postgresSuites } from "../conformance/postgres-suites.ts";

// Read once, while the suite registers: whether there is a database to run against.
const url = Effect.runSync(Config.Redacted("DB_PG_URL").pipe(Config.option));
const run = Effect.runSync(Random.nextIntBetween(0, 1_000_000_000));

O.match(url, {
  onNone: () =>
    describe("Platform conformance on a real Postgres", () => {
      it.skip("skipped: set DB_PG_URL to a Postgres the tests may create tables in", () => {});
    }),
  onSome: (value) =>
    postgresSuites({
      name: "AlchemyPostgresPlatform over Postgres",
      base: PostgresClient.makeLayer({ url: value }),
      tablePrefix: `alchemy_it${run}_`,
    }),
});
