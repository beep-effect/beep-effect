import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import minimal from "./fixtures/minimal/package.json" with { type: "json" };
import full from "./fixtures/full/package.json" with { type: "json" };
import scoped from "./fixtures/scoped/package.json" with { type: "json" };
import boilerplate from "./fixtures/boilerplate/package.json" with { type: "json" };
import customFields from "./fixtures/with-custom-fields/package.json" with { type: "json" };
import { Package } from "../../../effected/package-json/Package.ts";
import { PackageJsonFile } from "../../../effected/package-json/PackageJsonFile.ts";

const Json = S.fromJsonString(S.Record(S.String, S.Unknown));

const fixturePath = (name: string) => `/fixtures/${name}/package.json`;

// The subject consumes FileSystem and Path; each suite gets its own seeded volume.
const TestLayer = PackageJsonFile.layer.pipe(
	Layer.provideMerge(Layer.mergeAll(
		MemoryFileSystem.layerWith({
			[fixturePath("minimal")]: JSON.stringify(minimal),
			[fixturePath("full")]: JSON.stringify(full),
			[fixturePath("scoped")]: JSON.stringify(scoped),
			[fixturePath("boilerplate")]: JSON.stringify(boilerplate),
			[fixturePath("with-custom-fields")]: JSON.stringify(customFields),
		}),
		Path.layer,
	)),
);

describe("PackageJsonFile", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
		it.effect("reads the minimal fixture", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const pkg = yield* file.read(fixturePath("minimal"));
				assert.strictEqual(pkg.name, "minimal-pkg");
				assert.strictEqual(pkg.version.toString(), "1.0.0");
				assert.strictEqual(HashMap.size(pkg.dependencies), 0);
				assert.strictEqual(pkg.description, undefined);
			}),
		);

		it.effect("reads the full fixture with all typed fields", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const pkg = yield* file.read(fixturePath("full"));
				assert.strictEqual(pkg.name, "@scope/full-pkg");
				assert.isTrue(pkg.isScoped);
				assert.isTrue(pkg.isESM);
				assert.isTrue(pkg.isPrivate);
				assert.strictEqual(pkg.description, "A full package with all typed fields");
				assert.strictEqual(pkg.license, "MIT");
				assert.strictEqual(HashMap.size(pkg.dependencies), 2);
				assert.strictEqual(HashMap.size(pkg.devDependencies), 2);
				assert.strictEqual(HashMap.size(pkg.peerDependencies), 1);
				assert.strictEqual(HashMap.size(pkg.optionalDependencies), 1);
				assertSome(HashMap.get(pkg.scripts, "test"), "vitest run");
			}),
		);

		it.effect("reads the scoped fixture", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const pkg = yield* file.read(fixturePath("scoped"));
				assert.strictEqual(pkg.name, "@myorg/scoped-pkg");
				assert.isTrue(pkg.isScoped);
			}),
		);

		it.effect("reads the boilerplate fixture including packageManager and devEngines", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const pkg = yield* file.read(fixturePath("boilerplate"));
				assert.strictEqual(pkg.name, "@savvy-web/pnpm-module-template");
				assert.isTrue(pkg.isPrivate);
				assert.isTrue(pkg.isESM);
				assert.isTrue(pkg.packageManager !== undefined);
				assert.strictEqual(pkg.packageManager?.name, "pnpm");
				assert.isTrue(HashMap.has(pkg.scripts, "build"));
			}),
		);

		it.effect("fails with PackageJsonNotFoundError for a missing file", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const error = yield* Effect.flip(file.read("/nonexistent/package.json"));
				assert.strictEqual(error._tag, "PackageJsonNotFoundError");
			}),
		);

		it.effect("fails with PackageJsonParseError for invalid JSON", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-parse-" });
				const path = pathService.join(dir, "package.json");
				yield* fs.writeFileString(path, "{ not valid json");
				const error = yield* Effect.flip(file.read(path));

				assert.strictEqual(error._tag, "PackageJsonParseError");
			}),
		);
	});
});

