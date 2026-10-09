// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type { FileSystem } from "effect";
import { Effect, Layer, Option, Path, Schema } from "effect";
import { ConfigFile } from "../../effected/config-file/ConfigFile.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

const platform = (files: Record<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer);

const Doc = Schema.Struct({ from: Schema.String });

class DocConfig extends ConfigFile.Service<DocConfig, typeof Doc.Type>()("test/DocConfig") {}

describe("ConfigResolver.upwardWalk filenames", () => {
	// The whole point of a per-directory candidate list: three separate
	// `upwardWalk` entries would run the first to the filesystem root before the
	// second started, so a parent's `.app.toml` would beat the child's
	// `app.toml`. Every candidate must be exhausted at one level first.
	it.effect("prefers a nearer directory's later candidate over an ancestor's first", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml", ".config/app.toml"],
				cwd: "/repo/pkg",
			});
			const found = yield* resolver.resolve;
			assert.deepStrictEqual(found, Option.some("/repo/pkg/app.toml"));
		}).pipe(Effect.provide(platform({ "/repo/pkg/app.toml": "", "/repo/.app.toml": "" }))),
	);

	it.effect("probes the candidates in the order given, within one directory", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml"],
				cwd: "/repo",
			});
			const found = yield* resolver.resolve;
			assert.deepStrictEqual(found, Option.some("/repo/.app.toml"));
		}).pipe(Effect.provide(platform({ "/repo/.app.toml": "", "/repo/app.toml": "" }))),
	);

	it.effect("still ascends when no candidate matches at the start directory", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml"],
				cwd: "/repo/pkg/src",
			});
			const found = yield* resolver.resolve;
			assert.deepStrictEqual(found, Option.some("/repo/app.toml"));
		}).pipe(Effect.provide(platform({ "/repo/app.toml": "" }))),
	);

	it.effect("crosses filenames with subpaths, subpath-major", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: ["a.toml", "b.toml"],
				subpaths: [".", ".config"],
				cwd: "/repo",
			});
			const found = yield* resolver.resolve;
			// `./b.toml` beats `.config/a.toml`: the subpath is the outer loop.
			assert.deepStrictEqual(found, Option.some("/repo/b.toml"));
		}).pipe(Effect.provide(platform({ "/repo/b.toml": "", "/repo/.config/a.toml": "" }))),
	);

	it.effect("honors stopAt with a candidate list", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml"],
				cwd: "/repo/pkg",
				stopAt: "/repo",
			});
			const found = yield* resolver.resolve;
			assert.isTrue(Option.isNone(found));
		}).pipe(Effect.provide(platform({ "/app.toml": "" }))),
	);
});

describe("ConfigResolver.upwardWalk name", () => {
	it('defaults to "walk"', () => {
		assert.strictEqual(ConfigResolver.upwardWalk({ filename: "app.toml" }).name, "walk");
	});

	it("reports the caller's name so two walks are distinguishable", () => {
		const xdgTree = ConfigResolver.upwardWalk({
			filename: "config.toml",
			subpaths: [".config/app"],
			name: "walk:xdg-tree",
		});
		const flat = ConfigResolver.upwardWalk({ filename: "app.config.toml", name: "walk:flat-file" });
		assert.strictEqual(xdgTree.name, "walk:xdg-tree");
		assert.strictEqual(flat.name, "walk:flat-file");
	});
});

describe("ConfigResolver match reporting", () => {
	it.effect("upwardWalk reports the anchor directory and the matching candidate", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml"],
				subpaths: ["."],
				cwd: "/repo/pkg/src",
			});
			const match = yield* resolver.resolveMatch ?? Effect.succeedNone;
			assert.deepStrictEqual(
				match,
				Option.some({ path: "/repo/app.toml", dir: "/repo", filename: "app.toml", subpath: "." }),
			);
		}).pipe(Effect.provide(platform({ "/repo/app.toml": "" }))),
	);

	it.effect("staticDir reports its dir and filename", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.staticDir({ dir: "/etc/app", filename: "config.json" });
			const match = yield* resolver.resolveMatch ?? Effect.succeedNone;
			assert.deepStrictEqual(
				match,
				Option.some({ path: "/etc/app/config.json", dir: "/etc/app", filename: "config.json" }),
			);
		}).pipe(Effect.provide(platform({ "/etc/app/config.json": "" }))),
	);

	it.effect("gitRoot anchors on the repository root, not the subpath directory", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.gitRoot({
				filename: "config.json",
				subpaths: [".config"],
				cwd: "/repo/pkg",
			});
			const match = yield* resolver.resolveMatch ?? Effect.succeedNone;
			assert.deepStrictEqual(
				match,
				Option.some({
					path: "/repo/.config/config.json",
					dir: "/repo",
					filename: "config.json",
					subpath: ".config",
				}),
			);
		}).pipe(Effect.provide(platform({ "/repo/.git": "", "/repo/.config/config.json": "" }))),
	);

	it.effect("explicitPath reports the path alone — it has no anchor", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.explicitPath("/somewhere/else.json");
			const match = yield* resolver.resolveMatch ?? Effect.succeedNone;
			assert.deepStrictEqual(match, Option.some({ path: "/somewhere/else.json" }));
		}).pipe(Effect.provide(platform({ "/somewhere/else.json": "" }))),
	);

	it.effect("ConfigFile.discover carries the match onto every source", () =>
		Effect.gen(function* () {
			const config = yield* DocConfig;
			const sources = yield* config.discover;
			assert.strictEqual(sources.length, 1);
			assert.strictEqual(sources[0]?.match?.dir, "/repo");
			assert.strictEqual(sources[0]?.match?.filename, "app.json");
			assert.strictEqual(sources[0]?.resolver, "walk:project");
		}).pipe(
			Effect.provide(
				ConfigFile.layer(DocConfig, {
					schema: Doc,
					codec: JsonCodec,
					strategy: MergeStrategy.firstMatch<typeof Doc.Type>(),
					resolvers: [
						ConfigResolver.upwardWalk({ filenames: [".app.json", "app.json"], cwd: "/repo/pkg", name: "walk:project" }),
					],
				}).pipe(Layer.provide(platform({ "/repo/app.json": `{"from":"repo"}` }))),
			),
		),
	);

	// A resolver written outside the package implements `resolve` only; the
	// pipeline must still produce a source, with the path as its whole match.
	it.effect("ConfigFile.discover degrades to a bare path for a resolver without resolveMatch", () =>
		Effect.gen(function* () {
			const config = yield* DocConfig;
			const sources = yield* config.discover;
			assert.deepStrictEqual(sources[0]?.match, { path: "/repo/app.json" });
		}).pipe(
			Effect.provide(
				ConfigFile.layer(DocConfig, {
					schema: Doc,
					codec: JsonCodec,
					strategy: MergeStrategy.firstMatch<typeof Doc.Type>(),
					resolvers: [{ name: "hand-rolled", resolve: Effect.succeedSome("/repo/app.json") }],
				}).pipe(Layer.provide(platform({ "/repo/app.json": `{"from":"repo"}` }))),
			),
		),
	);
});

