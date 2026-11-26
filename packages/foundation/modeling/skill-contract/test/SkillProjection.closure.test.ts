import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Str from "effect/String";

const packageSources = import.meta.glob<string>("../src/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const MARKDOWN_SPECIFIER = /["'](@beep\/markdown(?:\/[^"']*)?)["']/g;

const markdownSpecifiers = (source: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(MARKDOWN_SPECIFIER)(source)), (match) =>
    match[1] === undefined ? [] : [match[1]]
  );

describe("@beep/skill-contract SkillProjection import closure", () => {
  it.effect(
    "enters @beep/markdown only through FrontmatterSource, so the block parser, inline parser and root barrel stay out",
    () =>
      Effect.sync(() => {
        const specifiers = A.dedupe(A.flatMap(R.values(packageSources), markdownSpecifiers));
        assertTrue(
          A.some(R.keys(packageSources), Str.endsWith("/SkillProjection.ts")),
          "the scan read the package: SkillProjection.ts is among the sources Vite inlined without the filesystem"
        );
        deepStrictEqual(
          specifiers,
          ["@beep/markdown/FrontmatterSource"],
          "that leaf's closure, pinned by @beep/markdown test/index.coverage.test.ts, includes the raw fence scanner internal/blocks/frontmatter.ts and never the block parser, the inline parser or the root barrel"
        );
      })
  );
});
