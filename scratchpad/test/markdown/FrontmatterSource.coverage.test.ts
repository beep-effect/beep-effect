import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { FrontmatterSource, FrontmatterSourceBlock, FrontmatterSourceSplit } from "../../effected/markdown/FrontmatterSource.ts";

it.effect("joining normalizes fence terminators and a missing final terminator while retaining content bytes", () => Effect.sync(() => {
  const source = "---\r\nkey: value\r---\n<MDX>\r\n";
  const split = FrontmatterSource.split(source);
  assert.strictEqual(split.frontmatter?.value, "key: value\r");
  assert.strictEqual(split.body, "<MDX>\r\n");
  assert.strictEqual(FrontmatterSource.join(split), "---\r\nkey: value\r---\r\n<MDX>\r\n");
  assert.strictEqual(FrontmatterSource.join(FrontmatterSource.split("+++\na = 1\n+++")), "+++\na = 1\n+++\n");
  const synthesized = FrontmatterSourceSplit.make({ frontmatter: FrontmatterSourceBlock.make({ format: "json", value: "{}" }), body: "<MDX>" });
  assert.strictEqual(FrontmatterSource.join(synthesized), "---json\n{}\n---\n<MDX>");
  const empty = FrontmatterSourceSplit.make({ frontmatter: FrontmatterSourceBlock.make({ format: "yaml", value: "" }), body: "" });
  assert.strictEqual(FrontmatterSource.join(empty), "---\n---\n");
  const absent = FrontmatterSource.split("ordinary body\r\n");
  assert.strictEqual(absent.frontmatter, undefined);
  assert.strictEqual(absent.bodyOffset, 0);
  assert.strictEqual(FrontmatterSource.join(absent), "ordinary body\r\n");
}));
