import { DuckDbClient, DuckDbClientConfigData, DuckDbMigrator, DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { DuckDBTimestampTZValue, decimalValue } from "@duckdb/node-api";
import { assert, describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import type { SqlError } from "effect/sql/SqlError";

const reasonOf = (error: SqlError): { readonly _tag: string; readonly operation?: string | undefined } => error.reason;

const assertUnknownError = (error: SqlError, operation: string): void => {
  assert.strictEqual(reasonOf(error)._tag, "UnknownError");
  assert.strictEqual(reasonOf(error).operation, operation);
};

const sameBytes = (actual: unknown, expected: ReadonlyArray<number>): void => {
  assert.instanceOf(actual, Uint8Array);
  assert.strictEqual((actual as Uint8Array).constructor, Uint8Array);
  assert.deepStrictEqual(A.fromIterable(actual as Uint8Array), A.fromIterable(expected));
};

const instantOf = (value: unknown): number => {
  assert.instanceOf(value, Date);
  return (value as Date).getTime();
};

const BIND_INSTANT = DateTime.toDateUtc(DateTime.makeUnsafe("2024-05-06T07:08:09.123Z"));
const CHICAGO_INSTANT = DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-15T12:00:00Z"));
const makeInvalidDate = (): Date => {
  const date = DateTime.toDateUtc(DateTime.makeUnsafe(0));
  date.setTime(Number.NaN);
  return date;
};
const INVALID_DATE = makeInvalidDate();

const encodeConfigData = S.encodeEffect(DuckDbClientConfigData);
const decodeConfigData = S.decodeUnknownEffect(DuckDbClientConfigData);

describe("DuckDbClient", { concurrent: false }, () => {
  it.layer(DuckDbClient.layer({ databasePath: ":memory:" }), { timeout: "30 seconds" })((it) => {
    it.effect(
      "provides DuckDbClient and SqlClient as the same object",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        const sql = yield* SqlClient.SqlClient;
        assert.strictEqual(client, sql);
        assert.strictEqual(client[DuckDbClient.TypeId], DuckDbClient.TypeId);
        assert.strictEqual(client.config.databasePath, ":memory:");
      })
    );

    it.effect(
      "reads its own writes through a repeated parameterless constant-filter query",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE stale_plan (singleton INTEGER, v INTEGER)`;
        const select = sql<{ readonly v: number }>`SELECT v FROM stale_plan WHERE singleton = 1`;
        const count = sql<{ readonly n: number }>`SELECT count(*) AS n FROM stale_plan WHERE singleton < 2`;
        const select1 = yield* select;
        assert.deepStrictEqual(select1, []);
        const values2 = yield* count.values;
        assert.deepStrictEqual(values2, [[0]]);
        yield* sql`INSERT INTO stale_plan VALUES (1, 7)`;
        const select3 = yield* select;
        assert.deepStrictEqual(select3, [{ v: 7 }]);
        const value4 = yield* sql`SELECT v FROM stale_plan WHERE singleton = 1`;
        assert.deepStrictEqual(value4, [{ v: 7 }]);
        const values5 = yield* count.values;
        assert.deepStrictEqual(values5, [[1]]);
        const value6 = yield* sql`SELECT v FROM stale_plan WHERE singleton = ${1}`;
        assert.deepStrictEqual(value6, [{ v: 7 }]);
      })
    );

    it.effect(
      "runs CRUD through the tagged template and record helpers",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE crud_people (id INTEGER PRIMARY KEY, name VARCHAR, age INTEGER)`;
        yield* sql`INSERT INTO crud_people ${sql.insert([
          { id: 1, name: "ada", age: 36 },
          { id: 2, name: "bob", age: 41 },
          { id: 3, name: "cy", age: 29 },
        ])}`;
        yield* sql`INSERT INTO crud_people ${sql.insert({ id: 4, name: "dee", age: 50 })}`;
        yield* sql`UPDATE crud_people SET ${sql.update({ id: 2, name: "bobby", age: 42 }, ["id"])} WHERE id = ${2}`;
        const selected = yield* sql<{
          readonly id: number;
          readonly name: string;
        }>`SELECT id, name FROM crud_people WHERE ${sql.in("id", [1, 2, 4])} ORDER BY id`;
        assert.deepStrictEqual(selected, [
          { id: 1, name: "ada" },
          { id: 2, name: "bobby" },
          { id: 4, name: "dee" },
        ]);
        const filtered = yield* sql`SELECT id FROM crud_people WHERE ${sql.and([
          sql`age > ${30}`,
          sql`name <> ${"dee"}`,
        ])} ORDER BY id`;
        assert.deepStrictEqual(filtered, [{ id: 1 }, { id: 2 }]);
        const inHelper = yield* sql`SELECT id FROM crud_people WHERE id IN ${sql.in([3, 4])} ORDER BY id`;
        assert.deepStrictEqual(inHelper, [{ id: 3 }, { id: 4 }]);
        yield* sql`DELETE FROM crud_people WHERE id = ${3}`;
        const value7 = yield* sql`SELECT count(*) AS n FROM crud_people`;
        assert.deepStrictEqual(value7, [{ n: 3 }]);
      })
    );

    it.effect(
      "updates rows with updateValues",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE uv_people (id INTEGER PRIMARY KEY, name VARCHAR)`;
        yield* sql`INSERT INTO uv_people ${sql.insert([
          { id: 1, name: "a" },
          { id: 2, name: "b" },
          { id: 3, name: "c" },
        ])}`;
        yield* sql`UPDATE uv_people SET name = data.name FROM ${sql.updateValues(
          [
            { id: 1, name: "x" },
            { id: 3, name: "z" },
          ],
          "data"
        )} WHERE uv_people.id = data.id`;
        const value8 = yield* sql`SELECT id, name FROM uv_people ORDER BY id`;
        assert.deepStrictEqual(value8, [
          { id: 1, name: "x" },
          { id: 2, name: "b" },
          { id: 3, name: "z" },
        ]);
      })
    );

    it.effect(
      "returns value rows through values and valuesUnprepared",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE values_rows (id INTEGER, name VARCHAR)`;
        yield* sql`INSERT INTO values_rows VALUES (1, 'one'), (2, 'two')`;
        const values9 = yield* sql`SELECT id, name FROM values_rows ORDER BY id`.values;
        assert.deepStrictEqual(values9, [
          [1, "one"],
          [2, "two"],
        ]);
        const valuesUnprepared10 = yield* sql`SELECT id, name FROM values_rows WHERE id = ${2}`.valuesUnprepared;
        assert.deepStrictEqual(valuesUnprepared10, [[2, "two"]]);
        const values11 = yield* sql`INSERT INTO values_rows VALUES (3, 'three')`.values;
        assert.deepStrictEqual(values11, []);
        const valuesUnprepared12 = yield* sql`INSERT INTO values_rows VALUES (4, 'four')`.valuesUnprepared;
        assert.deepStrictEqual(valuesUnprepared12, []);
      })
    );

    it.effect(
      "binds parameters on the unprepared path",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const unprepared13 = yield* sql`SELECT ${5} AS v`.unprepared;
        assert.deepStrictEqual(unprepared13, [{ v: 5 }]);
      })
    );

    it.effect(
      "runs multi-statement SQL without params on both paths",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const unprepared14 = yield* sql`CREATE TABLE multi_stmt (i INTEGER); INSERT INTO multi_stmt VALUES (1)`
          .unprepared;
        assert.deepStrictEqual(unprepared14, []);
        const value15 = yield* sql`INSERT INTO multi_stmt VALUES (2); INSERT INTO multi_stmt VALUES (3)`;
        assert.deepStrictEqual(value15, []);
        // second run hits the cached RunDirect entry
        yield* sql`INSERT INTO multi_stmt VALUES (2); INSERT INTO multi_stmt VALUES (3)`;
        const value16 = yield* sql`SELECT count(*) AS n FROM multi_stmt`;
        assert.deepStrictEqual(value16, [{ n: 5 }]);
      })
    );

    it.effect(
      "returns an empty result for blank SQL",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const unsafe17 = yield* sql.unsafe("   ");
        assert.deepStrictEqual(unsafe17, []);
        const unprepared18 = yield* sql.unsafe("").unprepared;
        assert.deepStrictEqual(unprepared18, []);
        const values19 = yield* sql.unsafe("  ").values;
        assert.deepStrictEqual(values19, []);
        const resultCount = yield* Stream.runCount(sql.unsafe(" ").stream);
        assert.strictEqual(resultCount, 0);
      })
    );

    it.effect(
      "returns [] for DDL and plain DML",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const value20 = yield* sql`CREATE TABLE ddl_dml (i INTEGER)`;
        assert.deepStrictEqual(value20, []);
        const value21 = yield* sql`INSERT INTO ddl_dml VALUES (1), (2)`;
        assert.deepStrictEqual(value21, []);
        const value22 = yield* sql`UPDATE ddl_dml SET i = i + 1`;
        assert.deepStrictEqual(value22, []);
        const value23 = yield* sql`DELETE FROM ddl_dml WHERE i = 3`;
        assert.deepStrictEqual(value23, []);
      })
    );

    it.effect(
      "reports changes and rows through raw",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE raw_rows (id INTEGER)`;
        const raw24 = yield* sql`INSERT INTO raw_rows VALUES (1), (2)`.raw;
        assert.deepStrictEqual(raw24, { changes: 2, rows: [] });
        const raw25 = yield* sql`INSERT INTO raw_rows VALUES (3) RETURNING id`.raw;
        assert.deepStrictEqual(raw25, {
          changes: 0,
          rows: [{ id: 3 }],
        });
      })
    );

    it.effect(
      "reads integers as numbers by default and bigints under SafeIntegers",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const query = sql`SELECT 9007199254740993::BIGINT AS b, 7::HUGEINT AS h, 8::UBIGINT AS u, [1::BIGINT] AS l, (SELECT count(*) FROM range(3)) AS c`;
        const query26 = yield* query;
        assert.deepStrictEqual(query26, [{ b: 9007199254740992, h: 7, u: 8, l: [1], c: 3 }]);
        const safe = yield* query.pipe(Effect.provideService(SqlClient.SafeIntegers, true));
        assert.deepStrictEqual(safe, [
          {
            b: BigInt("9007199254740993"),
            h: BigInt(7),
            u: BigInt(8),
            l: [BigInt(1)],
            c: BigInt(3),
          },
        ]);
      })
    );

    it.effect(
      "converts decimals, times, intervals, special timestamps, strings, and nested types",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TYPE conv_mood AS ENUM ('ok', 'sad')`;
        const [row] = yield* sql`SELECT
          123.4::DECIMAL(4,1) AS small_dec,
          123456789012345.678::DECIMAL(18,3) AS big_dec,
          '12:34:56.123456'::TIME AS t,
          '12:34:56+05:30'::TIMETZ AS ttz,
          INTERVAL 1 DAY + INTERVAL 2 HOUR + INTERVAL 3 MONTH AS iv,
          'infinity'::TIMESTAMP AS inf,
          '550e8400-e29b-41d4-a716-446655440000'::UUID AS id,
          'ok'::conv_mood AS mood,
          '{"a":1}'::JSON AS j,
          {'a': 1, 'b': 'x'} AS st,
          map {'k': 1} AS mp,
          [1, 2, 3] AS ls`;
        assert.deepStrictEqual(row, {
          small_dec: 123.4,
          big_dec: "123456789012345.678",
          t: "12:34:56.123456",
          ttz: "12:34:56+05:30",
          iv: { months: 3, days: 1, micros: 7_200_000_000 },
          inf: "infinity",
          id: "550e8400-e29b-41d4-a716-446655440000",
          mood: "ok",
          j: '{"a":1}',
          st: { a: 1, b: "x" },
          mp: [{ key: "k", value: 1 }],
          ls: [1, 2, 3],
        });
        const [safe] = yield* sql`SELECT INTERVAL 2 HOUR AS iv`.pipe(
          Effect.provideService(SqlClient.SafeIntegers, true)
        );
        assert.deepStrictEqual(safe, { iv: { months: 0, days: 0, micros: BigInt(7_200_000_000) } });
      })
    );

    it.effect(
      "round-trips BLOB values as plain Uint8Array",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE blob_rows (b BLOB)`;
        yield* sql`INSERT INTO blob_rows VALUES (${new Uint8Array([1, 2, 250])})`;
        const [row] = yield* sql<{ readonly b: unknown }>`SELECT b FROM blob_rows`;
        sameBytes(row?.b, [1, 2, 250]);
        const [literal] = yield* sql<{ readonly b: unknown }>`SELECT '\\xAA\\xBB'::BLOB AS b`;
        sameBytes(literal?.b, [0xaa, 0xbb]);
      })
    );

    it.effect(
      "reads DATE, TIMESTAMP and TIMESTAMPTZ as Date",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [row] = yield* sql<{
          readonly d: unknown;
          readonly ts: unknown;
          readonly tz: unknown;
        }>`SELECT DATE '2024-01-02' AS d, TIMESTAMP '2024-01-02 03:04:05' AS ts, TIMESTAMPTZ '2024-01-02 03:04:05+00' AS tz`;
        assert.strictEqual(instantOf(row?.d), Date.UTC(2024, 0, 2));
        assert.strictEqual(instantOf(row?.ts), Date.UTC(2024, 0, 2, 3, 4, 5));
        assert.strictEqual(instantOf(row?.tz), Date.UTC(2024, 0, 2, 3, 4, 5));
      })
    );

    it.effect(
      "binds a list whose first item is null without nulling the later items",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE lead_null (id INTEGER, tags INTEGER[], names VARCHAR[])`;
        yield* sql`INSERT INTO lead_null ${sql.insert({ id: 1, tags: [null, 7, 8], names: [null, "x"] })}`;
        yield* sql.unsafe("INSERT INTO lead_null VALUES (?, ?, ?)", [2, [undefined, 9], [undefined, "a"]]);
        const value27 = yield* sql`SELECT * FROM lead_null ORDER BY id`;
        assert.deepStrictEqual(value27, [
          { id: 1, tags: [null, 7, 8], names: [null, "x"] },
          { id: 2, tags: [null, 9], names: [null, "a"] },
        ]);
        const value28 = yield* sql`SELECT ${[null, 1]} AS l`;
        assert.deepStrictEqual(value28, [{ l: [null, 1] }]);
        const unsafe29 = yield* sql.unsafe("SELECT ? AS l", [[[null], null, [null, 2]]]);
        assert.deepStrictEqual(unsafe29, [{ l: [[null], null, [null, 2]] }]);
        const value30 = yield* sql`SELECT ${[null, null]} AS l`;
        assert.deepStrictEqual(value30, [{ l: [null, null] }]);
      })
    );

    it.effect(
      "widens a list mixing integers and non-integers to the widest number type",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE widen_list (id INTEGER, xs DOUBLE[], grid DOUBLE[][])`;
        yield* sql`INSERT INTO widen_list ${sql.insert({ id: 1, xs: [1, 2.5], grid: [[1], [2.5]] })}`;
        yield* sql.unsafe("INSERT INTO widen_list VALUES (?, ?, ?)", [2, [null, 3, 0.5], [[null, 4], null]]);
        yield* sql.unsafe("INSERT INTO widen_list VALUES (?, ?, ?)", [3, [3e9, 1.5], [[2.5, 1]]]).unprepared;
        const value31 = yield* sql`SELECT * FROM widen_list ORDER BY id`;
        assert.deepStrictEqual(value31, [
          { id: 1, xs: [1, 2.5], grid: [[1], [2.5]] },
          { id: 2, xs: [null, 3, 0.5], grid: [[null, 4], null] },
          { id: 3, xs: [3e9, 1.5], grid: [[2.5, 1]] },
        ]);
        const value32 = yield* sql`SELECT ${[1, 2.5]} AS l, typeof(${[1, 2.5]}) AS t`;
        assert.deepStrictEqual(value32, [{ l: [1, 2.5], t: "DOUBLE[]" }]);
        const value33 = yield* sql`SELECT typeof(${[1, 3e9]}) AS t, typeof(${[[1], [2.5]]}) AS g`;
        assert.deepStrictEqual(value33, [{ t: "BIGINT[]", g: "DOUBLE[][]" }]);
      })
    );

    it.effect(
      "binds an empty array as an empty LIST into typed and untyped contexts",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE empty_list_bind (id INTEGER, tags INTEGER[], names VARCHAR[], grid INTEGER[][])`;
        yield* sql`INSERT INTO empty_list_bind ${sql.insert({ id: 1, tags: [], names: [], grid: [] })}`;
        yield* sql.unsafe("INSERT INTO empty_list_bind VALUES (?, ?, ?, ?)", [2, [], [], [[], [3]]]);
        yield* sql.unsafe("INSERT INTO empty_list_bind VALUES (?, ?, ?, ?)", [3, [], ["a"], [[]]]).unprepared;
        const value34 = yield* sql`SELECT * FROM empty_list_bind ORDER BY id`;
        assert.deepStrictEqual(value34, [
          { id: 1, tags: [], names: [], grid: [] },
          { id: 2, tags: [], names: [], grid: [[], [3]] },
          { id: 3, tags: [], names: ["a"], grid: [[]] },
        ]);
        const value35 = yield* sql`SELECT ${[]} AS l, len(${[]}) AS n`;
        assert.deepStrictEqual(value35, [{ l: [], n: 0 }]);
        const unsafe36 = yield* sql.unsafe("SELECT ?::VARCHAR[] AS l", [[]]);
        assert.deepStrictEqual(unsafe36, [{ l: [] }]);
        const value37 = yield* sql`SELECT count(*) AS n FROM empty_list_bind WHERE tags = ${[]}`;
        assert.deepStrictEqual(value37, [{ n: 3 }]);
      })
    );

    it.effect(
      "reads infinite DATE and TIMESTAMP values of every precision as infinity strings",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [row] = yield* sql`SELECT
          'infinity'::DATE AS d, '-infinity'::DATE AS nd,
          'infinity'::TIMESTAMP_S AS s, '-infinity'::TIMESTAMP_S AS ns_,
          'infinity'::TIMESTAMP_MS AS ms, '-infinity'::TIMESTAMP_MS AS nms,
          'infinity'::TIMESTAMP AS us, '-infinity'::TIMESTAMP AS nus,
          'infinity'::TIMESTAMP_NS AS n, '-infinity'::TIMESTAMP_NS AS nn,
          'infinity'::TIMESTAMPTZ AS tz, '-infinity'::TIMESTAMPTZ AS ntz`;
        assert.deepStrictEqual(row, {
          d: "infinity",
          nd: "-infinity",
          s: "infinity",
          ns_: "-infinity",
          ms: "infinity",
          nms: "-infinity",
          us: "infinity",
          nus: "-infinity",
          n: "infinity",
          nn: "-infinity",
          tz: "infinity",
          ntz: "-infinity",
        });
        const [bound] = yield* sql`SELECT ${"infinity"}::DATE AS d`;
        assert.deepStrictEqual(bound, { d: "infinity" });
      })
    );

    it.effect(
      "reads DATE and TIMESTAMP values outside the JS Date range as their strings",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [row] = yield* sql`SELECT
          '5877642-06-25'::DATE AS d,
          '294247-01-10 04:00:54.775806'::TIMESTAMP AS big,
          '290309-12-22 (BC) 00:00:00'::TIMESTAMP AS small`;
        assert.deepStrictEqual(row, {
          d: "5877642-06-25",
          big: "294247-01-10 04:00:54.775806",
          small: "290309-12-22 (BC) 00:00:00",
        });
      })
    );

    it.effect(
      "reads an out-of-range TIMESTAMPTZ as its UTC string under a non-UTC host offset",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        // The upstream class captures the host offset once at module load;
        // pin it to +05:30 so the read runs as if the process TZ were not UTC.
        const row = yield* Effect.acquireUseRelease(
          Effect.sync(() => {
            const saved = DuckDBTimestampTZValue.timezoneOffsetInMinutes;
            DuckDBTimestampTZValue.timezoneOffsetInMinutes = 330;
            return saved;
          }),
          () =>
            sql`SELECT
              '294247-01-10 04:00:54.775806+00'::TIMESTAMPTZ AS big,
              '290309-12-22 (BC) 00:00:00+00'::TIMESTAMPTZ AS small`,
          (saved) =>
            Effect.sync(() => {
              DuckDBTimestampTZValue.timezoneOffsetInMinutes = saved;
            })
        );
        assert.deepStrictEqual(row, [
          { big: "294247-01-10 04:00:54.775806+00", small: "290309-12-22 (BC) 00:00:00+00" },
        ]);
      })
    );

    it.effect(
      "floors pre-epoch sub-millisecond timestamps instead of rounding toward the epoch",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [row] = yield* sql<{
          readonly us: unknown;
          readonly tz: unknown;
          readonly ns: unknown;
          readonly pos: unknown;
        }>`SELECT
          '1969-12-31 23:59:59.9995'::TIMESTAMP AS us,
          '1969-12-31 23:59:59.9995+00'::TIMESTAMPTZ AS tz,
          '1969-12-31 23:59:59.9999995'::TIMESTAMP_NS AS ns,
          '2024-01-02 03:04:05.6789'::TIMESTAMP AS pos`;
        assert.strictEqual(instantOf(row?.us), -1);
        assert.strictEqual(instantOf(row?.tz), -1);
        assert.strictEqual(instantOf(row?.ns), -1);
        assert.strictEqual(instantOf(row?.pos), Date.UTC(2024, 0, 2, 3, 4, 5, 678));
      })
    );

    it.effect(
      "reads BIT as its bit string",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const value38 = yield* sql`SELECT '101'::BIT AS b`;
        assert.deepStrictEqual(value38, [{ b: "101" }]);
      })
    );

    it.effect(
      "binds JavaScript values",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const unsafe39 = yield* sql.unsafe("SELECT ?::INTEGER IS NULL AS n", [undefined]);
        assert.deepStrictEqual(unsafe39, [{ n: true }]);

        const instant = BIND_INSTANT;
        yield* sql`CREATE TABLE bind_dates (ts TIMESTAMP, tz TIMESTAMPTZ)`;
        yield* sql`INSERT INTO bind_dates VALUES (${instant}, ${instant})`;
        const [dates] = yield* sql<{ readonly ts: unknown; readonly tz: unknown }>`SELECT ts, tz FROM bind_dates`;
        assert.strictEqual(instantOf(dates?.ts), instant.getTime());
        assert.strictEqual(instantOf(dates?.tz), instant.getTime());

        const [bytes] = yield* sql.unsafe<{ readonly u: unknown; readonly i: unknown }>("SELECT ? AS u, ? AS i", [
          new Uint8Array([1, 2]),
          new Int8Array([-1, 3]),
        ]);
        sameBytes(bytes?.u, [1, 2]);
        sameBytes(bytes?.i, [255, 3]);

        yield* sql`CREATE TABLE bind_bigints (b BIGINT)`;
        yield* sql`INSERT INTO bind_bigints VALUES (${BigInt("9007199254740993")})`;
        const pipe40 = yield* sql`SELECT b FROM bind_bigints`.pipe(Effect.provideService(SqlClient.SafeIntegers, true));
        assert.deepStrictEqual(pipe40, [{ b: BigInt("9007199254740993") }]);

        const unsafe41 = yield* sql.unsafe("SELECT ?::INTEGER[] AS l", [[1, 2, 3]]);
        assert.deepStrictEqual(unsafe41, [{ l: [1, 2, 3] }]);
        const unsafe42 = yield* sql.unsafe("SELECT list_sum(?) AS s", [[4, 5]]);
        assert.deepStrictEqual(unsafe42, [{ s: 9 }]);

        const unsafe43 = yield* sql.unsafe("SELECT ? AS j", [{ a: 1, b: "x" }]);
        assert.deepStrictEqual(unsafe43, [{ j: '{"a":1,"b":"x"}' }]);
        const unsafe44 = yield* sql.unsafe("SELECT (?::JSON)->>'a' AS a", [{ a: 1 }]);
        assert.deepStrictEqual(unsafe44, [{ a: "1" }]);

        const unsafe45 = yield* sql.unsafe("SELECT ? AS d", [decimalValue(BigInt(12345), 5, 2)]);
        assert.deepStrictEqual(unsafe45, [{ d: 123.45 }]);
      })
    );

    it.effect(
      "fails unbindable parameters with UnknownError carrying the method operation",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const flip46 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [new Map()]));
        assertUnknownError(flip46, "execute");
        const flip47 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [INVALID_DATE]));
        assertUnknownError(flip47, "execute");
        const flip48 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [new Map()]).unprepared);
        assertUnknownError(flip48, "executeUnprepared");
        const flip49 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [new Map()]).values);
        assertUnknownError(flip49, "executeValues");
        const flip50 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [new Map()]).valuesUnprepared);
        assertUnknownError(flip50, "executeValuesUnprepared");
        const flip51 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [new Map()]).raw.pipe(Effect.asVoid));
        assertUnknownError(flip51, "executeRaw");
      })
    );

    it.effect(
      "fails the documented number and mixed-array bind limits with UnknownError",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const flip52 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [1e20]));
        assert.strictEqual(reasonOf(flip52)._tag, "UnknownError");
        const flip53 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [[1, "a"]]));
        assert.strictEqual(reasonOf(flip53)._tag, "UnknownError");
        // A ragged list (a list item next to a scalar item) mixes kinds too.
        const flip54 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [[[1], 2]]));
        assert.strictEqual(reasonOf(flip54)._tag, "UnknownError");
        const flip55 = yield* Effect.flip(sql.unsafe("SELECT ? AS x", [[2, [1]]]));
        assert.strictEqual(reasonOf(flip55)._tag, "UnknownError");
      })
    );

    it.effect(
      "uses UTC as the default session TimeZone",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const value56 = yield* sql`SELECT current_setting('TimeZone') AS tz`;
        assert.deepStrictEqual(value56, [{ tz: "UTC" }]);
      })
    );

    it.effect(
      "never reuses earlier bindings on a cached statement with short binds",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const text = "SELECT ?::INTEGER AS a, ?::INTEGER AS b";
        const unsafe57 = yield* sql.unsafe(text, [1, 2]);
        assert.deepStrictEqual(unsafe57, [{ a: 1, b: 2 }]);
        const error = yield* Effect.flip(sql.unsafe(text, [3]));
        assert.strictEqual(reasonOf(error)._tag, "UnknownError");
        const unsafe58 = yield* sql.unsafe(text, [4, 5]);
        assert.deepStrictEqual(unsafe58, [{ a: 4, b: 5 }]);
      })
    );

    it.effect(
      "re-resolves cached bound statements after USE and SET schema",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        const sql = client;
        yield* client.attach(":memory:", "use_aux");
        yield* sql`CREATE TABLE use_aux.use_t (src INTEGER)`;
        yield* sql`INSERT INTO use_aux.use_t VALUES (42)`;
        yield* sql`CREATE TABLE memory.main.use_t (src VARCHAR)`;
        yield* sql`INSERT INTO memory.main.use_t VALUES ('main')`;
        yield* sql`CREATE SCHEMA memory.use_s2`;
        yield* sql`CREATE TABLE memory.use_s2.use_t (src INTEGER, extra INTEGER)`;
        yield* sql`INSERT INTO memory.use_s2.use_t VALUES (2, 3)`;
        // A bind keeps the statement on the prepared cache path (D44); each
        // context switch changes the resolved table and its result shape.
        // DuckDB 1.5.6 re-binds bound statements per execution, so this pins
        // the contract with or without the cache clear (D38).
        const select = sql`SELECT * FROM use_t WHERE ${1} = 1`;
        const main = [{ src: "main" }];
        const select59 = yield* select;
        assert.deepStrictEqual(select59, main);
        const select60 = yield* select;
        assert.deepStrictEqual(select60, main);
        yield* sql`USE use_aux`;
        const select61 = yield* select;
        assert.deepStrictEqual(select61, [{ src: 42 }]);
        yield* sql`USE memory`;
        const select62 = yield* select;
        assert.deepStrictEqual(select62, main);
        yield* sql`SET schema = 'use_s2'`;
        const select63 = yield* select;
        assert.deepStrictEqual(select63, [{ src: 2, extra: 3 }]);
        yield* sql`RESET schema`;
        const select64 = yield* select;
        assert.deepStrictEqual(select64, main);
        yield* sql`SET search_path = 'use_s2'`;
        const select65 = yield* select;
        assert.deepStrictEqual(select65, [{ src: 2, extra: 3 }]);
        yield* sql`RESET search_path`;
        const select66 = yield* select;
        assert.deepStrictEqual(select66, main);
        yield* client.detach("use_aux");
      })
    );

    it.effect(
      "re-resolves cached bound statements after multi-statement text that sets the schema",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE SCHEMA memory.multi_ctx_s`;
        yield* sql`CREATE TABLE memory.main.multi_ctx_t (src VARCHAR)`;
        yield* sql`INSERT INTO memory.main.multi_ctx_t VALUES ('main')`;
        yield* sql`CREATE TABLE memory.multi_ctx_s.multi_ctx_t (src INTEGER)`;
        yield* sql`INSERT INTO memory.multi_ctx_s.multi_ctx_t VALUES (7)`;
        const select = sql`SELECT src FROM multi_ctx_t WHERE ${1} = 1`;
        const select67 = yield* select;
        assert.deepStrictEqual(select67, [{ src: "main" }]);
        // A catalog-context statement inside multi-statement text is not transaction
        // control, so the text runs and the context switch is still tracked.
        yield* sql.unsafe("SET schema = 'multi_ctx_s'; SELECT 1");
        const select68 = yield* select;
        assert.deepStrictEqual(select68, [{ src: 7 }]);
        yield* sql.unsafe("SELECT 1; RESET schema");
        const select69 = yield* select;
        assert.deepStrictEqual(select69, [{ src: "main" }]);
      })
    );

    it.effect(
      "streams the last result of multi-statement schema switches and refreshes cached statements",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE SCHEMA memory.stream_ctx_s`;
        yield* sql`CREATE TABLE memory.main.stream_ctx_t (src VARCHAR)`;
        yield* sql`INSERT INTO memory.main.stream_ctx_t VALUES ('main')`;
        yield* sql`CREATE TABLE memory.stream_ctx_s.stream_ctx_t (src INTEGER)`;
        yield* sql`INSERT INTO memory.stream_ctx_s.stream_ctx_t VALUES (7)`;
        const select = sql`SELECT src FROM stream_ctx_t WHERE ${1} = 1`;
        const select70 = yield* select;
        assert.deepStrictEqual(select70, [{ src: "main" }]);
        const pipe71 = yield* sql
          .unsafe("SET schema = 'stream_ctx_s'; SELECT src FROM stream_ctx_t")
          .stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(pipe71, [{ src: 7 }]);
        const select72 = yield* select;
        assert.deepStrictEqual(select72, [{ src: 7 }]);
        const pipe73 = yield* sql.unsafe("RESET schema; SELECT src FROM stream_ctx_t").stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(pipe73, [{ src: "main" }]);
        const select74 = yield* select;
        assert.deepStrictEqual(select74, [{ src: "main" }]);
      })
    );

    it.effect(
      "pins DECIMAL widening rules",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE widen (x DECIMAL(10,2))`;
        yield* sql`INSERT INTO widen VALUES (1.25), (2.50)`;
        const [row] = yield* sql<Record<string, unknown>>`SELECT x, x * 2 AS d FROM widen WHERE x = 2.5`;
        assert.deepStrictEqual(row, { x: 2.5, d: "5.00" });
        const value75 = yield* sql`SELECT sum(x) AS s, avg(x) AS a FROM widen`;
        assert.deepStrictEqual(value75, [{ s: "3.75", a: 1.875 }]);
      })
    );

    it.effect(
      "interrupts a long-running query and keeps the connection usable",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [elapsed, exit] = yield* sql`SELECT count(*) AS n FROM range(20000000000)`.pipe(
          Effect.timeout("200 millis"),
          Effect.exit,
          Effect.timed,
          TestClock.withLive
        );
        pipe(exit, Exit.isFailure, assertTrue);
        assert.isBelow(Duration.toMillis(elapsed), 2000);
        const value76 = yield* sql`SELECT 1 AS one`;
        assert.deepStrictEqual(value76, [{ one: 1 }]);
      })
    );

    it.effect(
      "streams rows incrementally outside a transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const resultCount77 = yield* Stream.runCount(sql`SELECT range AS i FROM range(10000)`.stream);
        assert.strictEqual(resultCount77, 10000);
        const firstThree = yield* Stream.runCollect(
          Stream.take(sql<{ readonly i: number }>`SELECT range AS i FROM range(10000)`.stream, 3)
        );
        assert.deepStrictEqual(firstThree, [{ i: 0 }, { i: 1 }, { i: 2 }]);
        const value78 = yield* sql`SELECT 1 AS one`;
        assert.deepStrictEqual(value78, [{ one: 1 }]);
      })
    );

    it.effect(
      "cancels a stream during its first native pull and releases the op lock",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        // No row matches, so the first pull scans the whole range until it is cancelled.
        const [elapsed, exit] = yield* sql`SELECT range AS i FROM range(20000000000) WHERE range % 7 = 99`.stream.pipe(
          Stream.runCount,
          Effect.timeout("300 millis"),
          Effect.exit,
          Effect.timed,
          TestClock.withLive
        );
        pipe(exit, Exit.isFailure, assertTrue);
        assert.isBelow(Duration.toMillis(elapsed), 2000);
        const value79 = yield* sql`SELECT ${1} AS n`;
        assert.deepStrictEqual(value79, [{ n: 1 }]);
      })
    );

    it.effect(
      "releases the op lock when a blocked stream consumer is interrupted between pulls",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE stream_cancel_t (id INTEGER)`;
        const exit = yield* sql<{ readonly i: number }>`SELECT range AS i FROM range(10000)`.stream.pipe(
          Stream.runForEach((row) => (row.i === 5 ? Effect.never : Effect.void)),
          Effect.timeout("300 millis"),
          Effect.exit,
          TestClock.withLive
        );
        pipe(exit, Exit.isFailure, assertTrue);
        const value80 = yield* sql`SELECT ${2} AS n`;
        assert.deepStrictEqual(value80, [{ n: 2 }]);
        yield* sql.withTransaction(sql`INSERT INTO stream_cancel_t VALUES (${1})`);
        const value81 = yield* sql`SELECT id FROM stream_cancel_t`;
        assert.deepStrictEqual(value81, [{ id: 1 }]);
      })
    );

    it.effect(
      "materializes a stream inside withTransaction so per-row statements see every row",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        // 10000 rows: well past the 2048-row native chunk where a non-materialized stream truncates.
        const count = yield* sql<{ readonly i: number }>`SELECT range AS i FROM range(10000)`.stream.pipe(
          Stream.mapEffect((row) => sql`SELECT ${row.i} AS v`),
          Stream.runCount,
          sql.withTransaction
        );
        assert.strictEqual(count, 10000);
      })
    );

    it.effect(
      "sees a column added by ALTER TABLE through a cached statement",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE alter_t (a INTEGER)`;
        yield* sql`INSERT INTO alter_t VALUES (1)`;
        const select = sql`SELECT * FROM alter_t`;
        const select82 = yield* select;
        assert.deepStrictEqual(select82, [{ a: 1 }]);
        yield* sql`ALTER TABLE alter_t ADD COLUMN b INTEGER DEFAULT 7`;
        const select83 = yield* select;
        assert.deepStrictEqual(select83, [{ a: 1, b: 7 }]);
      })
    );

    it.effect(
      "reuses one cached statement for concurrent inserts inside a transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE conc_tx (i INTEGER)`;
        yield* sql.withTransaction(
          Effect.all(
            A.makeBy(20, (i) => sql`INSERT INTO conc_tx VALUES (${i})`),
            { concurrency: "unbounded" }
          )
        );
        const value84 = yield* sql`SELECT count(DISTINCT i) AS n, count(*) AS c FROM conc_tx`;
        assert.deepStrictEqual(value84, [{ n: 20, c: 20 }]);
      })
    );

    it.effect(
      "appends complete rows and guards a caught failed flush",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        yield* client`CREATE TABLE appended (id INTEGER PRIMARY KEY, xs INTEGER[], data JSON)`;
        yield* client.appendRows({ table: "appended", rows: [[1, [null, 7], { ok: true }]] });
        yield* client.withTransaction(client.appendRows({ table: "appended", rows: [[2, [], null]] }));
        yield* client
          .withTransaction(
            client
              .appendRows({ table: "appended", rows: [[3, [], null]] })
              .pipe(Effect.andThen(Effect.fail("rollback")))
          )
          .pipe(Effect.flip);
        const value85 = yield* client`SELECT id, xs FROM appended ORDER BY id`;
        assert.deepStrictEqual(value85, [
          { id: 1, xs: [null, 7] },
          { id: 2, xs: [] },
        ]);
        const duplicate = yield* Effect.flip(
          client.appendRows({
            table: "appended",
            rows: [
              [4, [], null],
              [1, [], null],
            ],
          })
        );
        assert.strictEqual(duplicate.reason._tag, "UniqueViolation");
        const refused = yield* Effect.flip(
          client.withTransaction(
            Effect.gen(function* () {
              yield* client`INSERT INTO appended VALUES (5, [], NULL)`;
              yield* client.appendRows({ table: "appended", rows: [[1, [], null]] }).pipe(Effect.ignore);
            })
          )
        );
        assertUnknownError(refused, "commitTransaction");
        const value86 = yield* client`SELECT id FROM appended ORDER BY id`;
        assert.deepStrictEqual(value86, [{ id: 1 }, { id: 2 }]);
        const flip87 = yield* Effect.flip(client.appendRows({ table: "appended", rows: [[6]] }));
        assertUnknownError(flip87, "appendRows");
        const flip88 = yield* Effect.flip(client.appendRows({ table: "appended", rows: [["bad", [], null]] }));
        assertUnknownError(flip88, "appendRows");
        const flip89 = yield* Effect.flip(client.appendRows({ table: "appended", rows: [[Symbol("bad"), [], null]] }));
        assertUnknownError(flip89, "appendRows");
        yield* client.appendRows({ table: "appended", rows: [] });
        yield* client`CREATE TABLE append_required (id INTEGER NOT NULL)`;
        const constraint = yield* client.appendRows({ table: "append_required", rows: [[null]] }).pipe(Effect.flip);
        assert.strictEqual(constraint.reason._tag, "ConstraintError");
        yield* client`CREATE SCHEMA append_schema`;
        yield* client`CREATE TABLE append_schema.scoped (id INTEGER)`;
        yield* client.appendRows({ table: "scoped", schema: "append_schema", rows: [[42]] });
        const value90 = yield* client`SELECT * FROM append_schema.scoped`;
        assert.deepStrictEqual(value90, [{ id: 42 }]);
      })
    );

    it.effect("discards buffered rows when a later append value fails", () =>
      Effect.gen(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        yield* client`CREATE TABLE append_failed_batch (id INTEGER)`;
        for (const bad of ["bad", Symbol("bad")]) {
          const error = yield* client
            .appendRows({ table: "append_failed_batch", rows: [[1], [bad]] })
            .pipe(Effect.flip);
          assertUnknownError(error, "appendRows");
          const value91 = yield* client`SELECT * FROM append_failed_batch`;
          assert.deepStrictEqual(value91, []);
        }
        yield* client.appendRows({ table: "append_failed_batch", rows: [[1], [2]] });
        const value92 = yield* client`SELECT * FROM append_failed_batch ORDER BY id`;
        assert.deepStrictEqual(value92, [{ id: 1 }, { id: 2 }]);
      })
    );

    it.effect(
      "runs driver extras",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        yield* client.checkpoint();
        yield* client.checkpoint({ force: true });

        const refused = yield* Effect.flip(client.withTransaction(client.checkpoint()));
        assertUnknownError(refused, "checkpoint");

        yield* client.attach(":memory:", "extras_aux");
        const value93 = yield* client`SELECT database_name FROM duckdb_databases() WHERE database_name = 'extras_aux'`;
        assert.deepStrictEqual(value93, [{ database_name: "extras_aux" }]);
        yield* client.detach("extras_aux");
        const value94 = yield* client`SELECT database_name FROM duckdb_databases() WHERE database_name = 'extras_aux'`;
        assert.deepStrictEqual(value94, []);

        const rolledBack = yield* Effect.flip(
          client.withTransaction(client.attach(":memory:", "extras_rb").pipe(Effect.andThen(Effect.fail("rollback"))))
        );
        assert.strictEqual(rolledBack, "rollback");
        const value95 = yield* client`SELECT database_name FROM duckdb_databases() WHERE database_name = 'extras_rb'`;
        assert.deepStrictEqual(value95, []);

        yield* client.loadExtension("json");
        const flip96 = yield* Effect.flip(client.loadExtension("not_an_extension_xyz"));
        assertUnknownError(flip96, "loadExtension");
      })
    );

    it.effect(
      "compiles identifiers with and without a transform",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const statement = sql`SELECT ${sql("someName")} FROM ${sql("someTable")} WHERE id = ${1}`;
        const transformed = DuckDbClient.makeCompiler(Str.camelToSnake);
        assert.deepStrictEqual(transformed.compile(statement, false), [
          'SELECT "some_name" FROM "some_table" WHERE id = ?',
          [1],
        ]);
        assert.deepStrictEqual(transformed.compile(statement, true), [
          'SELECT "someName" FROM "someTable" WHERE id = ?',
          [1],
        ]);
        assert.deepStrictEqual(DuckDbClient.makeCompiler().compile(statement, false), [
          'SELECT "someName" FROM "someTable" WHERE id = ?',
          [1],
        ]);
        assert.strictEqual(transformed.dialect, "sqlite");
      })
    );
  });

  it.layer(
    Layer.mergeAll(DuckDbClient.layerClient({ databasePath: ":memory:" }), FileSystem.layerNoop({}), Path.layer),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect(
      "layerClient provides DuckDbClient only",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        assert.strictEqual(client[DuckDbClient.TypeId], DuckDbClient.TypeId);
        const serviceOption97 = yield* Effect.serviceOption(SqlClient.SqlClient);
        assertNone(serviceOption97);
      })
    );

    it.effect(
      "runs DuckDbMigrator against the DuckDB client",
      Effect.fnUntraced(function* () {
        const loader = DuckDbMigrator.fromRecord({
          "1_init": Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`CREATE TABLE migrated (id INTEGER PRIMARY KEY, value VARCHAR)`;
          }),
          "2_seed": Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`INSERT INTO migrated VALUES (1, 'hello')`;
          }),
        });
        const completed = yield* DuckDbMigrator.run({ loader }).pipe(
          Effect.provideServiceEffect(SqlClient.SqlClient, Effect.service(DuckDbClient.DuckDbClient))
        );
        assert.deepStrictEqual(completed, [
          [1, "init"],
          [2, "seed"],
        ]);
        const client = yield* DuckDbClient.DuckDbClient;
        const value98 = yield* client`SELECT value FROM migrated`;
        assert.deepStrictEqual(value98, [{ value: "hello" }]);
        const again = yield* DuckDbMigrator.run({ loader }).pipe(
          Effect.provideServiceEffect(SqlClient.SqlClient, Effect.service(DuckDbClient.DuckDbClient))
        );
        assert.deepStrictEqual(again, []);
      })
    );
  });

  it.layer(DuckDbTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "DuckDbTestLayer answers select 1",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const value99 = yield* sql`SELECT 1 AS one`;
        assert.deepStrictEqual(value99, [{ one: 1 }]);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", timeZone: "America/Chicago" }), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "keeps TIMESTAMPTZ instants and stores local wall time in naive TIMESTAMP",
        Effect.fnUntraced(function* () {
          const sql = yield* SqlClient.SqlClient;
          const value100 = yield* sql`SELECT current_setting('TimeZone') AS tz`;
          assert.deepStrictEqual(value100, [{ tz: "America/Chicago" }]);
          const instant = CHICAGO_INSTANT;
          yield* sql`CREATE TABLE chicago_dates (ts TIMESTAMP, tz TIMESTAMPTZ)`;
          yield* sql`INSERT INTO chicago_dates VALUES (${instant}, ${instant})`;
          const [row] = yield* sql<{
            readonly tz: unknown;
            readonly wall: string;
          }>`SELECT tz, strftime(ts, '%Y-%m-%d %H:%M:%S') AS wall FROM chicago_dates`;
          assert.strictEqual(instantOf(row?.tz), instant.getTime());
          assert.strictEqual(row?.wall, "2024-01-15 06:00:00");
        })
      );
    }
  );

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", databaseOptions: { TimeZone: "Asia/Tokyo" } }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect(
      "keeps a databaseOptions TimeZone when timeZone is not given",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const value101 = yield* sql`SELECT current_setting('TimeZone') AS tz`;
        assert.deepStrictEqual(value101, [{ tz: "Asia/Tokyo" }]);
      })
    );
  });

  it.layer(
    DuckDbClient.layer({
      databasePath: ":memory:",
      transformQueryNames: Str.camelToSnake,
      transformResultNames: Str.snakeToCamel,
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "transforms names and withoutTransforms returns raw names with extras intact",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        const sql = client;
        yield* sql`CREATE TABLE ${sql("transformPeople")} (${sql("firstName")} VARCHAR)`;
        yield* sql`INSERT INTO ${sql("transformPeople")} ${sql.insert({ firstName: "ada" })}`;
        const value102 = yield* sql`SELECT * FROM transform_people`;
        assert.deepStrictEqual(value102, [{ firstName: "ada" }]);
        const raw = client.withoutTransforms();
        const value103 = yield* raw`SELECT * FROM transform_people`;
        assert.deepStrictEqual(value103, [{ first_name: "ada" }]);
        assert.strictEqual(raw[DuckDbClient.TypeId], DuckDbClient.TypeId);
        assert.isFunction(raw.checkpoint);
        assert.isFunction(raw.attach);
        yield* raw.checkpoint();
      })
    );

    it.effect(
      "applies the null-safe row transform through execute, unprepared and stream",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const query = () =>
          sql`SELECT [NULL, 1]::INTEGER[] AS some_list, [NULL, {'inner_key': 1}] AS some_structs, map {'k': 1} AS some_map`;
        const expected = {
          someList: [null, 1],
          someStructs: [null, { innerKey: 1 }],
          someMap: [{ key: "k", value: 1 }],
        };
        const query104 = yield* query();
        assert.deepStrictEqual(query104, [expected]);
        const unprepared105 = yield* query().unprepared;
        assert.deepStrictEqual(unprepared105, [expected]);
        const resultCollect = yield* Stream.runCollect(query().stream);
        assert.deepStrictEqual(resultCollect, [expected]);
      })
    );

    it.effect(
      "applies transformResultNames to streamed rows",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const resultCollect106 = yield* Stream.runCollect(sql`SELECT range AS some_value FROM range(3)`.stream);
        assert.deepStrictEqual(resultCollect106, [{ someValue: 0 }, { someValue: 1 }, { someValue: 2 }]);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", transformQueryNames: Str.camelToSnake }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect(
      "keeps transforming identifiers under withoutTransforms when only transformQueryNames is set",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const raw = sql.withoutTransforms();
        const value107 = yield* raw`SELECT 1 AS ${raw("someName")}`;
        assert.deepStrictEqual(value107, [{ some_name: 1 }]);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", prepareCacheSize: 1 }), { timeout: "30 seconds" })((it) => {
    it.effect(
      "evicts and re-prepares statements with a one-entry cache",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const results = yield* Effect.forEach(A.range(0, 199), (i) =>
          i % 2 === 0 ? sql`SELECT ${i}::INTEGER AS even` : sql`SELECT ${i}::INTEGER AS odd`
        );
        assert.deepStrictEqual(
          results,
          A.map(A.range(0, 199), (i) => (i % 2 === 0 ? [{ even: i }] : [{ odd: i }]))
        );
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", prepareCacheSize: 0 }), { timeout: "30 seconds" })((it) => {
    it.effect(
      "executes statements with the cache disabled",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const value108 = yield* sql`SELECT ${1}::INTEGER AS v`;
        assert.deepStrictEqual(value108, [{ v: 1 }]);
        const value109 = yield* sql`SELECT ${2}::INTEGER AS v`;
        assert.deepStrictEqual(value109, [{ v: 2 }]);
        const value110 = yield* sql`CREATE TABLE no_cache (i INTEGER); INSERT INTO no_cache VALUES (1), (2)`;
        assert.deepStrictEqual(value110, []);
        const raw111 = yield* sql`SELECT count(*) AS n FROM no_cache`.raw;
        assert.deepStrictEqual(raw111, { changes: 0, rows: [{ n: 2 }] });
        const pipe112 = yield* sql
          .unsafe("SET schema = 'main'; SELECT i FROM no_cache ORDER BY i")
          .stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(pipe112, [{ i: 1 }, { i: 2 }]);
      })
    );
  });

  it.layer(
    DuckDbClient.layerConfig({ databasePath: Config.String("duckdb_path") }).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ duckdb_path: ":memory:" })))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "builds layerConfig from a ConfigProvider",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        assert.strictEqual(client.config.databasePath, ":memory:");
        const value113 = yield* client`SELECT 1 AS one`;
        assert.deepStrictEqual(value113, [{ one: 1 }]);
      })
    );
  });

  it.layer(
    DuckDbClient.layerClientConfig({ databasePath: Config.String("duckdb_path") }).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ duckdb_path: ":memory:" })))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "builds layerClientConfig without the generic SqlClient",
      Effect.fnUntraced(function* () {
        const client = yield* DuckDbClient.DuckDbClient;
        assert.strictEqual(client.config.databasePath, ":memory:");
        const serviceOption114 = yield* Effect.serviceOption(SqlClient.SqlClient);
        assertNone(serviceOption114);
      })
    );
  });

  it.effect(
    "fails a bound statement after the client scope closes with ConnectionError",
    Effect.fnUntraced(function* () {
      const scope = yield* Scope.make();
      const context = yield* Layer.buildWithScope(DuckDbClient.layerClient({ databasePath: ":memory:" }), scope);
      const sql = Context.get(context, DuckDbClient.DuckDbClient);
      yield* sql`SELECT ${1} AS n`;
      yield* Scope.close(scope, Exit.void);
      const bound = yield* Effect.flip(sql`SELECT ${1} AS n`);
      const unbound = yield* Effect.flip(sql`SELECT 1 AS n`);
      assert.strictEqual(reasonOf(bound)._tag, "ConnectionError");
      assert.strictEqual(reasonOf(unbound)._tag, "ConnectionError");
    })
  );

  it.effect.prop(
    "round-trips DuckDbClientConfigData through its encoded form",
    [DuckDbClientConfigData],
    ([value]) =>
      Effect.gen(function* () {
        const decoded = yield* decodeConfigData(value);
        const encodedConfigData = yield* encodeConfigData(decoded);
        const roundTripped = yield* decodeConfigData(encodedConfigData);
        expect(roundTripped).toEqual(decoded);
      }),
    { arbitrary: fcRuns(20) }
  );
});

