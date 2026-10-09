// @effect-diagnostics nodeBuiltinImport:skip-file
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import type { Offence } from "../../effected/workspaces/testing.ts";
import { SourceBoundary } from "../../effected/workspaces/testing.ts";
import * as Effect from "effect/Effect";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "effected", "cli");

/** Reads a module's source text; the real tree reads the disk, the mutation control reads a map. */
type Read = (file: string) => string;
const readSource: Read = (file) => readFileSync(file, "utf8");

/** A file's path relative to `root`, with `/` separators. */
const relativeTo = (root: string, file: string): string => relative(root, file).split(sep).join("/");

/** The `./ui`, `./ui/testing` and `./ui/testing/serializer` entry files and everything under `src/ui/`. */
const isUiModule = (path: string): boolean => /^ui(?:\.ts$|-testing(?:-serializer)?\.ts$|\/)/.test(path);

/** A specifier naming a package only `./ui` may load: `ink`, `react`, or a subpath of either. */
const isUiPackage = (specifier: string): boolean => /^(?:ink|react)(?:$|\/)/.test(specifier);

/** A self-reference into `./ui`: the package's own name resolves through its `exports`, so no relative edge shows it. */
const isUiSelfReference = (specifier: string): boolean => /^@effected\/cli\/ui(?:$|\/)/.test(specifier);

/** The package's own name, or a subpath of it: what `./ui` uses to name root types without copying them. */
const isPackageSelfName = (specifier: string): boolean => /^@effected\/cli(?:$|\/)/.test(specifier);

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

