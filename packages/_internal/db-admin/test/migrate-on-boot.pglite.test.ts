import { migrateOnBoot } from "@beep/db-admin";
import { makeDrizzle, PostgresDrizzle } from "@beep/postgres";
import { makePgliteSqlTestLayer } from "@beep/test-utils";
import { expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

layer(Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" })), {
  timeout: "2 minutes",
})((it) => {
  it.effect(
    "applies boot migrations once and preserves the journal on a second boot",
    () =>
      Effect.gen(function* () {
        const db = yield* makeDrizzle();
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const boot = migrateOnBoot.pipe(Effect.provideService(PostgresDrizzle, db));
        expect(yield* boot).toBeUndefined();
        const first = yield* sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
        expect(first.length).toBeGreaterThan(0);
        expect(yield* boot).toBeUndefined();
        const second = yield* sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
        expect(second).toEqual(first);
      }),
    120_000
  );
});
