import { resolveExports, resolveExtendsTarget } from "@beep/repo-tsconfig/internal/extendsTarget";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { fixtureLayer, tree } from "../support/fixtures.ts";

const JsonValue = S.fromJsonString(S.Unknown);

/** The walk of `targets` that no `null` ended. */
const walked = (...targets: ReadonlyArray<string>) => ({ targets, blocked: false });

const nested = (leaf: unknown, depth: number): unknown => {
  let value = leaf;
  for (let i = 0; i < depth; i++) value = { default: value };
  return value;
};

describe("extendsTarget boundary coverage", () => {
  it.effect("rejects malformed and nonmatching wildcard patterns", () =>
    Effect.sync(() => {
      for (const [pattern, subpath] of [
        ["./a**", "./abc"],
        ["./long*suffix", "./x"],
        ["./a*b", "./zxb"],
        ["./a*b", "./axc"],
      ] as const)
        assert.deepStrictEqual(resolveExports({ [pattern]: "./*.json" }, subpath), walked());
    })
  );

  it.effect("chooses the most specific wildcard regardless of insertion order", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(
        resolveExports({ "./config/*": "./specific/*.json", "./*": "./general/*.json" }, "./config/a"),
        walked("./specific/a.json")
      );
      assert.deepStrictEqual(
        resolveExports({ "./*": "./general/*.json", "./config/*": "./specific/*.json" }, "./config/a"),
        walked("./specific/a.json")
      );
      assert.deepStrictEqual(resolveExports({ "./fixed": "./fixed.json", "./x*": "./*.json" }, "./absent"), walked());
    })
  );

  it.effect("rejects root sugar for subpaths and empty or primitive condition values", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(resolveExports("./root.json", "./sub"), walked());
      assert.deepStrictEqual(resolveExports(["./root.json"], "./sub"), walked());
      assert.deepStrictEqual(resolveExports({}, "."), walked());
      assert.deepStrictEqual(resolveExports({ types: "./root.json" }, "./sub"), walked());
      assert.deepStrictEqual(resolveExports({ types: 1, default: false }, "."), walked());
      assert.deepStrictEqual(resolveExports([false, 1, null, "./after.json"], "."), { targets: [], blocked: true });
    })
  );

  it.effect("substitutes nested wildcard arrays, skips dunder data and bounds recursion", () =>
    Effect.gen(function* () {
      const poisoned = yield* S.decodeEffect(JsonValue)(
        '{"__proto__":"./bad.json","constructor":"./bad.json","prototype":"./bad.json","browser":"./bad.json","types":[false,"./*.json"]}'
      );
      assert.deepStrictEqual(resolveExports({ "./*": poisoned }, "./base"), walked("./base.json"));
      assert.deepStrictEqual(resolveExports({ "./*": nested("./*.json", 34) }, "./base"), walked());
      assert.deepStrictEqual(resolveExports(nested("./base.json", 34), "."), walked());
      assert.deepStrictEqual(resolveExports(".")({ default: "./base.json" }), walked("./base.json"));
    })
  );

  const scenarios: ReadonlyArray<readonly [string, string, Record<string, string>]> = [
    ["missing relative json target", "./missing.json", {}],
    ["missing relative json retry", "./missing", {}],
    ["missing package subpath", "pkg/base", {}],
    ["missing explicit json subpath", "pkg/base.json", {}],
    [
      "missing exports target",
      "pkg/base",
      { "/project/node_modules/pkg/package.json": '{"exports":{"./base":"./missing.json"}}' },
    ],
    [
      "missing tsconfig field target",
      "pkg",
      { "/project/node_modules/pkg/package.json": '{"tsconfig":"./missing.json"}' },
    ],
    ["empty tsconfig field", "pkg", { "/project/node_modules/pkg/package.json": '{"tsconfig":""}' }],
  ];
  for (const [name, spec, files] of scenarios) {
    it.layer(fixtureLayer(files), { timeout: "10 seconds" })(name, (it) => {
      it.effect("continues lookup and returns absence", () =>
        Effect.gen(function* () {
          const resolvedExtendsTarget = yield* resolveExtendsTarget(spec, "/project/tsconfig.json");
          assertNone(resolvedExtendsTarget);
        })
      );
    });
  }

  it.layer(fixtureLayer(tree(["/node_modules/@scope/pkg/base.json", "{}"])), { timeout: "10 seconds" })(
    "ancestor retry",
    (it) => {
      it.effect("subpath json retry misses before a farther ancestor succeeds", () =>
        Effect.gen(function* () {
          const value1 = yield* resolveExtendsTarget("/project/tsconfig.json")("@scope/pkg/base");
          assertSome(value1, "/node_modules/@scope/pkg/base.json");
        })
      );
    }
  );
});
