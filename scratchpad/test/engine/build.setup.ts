/**
 * Vitest global setup for the engine module. Upstream runs `build:dev` before
 * `test`, and the entrypoint suite walks the `dist/dev/pkg` output that build
 * emits. The lab has no per-module build task, so this setup emits the same
 * transpiled distribution (no type check) before any engine test runs.
 */
import { NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const ENGINE = "scratchpad/effected/engine";
const SOURCES = ["Distribution", "LaunchContext", "ProcessGuard", "Remediation", "guard", "index"];

const emit = Effect.gen(function* () {
	const path = yield* Path.Path;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const repo = yield* path.fromFileUrl(new URL("../../..", import.meta.url));
	const output = yield* spawner.string(
		ChildProcess.make(
			path.join(repo, "node_modules/.bin/tsgo"),
			[
				"--ignoreConfig",
				"--target",
				"ES2025",
				"--module",
				"NodeNext",
				"--moduleResolution",
				"NodeNext",
				"--verbatimModuleSyntax",
				"--rewriteRelativeImportExtensions",
				"--noCheck",
				"--noResolve",
				"--outDir",
				`${ENGINE}/dist/dev/pkg`,
				...A.map(SOURCES, (name) => `${ENGINE}/${name}.ts`),
			],
			{ cwd: repo },
		),
		{ includeStderr: true },
	);
	yield* Effect.logDebug(output);
});

/** Emits `scratchpad/effected/engine/dist/dev/pkg` once per engine test run. */
export default function setup(): Promise<void> {
	return Effect.runPromise(
		Effect.scopedWith((scope) =>
			Effect.flatMap(Layer.buildWithScope(NodeServices.layer, scope), (context) => Effect.provideContext(emit, context)),
		),
	);
}
