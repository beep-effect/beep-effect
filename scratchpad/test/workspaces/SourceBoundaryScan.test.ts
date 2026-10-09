import { assert, describe, layer } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { SourceBoundary } from "../../effected/workspaces/testing.ts";

const SEED = {
	"/repo/src/index.ts": 'export { a } from "./a.ts";\n',
	"/repo/src/a.ts": "export const a = process.cwd();\n",
	"/repo/src/version.ts": "export const version = process.env.__PACKAGE_VERSION__;\n",
	"/repo/src/nested/b.mts": 'import { env } from "node:process";\nexport const b = env;\n',
	"/repo/src/nested/types.d.ts": "declare const process: { env: Record<string, string> };\n",
	"/repo/src/notes.md": "process everywhere\n",
	"/repo/src/node_modules/dep/index.js": "process.exit(1);\n",
	"/repo/src/loop": MemoryFileSystem.symlink("/repo/src"),
};
const RULES = ["process", "node:process"] as const;

/** A `Path` that reports backslash separators, standing in for win32. */
const BackslashPath = Layer.effect(
	Path.Path,
	Effect.gen(function* () {
		const posix = yield* Path.Path;
		return {
			...posix,
			sep: "\\",
			relative: (from: string, to: string) => posix.relative(from, to).split("/").join("\\"),
		};
	}),
).pipe(Layer.provide(Path.layer));

/**
 * A layer's `it` has no `it.live`, so the suites run without the test services
 * instead: the 3-second `Effect.timeout` guards then run on the real clock and
 * fail as a `TimeoutException` when a walk never ends.
 */
const LIVE_CLOCK = { excludeTestServices: true } as const;

