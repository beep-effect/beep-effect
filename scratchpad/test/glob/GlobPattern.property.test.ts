import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { minimatch } from "minimatch";
import { GlobPattern, GlobPatternError, GlobPatternOptions } from "../../effected/glob/GlobPattern.ts";

const runs = { arbitrary: fcRuns(100) };

describe("GlobPattern schema and compilation laws", () => {
  it.effect.prop("options encode/decode preserves every option", [Arbitrary.schema(GlobPatternOptions)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GlobPatternOptions)(value);
      const decoded = yield* S.decodeEffect(GlobPatternOptions)(encoded);
      assert.deepStrictEqual(decoded, value);
    }), runs);

  it.effect.prop("guard errors encode/decode preserves diagnostic fields", [Arbitrary.schema(GlobPatternError)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GlobPatternError)(value);
      const decoded = yield* S.decodeEffect(GlobPatternError)(encoded);
      assert.deepStrictEqual(yield* S.encodeEffect(GlobPatternError)(decoded), encoded);
      assert.strictEqual(decoded.message, value.message);
    }), runs);

  it.effect.prop("pattern schema round trips retain source and matching", [Arbitrary.schema(GlobPattern), Arbitrary.schema(S.String)], ([value, candidate]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GlobPattern)(value);
      const decoded = yield* S.decodeEffect(GlobPattern)(encoded);
      assert.deepStrictEqual(decoded, value);
      assert.strictEqual(decoded.matches(candidate), value.matches(candidate));
    }), runs);

  it.effect.prop("FromString preserves source, parse/stringify fidelity and compilation idempotence", [Arbitrary.schema(GlobPattern.FromString), Arbitrary.schema(S.String)], ([value, candidate]) =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(GlobPattern.FromString)(value);
      const decoded = yield* S.decodeEffect(GlobPattern.FromString)(text);
      assert.deepStrictEqual(decoded, value);
      const formatted = yield* S.encodeEffect(GlobPattern.FromString)(decoded);
      assert.strictEqual(formatted, text);
      const reparsed = yield* S.decodeEffect(GlobPattern.FromString)(formatted);
      assert.deepStrictEqual(reparsed, decoded);
      const recompiled = yield* GlobPattern.compile(reparsed.source);
      assert.strictEqual(recompiled.matches(candidate), decoded.matches(candidate));
      assert.strictEqual(decoded.matches(candidate), minimatch(candidate, text, { platform: "linux" }));
      assert.strictEqual(recompiled.enumerationPrefix, decoded.enumerationPrefix);
      assert.strictEqual(recompiled.crossesSegments, decoded.crossesSegments);
    }), runs);

  it.effect.prop("escape/unescape faithfully encodes literals and canonical encoding is idempotent", [Arbitrary.schema(S.String)], ([literal]) =>
    Effect.gen(function* () {
      const escaped = GlobPattern.escape(literal);
      const decoded = GlobPattern.unescape(escaped);
      assert.strictEqual(decoded, literal);
      assert.strictEqual(GlobPattern.escape(decoded), escaped);
      assert.strictEqual(GlobPattern.unescape(GlobPattern.escape(decoded)), decoded);
    }), runs);
});
