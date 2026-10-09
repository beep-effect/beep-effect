// @effect-diagnostics nodeBuiltinImport:skip-file
import { posix } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { ResolvedTsconfig } from "../../effected/tsconfig-json/ResolvedTsconfig.ts";

// The injected path resolver mirrors `Path.Path.resolve` (absolute `b` wins;
// relative `b` resolves against `a`, collapsing `.`/`..`). POSIX for
// determinism — the engine operates on normalized forward-slash paths.
const join = (a: string, b: string): string => posix.resolve(a, b);

// A `${configDir}`-prefixed value, written as an escaped template literal so the
// intentional token survives Biome's noTemplateCurlyInString rule.
const cd = (rest: string): string => `\${configDir}${rest}`;

// The base-most fold seed: an empty accumulator the loader (Task 8) folds every
// config onto, own config last.
const seed = (): ResolvedTsconfig => ({ configPath: "", extendedPaths: [], compilerOptions: {} });

const { absolutize, merge, substituteConfigDir } = ResolvedTsconfig;

describe("ResolvedTsconfig.merge — E4 merge per field", () => {
	it("E4 compilerOptions: per-key shallow assign, derived wins", () => {
		const base = merge(seed(), { compilerOptions: { strict: false, lib: ["esnext"] } }, "/proj/base.json");
		const result = merge(base, { compilerOptions: { strict: true, target: "es2022" } }, "/proj/tsconfig.json");
		assert.deepStrictEqual(result.compilerOptions, { strict: true, target: "es2022", lib: ["esnext"] });
	});

	it("E4 paths: replaced wholesale; pathsBase tracks the declaring config through a two-level chain", () => {
		const base = merge(seed(), { compilerOptions: { paths: { "@app/*": ["src/*"] } } }, "/proj/configs/base.json");
		// A more-derived config that does NOT redeclare paths inherits them and the pathsBase.
		const result = merge(base, { compilerOptions: { strict: true } }, "/proj/tsconfig.json");
		assert.deepStrictEqual(result.compilerOptions.paths, { "@app/*": ["src/*"] });
		assert.strictEqual(result.pathsBase, "/proj/configs");

		// A third config that DOES redeclare paths replaces them wholesale and moves pathsBase.
		const result2 = merge(result, { compilerOptions: { paths: { "@x/*": ["y/*"] } } }, "/proj/deep/tsconfig.json");
		assert.deepStrictEqual(result2.compilerOptions.paths, { "@x/*": ["y/*"] });
		assert.strictEqual(result2.pathsBase, "/proj/deep");
	});

	it("E4 files/include/exclude: own empty array beats inherited", () => {
		const base = merge(seed(), { include: ["src"] }, "/proj/configs/base.json");
		const result = merge(base, { include: [] }, "/proj/tsconfig.json");
		assert.deepStrictEqual(result.include, []);
	});

	it("E4 files/include/exclude: inherited entries re-rooted relative to the declaring config", () => {
		const base = merge(seed(), { include: ["src/**/*", "/abs/x", cd("/g")] }, "/proj/configs/base.json");
		const result = merge(base, {}, "/proj/tsconfig.json");
		// relative(dirname("/proj/tsconfig.json"), dirname("/proj/configs/base.json"))
		//   = relative("/proj", "/proj/configs") = "configs"
		// Absolute and ${configDir}-prefixed entries are exempt from re-rooting.
		assert.deepStrictEqual(result.include, ["configs/src/**/*", "/abs/x", cd("/g")]);
	});

	it("E4 references: never inherited", () => {
		const base = merge(seed(), { references: [{ path: "../core" }] }, "/proj/base.json");
		const inherited = merge(base, { compilerOptions: {} }, "/proj/tsconfig.json");
		assert.isUndefined(inherited.references);
		// The own config's references win outright.
		const own = merge(base, { references: [{ path: "../own" }] }, "/proj/tsconfig.json");
		assert.deepStrictEqual(own.references, [{ path: "../own" }]);
	});

	it("E4 typeAcquisition: never inherited", () => {
		const base = merge(seed(), { typeAcquisition: { enable: true } }, "/proj/base.json");
		const result = merge(base, {}, "/proj/tsconfig.json");
		assert.isUndefined(result.typeAcquisition);
	});

	it("E4 compileOnSave: inherited only when own undefined and inherited truthy", () => {
		// Own defined wins.
		const ownWins = merge(merge(seed(), { compileOnSave: true }, "/b"), { compileOnSave: false }, "/o");
		assert.strictEqual(ownWins.compileOnSave, false);
		// Own undefined + inherited truthy -> inherited.
		const carried = merge(merge(seed(), { compileOnSave: true }, "/b"), {}, "/o");
		assert.strictEqual(carried.compileOnSave, true);
		// Own undefined + inherited falsy -> NOT carried.
		const dropped = merge(merge(seed(), { compileOnSave: false }, "/b"), {}, "/o");
		assert.isUndefined(dropped.compileOnSave);
	});

	it("E4 watchOptions: per-key shallow merge", () => {
		const base = merge(seed(), { watchOptions: { watchFile: "usefsevents", excludeFiles: ["a"] } }, "/b");
		const result = merge(base, { watchOptions: { watchFile: "fixedpollinginterval" } }, "/o");
		assert.deepStrictEqual(result.watchOptions, { watchFile: "fixedpollinginterval", excludeFiles: ["a"] });
	});

	it("E4 unknown passthrough keys: derived wins per key (assign semantics)", () => {
		const base = merge(seed(), { "ts-node": { esm: true }, buildOptions: { a: 1, b: 9 } }, "/proj/base.json");
		const result = merge(base, { buildOptions: { a: 2 }, custom: "x" }, "/proj/tsconfig.json");
		// buildOptions replaced wholesale by the derived value; ts-node survives; custom added.
		assert.deepStrictEqual(result.buildOptions, { a: 2 });
		assert.deepStrictEqual(result["ts-node"], { esm: true });
		assert.strictEqual(result.custom, "x");
		// extends is consumed, never data.
		const withExtends = merge(seed(), { extends: "./base.json", compilerOptions: {} }, "/proj/tsconfig.json");
		assert.isUndefined(withExtends.extends);
	});

	it("configPath and extendedPaths track the fold, own config last", () => {
		const base = merge(seed(), {}, "/proj/configs/base.json");
		const result = merge(base, {}, "/proj/tsconfig.json");
		assert.strictEqual(result.configPath, "/proj/tsconfig.json");
		assert.deepStrictEqual(result.extendedPaths, ["/proj/configs/base.json", "/proj/tsconfig.json"]);
	});

	it("E4 files/include/exclude: a 3-config chain re-roots per-step, composing WITHOUT collapsing `..` (byte-identical to tsc)", () => {
		// Three non-nested dirs: /proj/shared (base) and /proj/apps (mid) are
		// SIBLINGS under /proj; /proj/apps/web (leaf) is nested under /proj/apps.
		// TsconfigLoader folds base-most first, own config last — exactly the two
		// merge calls below.
		const base = merge(seed(), { include: ["src"] }, "/proj/shared/base.json");
		const mid = merge(base, {}, "/proj/apps/tsconfig.base.json");
		const result = merge(mid, {}, "/proj/apps/web/tsconfig.json");

		// Per the merge() formula (rerootPrefix = relative(dirname(derivedPath),
		// dirname(base.configPath)), applied to every inherited entry via
		// rerootEntry), each step re-roots the CURRENT accumulated entries — it
		// does not recompute a single relative path from the leaf straight to the
		// original base. Composed by hand, step by step:
		//
		// Step 1 (base.json itself): merge(seed(), {include:["src"]}, ".../base.json")
		//   -> derived declares include, so it wins outright, unrooted: ["src"]
		//
		// Step 2 (tsconfig.base.json extends base.json):
		//   rerootPrefix = relative("/proj/apps", "/proj/shared") = "../shared"
		//   mergeFileList(["src"], undefined, "../shared")
		//     -> rerootEntry("../shared", "src") = "../shared/src"
		//
		// Step 3 (tsconfig.json extends tsconfig.base.json):
		//   rerootPrefix = relative("/proj/apps/web", "/proj/apps") = ".."
		//   mergeFileList(["../shared/src"], undefined, "..")
		//     -> rerootEntry("..", "../shared/src") = "../" + "../shared/src" = "../../shared/src"
		//
		// The two step-prefixes ("../shared" then "..") compose onto the ORIGINAL
		// "src" entry rather than being collapsed into one direct
		// relative(leaf, originalBase) computation — pinning that merge() folds
		// per-step, as TsconfigLoader actually drives it.
		assert.deepStrictEqual(result.include, ["../../shared/src"]);
		assert.strictEqual(result.configPath, "/proj/apps/web/tsconfig.json");
		assert.deepStrictEqual(result.extendedPaths, [
			"/proj/shared/base.json",
			"/proj/apps/tsconfig.base.json",
			"/proj/apps/web/tsconfig.json",
		]);
	});

	it("E4 files/include/exclude: composed re-rooting keeps a cancellable `web/..` segment UNCOLLAPSED (byte-identical to tsc)", () => {
		// The previous test's expected string ("../../shared/src") is identical
		// under collapsed and uncollapsed composition — nothing cancels — so it
		// cannot catch a mutation that normalizes `..` segments. This fixture
		// INVERTS the nesting so composition creates a cancellable segment: the
		// mid config lives BELOW the own config's directory.
		//
		//   base: /proj/shared/base.json           include ["src"]
		//   mid:  /proj/apps/web/tsconfig.base.json (extends ../../shared/base.json)
		//   own:  /proj/apps/tsconfig.json          (extends ./web/tsconfig.base.json)
		const base = merge(seed(), { include: ["src"] }, "/proj/shared/base.json");
		const mid = merge(base, {}, "/proj/apps/web/tsconfig.base.json");
		const result = merge(mid, {}, "/proj/apps/tsconfig.json");

		// Composed by hand from the merge() formula:
		//
		// Step 2 (mid extends base):
		//   rerootPrefix = relative("/proj/apps/web", "/proj/shared") = "../../shared"
		//   rerootEntry("../../shared", "src") = "../../shared/src"
		//
		// Step 3 (own extends mid):
		//   rerootPrefix = relative("/proj/apps", "/proj/apps/web") = "web"
		//   rerootEntry("web", "../../shared/src") = "web/../../shared/src"
		//
		// The "web/.." pair is cancellable — a `..`-collapsing mutation would emit
		// "../shared/src" instead and this assertion fails. tsc performs exactly
		// this prefix concatenation without normalizing, so the uncollapsed string
		// is the byte-identical-to-tsc behavior the design doc records.
		assert.deepStrictEqual(result.include, ["web/../../shared/src"]);
		assert.strictEqual(result.configPath, "/proj/apps/tsconfig.json");
		assert.deepStrictEqual(result.extendedPaths, [
			"/proj/shared/base.json",
			"/proj/apps/web/tsconfig.base.json",
			"/proj/apps/tsconfig.json",
		]);
	});
});

