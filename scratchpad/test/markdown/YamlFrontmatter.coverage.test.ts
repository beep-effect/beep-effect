import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Frontmatter } from "../../effected/markdown/MarkdownNode.ts";
import { YamlFrontmatter } from "../../effected/markdown/YamlFrontmatter.ts";

describe("YamlFrontmatter failure boundaries", () => {
  it.effect("wraps unrepresentable values in the typed encode error", () => Effect.gen(function* () {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const error = yield* YamlFrontmatter.encode(cyclic).pipe(Effect.asVoid, Effect.flip);
    assert.strictEqual(error._tag, "FrontmatterEncodeError");
    assert.strictEqual(error.format, "yaml");
    if (error._tag === "FrontmatterEncodeError" || error._tag === "FrontmatterDecodeError") assert.ok(error.cause);
  }));
  it.effect("preserves parser failures structurally", () => Effect.gen(function* () {
    const error = yield* YamlFrontmatter.decode(Frontmatter.make({ format: "yaml", value: "x: [" })).pipe(Effect.asVoid, Effect.flip);
    assert.strictEqual(error._tag, "FrontmatterDecodeError");
    if (error._tag === "FrontmatterDecodeError") assert.ok(error.cause);
  }));
  it.effect("rejects a different fence before parsing", () => Effect.gen(function* () {
    const error = yield* YamlFrontmatter.decode(Frontmatter.make({ format: "json", value: "x: [" })).pipe(Effect.asVoid, Effect.flip);
    assert.strictEqual(error._tag, "FrontmatterFormatMismatchError");
  }));
});
