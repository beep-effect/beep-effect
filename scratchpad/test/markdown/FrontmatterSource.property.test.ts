import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FrontmatterNewline, FrontmatterSourceBlock, FrontmatterSourceSplit, FrontmatterSource } from "../../effected/markdown/FrontmatterSource.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoding succeeds and preserves the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("FrontmatterSource schema property floor", () => {
  roundTrips("FrontmatterNewline", FrontmatterNewline);
  roundTrips("FrontmatterSourceBlock", FrontmatterSourceBlock);
  roundTrips("FrontmatterSourceSplit", FrontmatterSourceSplit);
});

const CaptureSample = S.Struct({
  format: S.Literals(["yaml", "toml", "json"]),
  newline: FrontmatterNewline,
  content: S.Array(S.Literals(["x", "é", "中", " ", "\0", "\t"])),
  body: S.String,
});
it.effect.prop("split/join preserves exact value and body bytes and the original fence terminators", [Arbitrary.schema(CaptureSample)], ([sample]) => Effect.sync(() => {
  const opening = sample.format === "yaml" ? "---" : sample.format === "toml" ? "+++" : "---json";
  const closing = sample.format === "toml" ? "+++" : "---";
  const value = `field: ${sample.content.join("")}${sample.newline}`;
  const body = `body:${sample.body}`;
  const source = `${opening}${sample.newline}${value}${closing}${sample.newline}${body}`;
  const split = FrontmatterSource.split(source);
  assert.strictEqual(split.frontmatter?.format, sample.format);
  assert.strictEqual(split.frontmatter?.value, value);
  assert.strictEqual(split.body, body);
  assert.strictEqual(split.body, source.slice(split.bodyOffset));
  assert.strictEqual(FrontmatterSource.join(split), source);
  assert.deepStrictEqual(FrontmatterSource.split(FrontmatterSource.join(split)), split);
}), runs);
it.effect.prop("split/join is an idempotent normalization and reparsing retains captured content", [Arbitrary.schema(S.String)], ([source]) => Effect.sync(() => {
  const split = FrontmatterSource.split(source);
  const formatted = FrontmatterSource.join(split);
  const reparsed = FrontmatterSource.split(formatted);
  assert.strictEqual(FrontmatterSource.join(reparsed), formatted);
  assert.deepStrictEqual(reparsed.frontmatter, split.frontmatter);
  assert.strictEqual(reparsed.body, split.body);
}), runs);