describe("PackageJsonFile round-trip", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
		const roundtrip = Effect.fn("roundtrip")(function* (fixture: string) {
			const file = yield* PackageJsonFile;
			const fs = yield* FileSystem.FileSystem;
			const pathService = yield* Path.Path;
			const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-rt-" });
			const outPath = pathService.join(dir, "package.json");
			const pkg = yield* file.read(fixturePath(fixture));
			yield* file.write(outPath, pkg);
			const written = yield* S.decodeEffect(Json)(yield* fs.readFileString(outPath));

			return written;
		});

		it.effect("minimal preserves name and version and strips empty dep maps", () =>
			Effect.gen(function* () {
				const result = yield* roundtrip("minimal");
				assert.strictEqual(result.name, "minimal-pkg");
				assert.strictEqual(result.version, "1.0.0");
				assert.isFalse("dependencies" in result);
				assert.isFalse("devDependencies" in result);
			}),
		);

		it.effect("full preserves typed fields and sorts keys and deps", () =>
			Effect.gen(function* () {
				const result = yield* roundtrip("full");
				assert.strictEqual(result.name, "@scope/full-pkg");
				assert.strictEqual(result.version, "2.1.0");
				assert.strictEqual(result.description, "A full package with all typed fields");
				assert.deepStrictEqual(result.dependencies, { effect: "^3.0.0", lodash: "^4.0.0" });
				const keys = Object.keys(result);
				assert.isTrue(keys.indexOf("name") < keys.indexOf("version"));
				assert.isTrue(keys.indexOf("scripts") < keys.indexOf("dependencies"));
			}),
		);

		it.effect("with-custom-fields preserves unknown fields", () =>
			Effect.gen(function* () {
				const result = yield* roundtrip("with-custom-fields");
				assert.strictEqual(result.customString, "preserved");
				assert.deepStrictEqual(result.customArray, [1, 2, 3]);
				assert.deepStrictEqual(result.customObject, { nested: true, deep: { value: "kept" } });
				assert.strictEqual(result["x-custom-namespace"], "also preserved");
			}),
		);

		it.effect("boilerplate preserves known and unknown fields and does not mutate workspace specifiers", () =>
			Effect.gen(function* () {
				const result = yield* roundtrip("boilerplate");
				assert.strictEqual(result.name, "@savvy-web/pnpm-module-template");
				assert.isDefined(result.publishConfig);
				assert.deepStrictEqual(result.repository, {
					type: "git",
					url: "https://github.com/spencerbeggs/pnpm-module-template.git",
				});
			}),
		);

		it.effect("write writes what it is given — resolution is NOT fused into write", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-nores-" });
				const outPath = pathService.join(dir, "package.json");
				const pkg = yield* Package.decode({
					name: "p",
					version: "1.0.0",
					customX: "preserved",
					dependencies: { lib: "workspace:*" },
				});
				yield* file.write(outPath, pkg);
				const written = yield* S.decodeEffect(Json)(yield* fs.readFileString(outPath));

				assert.strictEqual(written.customX, "preserved");
				assert.deepStrictEqual(written.dependencies, { lib: "workspace:*" });
			}),
		);

		it.effect('write with indent: "preserve" detects the overwritten file\'s indentation', () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-preserve-" });
				const outPath = pathService.join(dir, "package.json");
				yield* fs.writeFileString(outPath, '{\n\t"name": "p",\n\t"version": "1.0.0"\n}\n');
				const pkg = yield* Package.decode({ name: "p", version: "2.0.0" });
				yield* file.write(outPath, pkg, { indent: "preserve" });
				const written = yield* fs.readFileString(outPath);

				assert.isTrue(written.includes('\n\t"name"'));
				assert.isTrue(written.includes('"version": "2.0.0"'));
			}),
		);

		it.effect('write with indent: "preserve" to a fresh path falls back to two spaces', () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-preserve-fresh-" });
				const outPath = pathService.join(dir, "package.json");
				const pkg = yield* Package.decode({ name: "p", version: "1.0.0" });
				yield* file.write(outPath, pkg, { indent: "preserve" });
				const written = yield* fs.readFileString(outPath);

				assert.isTrue(written.includes('\n  "name"'));
				assert.isFalse(written.includes("\t"));
			}),
		);

		it.effect("full round-trip preserves nested, encoded and unknown-shaped fields", () =>
			Effect.gen(function* () {
				const result = yield* roundtrip("full");
				// packageManager is a codec — it must re-encode to the exact string.
				assert.strictEqual(result.packageManager, "pnpm@10.33.0+sha512.abc123");
				// private flag and nested structural fields survive verbatim.
				assert.strictEqual(result.private, true);
				assert.deepStrictEqual(result.exports, { ".": "./src/index.ts", "./utils": "./src/utils.ts" });
				assert.deepStrictEqual(result.bin, { "my-cli": "./dist/cli.js" });
				assert.deepStrictEqual(result.peerDependenciesMeta, { effect: { optional: true } });
				assert.deepStrictEqual(result.optionalDependencies, { fsevents: "^2.3.0" });
				assert.deepStrictEqual(result.engines, { node: ">=18.0.0" });
				assert.deepStrictEqual(result.devEngines, {
					packageManager: { name: "pnpm", version: "10.33.0", onFail: "ignore" },
					runtime: [{ name: "node", version: "24.11.0", onFail: "ignore" }],
				});
				assert.deepStrictEqual(result.publishConfig, {
					access: "public",
					directory: "dist/npm",
					linkDirectory: true,
					registry: "https://registry.npmjs.org/",
				});
			}),
		);
	});
});

