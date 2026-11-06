import { DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Model from "effect/schema/Model";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlModel from "effect/sql/SqlModel";
import * as SqlSchema from "effect/sql/SqlSchema";

class Person extends Model.Class<Person>("Person")({
  id: Model.Field({ select: S.Finite, update: S.Finite, json: S.Finite }),
  name: S.String,
}) {}

const PersonRow = S.Struct({ id: S.Finite, name: S.String });

describe("DuckDbClient generic SqlClient consumers", { concurrent: false }, () => {
  it.layer(DuckDbTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "runs SqlModel.makeRepository insert and findById",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE SEQUENCE model_people_id`;
        yield* sql`CREATE TABLE model_people (id INTEGER PRIMARY KEY DEFAULT nextval('model_people_id'), name VARCHAR)`;
        const repo = yield* SqlModel.makeRepository(Person, {
          tableName: "model_people",
          spanPrefix: "ModelPeople",
          idColumn: "id",
        });
        const inserted = yield* repo.insert(Person.insert.make({ name: "Ada" }));
        assert.strictEqual(inserted.name, "Ada");
        const found = yield* repo.findById(inserted.id);
        assert.strictEqual(found.id, inserted.id);
        assert.strictEqual(found.name, "Ada");
      })
    );

    it.effect(
      "runs SqlSchema.findAll, findOne and findOneOption",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE schema_people (id INTEGER, name VARCHAR)`;
        yield* sql`INSERT INTO schema_people VALUES (1, 'Ada'), (2, 'Grace')`;
        const findAll = SqlSchema.findAll({
          Request: S.Void,
          Result: PersonRow,
          execute: () => sql`SELECT id, name FROM schema_people ORDER BY id`,
        });
        const findOne = SqlSchema.findOneOption({
          Request: S.Finite,
          Result: PersonRow,
          execute: (id) => sql`SELECT id, name FROM schema_people WHERE id = ${id}`,
        });
        const foundAll = yield* findAll(undefined);
        assert.deepStrictEqual(foundAll, [
          { id: 1, name: "Ada" },
          { id: 2, name: "Grace" },
        ]);
        const foundOne = yield* findOne(2);
        assertSome(foundOne, { id: 2, name: "Grace" });
        const foundOne1 = yield* findOne(3);
        assertNone(foundOne1);
        const exactlyOne = SqlSchema.findOne({
          Request: S.Finite,
          Result: PersonRow,
          execute: (id) => sql`SELECT id, name FROM schema_people WHERE id = ${id}`,
        });
        const exactlyOne2 = yield* exactlyOne(1);
        assert.deepStrictEqual(exactlyOne2, { id: 1, name: "Ada" });
      })
    );
  });
});
