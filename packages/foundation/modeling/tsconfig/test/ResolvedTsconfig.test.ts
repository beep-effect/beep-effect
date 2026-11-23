import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { deliberatelyInvalid } from "./support/deliberatelyInvalid.ts";
import type { TsconfigJson } from "@beep/tsconfig/TsconfigJson";

const posixResolveFromPathLayerForDeterminism = Effect.map(
  Effect.service(Path.Path),
  (path) =>
    (a: string, b: string): string =>
      path.resolve(a, b)
);

const escapedConfigDirPrefixedForNoTemplateCurlyInString = (rest: string): string => `\${configDir}${rest}`;

const emptyBaseMostFoldSeed = (): ResolvedTsconfig =>
  ResolvedTsconfig.make({ configPath: "", extendedPaths: [], compilerOptions: {} });

const { absolutize, merge, substituteConfigDir } = ResolvedTsconfig;

it.layer(Path.layer, { timeout: "10 seconds" })("ResolvedTsconfig runtime model and dual combinators", (it) => {
  it("decodes plain resolved objects with passthrough and exact optional keys", () => {
    const resolved = ResolvedTsconfig.make({
      configPath: "/proj/tsconfig.json",
      extendedPaths: ["/proj/base.json", "/proj/tsconfig.json"],
      compilerOptions: { strict: true, futureOption: { enabled: true } },
      include: [],
      compileOnSave: false,
      futureTopLevel: { value: 1 },
    });
    assert.deepStrictEqual(S.decodeOption(ResolvedTsconfig)(resolved), O.some(resolved));
    assert.isFalse(S.is(ResolvedTsconfig)({ ...resolved, files: undefined }));
    assert.isFalse(S.is(ResolvedTsconfig)({ ...resolved, compilerOptions: { strict: "true" } }));
  });

  it.effect("absolutize is equivalent in data-first and data-last forms", () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const doc: TsconfigJson.Type = {
        compilerOptions: {
          outDir: "./dist",
          rootDirs: ["./src", escapedConfigDirPrefixedForNoTemplateCurlyInString("/shared")],
          paths: { "@app/*": ["src/*"] },
        },
      };
      assert.deepStrictEqual(pipe(doc, absolutize("/proj", join)), absolutize(doc, "/proj", join));
      const withoutOptions: TsconfigJson.Type = { files: ["src/index.ts"] };
      assert.strictEqual(pipe(withoutOptions, absolutize("/proj", join)), withoutOptions);
    })
  );

  it("merge is equivalent in data-first and data-last forms", () => {
    const base = merge(
      emptyBaseMostFoldSeed(),
      { compilerOptions: { strict: false }, include: ["src"], futureKey: "base" },
      "/proj/config/base.json"
    );
    const derived: TsconfigJson.Type = {
      compilerOptions: { strict: true, paths: { "@app/*": ["src/*"] } },
      watchOptions: { excludeFiles: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/generated")] },
      futureKey: "derived",
    };
    assert.deepStrictEqual(
      pipe(base, merge(derived, "/proj/tsconfig.json")),
      merge(base, derived, "/proj/tsconfig.json")
    );
  });

  it("substituteConfigDir is equivalent in data-first and data-last forms", () => {
    const resolved = merge(
      emptyBaseMostFoldSeed(),
      {
        compilerOptions: {
          outDir: escapedConfigDirPrefixedForNoTemplateCurlyInString("/dist"),
          paths: { "@app/*": [escapedConfigDirPrefixedForNoTemplateCurlyInString("/src/*")] },
        },
        include: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/src")],
        watchOptions: { excludeDirectories: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/generated")] },
      },
      "/proj/tsconfig.json"
    );
    assert.deepStrictEqual(pipe(resolved, substituteConfigDir("/final")), substituteConfigDir(resolved, "/final"));
  });
});

