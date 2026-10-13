import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { GlyphSet, Glyphs } from "../../effected/cli/Glyphs.ts";

it.effect.prop("GlyphSet encodes and decodes without failure or loss", [Arbitrary.schema(GlyphSet)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(GlyphSet)(value);
    const decoded = yield* S.decodeEffect(GlyphSet)(encoded);
    assertTrue(S.toEquivalence(GlyphSet)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(GlyphSet)(decoded), encoded);
  }), { arbitrary: fcRuns(100) });

it.effect("built-in glyph sets round trip as plain objects with their exact frames and values", () =>
  Effect.gen(function* () {
    for (const glyphs of [Glyphs.unicode, Glyphs.ascii]) {
      const encoded = yield* S.encodeEffect(GlyphSet)(glyphs);
      const decoded = yield* S.decodeEffect(GlyphSet)(encoded);
      assert.deepStrictEqual(decoded, glyphs);
      assert.notProperty(decoded, "_tag");
      assert.deepStrictEqual(decoded.spinner, glyphs.spinner);
      assert.strictEqual(Glyphs.select({ ascii: glyphs.kind === "ascii" }), glyphs);
    }
  }));
