import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

import { WorkspacePackage } from "../../effected/workspaces/index.ts";
import {
	binConflict,
	binTargetOf,
	closureOf,
	consumerFiles,
	fileOverridesOf,
	installArgs,
	overridePath,
	readPackedManifest,
	scrubEnv,
	unresolvedSpecifiers,
	versionOf,
} from "../../effected/workspaces/internal/packedInstallPlan.ts";

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

const pkg = (name: string, fields: Record<string, Record<string, string>> = {}): WorkspacePackage =>
	WorkspacePackage.make({
		name,
		version: "1.0.0",
		path: `/repo/packages/${name.replace("@x/", "")}`,
		packageJsonPath: `/repo/packages/${name.replace("@x/", "")}/package.json`,
		relativePath: `packages/${name.replace("@x/", "")}`,
		workspaceRoot: "/repo",
		...fields,
	});
const PACKAGES = [
	pkg("@x/carrier", {
		dependencies: { "@x/lib": "workspace:^" },
		peerDependencies: { "@x/peer": "workspace:^" },
		devDependencies: { "@x/tool": "workspace:*" },
	}),
	// lib -> deep is transitive-only, deep -> lib closes a cycle, lib -> devonly is dev-only.
	pkg("@x/lib", { dependencies: { "@x/deep": "workspace:^" }, devDependencies: { "@x/devonly": "workspace:*" } }),
	pkg("@x/peer"),
	pkg("@x/tool"),
	pkg("@x/deep", { peerDependencies: { "@x/lib": "workspace:^" } }),
	pkg("@x/devonly"),
];
const INPUT = {
	version: "0.0.0",
	carrier: { name: "@x/carrier", tarball: "/t/carrier.tgz" },
	overrides: { "@x/lib": "/t/lib.tgz" },
	dependencies: { effect: "4.0.0-rc.117" },
};
const fileMap = (files: ReadonlyArray<{ readonly file: string; readonly content: string }>) =>
	Object.fromEntries(files.map(({ file, content }) => [file, content]));

describe("scrubEnv", () => {
	it("drops the parent package manager's context and undefined values, keeps the rest", () => {
		assert.deepStrictEqual(
			scrubEnv({
				PATH: "/usr/bin",
				HOME: "/home/u",
				CI: "true",
				INIT_CWD: "/repo",
				NODE_V8_COVERAGE: "/cov",
				npm_config_user_agent: "pnpm/12",
				NPM_CONFIG_REGISTRY: "https://x",
				pnpm_config_verify_deps_before_run: "false",
				PNPM_SCRIPT_SRC_DIR: "/repo/packages/x",
				PNPM_PACKAGE_NAME: "@x/carrier",
				YARN_NODE_LINKER: "pnp",
				yarn_enable_immutable_installs: "true",
				PNPM_HOME: "/home/u/.pnpm",
				EMPTY: undefined,
			}),
			{ PATH: "/usr/bin", HOME: "/home/u", PNPM_HOME: "/home/u/.pnpm" },
		);
	});
});

describe("versionOf", () => {
	it("takes the last version-shaped line of --version output", () => {
		assert.strictEqual(versionOf("11.19.1\n"), "11.19.1");
		assert.strictEqual(versionOf("v1.4.2"), "1.4.2");
		assert.strictEqual(versionOf("WARN this project pins pnpm@12.6.0\n12.5.1\n"), "12.5.1");
		assert.strictEqual(versionOf("4.5.0-rc.1\n"), "4.5.0-rc.1");
		assert.isUndefined(versionOf(""));
		assert.isUndefined(versionOf("command not found"));
	});
});

describe("closureOf", () => {
	it("auto walks runtime edges transitively from the carrier, carrier first, through cycles, never devDependencies", () => {
		const closure = closureOf(PACKAGES, "@x/carrier", "auto");
		assert.isTrue(Result.isSuccess(closure));
		if (Result.isSuccess(closure)) {
			assert.deepStrictEqual(
				closure.success.map((p) => p.name),
				["@x/carrier", "@x/lib", "@x/peer", "@x/deep"],
			);
		}
	});

	it("an explicit list is taken as given, carrier first, and an unknown name fails", () => {
		const explicit = closureOf(PACKAGES, "@x/carrier", ["@x/lib", "@x/carrier"]);
		assert.deepStrictEqual(Result.isSuccess(explicit) ? explicit.success.map((p) => p.name) : [], [
			"@x/carrier",
			"@x/lib",
		]);
		assert.deepStrictEqual(closureOf(PACKAGES, "@x/nope", "auto"), Result.fail("@x/nope"));
		assert.deepStrictEqual(closureOf(PACKAGES, "@x/carrier", ["@x/ghost"]), Result.fail("@x/ghost"));
	});
});

