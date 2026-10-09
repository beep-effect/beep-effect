// @effect-diagnostics nodeBuiltinImport:skip-file
// The package's own source, scanned by the scanner it ships. Real disk, real
// lexing: ConfigDependencyHooks.ts embeds a child script whose process.argv and
// process.stdout.write sit in TEMPLATE TEXT, which must not count, while six
// other modules really do read process.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SourceBoundary } from "../../../effected/workspaces/testing.ts";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "effected", "workspaces");
const Platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TESTING_MODULES = new Set([
	"testing.ts",
	"SourceBoundary.ts",
	"LayerPolicy.ts",
	"WorkspaceLayering.ts",
	"PackedInstall.ts",
	"internal/sourceText.ts",
	"internal/packedInstallPlan.ts",
	"internal/dependencyFields.ts",
]);

/**
 * The modules that legitimately read `process`: ambient defaults (the cwd,
 * the environment) and real Node bindings. Twelve reads across six files:
 * the four root-resolving services share `internal/layerRoot.ts`'s one
 * ambient-cwd read, and four Node bindings each retrieve two built-in modules.
 */
const PROCESS_READERS: ReadonlyArray<string> = [
	"Workspaces.ts",
	"internal/configDependencyFetch.ts",
	"internal/configDependencyResolution.ts",
	"internal/configDependencyShared.ts",
	"internal/layerRoot.ts",
	"node-sync.ts",
];

describe("@effected/workspaces, scanned by SourceBoundary", () => {
	layer(Platform, { timeout: "30 seconds" })((it) => {
		it.effect("finds exactly the modules that read process, and not the replay script's template text", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({ root: SRC, rules: ["process"] });
				assert.include(scan.files, "ConfigDependencyHooks.ts", "the embedded script's module was read");
				assert.deepStrictEqual([...new Set(scan.offences.map((offence) => offence.file))], [...PROCESS_READERS]);
				assert.strictEqual(scan.offences.length, 12);
			}),
		);

		it.effect("the process allowlist is exact: with it the package is clean, and dropping any entry turns red", () =>
			Effect.gen(function* () {
				const clean = yield* SourceBoundary.scan({ root: SRC, rules: ["process"], allow: PROCESS_READERS });
				assert.deepStrictEqual(clean.violations, []);
				assert.deepStrictEqual(clean.allowed, [...PROCESS_READERS]);
				for (const dropped of PROCESS_READERS) {
					const scan = yield* SourceBoundary.scan({
						root: SRC,
						rules: ["process"],
						allow: PROCESS_READERS.filter((entry) => entry !== dropped),
					});
					assert.isNotEmpty(scan.violations, `dropping ${dropped} from the allowlist must surface its read`);
					assert.deepStrictEqual(
						[...new Set(scan.offences.map((offence) => offence.file))],
						[dropped],
						`only ${dropped} is reported once it is dropped`,
					);
				}
			}),
		);

		it.effect("the replay script's stdout write is template text, not a write", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({ root: SRC, rules: ["stdout-write"] });
				assert.isAbove(scan.files.length, 20);
				assert.deepStrictEqual(scan.violations, []);
			}),
		);

		it.effect(
			"the ./testing modules read no process, import no node: or platform module, and touch no console or stdout",
			() =>
				Effect.gen(function* () {
					const scan = yield* SourceBoundary.scan({
						root: SRC,
						rules: [
							"process",
							"node:process",
							"stdout-write",
							"console",
							{ forbidImports: ["node:*", "@effect/platform*"] },
						],
					});
					assert.isTrue(scan.files.includes("SourceBoundary.ts"), "the testing modules were read");
					assert.isNotEmpty(scan.offences, "the same rules do flag the modules outside ./testing");
					assert.deepStrictEqual(
						scan.offences.filter((offence) => TESTING_MODULES.has(offence.file)).map((offence) => offence.label),
						[],
					);
				}),
		);
	});
});