describe("ConfigResolver probe reporting", () => {
	it.effect("upwardWalk reports every candidate when nothing matches, directory-major", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml"],
				cwd: "/repo/pkg",
				stopAt: "/repo",
			});
			const probe = yield* resolver.resolveProbe ?? Effect.succeed({ match: Option.none(), probed: [] });
			assert.isTrue(Option.isNone(probe.match));
			assert.deepStrictEqual(probe.probed, [
				"/repo/pkg/.app.toml",
				"/repo/pkg/app.toml",
				"/repo/.app.toml",
				"/repo/app.toml",
			]);
		}).pipe(Effect.provide(platform({ "/app.toml": "" }))),
	);

	it.effect("upwardWalk reports only the checked prefix when a candidate matches", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({
				filenames: [".app.toml", "app.toml"],
				cwd: "/repo/pkg",
			});
			const probe = yield* resolver.resolveProbe ?? Effect.succeed({ match: Option.none(), probed: [] });
			assert.deepStrictEqual(probe.match, Option.some({ path: "/repo/app.toml", dir: "/repo", filename: "app.toml" }));
			// firstMatch short-circuits: the prefix ends at the match, so nothing
			// above /repo — and no later candidate there — was ever checked.
			assert.deepStrictEqual(probe.probed, [
				"/repo/pkg/.app.toml",
				"/repo/pkg/app.toml",
				"/repo/.app.toml",
				"/repo/app.toml",
			]);
		}).pipe(Effect.provide(platform({ "/repo/app.toml": "" }))),
	);

	it.effect("explicitPath and staticDir report their single candidate, hit or miss", () =>
		Effect.gen(function* () {
			const explicitMiss = yield* ConfigResolver.explicitPath("/nope.json").resolveProbe ??
				Effect.succeed({ match: Option.none(), probed: [] });
			assert.isTrue(Option.isNone(explicitMiss.match));
			assert.deepStrictEqual(explicitMiss.probed, ["/nope.json"]);

			const staticMiss = yield* ConfigResolver.staticDir({ dir: "/etc/app", filename: "config.json" }).resolveProbe ??
				Effect.succeed({ match: Option.none(), probed: [] });
			assert.isTrue(Option.isNone(staticMiss.match));
			assert.deepStrictEqual(staticMiss.probed, ["/etc/app/config.json"]);
		}).pipe(Effect.provide(platform({}))),
	);

	it.effect("gitRoot reports no candidates when there is no root", () =>
		Effect.gen(function* () {
			// The fallback must not coincide with the expected value, or the test
			// passes with `resolveProbe` absent.
			const noRoot = yield* ConfigResolver.gitRoot({ filename: "config.json", cwd: "/repo/pkg" }).resolveProbe ??
				Effect.die("gitRoot must implement resolveProbe");
			assert.isTrue(Option.isNone(noRoot.match));
			assert.deepStrictEqual(noRoot.probed, []);
		}).pipe(Effect.provide(platform({}))),
	);

	it.effect("gitRoot reports its subpath candidates under a root", () =>
		Effect.gen(function* () {
			const rootedMiss = yield* ConfigResolver.gitRoot({
				filename: "config.json",
				subpaths: [".", ".config"],
				cwd: "/repo/pkg",
			}).resolveProbe ?? Effect.succeed({ match: Option.none(), probed: [] });
			assert.isTrue(Option.isNone(rootedMiss.match));
			assert.deepStrictEqual(rootedMiss.probed, ["/repo/config.json", "/repo/.config/config.json"]);
		}).pipe(Effect.provide(platform({ "/repo/.git": "" }))),
	);

	it.effect("derive resolve and resolveMatch from the same probe — the three never disagree", () =>
		Effect.gen(function* () {
			const resolver = ConfigResolver.upwardWalk({ filename: "app.toml", cwd: "/repo", stopAt: "/repo" });
			const probe = yield* resolver.resolveProbe ?? Effect.succeed({ match: Option.none(), probed: [] });
			const match = yield* resolver.resolveMatch ?? Effect.succeedNone;
			const resolved = yield* resolver.resolve;
			assert.deepStrictEqual(match, probe.match);
			assert.deepStrictEqual(
				resolved,
				Option.map(probe.match, (m) => m.path),
			);
		}).pipe(Effect.provide(platform({ "/repo/app.toml": "" }))),
	);
});
