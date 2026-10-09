import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import * as FileSystem from "effect/FileSystem";
import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ConfigResolver } from "../../../effected/config-file/ConfigResolver.ts";

const JsonValue = S.fromJsonString(S.Unknown);

const Platform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

describe("ConfigResolver against a real filesystem", () => {
	it.layer(Platform, { timeout: "30 seconds" })((it) => {
		it.effect("upwardWalk finds a nearer file before a higher one", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fs
					.makeTempDirectoryScoped({ prefix: "cf-" })
					.pipe(Effect.orDie);
				const deep = path.join(root, "a", "b");
				yield* fs.makeDirectory(deep, { recursive: true });
				yield* fs.writeFileString(path.join(root, ".apprc"), "{}");
				yield* fs.writeFileString(path.join(root, "a", ".apprc"), "{}");

				const resolver = ConfigResolver.upwardWalk({
					filename: ".apprc",
					cwd: deep,
					stopAt: root,
				});
				const found = yield* resolver.resolve;

				assertSome(found, path.join(root, "a", ".apprc"));
			}).pipe(Effect.orDie),
		);

		it.effect("gitRoot anchors on the .git marker", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fs
					.makeTempDirectoryScoped({ prefix: "cf-" })
					.pipe(Effect.orDie);
				const deep = path.join(root, "pkg", "src");
				yield* fs.makeDirectory(deep, { recursive: true });
				yield* fs.makeDirectory(path.join(root, ".git"));
				yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

				const found = yield* ConfigResolver.gitRoot({
					filename: ".apprc",
					cwd: deep,
				}).resolve;

				assertSome(found, path.join(root, ".apprc"));
			}).pipe(Effect.orDie),
		);

		it.effect("gitRoot anchors on a .git file (worktree)", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fs
					.makeTempDirectoryScoped({ prefix: "cf-" })
					.pipe(Effect.orDie);
				const deep = path.join(root, "pkg", "src");
				yield* fs.makeDirectory(deep, { recursive: true });
				yield* fs.writeFileString(
					path.join(root, ".git"),
					"gitdir: /elsewhere/.git/worktrees/pkg",
				);
				yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

				const found = yield* ConfigResolver.gitRoot({
					filename: ".apprc",
					cwd: deep,
				}).resolve;

				assertSome(found, path.join(root, ".apprc"));
			}).pipe(Effect.orDie),
		);

		it.effect("workspaceRoot anchors on pnpm-workspace.yaml", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fs
					.makeTempDirectoryScoped({ prefix: "cf-" })
					.pipe(Effect.orDie);
				const deep = path.join(root, "packages", "pkg");
				yield* fs.makeDirectory(deep, { recursive: true });
				yield* fs.writeFileString(
					path.join(root, "pnpm-workspace.yaml"),
					"packages:\n  - packages/*\n",
				);
				yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

				const found = yield* ConfigResolver.workspaceRoot({
					filename: ".apprc",
					cwd: deep,
				}).resolve;

				assertSome(found, path.join(root, ".apprc"));
			}).pipe(Effect.orDie),
		);

		it.effect(
			"workspaceRoot anchors on a package.json with a workspaces field",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const deep = path.join(root, "packages", "pkg");
					yield* fs.makeDirectory(deep, { recursive: true });
					yield* fs.writeFileString(
						path.join(root, "package.json"),
						Result.getOrThrow(
							S.encodeResult(JsonValue)({ workspaces: ["packages/*"] }),
						),
					);
					yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

					const found = yield* ConfigResolver.workspaceRoot({
						filename: ".apprc",
						cwd: deep,
					}).resolve;

					assertSome(found, path.join(root, ".apprc"));
				}).pipe(Effect.orDie),
		);

		it.effect(
			"upwardWalk yields none() when nothing is found before stopAt",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const found = yield* ConfigResolver.upwardWalk({
						filename: ".missing",
						cwd: root,
						stopAt: root,
					}).resolve;
					assertNone(found);
				}).pipe(Effect.orDie),
		);

		// Every other stopAt test finds its match before reaching stopAt, so none of them
		// observe stopAt actually halting the ascent: dropping the option entirely leaves
		// them all green. This one puts the only match ABOVE stopAt.
		it.effect("upwardWalk does not see a file above stopAt", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fs
					.makeTempDirectoryScoped({ prefix: "cf-" })
					.pipe(Effect.orDie);
				const mid = path.join(root, "mid");
				const leaf = path.join(mid, "leaf");
				yield* fs.makeDirectory(leaf, { recursive: true });
				yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

				const found = yield* ConfigResolver.upwardWalk({
					filename: ".apprc",
					cwd: leaf,
					stopAt: mid,
				}).resolve;

				assertNone(found);
			}).pipe(Effect.orDie),
		);

		// systemEtc's success path was never exercised: the suite only reached it through a
		// hostile filesystem (always none()) and a `.name` assertion, so returning none() on
		// the hit branch passed everything. This pins both the some(candidate) return and the
		// `app` path segment. The win32 short-circuit stays unobservable without stubbing
		// `process.platform`, so it remains untested here.
		it.effect("systemEtc finds a file under <dir>/<app>", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fs
					.makeTempDirectoryScoped({ prefix: "cf-" })
					.pipe(Effect.orDie);
				const appDir = path.join(root, "acme");
				yield* fs.makeDirectory(appDir, { recursive: true });
				yield* fs.writeFileString(path.join(appDir, ".apprc"), "{}");

				const found = yield* ConfigResolver.systemEtc({
					app: "acme",
					filename: ".apprc",
					dir: root,
				}).resolve;

				assertSome(found, path.join(appDir, ".apprc"));
			}).pipe(Effect.orDie),
		);

		// rootAnchored exists to probe subpaths UNDER the anchor. Every other fixture puts
		// the config at or above the anchor, so probing the whole ascent chain instead of
		// just the anchored root gives the same answer — collapsing gitRoot into a plain
		// upwardWalk would pass the entire suite. Here the only config sits strictly BELOW
		// the root, so anchoring must not see it.
		it.effect(
			"gitRoot does not find a config in a subdirectory below the anchored root",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const sub = path.join(root, "sub");
					const deep = path.join(sub, "pkg");
					yield* fs.makeDirectory(deep, { recursive: true });
					yield* fs.makeDirectory(path.join(root, ".git"));
					yield* fs.writeFileString(path.join(sub, ".apprc"), "{}");

					const found = yield* ConfigResolver.gitRoot({
						filename: ".apprc",
						cwd: deep,
					}).resolve;

					assertNone(found);
				}).pipe(Effect.orDie),
		);

		// No other fixture has nested roots, so an implementation that anchors on the
		// FURTHEST accepting ancestor instead of the nearest passes them all.
		it.effect(
			"gitRoot anchors on the nearest .git when repositories are nested",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const inner = path.join(root, "inner");
					const deep = path.join(inner, "pkg");
					yield* fs.makeDirectory(deep, { recursive: true });
					yield* fs.makeDirectory(path.join(root, ".git"));
					yield* fs.makeDirectory(path.join(inner, ".git"));
					yield* fs.writeFileString(path.join(root, ".apprc"), "{}");
					yield* fs.writeFileString(path.join(inner, ".apprc"), "{}");

					const found = yield* ConfigResolver.gitRoot({
						filename: ".apprc",
						cwd: deep,
					}).resolve;

					assertSome(found, path.join(inner, ".apprc"));
				}).pipe(Effect.orDie),
		);

		it.effect(
			"upwardWalk: an earlier-listed subpath wins over a later one in the same directory",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					yield* fs.makeDirectory(path.join(root, ".config"), {
						recursive: true,
					});
					yield* fs.writeFileString(path.join(root, ".config", ".apprc"), "{}");
					yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

					const resolver = ConfigResolver.upwardWalk({
						filename: ".apprc",
						cwd: root,
						stopAt: root,
						subpaths: [".config", "."],
					});
					const found = yield* resolver.resolve;

					assertSome(found, path.join(root, ".config", ".apprc"));
				}).pipe(Effect.orDie),
		);

		it.effect(
			"upwardWalk searches stopAt itself, not just directories strictly above it",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const deep = path.join(root, "a", "b");
					yield* fs.makeDirectory(deep, { recursive: true });
					yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

					const resolver = ConfigResolver.upwardWalk({
						filename: ".apprc",
						cwd: deep,
						stopAt: root,
					});
					const found = yield* resolver.resolve;

					assertSome(found, path.join(root, ".apprc"));
				}).pipe(Effect.orDie),
		);

		it.effect(
			"workspaceRoot absorbs an unparsable package.json and keeps ascending to the real root",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const malformedDir = path.join(root, "malformed");
					const deep = path.join(malformedDir, "pkg");
					yield* fs.makeDirectory(deep, { recursive: true });
					yield* fs.writeFileString(
						path.join(malformedDir, "package.json"),
						"{ not json",
					);
					yield* fs.writeFileString(
						path.join(root, "pnpm-workspace.yaml"),
						"packages:\n  - packages/*\n",
					);
					yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

					const found = yield* ConfigResolver.workspaceRoot({
						filename: ".apprc",
						cwd: deep,
					}).resolve;

					assertSome(found, path.join(root, ".apprc"));
				}).pipe(Effect.orDie),
		);

		it.effect(
			"workspaceRoot does not treat a package.json without a workspaces field as a root",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fs
						.makeTempDirectoryScoped({ prefix: "cf-" })
						.pipe(Effect.orDie);
					const decoyDir = path.join(root, "mid");
					const deep = path.join(decoyDir, "deep");
					yield* fs.makeDirectory(deep, { recursive: true });
					yield* fs.writeFileString(
						path.join(decoyDir, "package.json"),
						Result.getOrThrow(S.encodeResult(JsonValue)({ name: "decoy" })),
					);
					yield* fs.writeFileString(
						path.join(root, "package.json"),
						Result.getOrThrow(
							S.encodeResult(JsonValue)({ workspaces: ["packages/*"] }),
						),
					);
					yield* fs.writeFileString(path.join(root, ".apprc"), "{}");

					const found = yield* ConfigResolver.workspaceRoot({
						filename: ".apprc",
						cwd: deep,
					}).resolve;

					assertSome(found, path.join(root, ".apprc"));
				}).pipe(Effect.orDie),
		);
	});
});
