/**
 * The conformance and consumer suites against a real Postgres, when
 * `DB_PG_URL` names one; skipped otherwise. Each run uses its own table
 * prefix, so runs never see each other's rows.
 */
import { PostgresClient } from "@beep/postgres";
import { atRegistration } from "@beep/test-utils/Registration";
import { describe, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as O from "effect/Option";
import * as Random from "effect/Random";
import { postgresSuites } from "../conformance/postgres-suites.ts";

const url = atRegistration(Config.Redacted("DB_PG_URL").pipe(Config.option));
const run = atRegistration(Random.nextIntBetween(0, 1_000_000_000));

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
