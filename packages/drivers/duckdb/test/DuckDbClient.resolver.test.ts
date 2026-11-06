import { DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlError from "effect/sql/SqlError";
import * as SqlResolver from "effect/sql/SqlResolver";

// Mirrors effect@4.0.5 packages/sql/sqlite-node/test/Resolver.test.ts.
// DuckDB has no implicit rowid, so ids come from a sequence default that starts
// after the 100 explicitly seeded rows. All tests share one in-memory database
// (one `it.layer`) and the repo runs tests concurrently, so each test seeds its
// own table and sequence.

const isResultLengthMismatch = S.is(SqlError.ResultLengthMismatch);

const TestRow = S.Struct({ id: S.Finite, name: S.String });

const seededClient = Effect.fnUntraced(function* (table: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.unsafe(`CREATE SEQUENCE ${table}_id_seq START 101`);
  yield* sql.unsafe(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY DEFAULT nextval('${table}_id_seq'), name TEXT)`);
  const rows = A.map(A.range(1, 100), (id) => ({ id, name: `name${id}` }));
  yield* sql`INSERT INTO ${sql(table)} ${sql.insert(rows)}`;
  return { sql, test: sql(table) };
});

describe("DuckDbClient SqlResolver", () => {
  it.layer(DuckDbTestLayer, { timeout: "30 seconds" })((it) => {
    describe("ordered", () => {
      it.effect("insert", () =>
        Effect.gen(function* () {
          const batches: Array<ReadonlyArray<string>> = [];
          const { sql, test } = yield* seededClient("ordered_insert");
          const Insert = SqlResolver.ordered({
            Request: S.String,
            Result: TestRow,
            execute: (names) => {
              batches.push(names);
              return sql`INSERT INTO ${test} ${sql.insert(A.map(names, (name) => ({ name })))} RETURNING *`;
            },
          });
          const execute = SqlResolver.request(Insert);
          const all1 = yield* Effect.all(
            {
              one: execute("one"),
              two: execute("two"),
            },
            { concurrency: "unbounded" }
          );
          assert.deepStrictEqual(all1, {
            one: { id: 101, name: "one" },
            two: { id: 102, name: "two" },
          });
          assert.deepStrictEqual(batches, [["one", "two"]]);
        })
      );

      it.effect("insert RETURNING follows VALUES order for 50 shuffled keys", () =>
        Effect.gen(function* () {
          const batches: Array<ReadonlyArray<string>> = [];
          const { sql, test } = yield* seededClient("ordered_shuffled");
          const Insert = SqlResolver.ordered({
            Request: S.String,
            Result: TestRow,
            execute: (names) => {
              batches.push(names);
              return sql`INSERT INTO ${test} ${sql.insert(A.map(names, (name) => ({ name })))} RETURNING *`;
            },
          });
          const execute = SqlResolver.request(Insert);
          // 17 is coprime to 50, so this is a deterministic permutation of 0..49.
          const keys = A.makeBy(50, (i) => `key${(i * 17) % 50}`);
          const results = yield* Effect.forEach(keys, execute, { concurrency: "unbounded" });
          assert.deepStrictEqual(
            A.map(results, (row) => row.name),
            keys
          );
          assert.deepStrictEqual(
            A.map(results, (row) => row.id),
            A.range(101, 150)
          );
          assert.deepStrictEqual(batches, [keys]);
        })
      );

      it.effect("result length mismatch", () =>
        Effect.gen(function* () {
          const batches: Array<ReadonlyArray<number>> = [];
          const { sql, test } = yield* seededClient("ordered_mismatch");
          const Select = SqlResolver.ordered({
            Request: S.Finite,
            Result: TestRow,
            execute: (ids) => {
              batches.push(ids);
              return sql`SELECT * FROM ${test} WHERE id IN ${sql.in(ids)} ORDER BY id`;
            },
          });
          const execute = SqlResolver.request(Select);
          const error = yield* Effect.all([execute(1), execute(2), execute(3), execute(101)], {
            concurrency: "unbounded",
          }).pipe(Effect.flip);
          if (!isResultLengthMismatch(error)) {
            return assert.fail(`expected ResultLengthMismatch, got ${error._tag}`);
          }
          assert.strictEqual(error.actual, 3);
          assert.strictEqual(error.expected, 4);
          assert.deepStrictEqual(batches, [[1, 2, 3, 101]]);
        })
      );
    });

    describe("grouped", () => {
      it.effect("find by name", () =>
        Effect.gen(function* () {
          const { sql, test } = yield* seededClient("grouped_name");
          const FindByName = SqlResolver.grouped({
            Request: S.String,
            RequestGroupKey: (name) => name,
            Result: TestRow,
            ResultGroupKey: (result) => result.name,
            execute: (names) => sql`SELECT * FROM ${test} WHERE name IN ${sql.in(names)} ORDER BY id`,
          });
          yield* sql`INSERT INTO ${test} ${sql.insert({ name: "name1" })}`;
          const execute = SqlResolver.request(FindByName);
          const all2 = yield* Effect.all(
            {
              one: execute("name1"),
              two: execute("name2"),
              three: Effect.flip(execute("name0")),
            },
            { concurrency: "unbounded" }
          );
          assert.deepStrictEqual(all2, {
            one: [
              { id: 1, name: "name1" },
              { id: 101, name: "name1" },
            ],
            two: [{ id: 2, name: "name2" }],
            three: new Cause.NoSuchElementError(),
          });
        })
      );

      it.effect("using raw rows", () =>
        Effect.gen(function* () {
          const { sql, test } = yield* seededClient("grouped_raw");
          const FindByName = SqlResolver.grouped({
            Request: S.String,
            RequestGroupKey: (name) => name,
            Result: TestRow,
            ResultGroupKey: (_, row: { readonly name: string }) => row.name,
            execute: (names) =>
              sql<{ readonly name: string }>`SELECT * FROM ${test} WHERE name IN ${sql.in(names)} ORDER BY id`,
          });
          yield* sql`INSERT INTO ${test} ${sql.insert({ name: "name1" })}`;
          const execute = SqlResolver.request(FindByName);
          const all3 = yield* Effect.all(
            {
              one: execute("name1"),
              two: execute("name2"),
              three: Effect.flip(execute("name0")),
            },
            { concurrency: "unbounded" }
          );
          assert.deepStrictEqual(all3, {
            one: [
              { id: 1, name: "name1" },
              { id: 101, name: "name1" },
            ],
            two: [{ id: 2, name: "name2" }],
            three: new Cause.NoSuchElementError(),
          });
        })
      );
    });

    describe("findById", () => {
      it.effect("find by id", () =>
        Effect.gen(function* () {
          const { sql, test } = yield* seededClient("find_by_id");
          const FindById = SqlResolver.findById({
            Id: S.Finite,
            Result: TestRow,
            ResultId: (result) => result.id,
            execute: (ids) => sql`SELECT * FROM ${test} WHERE id IN ${sql.in(ids)}`,
          });
          const execute = SqlResolver.request(FindById);
          const all4 = yield* Effect.all(
            {
              one: execute(1),
              two: execute(2),
              three: Effect.flip(execute(101)),
            },
            { concurrency: "unbounded" }
          );
          assert.deepStrictEqual(all4, {
            one: { id: 1, name: "name1" },
            two: { id: 2, name: "name2" },
            three: new Cause.NoSuchElementError(),
          });
        })
      );

      it.effect("using raw rows", () =>
        Effect.gen(function* () {
          const { sql, test } = yield* seededClient("find_by_id_raw");
          const FindById = SqlResolver.findById({
            Id: S.Finite,
            Result: TestRow,
            ResultId: (_, row: { readonly id: number }) => row.id,
            execute: (ids) => sql<{ readonly id: number }>`SELECT * FROM ${test} WHERE id IN ${sql.in(ids)}`,
          });
          const execute = SqlResolver.request(FindById);
          const all5 = yield* Effect.all(
            {
              one: execute(1),
              two: execute(2),
              three: Effect.flip(execute(101)),
            },
            { concurrency: "unbounded" }
          );
          assert.deepStrictEqual(all5, {
            one: { id: 1, name: "name1" },
            two: { id: 2, name: "name2" },
            three: new Cause.NoSuchElementError(),
          });
        })
      );
    });
  });
});
