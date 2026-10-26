// @effect-diagnostics nodeBuiltinImport:skip-file -- nodeBuiltinImport because it scans the lab's own source tree synchronously at test collection. Owner: @beep/scratchpad. Exit: C deletes the lab ./ui half (W4-m).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import type { Offence } from "@beep/repo-workspaces/SourceBoundary";
import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import * as FileSystem from "effect/FileSystem";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "effected", "cli");

/**
 * The lab keeps the `./ui` half of the port at the module root; the root and `./testing` half is `@beep/cli-kit`,
 * whose own boundary test holds the root-never-reaches-ui and no-runtime-in-testing rules (wave 4-C).
 */
const scanSource = Effect.fn("cli.boundary.scanSource")(function* (options: Parameters<typeof SourceBoundary.scan>[0]) {
	const fs = yield* FileSystem.FileSystem;
	return yield* SourceBoundary.scan(options).pipe(Effect.provideService(FileSystem.FileSystem, {
		...fs,
		readDirectory: (directory) => fs.readDirectory(directory).pipe(Effect.map((names) =>
			directory === SRC ? A.filter(names, (name) => name !== "dist") : names,
		)),
	}));
});

/** Reads a module's source text; the real tree reads the disk, the mutation control reads a map. */
type Read = (file: string) => string;
const readSource: Read = (file) => readFileSync(file, "utf8");

/** A file's path relative to `root`, with `/` separators. */
const relativeTo = (root: string, file: string): string => relative(root, file).split(sep).join("/");

/** The `./ui`, `./ui/testing` and `./ui/testing/serializer` entry files and everything under `src/ui/`. */
const isUiModule = (path: string): boolean => /^ui(?:\.ts$|-testing(?:-serializer)?\.ts$|\/)/.test(path);

/** A specifier naming a package only `./ui` may load: `ink`, `react`, or a subpath of either. */
const isUiPackage = (specifier: string): boolean => /^(?:ink|react)(?:$|\/)/.test(specifier);

/** The root entrypoint, `@beep/cli-kit`: what `./ui` uses to name root types without copying them. */
const isRootEntrypoint = (specifier: string): boolean => specifier === "@beep/cli-kit";

/** An `import type` or `export type` clause and its specifier, in comment-stripped source. */
// The clause body excludes quotes as well as semicolons, so a match cannot run past an earlier `from "…"` in code
// written without semicolons.
const TYPE_ONLY_IMPORT = /\b(?:import|export)\s+type\b[^;"']*?\bfrom\s*(["'])([^"']+)\1/g;

/**
 * The specifiers matching `isTarget` that a source text names other than through `import type` or `export type`: a
 * value import, an inline `import { type X }` (which `verbatimModuleSyntax` keeps as a side-effect import), a
 * re-export or an `import()`. Each loads the module at runtime.
 */
const valueImportsOf = (text: string, isTarget: (specifier: string) => boolean): ReadonlyArray<string> => {
	const remaining = SourceBoundary.importSpecifiers(text).filter(isTarget);
	for (const match of SourceBoundary.stripComments(text).matchAll(TYPE_ONLY_IMPORT)) {
		const index = remaining.indexOf(match[2] ?? "");
		if (index >= 0) remaining.splice(index, 1);
	}
	return remaining;
};

/** The `ink` and `react` specifiers a source text loads at runtime. */
const valueImportsOfUiPackages = (text: string): ReadonlyArray<string> => valueImportsOf(text, isUiPackage);

/** The one module that may load `ink` and `react` as values: every other ui module goes through its `loadInk`, so importing `./ui` loads neither. */
const INK_LOADER = "ui/internal/ink.ts";

/** Every module specifier a file names: static, re-export, type-only and `import("<literal>")`. */
const specifiersOf = (file: string, read: Read): ReadonlyArray<string> => SourceBoundary.importSpecifiers(read(file));

/** Every relative import of a module, resolved to its source path. */
const importsOf = (file: string, read: Read): ReadonlyArray<string> =>
	specifiersOf(file, read)
		.filter((specifier) => specifier.startsWith("."))
		.map((specifier) => resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));

/** Every module reachable from an entrypoint, transitively; a lazy `import()` is an edge like any other. */
const reachableFrom = (entry: string, read: Read = readSource): ReadonlySet<string> => {
	const seen = new Set<string>();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);
		for (const next of importsOf(file, read)) queue.push(next);
	}
	return seen;
};

/** The files reachable from `entry` that import any `node:` module, sorted. */
const nodeImporters = (entry: string): ReadonlyArray<string> =>
	[...reachableFrom(resolve(SRC, entry))]
		.filter((file) => specifiersOf(file, readSource).some((specifier) => specifier.startsWith("node:")))
		.map((file) => relativeTo(SRC, file))
		.sort();

