import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Frontmatter } from "../../effected/markdown/MarkdownNode.ts";
import { TomlFrontmatter } from "../../effected/markdown/TomlFrontmatter.ts";

const runs = { arbitrary: fcRuns(100) };
const Data = S.Struct({
  title: S.String,
  count: S.Int.check(S.isBetween({ minimum: -100000, maximum: 100000 })),
  draft: S.Boolean,
  tags: S.Array(S.String),
});
const decode = (value: string) => TomlFrontmatter.decode(Frontmatter.make({ format: "toml", value }));

describe("TomlFrontmatter properties", () => {
  it.effect.prop("decode(encode(x)) recovers data and never fails", [Arbitrary.schema(Data)], ([value]) => Effect.gen(function* () {
    const encoded = yield* TomlFrontmatter.encode(value);
    assert.deepStrictEqual(yield* decode(encoded), value);
  }), runs);
  it.effect.prop("encode/decode normalization is idempotent and faithful", [Arbitrary.schema(Data)], ([value]) => Effect.gen(function* () {
    const first = yield* TomlFrontmatter.encode(value);
    const parsed = yield* decode(first);
    const second = yield* TomlFrontmatter.encode(parsed);
    assert.strictEqual(second, first);
    assert.deepStrictEqual(yield* decode(second), parsed);
  }), runs);
  it.effect("empty mappings survive the codec boundary", () => Effect.gen(function* () {
    assert.deepStrictEqual(yield* decode(yield* TomlFrontmatter.encode({})), {});
  }));
});
