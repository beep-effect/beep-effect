import { lifecycleAllows, StatusLifecycle, StatusTransition, StatusValue } from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const draft = StatusValue.make("draft");
const active = StatusValue.make("active");
const completed = StatusValue.make("completed");

const lifecycle = StatusLifecycle.make({ field: "status", order: [draft, active, completed] });

const move = (from: O.Option<StatusValue>, to: StatusValue, field = "status") =>
  StatusTransition.make({ field, from, to });

describe("StatusLifecycle", () => {
  it.effect(
    "admits forward and same-position moves",
    Effect.fnUntraced(function* () {
      expect(lifecycleAllows(lifecycle, move(O.some(draft), active))).toBe(true);
      expect(lifecycleAllows(lifecycle, move(O.some(draft), completed))).toBe(true);
      expect(lifecycleAllows(lifecycle, move(O.some(active), active))).toBe(true);
      expect(lifecycleAllows(lifecycle, move(O.none(), draft))).toBe(true);
      expect(lifecycleAllows(move(O.some(active), completed))(lifecycle)).toBe(true);
    })
  );

  it.effect(
    "rejects backward moves, unknown values and other fields",
    Effect.fnUntraced(function* () {
      expect(lifecycleAllows(lifecycle, move(O.some(completed), active))).toBe(false);
      expect(lifecycleAllows(lifecycle, move(O.some(active), draft))).toBe(false);
      expect(lifecycleAllows(lifecycle, move(O.some(active), StatusValue.make("archived")))).toBe(false);
      expect(lifecycleAllows(lifecycle, move(O.some(StatusValue.make("archived")), completed))).toBe(false);
      expect(lifecycleAllows(lifecycle, move(O.some(draft), active, "phase"))).toBe(false);
    })
  );

  it.effect(
    "fails to decode a lifecycle whose order repeats a value",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        S.decodeEffect(StatusLifecycle)({ field: "status", order: ["draft", "active", "draft"] })
      );
      assertInstanceOf(error, S.SchemaError);

      const decoded = yield* S.decodeEffect(StatusLifecycle)({ field: "status", order: ["draft", "active"] });
      expect(decoded.order).toEqual([draft, active]);
    })
  );
});