describe("ResolvedTsconfig.merge — E4 merge per field", () => {
  it("E4 compilerOptions: per-key shallow assign, derived wins", () => {
    const base = merge(
      emptyBaseMostFoldSeed(),
      { compilerOptions: { strict: false, lib: ["esnext"] } },
      "/proj/base.json"
    );
    const result = merge(base, { compilerOptions: { strict: true, target: "es2022" } }, "/proj/tsconfig.json");
    assert.deepStrictEqual(result.compilerOptions, { strict: true, target: "es2022", lib: ["esnext"] });
  });

  it("E4 paths: replaced wholesale; pathsBase tracks the declaring config through a two-level chain", () => {
    const base = merge(
      emptyBaseMostFoldSeed(),
      { compilerOptions: { paths: { "@app/*": ["src/*"] } } },
      "/proj/configs/base.json"
    );
    const result = merge(base, { compilerOptions: { strict: true } }, "/proj/tsconfig.json");
    const notRedeclaring = "a more-derived config that does not redeclare paths inherits them and the pathsBase";
    assert.deepStrictEqual(result.compilerOptions.paths, { "@app/*": ["src/*"] }, notRedeclaring);
    assert.strictEqual(result.pathsBase, "/proj/configs", notRedeclaring);

    const result2 = merge(result, { compilerOptions: { paths: { "@x/*": ["y/*"] } } }, "/proj/deep/tsconfig.json");
    const redeclaring = "a third config that redeclares paths replaces them wholesale and moves pathsBase";
    assert.deepStrictEqual(result2.compilerOptions.paths, { "@x/*": ["y/*"] }, redeclaring);
    assert.strictEqual(result2.pathsBase, "/proj/deep", redeclaring);
  });

  it("E4 files/include/exclude: own empty array beats inherited", () => {
    const base = merge(emptyBaseMostFoldSeed(), { include: ["src"] }, "/proj/configs/base.json");
    const result = merge(base, { include: [] }, "/proj/tsconfig.json");
    assert.deepStrictEqual(result.include, []);
  });

  it("E4 files/include/exclude: inherited entries re-rooted relative to the declaring config", () => {
    const base = merge(
      emptyBaseMostFoldSeed(),
      { include: ["src/**/*", "/abs/x", escapedConfigDirPrefixedForNoTemplateCurlyInString("/g")] },
      "/proj/configs/base.json"
    );
    const result = merge(base, {}, "/proj/tsconfig.json");
    assert.deepStrictEqual(
      result.include,
      ["configs/src/**/*", "/abs/x", escapedConfigDirPrefixedForNoTemplateCurlyInString("/g")],
      'the prefix is relative("/proj", "/proj/configs") = "configs"; absolute and ${configDir}-prefixed entries are exempt from re-rooting'
    );
  });

  it("E4 references: never inherited", () => {
    const base = merge(emptyBaseMostFoldSeed(), { references: [{ path: "../core" }] }, "/proj/base.json");
    const inherited = merge(base, { compilerOptions: {} }, "/proj/tsconfig.json");
    assert.isUndefined(inherited.references);
    const own = merge(base, { references: [{ path: "../own" }] }, "/proj/tsconfig.json");
    assert.deepStrictEqual(own.references, [{ path: "../own" }], "the own config's references win outright");
  });

  it("E4 typeAcquisition: never inherited", () => {
    const base = merge(emptyBaseMostFoldSeed(), { typeAcquisition: { enable: true } }, "/proj/base.json");
    const result = merge(base, {}, "/proj/tsconfig.json");
    assert.isUndefined(result.typeAcquisition);
  });

  it("E4 compileOnSave: inherited only when own undefined and inherited truthy", () => {
    const ownWins = merge(
      merge(emptyBaseMostFoldSeed(), { compileOnSave: true }, "/b"),
      { compileOnSave: false },
      "/o"
    );
    assert.strictEqual(ownWins.compileOnSave, false, "an own defined value wins");
    const carried = merge(merge(emptyBaseMostFoldSeed(), { compileOnSave: true }, "/b"), {}, "/o");
    assert.strictEqual(carried.compileOnSave, true, "own undefined and inherited truthy: inherited");
    const dropped = merge(merge(emptyBaseMostFoldSeed(), { compileOnSave: false }, "/b"), {}, "/o");
    assert.isUndefined(dropped.compileOnSave, "own undefined and inherited falsy: not carried");
  });

  it("E4 watchOptions: per-key shallow merge", () => {
    const base = merge(
      emptyBaseMostFoldSeed(),
      { watchOptions: { watchFile: "usefsevents", excludeFiles: ["a"] } },
      "/b"
    );
    const result = merge(base, { watchOptions: { watchFile: "fixedpollinginterval" } }, "/o");
    assert.deepStrictEqual(result.watchOptions, { watchFile: "fixedpollinginterval", excludeFiles: ["a"] });
  });

  it("E4 unknown passthrough keys: derived wins per key (assign semantics)", () => {
    const base = merge(
      emptyBaseMostFoldSeed(),
      { "ts-node": { esm: true }, buildOptions: { a: 1, b: 9 } },
      "/proj/base.json"
    );
    const result = merge(base, { buildOptions: { a: 2 }, custom: "x" }, "/proj/tsconfig.json");
    assert.deepStrictEqual(result.buildOptions, { a: 2 }, "buildOptions is replaced wholesale by the derived value");
    assert.deepStrictEqual(result["ts-node"], { esm: true }, "an inherited-only ts-node survives");
    assert.strictEqual(result.custom, "x", "a derived-only custom key is added");
    const withExtends = merge(
      emptyBaseMostFoldSeed(),
      { extends: "./base.json", compilerOptions: {} },
      "/proj/tsconfig.json"
    );
    assert.isUndefined(withExtends.extends, "extends is consumed, never data");
  });

  it("configPath and extendedPaths track the fold, own config last", () => {
    const base = merge(emptyBaseMostFoldSeed(), {}, "/proj/configs/base.json");
    const result = merge(base, {}, "/proj/tsconfig.json");
    assert.strictEqual(result.configPath, "/proj/tsconfig.json");
    assert.deepStrictEqual(result.extendedPaths, ["/proj/configs/base.json", "/proj/tsconfig.json"]);
  });

  it("preserves hostile own passthrough keys as data through base and derived merges", () => {
    const baseProto = { polluted: "base" };
    const derivedProto = { polluted: "derived" };
    const base = merge(
      emptyBaseMostFoldSeed(),
      {
        ["__proto__"]: baseProto,
        constructor: "base constructor",
        ordinary: "base",
      },
      "/proj/base.json"
    );
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(base, "__proto__"), {
      value: baseProto,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(base, "constructor"), {
      value: "base constructor",
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.strictEqual(Object.getPrototypeOf(base), Object.getPrototypeOf({}));
    assert.isUndefined(base.polluted);

    const inherited = merge(base, {}, "/proj/inherited.json");
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(inherited, "__proto__"), {
      value: baseProto,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(inherited, "constructor"), {
      value: "base constructor",
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.strictEqual(Object.getPrototypeOf(inherited), Object.getPrototypeOf({}));
    assert.isUndefined(inherited.polluted);

    const result = merge(
      base,
      {
        ["__proto__"]: derivedProto,
        constructor: "derived constructor",
      },
      "/proj/tsconfig.json"
    );
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(result, "__proto__"), {
      value: derivedProto,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(result, "constructor"), {
      value: "derived constructor",
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.strictEqual(result.ordinary, "base");
    assert.strictEqual(Object.getPrototypeOf(result), Object.getPrototypeOf({}));
    assert.isUndefined(result.polluted);
  });

  it("skips consumed passthrough getters and reads retained getters in enumeration order", () => {
    const reads: Array<string> = [];
    let consumedReads = 0;
    const base: ResolvedTsconfig = {
      ...emptyBaseMostFoldSeed(),
      get second() {
        reads.push("base second");
        return "second";
      },
      get references() {
        consumedReads++;
        return [];
      },
      get 2() {
        reads.push("base 2");
        return "two";
      },
      get extends() {
        consumedReads++;
        return "./ignored.json";
      },
      get first() {
        reads.push("base first");
        return "first";
      },
      get typeAcquisition() {
        consumedReads++;
        return { enable: true };
      },
    };
    const derived: TsconfigJson.Type = {
      get last() {
        reads.push("derived last");
        return "last";
      },
      get extends() {
        consumedReads++;
        return "./ignored.json";
      },
      get 1() {
        reads.push("derived 1");
        return "one";
      },
    };
    const result = merge(base, derived, "/proj/tsconfig.json");
    assert.strictEqual(consumedReads, 0);
    assert.deepStrictEqual(reads, ["base 2", "base second", "base first", "derived 1", "derived last"]);
    assert.strictEqual(result["2"], "two");
    assert.strictEqual(result.second, "second");
    assert.strictEqual(result.first, "first");
    assert.strictEqual(result["1"], "one");
    assert.strictEqual(result.last, "last");
    assert.isUndefined(result.extends);
    assert.isUndefined(result.references);
    assert.isUndefined(result.typeAcquisition);
  });

  it("E4 files/include/exclude: a 3-config chain re-roots per-step, composing WITHOUT collapsing `..` (byte-identical to tsc)", () => {
    const siblingBaseDir = "/proj/shared";
    const siblingMidDir = "/proj/apps";
    const leafNestedUnderMidDir = "/proj/apps/web";
    const base = merge(emptyBaseMostFoldSeed(), { include: ["src"] }, `${siblingBaseDir}/base.json`);
    assert.deepStrictEqual(
      base.include,
      ["src"],
      "step 1: the derived config declares include, so it wins outright, unrooted"
    );
    const mid = merge(base, {}, `${siblingMidDir}/tsconfig.base.json`);
    assert.deepStrictEqual(
      mid.include,
      ["../shared/src"],
      'step 2: rerootPrefix = relative("/proj/apps", "/proj/shared") = "../shared", applied to the accumulated "src"'
    );
    const result = merge(mid, {}, `${leafNestedUnderMidDir}/tsconfig.json`);

    assert.deepStrictEqual(
      result.include,
      ["../../shared/src"],
      'step 3: rerootPrefix = relative("/proj/apps/web", "/proj/apps") = "..", prefixed onto the accumulated "../shared/src"; each step re-roots the current entries instead of computing one relative(leaf, originalBase), as TsconfigLoader folds base-most first'
    );
    assert.strictEqual(result.configPath, "/proj/apps/web/tsconfig.json");
    assert.deepStrictEqual(result.extendedPaths, [
      "/proj/shared/base.json",
      "/proj/apps/tsconfig.base.json",
      "/proj/apps/web/tsconfig.json",
    ]);
  });

  it("E4 files/include/exclude: composed re-rooting keeps a cancellable `web/..` segment UNCOLLAPSED (byte-identical to tsc)", () => {
    const baseAtSharedIncludingSrc = "/proj/shared/base.json";
    const midNestedBelowOwnDir = "/proj/apps/web/tsconfig.base.json";
    const ownAboveMidDir = "/proj/apps/tsconfig.json";
    const base = merge(emptyBaseMostFoldSeed(), { include: ["src"] }, baseAtSharedIncludingSrc);
    const mid = merge(base, {}, midNestedBelowOwnDir);
    assert.deepStrictEqual(
      mid.include,
      ["../../shared/src"],
      'step 2: rerootPrefix = relative("/proj/apps/web", "/proj/shared") = "../../shared"'
    );
    const result = merge(mid, {}, ownAboveMidDir);

    assert.deepStrictEqual(
      result.include,
      ["web/../../shared/src"],
      'step 3: rerootPrefix = relative("/proj/apps", "/proj/apps/web") = "web"; the cancellable "web/.." pair stays uncollapsed, byte-identical to tsc prefix concatenation, which the previous fixture cannot catch because nothing cancels there'
    );
    assert.strictEqual(result.configPath, "/proj/apps/tsconfig.json");
    assert.deepStrictEqual(result.extendedPaths, [
      "/proj/shared/base.json",
      "/proj/apps/web/tsconfig.base.json",
      "/proj/apps/tsconfig.json",
    ]);
  });
});

it.layer(Path.layer, { timeout: "10 seconds" })("ResolvedTsconfig.absolutize — E5 parse-time absolutization", (it) => {
  it.effect("E5 transforms string path-list entries and preserves invalid entries and paths values", () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const marker = { future: true };
      const doc = deliberatelyInvalid<TsconfigJson.Type>({
        compilerOptions: {
          typeRoots: ["./types", 1, null, marker],
          rootDirs: ["./src", false, escapedConfigDirPrefixedForNoTemplateCurlyInString("/shared")],
          paths: { mixed: ["./src/*", 2, marker], scalar: "./raw/*", absent: null },
        },
      });
      const out = absolutize(doc, "/proj/base", join);
      assert.deepStrictEqual<unknown>(out.compilerOptions?.typeRoots, ["/proj/base/types", 1, null, marker]);
      assert.deepStrictEqual<unknown>(out.compilerOptions?.rootDirs, [
        "/proj/base/src",
        false,
        escapedConfigDirPrefixedForNoTemplateCurlyInString("/shared"),
      ]);
      assert.strictEqual(out.compilerOptions?.paths, doc.compilerOptions?.paths);
      assert.deepStrictEqual<unknown>(doc.compilerOptions?.typeRoots, ["./types", 1, null, marker]);
    })
  );

  it.effect("E5 path options absolutized against the declaring config's directory", () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const out = absolutize(
        { compilerOptions: { outDir: "./dist", rootDir: "src", typeRoots: ["./types", "node_modules/@types"] } },
        "/proj/base",
        join
      );
      assert.strictEqual(out.compilerOptions?.outDir, "/proj/base/dist");
      assert.strictEqual(out.compilerOptions?.rootDir, "/proj/base/src");
      assert.deepStrictEqual(out.compilerOptions?.typeRoots, ["/proj/base/types", "/proj/base/node_modules/@types"]);
    })
  );

  it.effect("E5 paths values stay verbatim", () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const out = absolutize({ compilerOptions: { paths: { "@app/*": ["./src/*"] } } }, "/proj/base", join);
      assert.deepStrictEqual(out.compilerOptions?.paths, { "@app/*": ["./src/*"] });
    })
  );

  it.effect(`E5 \${configDir}-prefixed values are exempt from absolutization`, () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const out = absolutize(
        {
          compilerOptions: {
            outDir: escapedConfigDirPrefixedForNoTemplateCurlyInString("/out"),
            typeRoots: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/types"), "./local"],
          },
        },
        "/proj/base",
        join
      );
      assert.strictEqual(out.compilerOptions?.outDir, escapedConfigDirPrefixedForNoTemplateCurlyInString("/out"));
      assert.deepStrictEqual(out.compilerOptions?.typeRoots, [
        escapedConfigDirPrefixedForNoTemplateCurlyInString("/types"),
        "/proj/base/local",
      ]);
    })
  );

  it.effect("E5 already-absolute path options are preserved", () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const out = absolutize({ compilerOptions: { outDir: "/already/abs" } }, "/proj/base", join);
      assert.strictEqual(out.compilerOptions?.outDir, "/already/abs");
    })
  );

  it.effect("a doc without compilerOptions is returned untouched", () =>
    Effect.gen(function* () {
      const join = yield* posixResolveFromPathLayerForDeterminism;
      const doc = { include: ["src"] };
      const out = absolutize(doc, "/proj/base", join);
      assert.deepStrictEqual(out, doc);
    })
  );
});