describe("SourceBoundary.scan over a virtual tree", () => {
	layer(
		Layer.mergeAll(MemoryFileSystem.layerWith(SEED), Path.layer),
		LIVE_CLOCK,
	)((it) => {
		it.effect("the loop seed really is a symlink to a directory, so the loop test exercises a loop", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				assert.strictEqual((yield* fs.stat("/repo/src/loop")).type, "Directory");
				assert.strictEqual(yield* fs.realPath("/repo/src/loop"), "/repo/src");
			}),
		);

		it.effect(
			"scans every source file once, skipping declarations, non-sources and node_modules, and survives a symlink loop",
			() =>
				Effect.gen(function* () {
					const scan = yield* SourceBoundary.scan({ root: "/repo/src", rules: RULES });
					assert.deepStrictEqual(scan.files, ["a.ts", "index.ts", "nested/b.mts", "version.ts"]);
					assert.deepStrictEqual(scan.violations, [
						"a.ts:1:18 process process",
						"nested/b.mts:1:21 node:process node:process",
					]);
					assert.deepStrictEqual(scan.allowed, []);
				}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("an allow glob exempts matching files and reports which it exempted", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({ root: "/repo/src", rules: RULES, allow: ["nested/**"] });
				assert.deepStrictEqual(scan.allowed, ["nested/b.mts"]);
				assert.deepStrictEqual(scan.violations, ["a.ts:1:18 process process"]);
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("a missing root fails as a PlatformError rather than scanning nothing", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(SourceBoundary.scan({ root: "/repo/nope", rules: RULES }));
				assert.strictEqual(error._tag, "PlatformError");
			}),
		);

		it.effect("an uncompilable allow glob fails typed", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					SourceBoundary.scan({ root: "/repo/src", rules: RULES, allow: ["a".repeat(65_537)] }),
				);
				assert.strictEqual(error._tag, "GlobPatternError");
			}),
		);
	});

	// A dangling link: its target never existed, so stat (which follows links) fails NotFound.
	const DANGLING = { ...SEED, "/repo/src/dangling.ts": MemoryFileSystem.symlink("/repo/gone.ts") };
	layer(
		Layer.mergeAll(MemoryFileSystem.layerWith(DANGLING), Path.layer),
		LIVE_CLOCK,
	)((it) => {
		it.effect("a dangling symlink under the root is skipped, not fatal, and every real file is still scanned", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				// Positive control: the seed really is a link whose target stat cannot reach.
				assert.strictEqual(yield* fs.readLink("/repo/src/dangling.ts"), "/repo/gone.ts");
				const stat = yield* Effect.flip(fs.stat("/repo/src/dangling.ts"));
				assert.strictEqual(stat.reason._tag, "NotFound");
				const scan = yield* SourceBoundary.scan({ root: "/repo/src", rules: RULES });
				assert.deepStrictEqual(scan.files, ["a.ts", "index.ts", "nested/b.mts", "version.ts"]);
				assert.deepStrictEqual(scan.violations, [
					"a.ts:1:18 process process",
					"nested/b.mts:1:21 node:process node:process",
				]);
			}).pipe(Effect.timeout("3 seconds")),
		);
	});

	// A NotFound on an entry that is NOT a link (a file removed mid-scan, a broken volume) still fails.
	const vanished = MemoryFileSystem.layerWith(SEED, {
		faults: {
			stat: (path) =>
				path === "/repo/src/a.ts"
					? Effect.fail(
							PlatformError.systemError({
								_tag: "NotFound",
								module: "FileSystem",
								method: "stat",
								pathOrDescriptor: path,
							}),
						)
					: undefined,
		},
	});
	layer(
		Layer.mergeAll(vanished, Path.layer),
		LIVE_CLOCK,
	)((it) => {
		it.effect("a NotFound stat on an entry that is not a symlink still fails the scan", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(SourceBoundary.scan({ root: "/repo/src", rules: RULES }));
				assert.strictEqual(error._tag, "PlatformError");
			}).pipe(Effect.timeout("3 seconds")),
		);
	});

	// okfit's LSP policy: main.ts may hold a bare process.stdout handle for a
	// transport, yet must still never call .write() on it.
	const LSP = {
		"/lsp/src/main.ts": 'const transport = listen(process.stdout);\nprocess.stdout.write("x");\n',
		"/lsp/src/server.ts": "export const cwd = process.cwd();\n",
		"/lsp/src/io.ts": 'import { readFile } from "node:fs";\nexport { readFile };\n',
	};
	const LSP_RULES = ["process", "stdout-write", { forbidImports: ["node:*"] }] as const;
	layer(
		Layer.mergeAll(MemoryFileSystem.layerWith(LSP), Path.layer),
		LIVE_CLOCK,
	)((it) => {
		it.effect("positive control: without a waiver, main.ts is flagged for both process and stdout-write", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({ root: "/lsp/src", rules: LSP_RULES });
				assert.deepStrictEqual(scan.violations, [
					"io.ts:1:26 forbidImports node:fs",
					"main.ts:1:26 process process",
					"main.ts:2:1 process process",
					"main.ts:2:9 stdout-write stdout.write",
					"server.ts:1:20 process process",
				]);
				assert.deepStrictEqual(scan.waived, []);
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("an allowRules glob waives one rule for the matching file, and every other rule still flags it", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: "/lsp/src",
					rules: LSP_RULES,
					allowRules: { process: ["main.ts"] },
				});
				assert.deepStrictEqual(scan.files, ["io.ts", "main.ts", "server.ts"]);
				assert.deepStrictEqual(scan.allowed, []);
				assert.deepStrictEqual(scan.violations, [
					"io.ts:1:26 forbidImports node:fs",
					"main.ts:2:9 stdout-write stdout.write",
					"server.ts:1:20 process process",
				]);
				assert.deepStrictEqual(
					scan.waived.map((offence) => offence.label),
					["main.ts:1:26 process process", "main.ts:2:1 process process"],
				);
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("a forbidImports key waives every forbidImports entry, and only for the matching file", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: "/lsp/src",
					rules: LSP_RULES,
					allowRules: { forbidImports: ["io.ts"], "stdout-write": ["server.ts"] },
				});
				assert.deepStrictEqual(
					scan.waived.map((offence) => offence.label),
					["io.ts:1:26 forbidImports node:fs"],
				);
				assert.include(scan.violations, "main.ts:2:9 stdout-write stdout.write");
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("a whole-file allow wins over a per-rule glob: the file is allowed, and nothing is waived", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: "/lsp/src",
					rules: LSP_RULES,
					allow: ["main.ts"],
					allowRules: { process: ["main.ts"] },
				});
				assert.deepStrictEqual(scan.allowed, ["main.ts"]);
				assert.deepStrictEqual(scan.waived, []);
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("an uncompilable allowRules glob fails typed, as an allow glob does", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					SourceBoundary.scan({
						root: "/lsp/src",
						rules: LSP_RULES,
						allowRules: { "stdout-write": ["a".repeat(65_537)] },
					}),
				);
				assert.strictEqual(error._tag, "GlobPatternError");
			}),
		);
	});

	// The house rule a carrier keeps: the build-time version define appears in version.ts and nowhere else.
	const TOKEN = "process.env.__PACKAGE_VERSION__";
	const CONFINED = {
		"/pkg/src/version.ts": `export const version = ${TOKEN};\n`,
		"/pkg/src/commands/about.ts": `export const about = () => ${TOKEN};\n`,
		"/pkg/src/main.ts": 'import { version } from "./version.ts";\nexport const v = version;\n',
	};
	const CONFINE_RULES = ["process", { forbidTokens: [TOKEN] }] as const;
	layer(
		Layer.mergeAll(MemoryFileSystem.layerWith(CONFINED), Path.layer),
		LIVE_CLOCK,
	)((it) => {
		it.effect("forbidTokens with a forbidTokens waiver confines a token to the named file, reporting both sides", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: "/pkg/src",
					rules: CONFINE_RULES,
					allowRules: { forbidTokens: ["version.ts"] },
				});
				assert.deepStrictEqual(scan.files, ["commands/about.ts", "main.ts", "version.ts"]);
				assert.deepStrictEqual(scan.violations, [`commands/about.ts:1:28 forbidTokens ${TOKEN}`]);
				assert.deepStrictEqual(
					scan.waived.map((offence) => offence.label),
					[`version.ts:1:24 forbidTokens ${TOKEN}`],
					"the confinement is live: the one permitted use is reported, not dropped",
				);
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("a confinement naming a file that no longer uses the token waives nothing, which waived shows", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: "/pkg/src",
					rules: CONFINE_RULES,
					allowRules: { forbidTokens: ["main.ts"] },
				});
				assert.deepStrictEqual(scan.waived, []);
				assert.deepStrictEqual(scan.violations, [
					`commands/about.ts:1:28 forbidTokens ${TOKEN}`,
					`version.ts:1:24 forbidTokens ${TOKEN}`,
				]);
			}).pipe(Effect.timeout("3 seconds")),
		);
	});

	layer(
		Layer.mergeAll(MemoryFileSystem.layerWith(SEED), BackslashPath),
		LIVE_CLOCK,
	)((it) => {
		it.effect("reports POSIX paths, and allow globs still match, under a backslash Path", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({ root: "/repo/src", rules: RULES, allow: ["nested/**"] });
				assert.include(scan.files, "nested/b.mts");
				assert.deepStrictEqual(scan.allowed, ["nested/b.mts"]);
				assert.deepStrictEqual(scan.violations, ["a.ts:1:18 process process"]);
			}).pipe(Effect.timeout("3 seconds")),
		);

		it.effect("allowRules globs match the same POSIX path under a backslash Path", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: "/repo/src",
					rules: RULES,
					allowRules: { "node:process": ["nested/**"] },
				});
				assert.deepStrictEqual(
					scan.waived.map((offence) => offence.label),
					["nested/b.mts:1:21 node:process node:process"],
				);
				assert.deepStrictEqual(scan.violations, ["a.ts:1:18 process process"]);
			}).pipe(Effect.timeout("3 seconds")),
		);
	});
});