describe("consumerFiles", () => {
	it("npm: overrides in the manifest, the carrier a dependency (never dev, never an override), the probed version pinned", () => {
		const files = fileMap(consumerFiles({ ...INPUT, manager: "npm", version: "11.19.1" }));
		assert.deepStrictEqual(Object.keys(files), ["package.json"]);
		const manifest = Result.getOrThrow(S.decodeResult(JsonObject)(files["package.json"] ?? "{}"));
		assert.strictEqual(manifest.packageManager, "npm@11.19.1");
		assert.deepStrictEqual(manifest.dependencies, { "@x/carrier": "file:/t/carrier.tgz", effect: "4.0.0-rc.117" });
		assert.isUndefined(manifest.devDependencies, "omit=dev or NODE_ENV=production would skip a devDependency");
		assert.deepStrictEqual(manifest.overrides, { "@x/lib": "file:/t/lib.tgz" });
		assert.isUndefined(manifest.resolutions);
	});

	it("pnpm: overrides only in a settings-only pnpm-workspace.yaml", () => {
		const files = fileMap(consumerFiles({ ...INPUT, manager: "pnpm", version: "12.5.1" }));
		const manifest = Result.getOrThrow(S.decodeResult(JsonObject)(files["package.json"] ?? "{}"));
		assert.isUndefined(manifest.overrides);
		// pnpm resolves a `packageManager` pin from the registry even when it names
		// the running version, which fails an offline install; devEngines with
		// onFail "ignore" declares the same version and never fetches.
		assert.isUndefined(manifest.packageManager);
		assert.deepStrictEqual(manifest.devEngines, {
			packageManager: { name: "pnpm", version: "12.5.1", onFail: "ignore" },
		});
		// pnpm 12's default release-age gate is non-strict: without minimumReleaseAge: 0
		// it rewrites this file with exclusions and can pick an older, mature match for a range.
		assert.strictEqual(
			files["pnpm-workspace.yaml"],
			'minimumReleaseAge: 0\noverrides:\n  "@x/lib": "file:/t/lib.tgz"\n',
		);
		const empty = fileMap(consumerFiles({ ...INPUT, overrides: {}, manager: "pnpm", version: "12.5.1" }));
		assert.strictEqual(empty["pnpm-workspace.yaml"], "minimumReleaseAge: 0\noverrides: {}\n");
	});

	it("yarn: resolutions, plus the node-modules linker for Berry only", () => {
		const berry = fileMap(consumerFiles({ ...INPUT, manager: "yarn", version: "4.5.0" }));
		assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonObject)(berry["package.json"] ?? "{}")).resolutions, {
			"@x/lib": "file:/t/lib.tgz",
		});
		assert.strictEqual(
			berry[".yarnrc.yml"],
			"nodeLinker: node-modules\nenableImmutableInstalls: false\nenableScripts: false\nenableTelemetry: false\n",
		);
		assert.isUndefined(fileMap(consumerFiles({ ...INPUT, manager: "yarn", version: "1.22.22" }))[".yarnrc.yml"]);
	});

	it("yarn: Berry 4.10+ turns the release-age gate off, older Berry never sees the key it would reject", () => {
		const gated = "npmMinimalAgeGate: 0\n";
		for (const version of ["4.10.0", "4.18.1", "5.0.0"]) {
			assert.isTrue(
				fileMap(consumerFiles({ ...INPUT, manager: "yarn", version }))[".yarnrc.yml"]?.endsWith(gated),
				version,
			);
		}
		// Berry fails every command on a setting it does not know, and 4.9 predates this one.
		for (const version of ["4.9.4", "3.8.7", "2.4.3"]) {
			assert.notInclude(
				fileMap(consumerFiles({ ...INPUT, manager: "yarn", version }))[".yarnrc.yml"] ?? "",
				"npmMinimalAgeGate",
				version,
			);
		}
	});

	it("a consumer dependency naming a packed package is written as that package's tarball, for every manager", () => {
		// npm refuses an override that differs from a direct spec (EOVERRIDE); the same file: spec in both is accepted.
		for (const [manager, version] of [
			["npm", "11.19.1"],
			["pnpm", "12.5.1"],
			["yarn", "4.5.0"],
			["bun", "1.4.2"],
		] as const) {
			const files = fileMap(
				consumerFiles({
					...INPUT,
					manager,
					version,
					dependencies: { "@x/lib": "^1.0.0", "@x/carrier": "1.0.0", effect: "4.0.0-rc.117" },
				}),
			);
			const manifest = Result.getOrThrow(S.decodeResult(JsonObject)(files["package.json"] ?? "{}"));
			assert.deepStrictEqual(
				manifest.dependencies,
				{ "@x/carrier": "file:/t/carrier.tgz", "@x/lib": "file:/t/lib.tgz", effect: "4.0.0-rc.117" },
				manager,
			);
		}
	});

	it("bun: overrides in the manifest", () => {
		const files = fileMap(consumerFiles({ ...INPUT, manager: "bun", version: "1.4.2" }));
		assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonObject)(files["package.json"] ?? "{}")).overrides, {
			"@x/lib": "file:/t/lib.tgz",
		});
	});
});