/**
 * The process-streams licence (`okf/decisions/ui-binds-process-streams.md`), one
 * `file rule detail` line per waived offence that is not an `ink` or `react`
 * import. Exactly three files may ever appear here, and each joins when it
 * lands:
 *
 * - `ui/internal/processStreams.ts`: `process` (reads the three process streams);
 * - `ui/internal/inkChalk.ts`: `forbidImports` of `node:module`, `node:url`, `@effect/platform-node/NodeFileSystem`
 *   (the scoped FileSystem service for realpath resolution);
 * - `ui/testing/fakeStreams.ts` (testing only): `forbidImports` of `node:stream` (it needs no `node:events`).
 */
const NODE_LICENCE: ReadonlyArray<string> = [
	"ui/internal/inkChalk.ts forbidImports node:module",
	"ui/internal/inkChalk.ts forbidImports node:url",
	"ui/internal/inkChalk.ts forbidImports @effect/platform-node/NodeFileSystem",
	"ui/internal/processStreams.ts process process",
	"ui/testing/fakeStreams.ts forbidImports node:stream",
	"ui/testing/fakeStreams.ts process process",
];

/**
 * The one `./ui` write to a stream outside Ink: the live view's console bridge writes a log line straight to
 * `UiStreams.stdout` when no frame is mounted to write it through (`okf/decisions/live-logs-through-ink.md`). It is
 * the stream `./ui` binds under the process-streams licence, not the process's own, and the file imports nothing from Node.
 */
const UI_WRITE_LICENCE: ReadonlyArray<string> = ["ui/internal/inkConsole.ts stdout-write stdout.write"];

/** The `node:` importers reachable from `./ui`: only Ink's chalk resolution. The testing fakes stay off it. */
const UI_NODE_IMPORTERS: ReadonlyArray<string> = ["ui/internal/inkChalk.ts"];

/** The `node:` importers `./ui/testing` may reach. */
const UI_TESTING_NODE_LICENCE: ReadonlySet<string> = new Set(["ui/internal/inkChalk.ts", "ui/testing/fakeStreams.ts"]);

const licensedLine = (offence: Offence): string => `${offence.file} ${offence.rule} ${offence.detail}`;

