import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as MarkdownExports from "../../effected/markdown/index.ts";
import { Mdast } from "../../effected/markdown/Mdast.ts";
import { TomlFrontmatter } from "../../effected/markdown/TomlFrontmatter.ts";
import { YamlFrontmatter } from "../../effected/markdown/YamlFrontmatter.ts";

it.effect("barrel exposes the owned adapters by identity", () => Effect.sync(() => {
  assert.strictEqual(MarkdownExports.Mdast, Mdast);
  assert.strictEqual(MarkdownExports.TomlFrontmatter, TomlFrontmatter);
  assert.strictEqual(MarkdownExports.YamlFrontmatter, YamlFrontmatter);
}));