/** Every way the modules reachable from `entries` break the root boundary, sorted. */
const rootOffences = (root: string, entries: ReadonlyArray<string>, read: Read = readSource): ReadonlyArray<string> => {
	const reached = new Set(entries.flatMap((entry) => [...reachableFrom(resolve(root, entry), read)]));
	const offences: Array<string> = [];
	for (const file of reached) {
		const path = relativeTo(root, file);
		if (isUiModule(path)) offences.push(`${path} is a ./ui module`);
		for (const specifier of specifiersOf(file, read)) {
			if (isUiPackage(specifier) || isUiSelfReference(specifier)) offences.push(`${path} imports ${specifier}`);
		}
	}
	return offences.sort();
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
 * - `ui/internal/inkChalk.ts`: `forbidImports` of `node:module`, `node:url`, `node:fs`;
 * - `ui/testing/fakeStreams.ts` (testing only): `forbidImports` of `node:stream` (it needs no `node:events`).
 */
const NODE_LICENCE: ReadonlyArray<string> = [
	"ui/internal/inkChalk.ts forbidImports node:fs",
	"ui/internal/inkChalk.ts forbidImports node:module",
	"ui/internal/inkChalk.ts forbidImports node:url",
	"ui/internal/processStreams.ts process process",
	"ui/testing/fakeStreams.ts forbidImports node:stream",
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
	layer(NodeServices.layer)((it) => {
		it.effect("the scanner still flags and spares what its shipped fixtures say (positive control)", () =>
			Effect.sync(() => assert.deepStrictEqual(SourceBoundary.verifyFixtures(), [])),
		);

		it.effect(
			"no source file reads process, writes to stdout, or imports node:, a platform package, mcp, engine, ink or react, outside the ./ui waivers",
			() =>
				Effect.gen(function* () {
					const scan = yield* SourceBoundary.scan({
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
							process: ["ui/internal/processStreams.ts"],
							"stdout-write": ["ui/internal/inkConsole.ts"],
						},
					});
					assert.include(scan.files, "CliRuntime.ts", "the scan read the real tree");
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

		// CliLogger binds a LOCAL `console` to core's Console service
		// (CliLogger.ts:104); the scanner has no scope analysis, so the console
		// rule is waived for that one file. The waiver is visible in `waived`,
		// which proves it is both needed and the only one. The process and
		// stdout rules are held by the scan above.
		it.effect("only CliLogger.ts names console, and only the console rule is waived there", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: SRC,
					rules: ["console"],
					allowRules: { console: ["CliLogger.ts"] },
				});
				assert.include(scan.files, "CliLogger.ts", "the scan read the real tree");
				assert.deepStrictEqual(scan.allowed, []);
				assert.deepStrictEqual(scan.violations, []);
				assert.isNotEmpty(scan.waived, "the waiver still waives something");
				assert.deepStrictEqual(
					[...new Set(scan.waived.map((offence) => `${offence.file} ${offence.rule}`))],
					["CliLogger.ts console"],
				);
			}),
		);
	});

	describe("reachability", () => {
		it("the walker resolves the root's real modules, or it proves nothing", () => {
			const main = [...reachableFrom(resolve(SRC, "index.ts"))].map((file) => relativeTo(SRC, file));
			const testing = [...reachableFrom(resolve(SRC, "testing.ts"))].map((file) => relativeTo(SRC, file));
			assert.include(main, "CliRuntime.ts");
			assert.include(testing, "CliTest.ts");
		});

		it("nothing reachable from `.` or `./testing` is a ./ui module or names ink or react", () => {
			assert.deepStrictEqual(rootOffences(SRC, ["index.ts", "testing.ts"]), []);
		});

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
			const uiFiles = (readdirSync(SRC, { recursive: true }) as ReadonlyArray<string>)
				.map((file) => file.split(sep).join("/"))
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
			const uiFiles = (readdirSync(SRC, { recursive: true }) as ReadonlyArray<string>)
				.map((file) => file.split(sep).join("/"))
				.filter((file) => file.endsWith(".ts") && isUiModule(file))
				.sort();
			const offenders = uiFiles.flatMap((file) =>
				valueImportsOf(readSource(join(SRC, file)), isPackageSelfName).map((spec) => `${file} ${spec}`),
			);
			assert.deepStrictEqual(offenders, []);
			assert.include(
				specifiersOf(join(SRC, "ui", "CliUi.ts"), readSource),
				"@effected/cli",
				"positive control: CliUi.ts names the root types through the package's own name",
			);
			assert.deepStrictEqual(valueImportsOf('import { CliTheme } from "../../effected/cli/index.ts";', isPackageSelfName), [
				"@effected/cli",
			]);
			assert.deepStrictEqual(valueImportsOf('import type * as Cli from "../../effected/cli/index.ts";', isPackageSelfName), []);
		});

		it("no root module imports the package's own name, which would make the root declarations import themselves", () => {
			const rootFiles = (readdirSync(SRC, { recursive: true }) as ReadonlyArray<string>)
				.map((file) => file.split(sep).join("/"))
				.filter((file) => file.endsWith(".ts") && !isUiModule(file));
			assert.include(rootFiles, "CliRuntime.ts", "the walk read the root tree");
			const offenders = rootFiles.flatMap((file) =>
				specifiersOf(join(SRC, file), readSource)
					.filter(isPackageSelfName)
					.map((spec) => `${file} ${spec}`),
			);
			assert.deepStrictEqual(offenders, []);
			assert.deepStrictEqual(
				SourceBoundary.importSpecifiers('import type { CliTheme } from "../../effected/cli/index.ts";').filter(isPackageSelfName),
				["@effected/cli"],
				"mutation control: even a type-only self-import is caught",
			);
			assert.deepStrictEqual(
				SourceBoundary.importSpecifiers('/** import { CliLogger } from "../../effected/cli/index.ts" */\nexport {};').filter(
					isPackageSelfName,
				),
				[],
				"a TSDoc example naming the package is not an import",
			);
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

		it("mutation control: a root module reaching ./ui is flagged, however it gets there", () => {
			const root = "/virtual/src";
			const graph = (files: Record<string, string>): Read => {
				const sources = new Map(Object.entries(files).map(([path, text]) => [resolve(root, path), text]));
				return (file) => {
					const text = sources.get(file);
					if (text === undefined) throw new Error(`no module ${file}`);
					return text;
				};
			};
			const tree = {
				"index.ts": 'export * from "./Cli.ts";\nexport * from "./commands/run.ts";\n',
				"commands/run.ts": 'import { helper } from "../uiHelpers.ts";\nexport const run = helper;\n',
				"uiHelpers.ts": "export const helper = 1;\n",
				"ui.ts": 'export * from "./ui/Screen.ts";\n',
				"ui/Screen.ts": 'import type { Box } from "ink";\nexport const load = () => import("react");\n',
			};
			// The clean twin: a root that never reaches ./ui, beside a ./ui that names ink and react.
			assert.deepStrictEqual(
				rootOffences(root, ["index.ts"], graph({ ...tree, "Cli.ts": "export const cli = 1;\n" })),
				[],
				"a clean tree, and a uiHelpers module that merely starts with ui, are not flagged",
			);
			assert.deepStrictEqual(
				rootOffences(root, ["index.ts"], graph({ ...tree, "Cli.ts": 'export { load } from "./ui/Screen.ts";\n' })),
				["ui/Screen.ts imports ink", "ui/Screen.ts imports react", "ui/Screen.ts is a ./ui module"],
			);
			assert.deepStrictEqual(
				rootOffences(
					root,
					["index.ts"],
					graph({ ...tree, "Cli.ts": 'export const lazy = () => import("./ui.ts");\n' }),
				),
				[
					"ui.ts is a ./ui module",
					"ui/Screen.ts imports ink",
					"ui/Screen.ts imports react",
					"ui/Screen.ts is a ./ui module",
				],
				"a lazy import() of ./ui counts as reaching it",
			);
			assert.deepStrictEqual(
				rootOffences(
					root,
					["index.ts"],
					graph({
						...tree,
						"Cli.ts": "export const cli = 1;\n",
						"commands/run.ts": 'export { load as run } from "../ui/Screen.ts";\n',
					}),
				),
				["ui/Screen.ts imports ink", "ui/Screen.ts imports react", "ui/Screen.ts is a ./ui module"],
				"a nested module reaching up into ./ui is flagged",
			);
			assert.deepStrictEqual(
				rootOffences(root, ["index.ts"], graph({ ...tree, "Cli.ts": 'import type { Ink } from "ink";\n' })),
				["Cli.ts imports ink"],
				"even a type-only ink import is off limits to the root",
			);
			assert.deepStrictEqual(
				rootOffences(
					root,
					["index.ts"],
					graph({
						...tree,
						"Cli.ts":
							'export const lazy = () => import("../../effected/cli/ui.ts");\nexport * from "../../effected/cli/ui-testing.ts";\n',
					}),
				),
				["Cli.ts imports @effected/cli/ui", "Cli.ts imports @effected/cli/ui/testing"],
				"a self-reference into ./ui through the package's own name is flagged",
			);
		});
	});
});
