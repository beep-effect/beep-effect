/**
 * Effect-native environment detection: which agent or CI is running a program, what the terminal can do (colour
 * level, hyperlinks, columns), and which audience the output is for.
 *
 * **Details**
 *
 * Every read goes through `Config`, `Stdio` and `Terminal`, never `process`, so a test swaps the environment with a layer:
 * `CurrentRuntimeEnv.layerTest`, `TerminalEnv.layerTest` and `Audience.layerTest`. The colour decision is also
 * available as the pure `fromEnv` of `@beep/runtime-env/ColorLevel`, for a caller without a layer.
 *
 * **Example** (Fix the audience in a test)
 *
 * ```ts
 * import { Audience } from "@beep/runtime-env/Audience";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.map(Audience, (audience) => audience.kind).pipe(Effect.provide(Audience.layerTest("agent")));
 * console.log(Effect.runSync(program)) // agent
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export { Audience } from "./Audience.ts";
export { EnvOverride } from "./EnvOverride.ts";
export { AgentEnvKey, CurrentRuntimeEnv, RuntimeEnv } from "./RuntimeEnv.ts";
export { TerminalEnv } from "./TerminalEnv.ts";
export type { AudienceKind, AudienceOptions, AudienceShape } from "./Audience.ts";
export type { ColorLevel } from "./ColorLevel.ts";
export type { CiName, RuntimeEnvOverrides } from "./RuntimeEnv.ts";
export type {
  StreamEnv,
  TerminalEnvOptions,
  TerminalEnvShape,
  TerminalEnvTestOptions,
  TerminalSnapshot,
} from "./TerminalEnv.ts";
