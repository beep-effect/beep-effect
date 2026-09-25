import * as Pglite from "@beep/pglite";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as SqlClient from "effect/sql/SqlClient";

const makePersistentLayer = (dataDir: string) => Pglite.makeLayer({ dataDir, relaxedDurability: true });

const PersistentTestServices = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const driverNotes = pgTable("pglite_driver_notes", {
  body: text("body").notNull(),
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(),
});

const createTableAndInsert = Effect.fnUntraced(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* sql`
    CREATE TABLE persistent_notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL
    )
  `;
  yield* sql`
    INSERT INTO persistent_notes (body)
    VALUES ('durable hello')
  `;
});

const readPersistentBodies = Effect.fnUntraced(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const rows = yield* sql<{ readonly body: string }>`
    SELECT body
    FROM persistent_notes
    ORDER BY id ASC
  `;

  return rows.map((row) => row.body);
});

const createDriverNotesTable = Effect.fnUntraced(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* sql`
    CREATE TABLE pglite_driver_notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL,
      rating INTEGER NOT NULL
    )
  `;
});

it.layer(PersistentTestServices, { timeout: "30 seconds" })("PgliteClient (file-backed)", (it) => {
  it.effect(
    "persists rows across closing and reopening the same dataDir",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-pglite-persistent-" });
      const dataDir = path.join(tempDir, "pgdata");
      const layer = makePersistentLayer(dataDir);

      yield* Effect.log("PGlite persistence phase: create and insert within first database lifetime");
      yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(layer);
          yield* createTableAndInsert().pipe(Effect.provide(context));
        })
      );
      yield* Effect.log("PGlite persistence phase: first database closed; reopen and read");
      const bodies = yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(layer);
          return yield* readPersistentBodies().pipe(Effect.provide(context));
        })
      );
      yield* Effect.log("PGlite persistence phase: reopened database closed; verify durable rows");

      expect(bodies).toEqual(["durable hello"]);
    })
  );

  it.effect(
    "runs Drizzle CRUD through the PgClient alias",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-pglite-drizzle-" });
      const dataDir = path.join(tempDir, "pgdata");
      const layer = makePersistentLayer(dataDir);

      yield* Effect.log("PGlite Drizzle phase: acquire native database and execute ordered CRUD");
      const rows = yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(layer);
          return yield* Effect.gen(function* () {
            yield* createDriverNotesTable();
            const db = yield* PgDrizzle.makeWithDefaults();

            yield* db.insert(driverNotes).values([
              { body: "alpha", rating: 2 },
              { body: "beta", rating: 1 },
            ]);

            return yield* db
              .select({ body: driverNotes.body, rating: driverNotes.rating })
              .from(driverNotes)
              .orderBy(driverNotes.rating);
          }).pipe(Effect.provide(context));
        })
      );
      yield* Effect.log("PGlite Drizzle phase: database closed; verify ordered rows");

      expect(rows.map((row) => `${row.body}:${row.rating}`)).toEqual(["beta:1", "alpha:2"]);
    })
  );
});
