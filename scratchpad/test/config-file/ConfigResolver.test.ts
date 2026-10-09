import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";

/** The typed failure a node adapter raises for EACCES. */
const denied = (method: string, path: string) =>
	Effect.fail(
		PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method, pathOrDescriptor: path }),
	);

/**
 * A volume holding a config at every candidate the resolvers below could probe,
 * whose every probe and read is DENIED. Without the faults each resolver would
 * find a file, so a `none()` can only come from the absorbed failure.
 */
const HostileFs = MemoryFileSystem.layerWith(
	{
		"/a/.apprc": "{}",
		"/a/b/.apprc": "{}",
		"/a/b/.git": MemoryFileSystem.directory(),
		"/a/b/pnpm-workspace.yaml": "",
		"/etc/acme/.apprc": "{}",
	},
	{
		faults: {
			access: (path) => denied("access", path),
			readFile: (path) => denied("readFile", path),
		},
	},
);

const TestPath = Path.layer;
const HostilePlatform = Layer.mergeAll(HostileFs, TestPath);

describe("ConfigResolver error absorption", () => {
	it.layer(HostilePlatform, { timeout: "30 seconds" })((it) => {
		it.effect("explicitPath yields none() when the filesystem denies permission", () =>
			Effect.gen(function* () {
				const resolver = ConfigResolver.explicitPath("/a/.apprc");
				const result = yield* resolver.resolve;
				assertNone(result);
			}),
		);
	});

	it.layer(HostilePlatform, { timeout: "30 seconds" })((it) => {
		it.effect("staticDir yields none() when the filesystem denies permission", () =>
			Effect.gen(function* () {
				const resolver = ConfigResolver.staticDir({ dir: "/a", filename: ".apprc" });
				const result = yield* resolver.resolve;
				assertNone(result);
			}),
		);
	});

	it.layer(HostilePlatform, { timeout: "30 seconds" })((it) => {
		it.effect("upwardWalk yields none() when the filesystem denies permission", () =>
			Effect.gen(function* () {
				const resolver = ConfigResolver.upwardWalk({ filename: ".apprc", cwd: "/a/b" });
				const result = yield* resolver.resolve;
				assertNone(result);
			}),
		);
	});

	it.layer(HostilePlatform, { timeout: "30 seconds" })((it) => {
		it.effect("workspaceRoot yields none() when the filesystem denies permission", () =>
			Effect.gen(function* () {
				const resolver = ConfigResolver.workspaceRoot({ filename: ".apprc", cwd: "/a/b" });
				const result = yield* resolver.resolve;
				assertNone(result);
			}),
		);
	});

	it.layer(HostilePlatform, { timeout: "30 seconds" })((it) => {
		it.effect("gitRoot yields none() when the filesystem denies permission", () =>
			Effect.gen(function* () {
				const resolver = ConfigResolver.gitRoot({ filename: ".apprc", cwd: "/a/b" });
				const result = yield* resolver.resolve;
				assertNone(result);
			}),
		);
	});

	it.layer(HostilePlatform, { timeout: "30 seconds" })((it) => {
		it.effect("systemEtc yields none() when the filesystem denies permission", () =>
			Effect.gen(function* () {
				const resolver = ConfigResolver.systemEtc({ app: "acme", filename: ".apprc" });
				const result = yield* resolver.resolve;
				assertNone(result);
			}),
		);
	});

	it("every resolver names itself", () => {
		assert.strictEqual(ConfigResolver.explicitPath("/x").name, "explicit");
		assert.strictEqual(ConfigResolver.staticDir({ dir: "/x", filename: "y" }).name, "static");
		assert.strictEqual(ConfigResolver.upwardWalk({ filename: "y" }).name, "walk");
		assert.strictEqual(ConfigResolver.workspaceRoot({ filename: "y" }).name, "workspace");
		assert.strictEqual(ConfigResolver.gitRoot({ filename: "y" }).name, "git");
		assert.strictEqual(ConfigResolver.systemEtc({ app: "y", filename: "z" }).name, "system");
	});
});

describe("ConfigResolver — an unreadable ancestor must not abort root discovery", () => {
	/** `/a/b` is unreadable; the real root lives above it at `/a`. */
	const flakyFs = MemoryFileSystem.layerWith(
		{
			"/a/.git": MemoryFileSystem.directory(),
			"/a/.apprc": "{}",
			// Present but unreadable: were the fault gone, discovery would stop here.
			"/a/b/.git": MemoryFileSystem.directory(),
			"/a/b/.apprc": "{}",
			"/a/b/c": MemoryFileSystem.directory(),
		},
		{
			faults: {
				access: (path) => (path.startsWith("/a/b/") ? denied("access", path) : undefined),
				readFile: (path) => denied("readFile", path),
			},
		},
	);

	it.layer(Layer.mergeAll(flakyFs, Path.layer), { timeout: "30 seconds" })((it) => {
		it.effect("gitRoot finds the root above an unreadable ancestor", () =>
			Effect.gen(function* () {
				const found = yield* ConfigResolver.gitRoot({ filename: ".apprc", cwd: "/a/b/c" }).resolve;
				assertSome(found, "/a/.apprc");
			}),
		);
	});

	it.layer(Layer.mergeAll(flakyFs, Path.layer), { timeout: "30 seconds" })((it) => {
		it.effect("upwardWalk skips an unreadable directory and keeps ascending", () =>
			Effect.gen(function* () {
				const found = yield* ConfigResolver.upwardWalk({ filename: ".apprc", cwd: "/a/b/c" }).resolve;
				assertSome(found, "/a/.apprc");
			}),
		);
	});
});
