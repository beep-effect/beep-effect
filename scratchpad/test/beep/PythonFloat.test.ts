import { assert, describe, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { toPgTable } from "@beep/effect-drizzle/pg";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/Arbitrary";
import { Model, pg } from "../../beep/Kit.ts";
import { PythonFloat } from "../../beep/PythonFloat.ts";

const decodePythonFloat = S.decodeUnknownEffect(PythonFloat);

const PythonFloatJson = S.toCodecJson(PythonFloat);

const encodePythonFloatJson = S.encodeEffect(PythonFloatJson);

const decodePythonFloatJson = S.decodeUnknownEffect(PythonFloatJson);

const isFiniteNumber = S.is(S.Finite);

const pythonFloatArbitrary = Arbitrary.schema(PythonFloat);

describe("PythonFloat", () => {
  it.effect(
    "decodes NaN, both infinities, and finite numbers",
    Effect.fnUntraced(function* () {
      const result1 = yield* decodePythonFloat(Number.NaN);
      assert.isNaN(result1);
      const result2 = yield* decodePythonFloat(Number.POSITIVE_INFINITY);
      assert.strictEqual(result2, Number.POSITIVE_INFINITY);
      const result3 = yield* decodePythonFloat(Number.NEGATIVE_INFINITY);
      assert.strictEqual(result3, Number.NEGATIVE_INFINITY);
      const result4 = yield* decodePythonFloat(47.6);
      assert.strictEqual(result4, 47.6);
      const result5 = yield* Effect.isFailure(decodePythonFloat("47.6"));
      assert.strictEqual(result5, true);
    }),
  );

  it.effect(
    "writes non-finite values by name in JSON and reads them back",
    Effect.fnUntraced(function* () {
      const result6 = yield* encodePythonFloatJson(Number.NaN);
      assert.strictEqual(result6, "NaN");
      const result7 = yield* encodePythonFloatJson(Number.POSITIVE_INFINITY);
      assert.strictEqual(result7, "Infinity");
      const result8 = yield* encodePythonFloatJson(Number.NEGATIVE_INFINITY);
      assert.strictEqual(result8, "-Infinity");
      const result9 = yield* encodePythonFloatJson(-122.3);
      assert.strictEqual(result9, -122.3);
      const result10 = yield* encodePythonFloatJson(Number.NaN);
      const result11 = yield* decodePythonFloatJson(result10);
      assert.isNaN(result11);
      const result12 = yield* encodePythonFloatJson(Number.NEGATIVE_INFINITY);
      const result13 = yield* decodePythonFloatJson(result12);
      assert.strictEqual(result13, Number.NEGATIVE_INFINITY);
      const result14 = yield* encodePythonFloatJson(-122.3);
      const result15 = yield* decodePythonFloatJson(result14);
      assert.strictEqual(result15, -122.3);
    }),
  );

  it.effect(
    "generates non-finite values from its arbitrary",
    Effect.fnUntraced(function* () {
      const sample = yield* Arbitrary.sampleEffect(pythonFloatArbitrary, { count: 200, seed: 7 });
      assert.strictEqual(A.every(sample, P.isNumber), true);
      assert.strictEqual(A.some(sample, P.not(isFiniteNumber)), true);
      assert.strictEqual(A.some(sample, isFiniteNumber), true);
    }),
  );

  it("builds a double-precision model column", () => {
    const build = () => {
      class PythonFloatRow extends Model<PythonFloatRow>("PythonFloatRow")({
        x: PythonFloat.pipe(pg.doublePrecision(), pg.columnName("x")),
      }) {}
      return PythonFloatRow;
    };
    assert.doesNotThrow(build);
    const Row = build();
    assert.strictEqual(Row.sql.columns.x.column.kind, "doublePrecision");
    const sqlType = A.findFirst(getTableConfig(Row.pipe(toPgTable)).columns, (column) => column.name === "x").pipe(
      O.match({ onNone: () => "missing", onSome: (column) => column.getSQLType() }),
    );
    assert.strictEqual(sqlType, "double precision");
  });
});
