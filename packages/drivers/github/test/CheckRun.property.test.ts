import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Annotation, AnnotationLevel, CheckConclusion, CheckRunOutput, CheckRunRef } from "@beep/github/CheckRun";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "CheckConclusion preserves every encoded value",
  [Arbitrary.schema(CheckConclusion)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CheckConclusion)(value);
      const decoded = yield* S.decodeEffect(CheckConclusion)(encoded);
      assert.isTrue(S.toEquivalence(CheckConclusion)(decoded, value));
      const value1 = yield* S.encodeEffect(CheckConclusion)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "AnnotationLevel preserves every encoded value",
  [Arbitrary.schema(AnnotationLevel)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(AnnotationLevel)(value);
      const decoded = yield* S.decodeEffect(AnnotationLevel)(encoded);
      assert.isTrue(S.toEquivalence(AnnotationLevel)(decoded, value));
      const value2 = yield* S.encodeEffect(AnnotationLevel)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);

it.effect.prop(
  "Annotation preserves every encoded value",
  [Arbitrary.schema(Annotation)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Annotation)(value);
      const decoded = yield* S.decodeEffect(Annotation)(encoded);
      assert.isTrue(S.toEquivalence(Annotation)(decoded, value));
      const value3 = yield* S.encodeEffect(Annotation)(decoded);
      assert.deepStrictEqual(value3, encoded);
    }),
  runs
);

it.effect.prop(
  "CheckRunOutput preserves every encoded value",
  [Arbitrary.schema(CheckRunOutput)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CheckRunOutput)(value);
      const decoded = yield* S.decodeEffect(CheckRunOutput)(encoded);
      assert.isTrue(S.toEquivalence(CheckRunOutput)(decoded, value));
      const value4 = yield* S.encodeEffect(CheckRunOutput)(decoded);
      assert.deepStrictEqual(value4, encoded);
    }),
  runs
);

it.effect.prop(
  "CheckRunRef preserves every encoded value",
  [Arbitrary.schema(CheckRunRef)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CheckRunRef)(value);
      const decoded = yield* S.decodeEffect(CheckRunRef)(encoded);
      assert.isTrue(S.toEquivalence(CheckRunRef)(decoded, value));
      const value5 = yield* S.encodeEffect(CheckRunRef)(decoded);
      assert.deepStrictEqual(value5, encoded);
    }),
  runs
);

it.effect.prop(
  "truncation is idempotent and faithfully preserves fitting output",
  [Arbitrary.schema(CheckRunOutput)],
  ([value]) =>
    Effect.gen(function* () {
      const once = value.truncated();
      assert.isTrue(S.toEquivalence(CheckRunOutput)(once.truncated(), once));
      const json = S.fromJsonString(CheckRunOutput);
      const encoded = yield* S.encodeEffect(json)(once);
      const decoded = yield* S.decodeEffect(json)(encoded);
      assert.isTrue(S.toEquivalence(CheckRunOutput)(decoded.truncated(), once));
      assert.strictEqual(once.title, value.title);
      assert.isAtMost(Buffer.byteLength(once.summary, "utf8"), CheckRunOutput.LIMIT_BYTES);
      if (Buffer.byteLength(value.summary, "utf8") <= CheckRunOutput.LIMIT_BYTES)
        assert.strictEqual(once.summary, value.summary);
      if (value.text !== undefined) {
        assert.isAtMost(Buffer.byteLength(once.text ?? "", "utf8"), CheckRunOutput.LIMIT_BYTES);
        if (Buffer.byteLength(value.text, "utf8") <= CheckRunOutput.LIMIT_BYTES)
          assert.strictEqual(once.text, value.text);
      }
      assert.deepStrictEqual(once.annotations, value.annotations?.slice(0, CheckRunOutput.MAX_ANNOTATIONS));
    }),
  runs
);

it.effect.prop(
  "oversized UTF-8 output preserves complete characters and remains stable",
  [Arbitrary.schema(S.Literals(["a", "é", "│", "🦋", "�"]))],
  ([character]) =>
    Effect.gen(function* () {
      const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
      const prefix = Str.repeat(Math.floor(budget / Buffer.byteLength(character, "utf8")))(character);
      const value = CheckRunOutput.make({
        title: "budget",
        summary: prefix + Str.repeat(100)(character),
        text: prefix + Str.repeat(100)(character),
      });
      const once = value.truncated();
      assert.strictEqual(once.summary, prefix + CheckRunOutput.NOTICE);
      assert.strictEqual(once.text, prefix + CheckRunOutput.NOTICE);
      assert.isAtMost(Buffer.byteLength(once.summary, "utf8"), CheckRunOutput.LIMIT_BYTES);
      assert.isTrue(S.toEquivalence(CheckRunOutput)(once.truncated(), once));
      const json = S.fromJsonString(CheckRunOutput);
      const encoded = yield* S.encodeEffect(json)(once);
      const decoded = yield* S.decodeEffect(json)(encoded);
      assert.isTrue(S.toEquivalence(CheckRunOutput)(decoded.truncated(), once));
    }),
  runs
);
