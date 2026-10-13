import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { detect, detectOsc8, Osc8Reason, Osc8Detection } from "../../../../effected/env/internal/osc8/detect.ts";

const runs = { arbitrary: fcRuns(100) };

describe("internal/osc8/detect schema property floor", () => {
  it.effect.prop(
    "Osc8Reason: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(Osc8Reason)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Osc8Reason)(value);
      const decoded = yield* S.decodeEffect(Osc8Reason)(encoded);
      assert.isTrue(S.toEquivalence(Osc8Reason)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(Osc8Reason)(decoded), encoded);
    }),
    runs,
  );
  it.effect.prop(
    "Osc8Detection: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(Osc8Detection)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Osc8Detection)(value);
      const decoded = yield* S.decodeEffect(Osc8Detection)(encoded);
      assert.isTrue(S.toEquivalence(Osc8Detection)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(Osc8Detection)(decoded), encoded);
    }),
    runs,
  );
});

const Snapshot = S.Struct({
  env: S.Record(S.String, S.String),
  isStdoutTTY: S.Boolean,
  isStderrTTY: S.Boolean,
});
const snapshotJson = S.fromJsonString(Snapshot);

describe("OSC8 snapshot and projection fidelity", () => {
  it.effect.prop("serializing a snapshot preserves detection and the projection codec", [Arbitrary.schema(Snapshot)], ([snap]) =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(snapshotJson)(snap);
      const restored = yield* S.decodeEffect(snapshotJson)(text);
      const info = detect(snap);
      assert.deepStrictEqual(detect(restored), info);
      const projection = detectOsc8(snap.env, snap.isStdoutTTY, snap.isStderrTTY);
      assert.strictEqual(projection.stdout, info.supported);
      assert.strictEqual(projection.stderr, info.supportedForStderr);
      const decoded = yield* S.decodeEffect(Osc8Detection)(yield* S.encodeEffect(Osc8Detection)(projection));
      assert.isTrue(S.toEquivalence(Osc8Detection)(decoded, projection));
      assert.strictEqual(yield* S.encodeEffect(snapshotJson)(restored), text);
    }), runs);
});