describe("DuckDbClient reader connections", { concurrent: false }, () => {
  it.layer(DuckDbClient.layer({ databasePath: ":memory:", readerConnections: 1 }), { timeout: "60 seconds" })((it) => {
    it.effect("normalizes unqualified schemas against the reader database and system catalogs", () =>
      Effect.gen(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE SCHEMA unqualified_probe`;
        yield* sql`SET search_path='unqualified_probe,pg_catalog'`;
        const query = sql`SELECT current_setting('search_path') AS path`;
        const pipe115 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe115), [{ path: "memory.unqualified_probe,memory.pg_catalog" }]);
        const query116 = yield* query;
        assert.deepStrictEqual(query116, [{ path: "unqualified_probe,pg_catalog" }]);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", readerConnections: 1 }), { timeout: "60 seconds" })((it) => {
    it.effect(
      "resolves reader paths against committed schemas during a writer transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE main.probe_t AS SELECT 1 AS v`;
        yield* sql`CREATE SCHEMA probe_s`;
        yield* sql`CREATE TABLE probe_s.probe_t AS SELECT 42 AS v`;
        yield* sql`USE memory.probe_s`;
        const query = sql`SELECT v FROM probe_t`;
        const path = sql`SELECT current_setting('search_path') AS path`;
        const pipe117 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe117), [{ v: 42 }]);
        // DuckDB 2.0 resets the writer's path as soon as its schema is dropped,
        // even uncommitted, and ROLLBACK does not restore it: the lease mirrors that.
        yield* sql`BEGIN`;
        yield* sql`DROP SCHEMA probe_s CASCADE`;
        const path118 = yield* path;
        assert.deepStrictEqual(path118, [{ path: "memory.main" }]);
        const pipe119 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe119), [{ v: 1 }]);
        yield* sql`ROLLBACK`;
        const pipe120 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe120), [{ v: 1 }]);
        // The rolled-back schema is still in the reader's committed catalog.
        yield* sql`USE memory.probe_s`;
        const pipe121 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe121), [{ v: 42 }]);
        // The reused lease must normalize again after COMMIT, then see recreation.
        yield* sql`BEGIN`;
        yield* sql`DROP SCHEMA probe_s CASCADE`;
        yield* sql`COMMIT`;
        const pipe122 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe122), [{ v: 1 }]);
        yield* sql`CREATE SCHEMA probe_s`;
        yield* sql`CREATE TABLE probe_s.probe_t AS SELECT 99 AS v`;
        yield* sql`USE memory.probe_s`;
        const pipe123 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe123), [{ v: 99 }]);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", readerConnections: 1 }), { timeout: "60 seconds" })((it) => {
    it.effect(
      "filters dangling qualified paths for fresh and resynchronized reader leases",
      Effect.fnUntraced(function* () {
        // This isolated layer guarantees the first lease has no applied snapshot.
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE main.probe_t AS SELECT 1 AS v`;
        yield* sql`CREATE SCHEMA probe_s`;
        yield* sql`USE memory.probe_s`;
        yield* sql`DROP SCHEMA probe_s`;
        const query = sql`SELECT v, current_setting('TimeZone') AS zone FROM probe_t`;
        const writerPath = yield* sql`SELECT current_setting('search_path') AS path`;
        // DuckDB 2.0 resets the path when its schema is dropped instead of keeping it dangling.
        assert.deepStrictEqual(writerPath, [{ path: "memory.main" }]);
        const pipe124 = yield* query.stream.pipe(Stream.runCollect);
        const argument = A.fromIterable(pipe124);
        const query1 = yield* query;
        assert.deepStrictEqual(argument, query1);
        yield* sql`SET TimeZone='Asia/Tokyo'`;
        const pipe125 = yield* query.stream.pipe(Stream.runCollect);
        const argument1 = A.fromIterable(pipe125);
        const query2 = yield* query;
        assert.deepStrictEqual(argument1, query2);
        const value126 = yield* sql`SELECT current_setting('search_path') AS path`;
        assert.deepStrictEqual(value126, writerPath);
        yield* sql`CREATE SCHEMA probe_s`;
        yield* sql`CREATE TABLE probe_s.probe_t AS SELECT 42 AS v`;
        yield* sql`USE memory.probe_s`;
        const query127 = yield* query;
        assert.deepStrictEqual(query127, [{ v: 42, zone: "Asia/Tokyo" }]);
        const pipe128 = yield* query.stream.pipe(Stream.runCollect);
        const argument2 = A.fromIterable(pipe128);
        const query3 = yield* query;
        assert.deepStrictEqual(argument2, query3);
        yield* sql`DROP SCHEMA probe_s CASCADE`;
        const pipe129 = yield* query.stream.pipe(Stream.runCollect);
        const argument3 = A.fromIterable(pipe129);
        const query4 = yield* query;
        assert.deepStrictEqual(argument3, query4);
        yield* sql`CREATE OR REPLACE SCHEMA probe_s`;
        yield* sql`CREATE TABLE probe_s.probe_t AS SELECT 99 AS v`;
        yield* sql`USE memory.probe_s`;
        const query130 = yield* query;
        assert.deepStrictEqual(query130, [{ v: 99, zone: "Asia/Tokyo" }]);
        const pipe131 = yield* query.stream.pipe(Stream.runCollect);
        const argument4 = A.fromIterable(pipe131);
        const query5 = yield* query;
        assert.deepStrictEqual(argument4, query5);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", readerConnections: 1 }), { timeout: "60 seconds" })((it) => {
    it.effect(
      "preserves valid path order and quoted identifiers around dropped entries",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE SCHEMA "first,.schema"`;
        yield* sql`CREATE SCHEMA "second""schema"`;
        yield* sql`CREATE SCHEMA gone`;
        yield* sql`CREATE TABLE "first,.schema".probe_t AS SELECT 42 AS v`;
        yield* sql`CREATE TABLE "second""schema".probe_t AS SELECT 99 AS v`;
        yield* sql`SET search_path='memory.gone,memory."first,.schema",memory."second""schema"'`;
        yield* sql`DROP SCHEMA gone`;
        // DuckDB 2.0 resets the whole path when one of its schemas is dropped.
        const value132 = yield* sql`SELECT current_setting('search_path') AS path`;
        assert.deepStrictEqual(value132, [{ path: "memory.main" }]);
        yield* sql`SET search_path='memory."first,.schema",memory."second""schema"'`;
        const query = sql`SELECT v FROM probe_t`;
        const pipe133 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe133), [{ v: 42 }]);
        const query134 = yield* query;
        assert.deepStrictEqual(query134, [{ v: 42 }]);
        const pipe135 = yield* sql`SELECT current_setting('search_path') AS path`.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe135), [{ path: 'memory."first,.schema",memory."second""schema"' }]);
        yield* sql`SET search_path='MEMORY."FIRST,.SCHEMA",system.pg_catalog,memory."second""schema"'`;
        const settings = sql`SELECT current_setting('search_path') AS path`;
        const pipe136 = yield* settings.stream.pipe(Stream.runCollect);
        const argument5 = A.fromIterable(pipe136);
        const settings6 = yield* settings;
        assert.deepStrictEqual(argument5, settings6);
        const pipe137 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe137), [{ v: 42 }]);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", readerConnections: 1 }), { timeout: "60 seconds" })((it) => {
    it.effect(
      "retains native DETACH snapshot failures and recovers after resetting the path",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE main.probe_t AS SELECT 1 AS v`;
        yield* sql`ATTACH ':memory:' AS detached`;
        yield* sql`CREATE TABLE detached.main.probe_t AS SELECT 42 AS v`;
        yield* sql`SET search_path='memory.main,detached.main'`;
        const query = sql`SELECT v FROM probe_t`;
        const pipe138 = yield* query.stream.pipe(Stream.runCollect);
        const argument6 = A.fromIterable(pipe138);
        const query7 = yield* query;
        assert.deepStrictEqual(argument6, query7);
        yield* sql`DETACH detached`;
        // DuckDB cannot bind even current_setting() while a detached catalog
        // remains in the path. Snapshot refresh records this native failure.
        const writerError = yield* query.pipe(Effect.flip);
        const readerError = yield* query.stream.pipe(Stream.runCollect, Effect.flip);
        assert.strictEqual(writerError.reason._tag, "SqlSyntaxError");
        assert.strictEqual(readerError.reason._tag, writerError.reason._tag);
        yield* sql`ATTACH ':memory:' AS detached`;
        const pipe139 = yield* query.stream.pipe(Stream.runCollect);
        const argument7 = A.fromIterable(pipe139);
        const query8 = yield* query;
        assert.deepStrictEqual(argument7, query8);
        yield* sql`DETACH detached`;
        assert.strictEqual((yield* query.stream.pipe(Stream.runCollect, Effect.flip)).reason._tag, "SqlSyntaxError");
        yield* sql`RESET search_path`;
        const pipe140 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe140), [{ v: 1 }]);
        yield* sql`SET TimeZone='Asia/Tokyo'`;
        const pipe141 = yield* query.stream.pipe(Stream.runCollect);
        const argument8 = A.fromIterable(pipe141);
        const query9 = yield* query;
        assert.deepStrictEqual(argument8, query9);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:", readerConnections: 1 }), { timeout: "60 seconds" })((it) => {
    it.effect(
      "streams 10000 rows while every consumer statement uses the writer",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE reader_consumed (v BIGINT)`;
        yield* sql<{ readonly v: number }>`SELECT range AS v FROM range(10000)`.stream.pipe(
          Stream.runForEach((row) => sql`INSERT INTO reader_consumed VALUES (${row.v})`)
        );
        const value142 = yield* sql`SELECT count(*) AS n, sum(v) AS total FROM reader_consumed`;
        assert.deepStrictEqual(value142, [{ n: 10000, total: 49995000 }]);
      })
    );

    it.effect(
      "refuses a streamed write and returns the reader after failure",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE reader_write (v INTEGER)`;
        const error = yield* sql`INSERT INTO reader_write VALUES (1) RETURNING v`.stream.pipe(
          Stream.runCollect,
          Effect.flip
        );
        assert.strictEqual(error.reason._tag, "AuthorizationError");
        const value143 = yield* sql`SELECT * FROM reader_write`;
        assert.deepStrictEqual(value143, []);
        const pipe144 = yield* sql`SELECT 42 AS v`.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe144), [{ v: 42 }]);
      })
    );

    it.effect(
      "mirrors accumulated catalog and schema state, including failed text",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`ATTACH ':memory:' AS reader_a`;
        yield* sql`CREATE SCHEMA reader_a.s`;
        yield* sql`CREATE TABLE reader_a.s.t AS SELECT 42 AS v`;
        // The original catalog deliberately has no schema s.
        yield* sql.unsafe("USE reader_a; SET search_path = 's'");
        const pipe145 = yield* sql`SELECT v FROM t`.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe145), [{ v: 42 }]);
        yield* sql`CREATE SCHEMA memory.s`;
        yield* sql`CREATE TABLE memory.s.t AS SELECT 1 AS v`;
        const pipe146 = yield* sql`SELECT v FROM t`.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe146), [{ v: 42 }]);
        yield* sql`USE memory`;
        yield* sql.unsafe("USE reader_a; SELECT * FROM missing").pipe(Effect.flip);
        const pipe147 = yield* sql`SELECT current_database() AS db`.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe147), [{ db: "reader_a" }]);
        yield* sql`USE memory`;
        yield* sql`RESET search_path`;
      })
    );

    it.effect(
      "refreshes search_path after dropping and recreating the current schema",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE main.reader_drop_t AS SELECT 1 AS v`;
        yield* sql`CREATE SCHEMA reader_drop`;
        yield* sql`CREATE TABLE reader_drop.reader_drop_t AS SELECT 42 AS v`;
        yield* sql`SET search_path='reader_drop'`;
        const query = sql`SELECT v FROM reader_drop_t`;
        const pipe148 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe148), [{ v: 42 }]);
        yield* sql.unsafe(
          "DROP SCHEMA reader_drop CASCADE; CREATE SCHEMA reader_drop; CREATE TABLE reader_drop.reader_drop_t AS SELECT 99 AS v"
        );
        const query149 = yield* query;
        assert.deepStrictEqual(query149, [{ v: 1 }]);
        const pipe150 = yield* query.stream.pipe(Stream.runCollect);
        const argument9 = A.fromIterable(pipe150);
        const query10 = yield* query;
        assert.deepStrictEqual(argument9, query10);
        yield* sql`SET search_path='reader_drop'`;
        const pipe151 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe151), [{ v: 99 }]);
        yield* sql`DROP SCHEMA IF EXISTS reader_drop CASCADE`;
        const pipe152 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe152), [{ v: 1 }]);
        yield* sql`RESET search_path`;
      })
    );

    it.effect(
      "mirrors TimeZone and Calendar and refreshes after failed SET text",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        const query = sql`SELECT date_trunc('day', TIMESTAMPTZ '2024-01-15 12:00:00+00') AS day, current_setting('TimeZone') AS zone, current_setting('Calendar') AS calendar`;
        yield* sql`PRAGMA TimeZone = 'Asia/Tokyo'`;
        const pipe153 = yield* query.stream.pipe(Stream.runCollect);
        const argument10 = A.fromIterable(pipe153);
        const query11 = yield* query;
        assert.deepStrictEqual(argument10, query11);
        yield* sql`PRAGMA Calendar = 'japanese'`;
        const pipe154 = yield* query.stream.pipe(Stream.runCollect);
        const argument11 = A.fromIterable(pipe154);
        const query12 = yield* query;
        assert.deepStrictEqual(argument11, query12);
        yield* sql`SET TimeZone = 'Pacific/Kiritimati'`;
        yield* sql`SET Calendar = 'japanese'`;
        const pipe155 = yield* query.stream.pipe(Stream.runCollect);
        const argument12 = A.fromIterable(pipe155);
        const query13 = yield* query;
        assert.deepStrictEqual(argument12, query13);
        yield* sql.unsafe("SET TimeZone='Asia/Tokyo'; SELECT * FROM missing").pipe(Effect.flip);
        const pipe156 = yield* query.stream.pipe(Stream.runCollect);
        const argument13 = A.fromIterable(pipe156);
        const query14 = yield* query;
        assert.deepStrictEqual(argument13, query14);
        const value157 = yield* sql`SELECT current_setting('TimeZone') AS zone`;
        assert.deepStrictEqual(value157, [{ zone: "Asia/Tokyo" }]);
        yield* sql`SET Calendar = 'gregorian'`;
        yield* sql`SET TimeZone = 'UTC'`;
      })
    );

    it.effect(
      "refuses reader session changes without leaking them to the next lease",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        for (const text of [
          "USE reader_a; SELECT 1",
          "SET TimeZone='Asia/Tokyo'; SELECT 1",
          "RESET TimeZone; SELECT 1",
          "PRAGMA TimeZone='Asia/Tokyo'; SELECT 1",
          "PRAGMA Calendar='japanese'; SELECT 1",
          "PRAGMA search_path='s'; SELECT 1",
          "COMMIT",
          "/* before */ SET search_path='s'; SELECT 1",
        ]) {
          const error = yield* sql.unsafe(text).stream.pipe(Stream.runCollect, Effect.flip);
          assert.strictEqual(error.reason._tag, "AuthorizationError");
          const query = sql`SELECT current_database() AS db, current_setting('search_path') AS path, current_setting('TimeZone') AS zone`;
          const pipe158 = yield* query.stream.pipe(Stream.runCollect);
          const argument14 = A.fromIterable(pipe158);
          const query15 = yield* query;
          assert.deepStrictEqual(argument14, query15);
        }
      })
    );

    it.effect(
      "returns an interrupted reader lease to the pool",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        const started = yield* Deferred.make<void>();
        const fiber = yield* sql`SELECT * FROM range(10000)`.stream.pipe(
          Stream.runForEach(() => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never))),
          Effect.forkChild
        );
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
        const pipe159 = yield* sql`SELECT 7 AS v`.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe159), [{ v: 7 }]);
      })
    );

    it.effect(
      "reads committed state beside the writer's open transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TABLE reader_isolation (v INTEGER)`;
        yield* sql`INSERT INTO reader_isolation VALUES (1)`;
        const beginRead = yield* Deferred.make<void>();
        const finishedRead = yield* Deferred.make<void>();
        const fiber = yield* Deferred.await(beginRead).pipe(
          Effect.andThen(sql`SELECT v FROM reader_isolation`.stream.pipe(Stream.runCollect)),
          Effect.tap(() => Deferred.succeed(finishedRead, undefined)),
          Effect.forkChild
        );
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`INSERT INTO reader_isolation VALUES (2)`;
            yield* Deferred.succeed(beginRead, undefined);
            yield* Deferred.await(finishedRead);
          })
        );
        const join160 = yield* Fiber.join(fiber);
        assert.deepStrictEqual(A.fromIterable(join160), [{ v: 1 }]);
      })
    );

    it.effect(
      "recovers the reader snapshot after an aborted session-changing writer transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        for (const finish of ["ROLLBACK", "COMMIT"]) {
          yield* sql`BEGIN`;
          yield* sql.unsafe("SET TimeZone='Asia/Tokyo'; SELECT CAST('bad' AS INTEGER)").pipe(Effect.flip);
          yield* sql`SELECT 1`.stream.pipe(Stream.runCollect, Effect.flip);
          if (finish === "COMMIT") {
            yield* sql.unsafe(finish).pipe(Effect.flip);
          } else {
            yield* sql.unsafe(finish);
          }
          const query = sql`SELECT current_setting('TimeZone') AS zone`;
          const pipe161 = yield* query.stream.pipe(Stream.runCollect);
          const argument15 = A.fromIterable(pipe161);
          const query16 = yield* query;
          assert.deepStrictEqual(argument15, query16);
          yield* sql`SET TimeZone='UTC'`;
        }
      })
    );

    it.effect(
      "refreshes session settings after a reserved writer stream, including failure",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        // The reservation must close before the next stream borrows a reader.
        const successfulLease = yield* Scope.make();
        yield* Effect.gen(function* () {
          const writer = yield* sql.reserve;
          yield* writer.executeStream("SET TimeZone='Asia/Tokyo'; SELECT 1", [], undefined).pipe(Stream.runDrain);
        }).pipe(Scope.use(successfulLease));
        const query = sql`SELECT current_setting('TimeZone') AS zone`;
        const pipe162 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe162), [{ zone: "Asia/Tokyo" }]);
        const failedLease = yield* Scope.make();
        yield* Effect.gen(function* () {
          const writer = yield* sql.reserve;
          yield* writer
            .executeStream("SET TimeZone='Pacific/Kiritimati'; SELECT * FROM missing", [], undefined)
            .pipe(Stream.runDrain, Effect.flip);
        }).pipe(Scope.use(failedLease));
        const pipe163 = yield* query.stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe163), [{ zone: "Pacific/Kiritimati" }]);
        const pipe164 = yield* sql.unsafe("").stream.pipe(Stream.runCollect);
        assert.deepStrictEqual(A.fromIterable(pipe164), []);
        yield* sql`SET TimeZone='UTC'`;
      })
    );

    it.effect(
      "keeps temporary tables and macros on the writer",
      Effect.fnUntraced(function* () {
        const sql = yield* DuckDbClient.DuckDbClient;
        yield* sql`CREATE TEMP TABLE reader_temp AS SELECT 1 AS v`;
        yield* sql`CREATE TEMP MACRO reader_temp_macro() AS 1`;
        const value165 = yield* sql`SELECT * FROM reader_temp`;
        assert.deepStrictEqual(value165, [{ v: 1 }]);
        for (const text of ["SELECT * FROM reader_temp", "SELECT reader_temp_macro() AS v"]) {
          const error = yield* sql.unsafe(text).stream.pipe(Stream.runCollect, Effect.flip);
          assert.strictEqual(error.reason._tag, "SqlSyntaxError");
        }
      })
    );
  });

  for (const config of [
    { databasePath: ":memory:", readerConnections: 1 },
    { databasePath: ":memory:", readerConnections: 1, timeZone: "Pacific/Kiritimati" },
    { databasePath: ":memory:", readerConnections: 1, databaseOptions: { TimeZone: "Asia/Tokyo" } },
  ]) {
    it.layer(DuckDbClient.layer(config), { timeout: "30 seconds" })((it) => {
      it.effect(
        `matches the writer TimeZone at connect (${config.timeZone ?? config.databaseOptions?.TimeZone ?? "default"})`,
        Effect.fnUntraced(function* () {
          const sql = yield* DuckDbClient.DuckDbClient;
          const query = sql`SELECT current_setting('TimeZone') AS zone`;
          const pipe166 = yield* query.stream.pipe(Stream.runCollect);
          const argument16 = A.fromIterable(pipe166);
          const query17 = yield* query;
          assert.deepStrictEqual(argument16, query17);
        })
      );
    });
  }
});
