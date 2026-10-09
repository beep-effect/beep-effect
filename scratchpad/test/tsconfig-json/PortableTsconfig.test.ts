import { assert, describe, it } from "@effect/vitest";
import type { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";
import { PortableTsconfig } from "../../effected/tsconfig-json/PortableTsconfig.ts";
import type { ResolvedTsconfig } from "../../effected/tsconfig-json/ResolvedTsconfig.ts";

// A "full option zoo" compilerOptions object: at least one representative from
// every R1 category (enum, live boolean, dead boolean, deprecated boolean,
// path string, path list, plain string, string list, record, object list,
// number), plus an unknown passthrough key. Cast through `unknown` because the
// literal intentionally carries dead/unknown keys the schema types don't know.
const fullOptionZoo = {
	// enum family — preserved
	target: "es2022",
	module: "nodenext",
	moduleResolution: "bundler",
	jsx: "react-jsx",
	moduleDetection: "force",
	lib: ["esnext", "dom"],
	ignoreDeprecations: "6.0",
	// enum, NOT preserved (emit formatting only)
	newLine: "lf",
	// strict family — preserved
	strict: true,
	noUnusedLocals: true,
	exactOptionalPropertyTypes: true,
	// interop / module-semantics booleans — preserved
	esModuleInterop: true,
	verbatimModuleSyntax: true,
	isolatedModules: true,
	skipLibCheck: true,
	// jsx plain strings — preserved
	jsxImportSource: "react",
	reactNamespace: "React",
	// emit/path/file-selection — EXCLUDED
	outDir: "./dist",
	outFile: "./out.js",
	rootDir: "./src",
	baseUrl: ".",
	paths: { "#app/*": ["./src/*"] },
	typeRoots: ["./types"],
	types: ["node"],
	declaration: true,
	declarationMap: true,
	emitDeclarationOnly: true,
	sourceMap: true,
	inlineSourceMap: true,
	inlineSources: true,
	tsBuildInfoFile: "./tsBuildInfo.json",
	incremental: true,
	composite: true,
	// forced flags in the input, expected to be overridden
	noEmit: false,
	// number option — excluded (obscure checking-depth tuning, not carried)
	maxNodeModuleJsDepth: 3,
	// dead option, TS ignores it entirely — should never appear on output
	charset: "utf8",
	// unknown passthrough — DROPPED (allow-list, not deny-list)
	someFutureOption: 42,
} as unknown as CompilerOptions.Type;

describe("PortableTsconfig.make — from a bare CompilerOptions.Type", () => {
	it("stamps $schema and forces composite:false, noEmit:true", () => {
		const portable = PortableTsconfig.make(fullOptionZoo);
		assert.strictEqual(portable.$schema, "https://json.schemastore.org/tsconfig");
		assert.strictEqual(portable.compilerOptions.composite, false);
		assert.strictEqual(portable.compilerOptions.noEmit, true);
	});

	it("preserves type-semantics enum options", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.strictEqual(compilerOptions.target, "es2022");
		assert.strictEqual(compilerOptions.module, "nodenext");
		assert.strictEqual(compilerOptions.moduleResolution, "bundler");
		assert.strictEqual(compilerOptions.jsx, "react-jsx");
		assert.strictEqual(compilerOptions.moduleDetection, "force");
		assert.deepStrictEqual(compilerOptions.lib, ["esnext", "dom"]);
		assert.strictEqual(compilerOptions.ignoreDeprecations, "6.0");
	});

	it("preserves the strict family and other type-semantics booleans", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.strictEqual(compilerOptions.strict, true);
		assert.strictEqual(compilerOptions.noUnusedLocals, true);
		assert.strictEqual(compilerOptions.exactOptionalPropertyTypes, true);
		assert.strictEqual(compilerOptions.esModuleInterop, true);
		assert.strictEqual(compilerOptions.verbatimModuleSyntax, true);
		assert.strictEqual(compilerOptions.isolatedModules, true);
		assert.strictEqual(compilerOptions.skipLibCheck, true);
	});

	it("preserves the jsx plain-string family", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.strictEqual(compilerOptions.jsxImportSource, "react");
		assert.strictEqual(compilerOptions.reactNamespace, "React");
	});

	it("excludes emit/path/file-selection options", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		for (const key of [
			"outDir",
			"outFile",
			"rootDir",
			"baseUrl",
			"paths",
			"typeRoots",
			"declaration",
			"declarationMap",
			"emitDeclarationOnly",
			"sourceMap",
			"inlineSourceMap",
			"inlineSources",
			"tsBuildInfoFile",
			"incremental",
		]) {
			assert.isFalse(key in compilerOptions, `expected "${key}" to be excluded`);
		}
	});

	// `types` is portable but resolution-dependent, so it is neither in the
	// unconditional allow-list nor in the exclusion list above — it is opt-in.
	// Its default (dropped) and opted-in behavior live in their own describe.

	it("excludes an emit-formatting-only enum (newLine)", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.isFalse("newLine" in compilerOptions);
	});

	it("excludes the obscure numeric checking-depth option", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.isFalse("maxNodeModuleJsDepth" in compilerOptions);
	});

	it("forces composite:false and noEmit:true even when the input disagrees", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		// input declared composite: true, noEmit: false — forced flags win
		assert.strictEqual(compilerOptions.composite, false);
		assert.strictEqual(compilerOptions.noEmit, true);
	});

	it("drops dead options that never had a typed field", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.isFalse("charset" in compilerOptions);
	});

	it("drops unknown passthrough options (allow-list, not deny-list)", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo);
		assert.isFalse("someFutureOption" in compilerOptions);
	});

	it("output survives a JSON.stringify round-trip", () => {
		const portable = PortableTsconfig.make(fullOptionZoo);
		const roundTripped = JSON.parse(JSON.stringify(portable));
		assert.deepStrictEqual(roundTripped, portable);
	});

	it("an empty compilerOptions still yields the forced flags and $schema", () => {
		const portable = PortableTsconfig.make({} as CompilerOptions.Type);
		assert.deepStrictEqual(portable, {
			$schema: "https://json.schemastore.org/tsconfig",
			compilerOptions: { composite: false, noEmit: true },
		});
	});

	it("a passthrough string configPath does NOT misclassify a bare CompilerOptions.Type as a ResolvedTsconfig", () => {
		// A hostile config file's compilerOptions can carry ANY unrecognized key via
		// forward tolerance — including one named "configPath". Checking configPath
		// alone would misread this as a ResolvedTsconfig and read the (nonexistent)
		// .compilerOptions off it, throwing a TypeError. The extendedPaths check
		// closes that hole: this bag has no array extendedPaths, so it is filtered
		// as bare options, not thrown on.
		const hostile = {
			strict: true,
			target: "es2022",
			configPath: "/not/actually/a/ResolvedTsconfig",
		} as unknown as CompilerOptions.Type;
		const portable = PortableTsconfig.make(hostile);
		assert.strictEqual(portable.compilerOptions.strict, true);
		assert.strictEqual(portable.compilerOptions.target, "es2022");
		assert.isFalse("configPath" in portable.compilerOptions);
	});

	it("a bag crafted with BOTH passthrough keys (configPath AND extendedPaths) never throws", () => {
		// Escalation of the previous case: a hostile bag satisfying both the
		// string-configPath and array-extendedPaths conjuncts, still without a
		// compilerOptions object. Before the compilerOptions conjunct, the guard
		// misclassified this as a ResolvedTsconfig and make() threw a TypeError
		// indexing the undefined input.compilerOptions. The discrimination is now
		// total: no compilerOptions object means the bag is filtered as bare
		// options — sane filtering, no throw.
		const craftedBoth = {
			strict: true,
			target: "es2022",
			configPath: "/still/not/a/ResolvedTsconfig",
			extendedPaths: [],
		} as unknown as CompilerOptions.Type;
		const portable = PortableTsconfig.make(craftedBoth);
		assert.strictEqual(portable.compilerOptions.strict, true);
		assert.strictEqual(portable.compilerOptions.target, "es2022");
		assert.strictEqual(portable.compilerOptions.composite, false);
		assert.strictEqual(portable.compilerOptions.noEmit, true);
		// Neither crafted key survives the allow-list.
		assert.isFalse("configPath" in portable.compilerOptions);
		assert.isFalse("extendedPaths" in portable.compilerOptions);
	});
});

