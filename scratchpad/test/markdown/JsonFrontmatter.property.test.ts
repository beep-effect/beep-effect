import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { JsonFrontmatter } from "../../effected/markdown/JsonFrontmatter.ts";
import { Frontmatter } from "../../effected/markdown/MarkdownNode.ts";
const runs = { arbitrary: fcRuns(100) };

it.effect.prop("JSON frontmatter decoding an encoding always succeeds, preserves JSON, and stabilizes formatting",
  [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
    const encoded = yield* JsonFrontmatter.encode(value);
    const parsed = yield* JsonFrontmatter.decode(Frontmatter.make({ format: "json", value: encoded }));
    const decoded = yield* S.decodeUnknownEffect(S.Json)(parsed);
    assert.isTrue(S.toEquivalence(S.Json)(decoded, value));
    const twice = yield* JsonFrontmatter.encode(parsed);
    assert.strictEqual(twice, encoded);
    const reparsed = yield* JsonFrontmatter.decode(Frontmatter.make({ format: "json", value: twice }));
    assert.deepStrictEqual(reparsed, parsed);
  }), runs);
