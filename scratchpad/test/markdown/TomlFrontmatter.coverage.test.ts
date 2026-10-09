import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Frontmatter } from "../../effected/markdown/MarkdownNode.ts";
import { TomlFrontmatter } from "../../effected/markdown/TomlFrontmatter.ts";

describe("TomlFrontmatter failure boundaries", () => {
  it.effect("wraps unrepresentable values in the typed encode error", () => Effect.gen(function* () {
    const error = yield* TomlFrontmatter.encode({ value: () => 1 }).pipe(Effect.asVoid, Effect.flip);
    assert.strictEqual(error._tag, "FrontmatterEncodeError");
    assert.strictEqual(error.format, "toml");
    if (error._tag === "FrontmatterEncodeError" || error._tag === "FrontmatterDecodeError") assert.ok(error.cause);
  }));
  it.effect("preserves parser failures structurally", () => Effect.gen(function* () {
    const error = yield* TomlFrontmatter.decode(Frontmatter.make({ format: "toml", value: "x = [" })).pipe(Effect.asVoid, Effect.flip);
    assert.strictEqual(error._tag, "FrontmatterDecodeError");
    if (error._tag === "FrontmatterDecodeError") assert.ok(error.cause);
  }));
  it.effect("rejects a different fence before parsing", () => Effect.gen(function* () {
    const error = yield* TomlFrontmatter.decode(Frontmatter.make({ format: "json", value: "x = [" })).pipe(Effect.asVoid, Effect.flip);
    assert.strictEqual(error._tag, "FrontmatterFormatMismatchError");
  }));
});