describe("cli boundary", () => {
	layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
		it.effect("the scanner still flags and spares what its shipped fixtures say (positive control)", () =>
			Effect.sync(() => assert.deepStrictEqual(SourceBoundary.verifyFixtures(), [])),
		);

		it.effect(
			"no source file reads process, writes to stdout, or imports node:, a platform package, mcp, engine, ink or react, outside the ./ui waivers",
			() =>
				Effect.gen(function* () {
					const scan = yield* scanSource({
						root: SRC,
						rules: [
							"process",
							"node:process",
							"stdout-write",
							{
								forbidImports: [
									"node:*",
									"@effect/platform*",
									"@effected/mcp",
									"@effected/engine",
									"ink",
									"react",
									"react/*",
								],
							},
						],
						allowRules: {
							forbidImports: ["ui.ts", "ui-testing.ts", "ui/**"],
							process: ["ui/internal/processStreams.ts", "ui/testing/fakeStreams.ts"],
							"stdout-write": ["ui/internal/inkConsole.ts"],
						},
					});
					assert.include(scan.files, "ui.ts", "the scan read the ./ui entry");
					assert.include(scan.files, "ui-testing.ts", "the scan read the ./ui/testing entry");
					assert.deepStrictEqual(scan.allowed, []);
					assert.deepStrictEqual(scan.violations, []);
					// Every waived offence is a ./ui file naming ink or react, a line of the process-streams licence, or the one
					// stream write. The licences are exact, so a waiver that waives something new fails here.
					const licensed = scan.waived
						.filter((offence) => !(offence.rule === "forbidImports" && isUiPackage(offence.detail)))
						.map(licensedLine);
					assert.deepStrictEqual([...new Set(licensed)].sort(), [...NODE_LICENCE, ...UI_WRITE_LICENCE].sort());
					for (const offence of scan.waived) assert.isTrue(isUiModule(offence.file), offence.label);
				}),
		);

	});

	describe("reachability", () => {
		it("positive control: from ./ui the walker reaches the Ink loader's react import and more than one file", () => {
			const reached = reachableFrom(resolve(SRC, "ui.ts"));
			assert.isAbove(reached.size, 1, "the walker follows ./ui's imports");
			const specifiers = [...reached].flatMap((file) => specifiersOf(file, readSource));
			assert.include(specifiers, "react", 'the dynamic import("react") in the loader is reached');
			assert.include(specifiers, "ink");
			assert.isTrue(reachableFrom(resolve(SRC, "ui-testing.ts")).has(resolve(SRC, "ui-testing.ts")));
		});

		it("node: imports reachable from ./ui are exactly the licensed ones", () => {
			assert.deepStrictEqual(nodeImporters("ui.ts"), [...UI_NODE_IMPORTERS]);
			for (const file of nodeImporters("ui-testing.ts")) assert.isTrue(UI_TESTING_NODE_LICENCE.has(file), file);
			// The serializer entry is test tooling too: it reaches CliUiTest, and no node: import beyond the testing licence.
			assert.isTrue(
				reachableFrom(resolve(SRC, "ui-testing-serializer.ts")).has(resolve(SRC, "ui", "testing", "CliUiTest.ts")),
			);
			for (const file of nodeImporters("ui-testing-serializer.ts")) {
				assert.isTrue(UI_TESTING_NODE_LICENCE.has(file), file);
			}
		});

		it("only the Ink loader imports ink or react as a value; every other ./ui file imports types only", () => {
			const uiFiles = (readdirSync(SRC, { recursive: true, encoding: "utf8" }))
				.map((file) => file.split(sep).join("/"))
				.filter((file) => !file.startsWith("dist/"))
				.filter((file) => file.endsWith(".ts") && isUiModule(file))
				.sort();
			assert.include(uiFiles, INK_LOADER, "the walk read the ui tree");
			const offenders = uiFiles
				.filter((file) => file !== INK_LOADER)
				.flatMap((file) => valueImportsOfUiPackages(readSource(join(SRC, file))).map((spec) => `${file} ${spec}`));
			assert.deepStrictEqual(offenders, []);
			assert.deepStrictEqual(
				[...valueImportsOfUiPackages(readSource(join(SRC, INK_LOADER)))].sort(),
				["ink", "react"],
				"positive control: the detector sees the loader's own import()s",
			);
		});

		it("./ui files name the package's own entrypoint through import type only, so the root types are never copied", () => {
			const uiFiles = (readdirSync(SRC, { recursive: true, encoding: "utf8" }))
				.map((file) => file.split(sep).join("/"))
				.filter((file) => !file.startsWith("dist/"))
				.filter((file) => file.endsWith(".ts") && isUiModule(file))
				.sort();
			const isRootReference = (_file: string) => isRootEntrypoint;
			const offenders = uiFiles.flatMap((file) =>
				valueImportsOf(readSource(join(SRC, file)), isRootReference(file)).map((spec) => `${file} ${spec}`),
			);
			assert.deepStrictEqual(offenders, []);
			assert.include(
				specifiersOf(join(SRC, "ui", "CliUi.ts"), readSource),
				"@beep/cli-kit",
				"positive control: CliUi.ts names the root types through the @beep/cli-kit entrypoint",
			);
			assert.deepStrictEqual(valueImportsOf('import { CliTheme } from "@beep/cli-kit";', isRootEntrypoint), [
				"@beep/cli-kit",
			]);
			assert.deepStrictEqual(valueImportsOf('import type * as Cli from "@beep/cli-kit";', isRootEntrypoint), []);
		});

		it("mutation control: the type-only detector flags every runtime spelling and spares every type-only one", () => {
			const value = [
				'import { Text } from "ink";',
				'import React from "react";',
				'import { type ReactElement } from "react";',
				'export { useInput } from "ink";',
				'import "react/jsx-runtime";',
				'const load = () => import("ink");',
			];
			for (const text of value) assert.lengthOf(valueImportsOfUiPackages(text), 1, text);
			const typeOnly = [
				'import type { Instance } from "ink";',
				'import type React from "react";',
				'import type * as Ink from "ink";',
				'export type { ReactElement } from "react";',
				'import type {\n\tReactElement,\n\tReactNode,\n} from "react/jsx-runtime";',
				'// import { Text } from "ink";',
				'import type { Text } from "ink";\nimport type { Box } from "ink";',
			];
			for (const text of typeOnly) assert.deepStrictEqual(valueImportsOfUiPackages(text), [], text);
			assert.deepStrictEqual(
				valueImportsOfUiPackages('import type { Box } from "ink";\nimport { Text } from "ink";'),
				["ink"],
				"a type import beside a value import of the same package does not hide the value one",
			);
			assert.deepStrictEqual(
				valueImportsOfUiPackages('import type { A } from "./a.ts"\nimport { Text } from "ink"'),
				["ink"],
				"in code without semicolons, a type import of another module does not swallow a later value import",
			);
		});

	});
});