// The #286 surface: the lenient read for the private workspace-root shape and
// the surgical, byte-preserving modify.
describe("PackageJsonFile manifest and modify", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
		const PRIVATE_ROOT_TEXT =
			'{\n\t"private": true,\n\t"packageManager": "pnpm@11.2.0",\n\t"devEngines": {\n\t\t"runtime": {\n\t\t\t"name": "node",\n\t\t\t"version": "24.9.1"\n\t\t}\n\t}\n}\n';

		it.effect("readManifest reads the private workspace root that read rejects", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-manifest-" });
				const path = pathService.join(dir, "package.json");
				yield* fs.writeFileString(path, PRIVATE_ROOT_TEXT);
				const strictError = yield* Effect.flip(file.read(path));
				const manifest = yield* file.readManifest(path);

				assert.strictEqual(strictError._tag, "PackageDecodeError");
				assert.isTrue(manifest.isPrivate);
				assert.strictEqual(manifest.name, undefined);
				assert.strictEqual(manifest.packageManager?.range, "11.2.0");
			}),
		);

		it.effect("writeManifest round-trips the private root without inventing fields", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-manifest-rt-" });
				const path = pathService.join(dir, "package.json");
				yield* fs.writeFileString(path, PRIVATE_ROOT_TEXT);
				const manifest = yield* file.readManifest(path);
				yield* file.writeManifest(path, manifest, { indent: "preserve" });
				const written = yield* S.decodeEffect(Json)(yield* fs.readFileString(path));
				const raw = yield* fs.readFileString(path);

				assert.isFalse("name" in written);
				assert.isFalse("version" in written);
				assert.strictEqual(written.packageManager, "pnpm@11.2.0");
				assert.isTrue(raw.includes('\n\t"private"'));
			}),
		);

		it.effect("modify edits one field and preserves every other byte", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-modify-" });
				const path = pathService.join(dir, "package.json");
				yield* fs.writeFileString(path, PRIVATE_ROOT_TEXT);
				const returned = yield* file.modify(path, [{ path: ["packageManager"], value: "pnpm@11.3.0" }]);
				const written = yield* fs.readFileString(path);

				const expected = PRIVATE_ROOT_TEXT.replace('"pnpm@11.2.0"', '"pnpm@11.3.0"');
				assert.strictEqual(written, expected);
				assert.strictEqual(returned, expected);
			}),
		);

		it.effect("modify applies multiple edits in one read/write", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-modify-multi-" });
				const path = pathService.join(dir, "package.json");
				yield* fs.writeFileString(path, PRIVATE_ROOT_TEXT);
				yield* file.modify(path, [
					{ path: ["packageManager"], value: "pnpm@11.3.0" },
					{ path: ["devEngines", "runtime", "version"], value: "24.10.0" },
				]);
				const written = yield* fs.readFileString(path);

				assert.strictEqual(
					written,
					PRIVATE_ROOT_TEXT.replace('"pnpm@11.2.0"', '"pnpm@11.3.0"').replace('"24.9.1"', '"24.10.0"'),
				);
			}),
		);

		it.effect("modify normalizes invalid JSON to PackageJsonParseError — the same tag read uses", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const fs = yield* FileSystem.FileSystem;
				const pathService = yield* Path.Path;
				const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pkg-json-modify-bad-" });
				const path = pathService.join(dir, "package.json");
				yield* fs.writeFileString(path, "{ not valid json");
				const error = yield* Effect.flip(file.modify(path, [{ path: ["a"], value: 1 }]));

				assert.strictEqual(error._tag, "PackageJsonParseError");
			}),
		);

		it.effect("modify fails with PackageJsonNotFoundError for a missing file", () =>
			Effect.gen(function* () {
				const file = yield* PackageJsonFile;
				const error = yield* Effect.flip(file.modify("/nonexistent/package.json", [{ path: ["a"], value: 1 }]));
				assert.strictEqual(error._tag, "PackageJsonNotFoundError");
			}),
		);
	});
});
