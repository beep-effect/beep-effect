import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Frontmatter } from "@beep/markdown/MarkdownNode";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Data = S.Struct({
  title: S.String,
  count: S.Int.check(S.isBetween({ minimum: -100000, maximum: 100000 })),
  draft: S.Boolean,
  tags: S.Array(S.String),
});
const decode = (value: string) => YamlFrontmatter.decode(Frontmatter.make({ format: "yaml", value }));

describe("YamlFrontmatter properties", () => {
  it.effect.prop(
    "decode(encode(x)) recovers data and never fails",
    [Arbitrary.schema(Data)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* YamlFrontmatter.encode(value);
        const decoded = yield* decode(encoded);
        assert.deepStrictEqual(decoded, value);
      }),
    runs
  );
  it.effect.prop(
    "encode/decode normalization is idempotent and faithful",
    [Arbitrary.schema(Data)],
    ([value]) =>
      Effect.gen(function* () {
        const first = yield* YamlFrontmatter.encode(value);
        const parsed = yield* decode(first);
        const second = yield* YamlFrontmatter.encode(parsed);
        assert.strictEqual(second, first);
        const decoded1 = yield* decode(second);
        assert.deepStrictEqual(decoded1, parsed);
      }),
    runs
  );
  it.effect("empty mappings survive the codec boundary", () =>
    Effect.gen(function* () {
      const encoded3 = yield* YamlFrontmatter.encode({});
      const decoded2 = yield* decode(encoded3);
      assert.deepStrictEqual(decoded2, {});
    })
  );
});
