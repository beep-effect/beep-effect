import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { numericId } from "../../../effected/github/internal/ids.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("resource identifier normalization is idempotent and retains safe integer fidelity", [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })))], ([id]) => Effect.sync(() => {
  const normalized = numericId(BigInt(id));
  assert.strictEqual(normalized, id);
  assert.strictEqual(numericId(normalized), normalized);
  assert.strictEqual(numericId(BigInt(String(normalized))), normalized);
}), runs);
