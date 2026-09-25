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
      assert.isNaN(yield* decodePythonFloat(Number.NaN));
      assert.strictEqual(yield* decodePythonFloat(Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
      assert.strictEqual(yield* decodePythonFloat(Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY);
      assert.strictEqual(yield* decodePythonFloat(47.6), 47.6);
      assert.strictEqual(yield* Effect.isFailure(decodePythonFloat("47.6")), true);
    }),
  );

  it.effect(
    "writes non-finite values by name in JSON and reads them back",
    Effect.fnUntraced(function* () {
      assert.strictEqual(yield* encodePythonFloatJson(Number.NaN), "NaN");
      assert.strictEqual(yield* encodePythonFloatJson(Number.POSITIVE_INFINITY), "Infinity");
      assert.strictEqual(yield* encodePythonFloatJson(Number.NEGATIVE_INFINITY), "-Infinity");
      assert.strictEqual(yield* encodePythonFloatJson(-122.3), -122.3);
      assert.isNaN(yield* decodePythonFloatJson(yield* encodePythonFloatJson(Number.NaN)));
      assert.strictEqual(
        yield* decodePythonFloatJson(yield* encodePythonFloatJson(Number.NEGATIVE_INFINITY)),
        Number.NEGATIVE_INFINITY,
      );
      assert.strictEqual(yield* decodePythonFloatJson(yield* encodePythonFloatJson(-122.3)), -122.3);
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
