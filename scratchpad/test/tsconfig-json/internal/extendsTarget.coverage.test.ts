import { describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { resolveExports, resolveExtendsTarget } from "../../../effected/tsconfig-json/internal/extendsTarget.ts";
import { fixtureLayer } from "../fixtures.ts";

const JsonValue = S.fromJsonString(S.Unknown);

const nested = (leaf: unknown, depth: number): unknown => {
  let value = leaf;
  for (let i = 0; i < depth; i++) value = { default: value };
  return value;
};

describe("extendsTarget boundary coverage", () => {
  it.effect("rejects malformed and nonmatching wildcard patterns", () => Effect.sync(() => {
    for (const [pattern, subpath] of [
      ["./a**", "./abc"], ["./long*suffix", "./x"], ["./a*b", "./zxb"], ["./a*b", "./axc"],
    ] as const) assertNone(resolveExports({ [pattern]: "./*.json" }, subpath));
  }));

  it.effect("chooses the most specific wildcard regardless of insertion order", () => Effect.sync(() => {
    assertSome(resolveExports({ "./config/*": "./specific/*.json", "./*": "./general/*.json" }, "./config/a"), "./specific/a.json");
    assertSome(resolveExports({ "./*": "./general/*.json", "./config/*": "./specific/*.json" }, "./config/a"), "./specific/a.json");
    assertNone(resolveExports({ "./fixed": "./fixed.json", "./x*": "./*.json" }, "./absent"));
  }));

  it.effect("rejects root sugar for subpaths and empty or primitive condition values", () => Effect.sync(() => {
    assertNone(resolveExports("./root.json", "./sub"));
    assertNone(resolveExports(["./root.json"], "./sub"));
    assertNone(resolveExports({}, "."));
    assertNone(resolveExports({ types: "./root.json" }, "./sub"));
    assertNone(resolveExports({ types: 1, default: false }, "."));
    assertNone(resolveExports([null, false, 1], "."));
  }));

  it.effect("substitutes nested wildcard arrays, skips dunder data and bounds recursion", () => Effect.gen(function* () {
    const poisoned = yield* S.decodeEffect(JsonValue)('{"__proto__":"./bad.json","constructor":"./bad.json","prototype":"./bad.json","browser":"./bad.json","types":[false,"./*.json"]}');
    assertSome(resolveExports({ "./*": poisoned }, "./base"), "./base.json");
    assertNone(resolveExports({ "./*": nested("./*.json", 34) }, "./base"));
    assertNone(resolveExports(nested("./base.json", 34), "."));
    assertSome(resolveExports(".")({ default: "./base.json" }), "./base.json");
  }));

  const scenarios: ReadonlyArray<readonly [string, string, Record<string, string>]> = [
    ["missing relative json target", "./missing.json", {}],
    ["missing relative json retry", "./missing", {}],
    ["missing package subpath", "pkg/base", {}],
    ["missing explicit json subpath", "pkg/base.json", {}],
    ["missing exports target", "pkg/base", { "/project/node_modules/pkg/package.json": '{"exports":{"./base":"./missing.json"}}' }],
    ["missing tsconfig field target", "pkg", { "/project/node_modules/pkg/package.json": '{"tsconfig":"./missing.json"}' }],
    ["empty tsconfig field", "pkg", { "/project/node_modules/pkg/package.json": '{"tsconfig":""}' }],
  ];
  for (const [name, spec, files] of scenarios) {
    it.layer(fixtureLayer(new Map(Object.entries(files))), { timeout: "10 seconds" })(name, (it) => {
      it.effect("continues lookup and returns absence", () => Effect.gen(function* () {
        assertNone(yield* resolveExtendsTarget(spec, "/project/tsconfig.json"));
      }));
    });
  }

  it.layer(fixtureLayer(new Map([["/node_modules/@scope/pkg/base.json", "{}"]])), { timeout: "10 seconds" })("ancestor retry", (it) => {
    it.effect("subpath json retry misses before a farther ancestor succeeds", () => Effect.gen(function* () {
      assertSome(yield* resolveExtendsTarget("/project/tsconfig.json")("@scope/pkg/base"), "/node_modules/@scope/pkg/base.json");
    }));
  });
});