describe("ResolvedTsconfig.absolutize — E5 parse-time absolutization", () => {
	it("E5 path options absolutized against the declaring config's directory", () => {
		const out = absolutize(
			{ compilerOptions: { outDir: "./dist", rootDir: "src", typeRoots: ["./types", "node_modules/@types"] } },
			"/proj/base",
			join,
		);
		assert.strictEqual(out.compilerOptions?.outDir, "/proj/base/dist");
		assert.strictEqual(out.compilerOptions?.rootDir, "/proj/base/src");
		assert.deepStrictEqual(out.compilerOptions?.typeRoots, ["/proj/base/types", "/proj/base/node_modules/@types"]);
	});

	it("E5 paths values stay verbatim", () => {
		const out = absolutize({ compilerOptions: { paths: { "@app/*": ["./src/*"] } } }, "/proj/base", join);
		assert.deepStrictEqual(out.compilerOptions?.paths, { "@app/*": ["./src/*"] });
	});

	it(`E5 \${configDir}-prefixed values are exempt from absolutization`, () => {
		const out = absolutize(
			{ compilerOptions: { outDir: cd("/out"), typeRoots: [cd("/types"), "./local"] } },
			"/proj/base",
			join,
		);
		assert.strictEqual(out.compilerOptions?.outDir, cd("/out"));
		assert.deepStrictEqual(out.compilerOptions?.typeRoots, [cd("/types"), "/proj/base/local"]);
	});

	it("E5 already-absolute path options are preserved", () => {
		const out = absolutize({ compilerOptions: { outDir: "/already/abs" } }, "/proj/base", join);
		assert.strictEqual(out.compilerOptions?.outDir, "/already/abs");
	});

	it("a doc without compilerOptions is returned untouched", () => {
		const doc = { include: ["src"] };
		const out = absolutize(doc, "/proj/base", join);
		assert.deepStrictEqual(out, doc);
	});
});

describe("ResolvedTsconfig.substituteConfigDir — E5 final phase", () => {
	it(`E5 leading \${configDir} replaced against the final dir across options, files/include/exclude, watchOptions excludes`, () => {
		const resolved: ResolvedTsconfig = {
			configPath: "/proj/tsconfig.json",
			extendedPaths: ["/proj/tsconfig.json"],
			compilerOptions: {
				outDir: cd("/out"),
				typeRoots: [cd("/types")],
				paths: { "@a/*": [cd("/src/*")] },
			},
			include: [cd("/src/**/*"), "plain/**/*"],
			files: [cd("/main.ts")],
			exclude: [cd("/dist")],
			watchOptions: {
				excludeDirectories: [cd("/node_modules")],
				excludeFiles: [cd("/gen.ts")],
			},
		};
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
		const resolved: ResolvedTsconfig = {
			configPath: "/p",
			extendedPaths: [],
			compilerOptions: { outDir: `\${CONFIGDIR}/out`, rootDir: `src/\${configDir}/x` },
		};
		const out = substituteConfigDir(resolved, "/final");
		assert.strictEqual(out.compilerOptions.outDir, "/final/out");
		assert.strictEqual(out.compilerOptions.rootDir, `src/\${configDir}/x`);
	});
});
