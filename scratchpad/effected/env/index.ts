/**
 * Effect-native environment detection: which agent or CI is running a program, what the terminal can do (colour
 * level, hyperlinks, columns), and which audience the output is for.
 *
 * @remarks
 * Every read goes through `Config`, `Stdio` and `Terminal`, never `process`, so a test swaps the environment with a layer:
 * `CurrentRuntimeEnv.layerTest`, `TerminalEnv.layerTest` and `Audience.layerTest`.
 *
 * @packageDocumentation
 */
export type { AudienceKind, AudienceOptions, AudienceShape } from "./Audience.ts";
export { Audience } from "./Audience.ts";
export type { ColorLevel } from "./ColorLevel.ts";
export { EnvOverride } from "./EnvOverride.ts";
export type { CiName, RuntimeEnvOverrides } from "./RuntimeEnv.ts";
export { CurrentRuntimeEnv, RuntimeEnv } from "./RuntimeEnv.ts";
export type { StreamEnv, TerminalEnvOptions, TerminalEnvShape, TerminalEnvTestOptions } from "./TerminalEnv.ts";
export { TerminalEnv } from "./TerminalEnv.ts";