describe("ResolvedTsconfig.substituteConfigDir — E5 final phase", () => {
  it("rebuilds hostile own paths keys as data and reads values in enumeration order", () => {
    const reads: Array<string> = [];
    const paths: Record<string, Array<string>> = {
      get ordinary() {
        reads.push("ordinary");
        return [escapedConfigDirPrefixedForNoTemplateCurlyInString("/ordinary")];
      },
      get ["__proto__"]() {
        reads.push("__proto__");
        return [escapedConfigDirPrefixedForNoTemplateCurlyInString("/proto")];
      },
      get 2() {
        reads.push("2");
        return [escapedConfigDirPrefixedForNoTemplateCurlyInString("/two")];
      },
      get constructor() {
        reads.push("constructor");
        return [escapedConfigDirPrefixedForNoTemplateCurlyInString("/constructor")];
      },
    };
    const result = substituteConfigDir({ ...emptyBaseMostFoldSeed(), compilerOptions: { paths } }, "/final");
    assert.deepStrictEqual(reads, ["2", "ordinary", "__proto__", "constructor"]);
    assert.deepStrictEqual(result.compilerOptions.paths, {
      "2": ["/final/two"],
      ordinary: ["/final/ordinary"],
      ["__proto__"]: ["/final/proto"],
      constructor: ["/final/constructor"],
    });
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(result.compilerOptions.paths, "__proto__"), {
      value: ["/final/proto"],
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(result.compilerOptions.paths, "constructor"), {
      value: ["/final/constructor"],
      enumerable: true,
      writable: true,
      configurable: true,
    });
    assert.strictEqual(Object.getPrototypeOf(result.compilerOptions.paths), Object.getPrototypeOf({}));
    assert.deepStrictEqual(R.keys(result.compilerOptions.paths ?? {}), ["2", "ordinary", "__proto__", "constructor"]);
  });

  it("E5 substitutes string compiler paths and preserves invalid entries and non-array paths values", () => {
    const marker = { future: true };
    const resolved = deliberatelyInvalid<ResolvedTsconfig>({
      configPath: "/proj/tsconfig.json",
      extendedPaths: [],
      compilerOptions: {
        typeRoots: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/types"), 1, null, marker],
        rootDirs: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/src"), false, "plain"],
        paths: {
          mixed: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/src/*"), 2, null, marker, "plain/*"],
          scalar: escapedConfigDirPrefixedForNoTemplateCurlyInString("/raw/*"),
          absent: null,
          object: marker,
        },
      },
    });
    const out = substituteConfigDir(resolved, "/final");
    assert.deepStrictEqual<unknown>(out.compilerOptions.typeRoots, ["/final/types", 1, null, marker]);
    assert.deepStrictEqual<unknown>(out.compilerOptions.rootDirs, ["/final/src", false, "plain"]);
    assert.deepStrictEqual<unknown>(out.compilerOptions.paths, {
      mixed: ["/final/src/*", 2, null, marker, "plain/*"],
      scalar: escapedConfigDirPrefixedForNoTemplateCurlyInString("/raw/*"),
      absent: null,
      object: marker,
    });
    assert.deepStrictEqual<unknown>(resolved.compilerOptions.typeRoots, [
      escapedConfigDirPrefixedForNoTemplateCurlyInString("/types"),
      1,
      null,
      marker,
    ]);
    assert.deepStrictEqual<unknown>(resolved.compilerOptions.paths?.mixed, [
      escapedConfigDirPrefixedForNoTemplateCurlyInString("/src/*"),
      2,
      null,
      marker,
      "plain/*",
    ]);
  });

  it("E5 watch excludes substitute strings and preserve non-string entries in both lists", () => {
    const marker = { future: true };
    const resolved = deliberatelyInvalid<ResolvedTsconfig>({
      configPath: "/proj/tsconfig.json",
      extendedPaths: [],
      compilerOptions: {},
      watchOptions: {
        excludeDirectories: [
          escapedConfigDirPrefixedForNoTemplateCurlyInString("/generated"),
          1,
          null,
          marker,
          "plain",
        ],
        excludeFiles: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/gen.ts"), false, marker, "plain.ts"],
      },
    });
    const out = substituteConfigDir(resolved, "/final");
    assert.deepStrictEqual<unknown>(out.watchOptions, {
      excludeDirectories: ["/final/generated", 1, null, marker, "plain"],
      excludeFiles: ["/final/gen.ts", false, marker, "plain.ts"],
    });
    assert.deepStrictEqual<unknown>(resolved.watchOptions, {
      excludeDirectories: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/generated"), 1, null, marker, "plain"],
      excludeFiles: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/gen.ts"), false, marker, "plain.ts"],
    });
  });

  it(`E5 leading \${configDir} replaced against the final dir across options, files/include/exclude, watchOptions excludes`, () => {
    const resolved = ResolvedTsconfig.make({
      configPath: "/proj/tsconfig.json",
      extendedPaths: ["/proj/tsconfig.json"],
      compilerOptions: {
        outDir: escapedConfigDirPrefixedForNoTemplateCurlyInString("/out"),
        typeRoots: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/types")],
        paths: { "@a/*": [escapedConfigDirPrefixedForNoTemplateCurlyInString("/src/*")] },
      },
      include: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/src/**/*"), "plain/**/*"],
      files: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/main.ts")],
      exclude: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/dist")],
      watchOptions: {
        excludeDirectories: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/node_modules")],
        excludeFiles: [escapedConfigDirPrefixedForNoTemplateCurlyInString("/gen.ts")],
      },
    });
    const out = substituteConfigDir(resolved, "/final");
    assert.strictEqual(out.compilerOptions.outDir, "/final/out");
    assert.deepStrictEqual(out.compilerOptions.typeRoots, ["/final/types"]);
    assert.deepStrictEqual(out.compilerOptions.paths, { "@a/*": ["/final/src/*"] });
    assert.deepStrictEqual(out.include, ["/final/src/**/*", "plain/**/*"]);
    assert.deepStrictEqual(out.files, ["/final/main.ts"]);
    assert.deepStrictEqual(out.exclude, ["/final/dist"]);
    assert.deepStrictEqual(out.watchOptions, {
      excludeDirectories: ["/final/node_modules"],
      excludeFiles: ["/final/gen.ts"],
    });
  });

  it("E5 case-insensitive prefix, leading position only", () => {
    const resolved = ResolvedTsconfig.make({
      configPath: "/p",
      extendedPaths: [],
      compilerOptions: { outDir: `\${CONFIGDIR}/out`, rootDir: `src/\${configDir}/x` },
    });
    const out = substituteConfigDir(resolved, "/final");
    assert.strictEqual(out.compilerOptions.outDir, "/final/out");
    assert.strictEqual(out.compilerOptions.rootDir, `src/\${configDir}/x`);
  });
});
