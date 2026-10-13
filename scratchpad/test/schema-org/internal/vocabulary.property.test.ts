import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { decodeRow } from "../../../effected/schema-org/internal/vocabulary.ts";

const runs = { arbitrary: fcRuns(100) };
const Indices = S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 1520 })));
const stringify = (indices: ReadonlyArray<number>): string => A.join(A.map(indices, String), ",");
const format = (row: string): string => stringify(decodeRow(row));

it.effect.prop(
  "index-row decoding preserves every index and canonical row formatting is idempotent",
  [Arbitrary.schema(Indices)],
  ([indices]) => Effect.sync(() => {
    const row = stringify(indices);
    const parsed = decodeRow(row);
    assert.deepStrictEqual(parsed, indices);
    assert.deepStrictEqual(decodeRow(stringify(parsed)), parsed);
    assert.strictEqual(format(format(row)), format(row));
  }),
  runs,
);

it.effect.prop(
  "noncanonical decimal spellings preserve order and multiplicity after normalization",
  [Arbitrary.schema(Indices)],
  ([indices]) => Effect.sync(() => {
    const row = A.join(A.map(indices, (index) => ` 0${index} `), ",");
    const parsed = decodeRow(row);
    assert.deepStrictEqual(parsed, indices);
    assert.deepStrictEqual(decodeRow(stringify(parsed)), parsed);
    assert.strictEqual(format(format(row)), format(row));
    assert.strictEqual(format(row), stringify(indices));
  }),
  runs,
);