describe("installArgs", () => {
	it("skips lifecycle scripts the way each manager spells it", () => {
		assert.deepStrictEqual(installArgs("npm", "11.19.1"), ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
		assert.deepStrictEqual(installArgs("pnpm", "12.5.1"), ["install", "--config.ignore-scripts=true"]);
		assert.deepStrictEqual(installArgs("yarn", "4.5.0"), ["install"]);
		assert.deepStrictEqual(installArgs("yarn", "1.22.22"), ["install", "--ignore-scripts", "--non-interactive"]);
		assert.deepStrictEqual(installArgs("bun", "1.4.2"), ["install", "--ignore-scripts"]);
	});
});

describe("unresolvedSpecifiers", () => {
	it("lists workspace: and catalog: specifiers in runtime maps only", () => {
		const manifest = JSON.stringify({
			dependencies: { "@x/lib": "workspace:^", ajv: "^8.0.0" },
			peerDependencies: { effect: "catalog:effect:peers" },
			devDependencies: { "@x/tool": "workspace:*" },
		});
		assert.deepStrictEqual(
			unresolvedSpecifiers(manifest),
			Result.succeed(["dependencies.@x/lib: workspace:^", "peerDependencies.effect: catalog:effect:peers"]),
		);
		assert.isTrue(Result.isFailure(unresolvedSpecifiers("{ nope")));
	});

	it("also lists link: and relative file: specifiers, which name a path only the workspace has", () => {
		const manifest = JSON.stringify({
			dependencies: { a: "link:../a", b: "file:../b", c: "file:./c.tgz", d: "file:/abs/d.tgz", e: "^1.0.0" },
			optionalDependencies: { f: "file:f" },
		});
		assert.deepStrictEqual(
			unresolvedSpecifiers(manifest),
			Result.succeed([
				"dependencies.a: link:../a",
				"dependencies.b: file:../b",
				"dependencies.c: file:./c.tgz",
				"optionalDependencies.f: file:f",
			]),
		);
	});
});

describe("readPackedManifest", () => {
	it("reads the name and the bin names: a bin object's keys, a bin string's unscoped package name", () => {
		const read = (manifest: unknown) =>
			Result.map(readPackedManifest(JSON.stringify(manifest)), (m) => [m.name, m.bins]);
		assert.deepStrictEqual(
			read({ name: "@x/tool", bin: { tool: "./a.js", "tool-mcp": "./b.js" } }),
			Result.succeed(["@x/tool", ["tool", "tool-mcp"]]),
		);
		assert.deepStrictEqual(read({ name: "@x/tool", bin: "./cli.js" }), Result.succeed(["@x/tool", ["tool"]]));
		assert.deepStrictEqual(read({ name: "plain", bin: "./cli.js" }), Result.succeed(["plain", ["plain"]]));
		assert.deepStrictEqual(read({ name: "none" }), Result.succeed(["none", []]));
		// A nameless string bin names nothing; a name that is not a string is no name.
		assert.deepStrictEqual(read({ name: 1, bin: "./cli.js" }), Result.succeed([undefined, []]));
	});

	it("a manifest that is not a JSON object fails", () => {
		assert.isTrue(Result.isFailure(readPackedManifest("[]")));
		assert.isTrue(Result.isFailure(readPackedManifest("null")));
		assert.isTrue(Result.isFailure(readPackedManifest("{ nope")));
	});
});

describe("binConflict", () => {
	const carrier = { name: "@x/carrier", bins: ["tool", "tool-mcp"] };

	it("names the first carrier bin another packed package also declares, and that package", () => {
		assert.deepStrictEqual(
			binConflict(carrier, [
				{ name: "@x/lib", bins: [] },
				{ name: "@x/mcp", bins: ["tool-mcp"] },
				{ name: "@x/cli", bins: ["tool"] },
			]),
			{ bin: "tool", package: "@x/cli" },
		);
	});

	it("a bin only another package declares, or the carrier listed among the others, is no conflict", () => {
		assert.isUndefined(
			binConflict(carrier, [
				{ name: "@x/cli", bins: ["tool-cli"] },
				{ name: "@x/carrier", bins: ["tool"] },
			]),
		);
	});
});

describe("fileOverridesOf", () => {
	it("keeps the bare-name file: entries of overrides, without the prefix", () => {
		assert.deepStrictEqual(
			fileOverridesOf({
				packages: ["packages/*"],
				overrides: {
					"@effected/cli": "file:../effected/packages/cli/dist/prod/npm/pkg",
					plain: "file:/abs/plain.tgz",
					"@effected/mcp": "^0.2.0",
					"parent>child": "file:../child",
					"pinned@1": "file:../pinned",
					numeric: 3,
				},
			}),
			{ "@effected/cli": "../effected/packages/cli/dist/prod/npm/pkg", plain: "/abs/plain.tgz" },
		);
	});

	it("skips __proto__ and keeps constructor and prototype as own entries of a prototype-free map", () => {
		// JSON.parse makes `__proto__` an own key, as a YAML parse of the workspace file can.
		const document: unknown = JSON.parse(
			'{"overrides":{"__proto__":"file:../evil","constructor":"file:../ctor","prototype":"file:../proto"}}',
		);
		const out = fileOverridesOf(document);
		assert.deepStrictEqual(Object.entries(out), [
			["constructor", "../ctor"],
			["prototype", "../proto"],
		]);
		assert.isNull(Object.getPrototypeOf(out));
		assert.isFalse(Object.hasOwn(out, "__proto__"));
		assert.isUndefined(fileOverridesOf({ overrides: {} }).constructor);
	});

	it("a document without an overrides map has none", () => {
		assert.deepStrictEqual(fileOverridesOf({ packages: [] }), {});
		assert.deepStrictEqual(fileOverridesOf({ overrides: ["file:a"] }), {});
		assert.deepStrictEqual(fileOverridesOf(null), {});
	});
});

describe("overridePath", () => {
	it("drops a file: prefix and leaves a bare path alone", () => {
		assert.deepStrictEqual([overridePath("file:../a"), overridePath("/abs/b.tgz")], ["../a", "/abs/b.tgz"]);
	});
});

describe("binTargetOf", () => {
	it("finds a bin object's entry, or a bin string under the unscoped package name", () => {
		const object = JSON.stringify({ name: "@x/carrier", bin: { tool: "./dist/tool.js", "tool-mcp": "./dist/mcp.js" } });
		assert.strictEqual(binTargetOf(object, "tool-mcp"), "./dist/mcp.js");
		assert.isUndefined(binTargetOf(object, "carrier"));
		assert.isUndefined(binTargetOf(object, "toString"), "an inherited key is no bin");
		const string = JSON.stringify({ name: "@x/tool", bin: "./cli.js" });
		assert.strictEqual(binTargetOf(string, "tool"), "./cli.js");
		assert.isUndefined(binTargetOf(string, "@x/tool"));
	});

	it("a manifest without a bin, or not a JSON object, declares none", () => {
		assert.isUndefined(binTargetOf(JSON.stringify({ name: "x" }), "x"));
		assert.isUndefined(binTargetOf("[]", "x"));
		assert.isUndefined(binTargetOf("{ nope", "x"));
	});
});