describe("PortableTsconfig.make — from a ResolvedTsconfig (structural discrimination via configPath + extendedPaths)", () => {
	it("reads compilerOptions off a ResolvedTsconfig, ignoring its other fields", () => {
		const resolved: ResolvedTsconfig = {
			configPath: "/proj/tsconfig.json",
			extendedPaths: ["/proj/tsconfig.json"],
			compilerOptions: { strict: true, outDir: "./dist", target: "es2022" },
			include: ["src/**/*"],
		};
		const portable = PortableTsconfig.make(resolved);
		assert.strictEqual(portable.compilerOptions.strict, true);
		assert.strictEqual(portable.compilerOptions.target, "es2022");
		assert.isFalse("outDir" in portable.compilerOptions);
		// ResolvedTsconfig-only fields never leak onto the portable shape.
		assert.isFalse("configPath" in portable);
		assert.isFalse("include" in portable);
	});
});

describe("PortableTsconfig.make — the includeTypes opt-in", () => {
	it("carries `types` when opted in", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo, { includeTypes: true });
		assert.deepStrictEqual(compilerOptions.types, ["node"]);
	});

	it("still drops `typeRoots` when opted in — only `types` is package-name-valued", () => {
		const { compilerOptions } = PortableTsconfig.make(fullOptionZoo, { includeTypes: true });
		assert.isFalse("typeRoots" in compilerOptions);
	});

	it("omits the key entirely when the source declared no `types`", () => {
		const { compilerOptions } = PortableTsconfig.make({ strict: true } as CompilerOptions.Type, {
			includeTypes: true,
		});
		assert.isFalse("types" in compilerOptions);
	});

	it("preserves an empty `types: []` — a deliberate opt-out of automatic @types inclusion", () => {
		const { compilerOptions } = PortableTsconfig.make({ types: [] } as unknown as CompilerOptions.Type, {
			includeTypes: true,
		});
		assert.deepStrictEqual(compilerOptions.types, []);
	});

	it("drops `types` under every non-opted-in call shape (the default is unchanged)", () => {
		for (const options of [undefined, {}, { includeTypes: false }] as const) {
			const { compilerOptions } = PortableTsconfig.make(fullOptionZoo, options);
			assert.isFalse("types" in compilerOptions, `expected "types" dropped for ${JSON.stringify(options)}`);
		}
	});

	it("opts in off a ResolvedTsconfig too", () => {
		const resolved: ResolvedTsconfig = {
			configPath: "/proj/tsconfig.json",
			extendedPaths: ["/proj/tsconfig.json"],
			compilerOptions: { types: ["node", "vitest/globals"], typeRoots: ["/proj/types"] },
		};
		const { compilerOptions } = PortableTsconfig.make(resolved, { includeTypes: true });
		assert.deepStrictEqual(compilerOptions.types, ["node", "vitest/globals"]);
		assert.isFalse("typeRoots" in compilerOptions);
	});

	it("does not let the forced flags or $schema drift when opted in", () => {
		const portable = PortableTsconfig.make(fullOptionZoo, { includeTypes: true });
		assert.strictEqual(portable.$schema, "https://json.schemastore.org/tsconfig");
		assert.strictEqual(portable.compilerOptions.composite, false);
		assert.strictEqual(portable.compilerOptions.noEmit, true);
	});
});
