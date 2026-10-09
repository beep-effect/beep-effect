/**
 * Structured command running and CLI tool discovery over Effect core's
 * `ChildProcessSpawner` contract.
 *
 * **Details**
 *
 * This package owns no subprocess vocabulary and no spawner backend. Commands
 * are core `ChildProcess.Command` values, built with core's own constructors
 * and combinators; the spawner arrives through the `R` channel and the
 * application provides a platform layer once at the edge. What this package
 * adds is the *outcome* (collected output, typed failure), the *policy*
 * (timeout, redaction, transience) and the *tool* (discovery, version, source).
 *
 * **Example** (Resolve Biome through pnpm and run a check)
 *
 * ```ts
 * import { LocalExec, Run, Tool, ToolDiscovery } from "./index.ts";
 * import { NodeServices } from "@effect/platform-node";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* ToolDiscovery;
 *   const biome = yield* discovery.resolve(Tool.named("biome"));
 *   return yield* Run.text(biome.command("check", "."));
 * });
 *
 * const AppLayer = ToolDiscovery.layer.pipe(
 *   Layer.provide(LocalExec.layerFor("pnpm", { directory: "/repo" })),
 *   Layer.provide(NodeServices.layer),
 * );
 *
 * const runnable = program.pipe(Effect.provide(AppLayer));
 * ```
 *
 * @packageDocumentation
 */

export type { LauncherPrefixes, LocalExecShape } from "./LocalExec.ts";
export { ExecContext, Launcher, LocalExec, LocalExecError } from "./LocalExec.ts";
export { REDACTED, Redaction, SECRET_FLAGS } from "./Redaction.ts";
export { Retry, TRANSIENT_PATTERNS } from "./Retry.ts";
export type { RunOptions } from "./Run.ts";
export { CommandFailedError, CommandOutput, CommandOutputError, DEFAULT_MAX_OUTPUT_BYTES, Run } from "./Run.ts";
export type { ScriptResult, SpawnRecord, SpawnScript } from "./ScriptedSpawner.ts";
export { ScriptedSpawner } from "./ScriptedSpawner.ts";
export { MismatchPolicy, Tool, ToolSource, VersionFlag, VersionJson, VersionNone, VersionProbe } from "./Tool.ts";
export type { ToolDiscoveryShape, ToolResolutionFailure } from "./ToolDiscovery.ts";
export {
	ResolvedSource,
	ResolvedTool,
	ToolDiscovery,
	ToolNotFoundError,
	ToolRefusedError,
	ToolVersionMismatchError,
} from "./ToolDiscovery.ts";
