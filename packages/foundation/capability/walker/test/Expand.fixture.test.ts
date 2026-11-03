// The matching cases of the retired `@beep/utils/Glob` suite, retargeted to
// `compileAndExpand`: one fixture tree, every case the walker now owns.
// Directory emission and the Bun/Node backend split retired with the module;
// the ignore, array, `absolute` and implicit-cwd cases live with the FsUtils
// adapter that kept those options.

import { GlobPatternOptions } from "@beep/glob/GlobPattern";
import { DescendError } from "@beep/walker/Descend";
import { compileAndExpand, GlobExpansionError } from "@beep/walker/Expand";
import { assert, describe, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { platformWith } from "./support/fixtures.ts";

const defaults = GlobPatternOptions.make({});

const tree = {
  "/fx/README.md": "",
  "/fx/src/index.ts": "",
  "/fx/src/errors/problem.ts": "",
  "/fx/src/nested/deep.ts": "",
  "/fx/%2F/literal.ts": "",
  "/fx/symbols#%/literal.ts": "",
  "/fx/unrelated/nested/hidden.ts": "",
};

const options = {
  unreadable: HashSet.make("/locked"),
  symlinks: {
    "/fx/src/dangling.ts": "/fx/missing.ts",
    "/fx/src/linked-root": "/fx",
  },
};

const srcFiles = ["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"];

describe("GlobExpansionError — declared equivalence", () => {
  it("compares by pattern and cause", () => {
    const same = S.toEquivalence(GlobExpansionError);
    const cause = DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" });
    const first = GlobExpansionError.make({ pattern: "src/*.ts", cause });
    const second = GlobExpansionError.make({
      pattern: "src/*.ts",
      cause: DescendError.make({ pattern: "src/*.ts", reason: "unreadableDirectory", path: "src" }),
    });
    const different = GlobExpansionError.make({ pattern: "test/*.ts", cause });

    assert.isTrue(same(first, second));
    assert.isFalse(same(first, different));
  });
});

// A statically rooted pattern must never list the unreadable sibling directory.
layer(platformWith(tree, { unreadable: HashSet.make("/fx/unrelated") }), { timeout: "10 seconds" })(
  "compileAndExpand, statically rooted patterns",
  (it) => {
    it.effect("does not traverse unrelated directories for a statically rooted pattern", () =>
      Effect.gen(function* () {
        const compileAndExpand1 = yield* compileAndExpand("src/**/*.ts", { cwd: "/fx", glob: defaults });
        assert.deepStrictEqual(compileAndExpand1, srcFiles);
      })
    );
  }
);

layer(platformWith(tree, options), { timeout: "10 seconds" })("compileAndExpand, retired Glob cases", (it) => {
  it.effect("returns only files for a globstar over directories", () =>
    Effect.gen(function* () {
      const compileAndExpand2 = yield* compileAndExpand("src/**", { cwd: "/fx", glob: defaults });
      assert.deepStrictEqual(compileAndExpand2, srcFiles);
    })
  );

  it.effect("treats percent-encoded and fragment characters as filesystem text", () =>
    Effect.gen(function* () {
      const expand = compileAndExpand({ cwd: "/fx", glob: defaults });
      const expand3 = yield* expand("%2F/*.ts");
      assert.deepStrictEqual(expand3, ["%2F/literal.ts"]);
      const expand4 = yield* expand("symbols*/*.ts");
      assert.deepStrictEqual(expand4, ["symbols#%/literal.ts"]);
    })
  );

  it.effect("surfaces a non-missing filesystem error as a typed failure", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(compileAndExpand("**/*.ts", { cwd: "/locked", glob: defaults }));
      assert.instanceOf(error, GlobExpansionError);
      assert.strictEqual(error.stage, "descend");
    })
  );

  it.effect("skips dangling symlinks", () =>
    Effect.gen(function* () {
      const files = yield* compileAndExpand("src/**", { cwd: "/fx", glob: defaults });
      assert.notInclude(files, "src/dangling.ts");
      assert.deepStrictEqual(files, srcFiles);
    })
  );

  it.effect("does not recurse into symlinked directories", () =>
    Effect.gen(function* () {
      const files = yield* compileAndExpand("src/**", { cwd: "/fx", glob: defaults });
      assert.isFalse(A.some(files, Str.startsWith("src/linked-root/")));
      assert.deepStrictEqual(files, srcFiles);
    })
  );
});
