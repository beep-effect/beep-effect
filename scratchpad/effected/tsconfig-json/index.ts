/**
 * Composable tsconfig.json handling for Effect: schemas, extends-chain
 * resolution, and config discovery.
 *
 * @packageDocumentation
 */

export {
	CompilerOptions,
	Jsx,
	Lib,
	Module,
	ModuleDetection,
	ModuleResolution,
	NewLine,
	Target,
} from "./CompilerOptions.ts";
export type { ProgrammaticRecord } from "./CompilerOptionsFromProgrammatic.ts";
export { CompilerOptionsFromProgrammatic } from "./CompilerOptionsFromProgrammatic.ts";
export { JsxConfig } from "./JsxConfig.ts";
export type { PortableTsconfigOptions } from "./PortableTsconfig.ts";
export { PortableTsconfig } from "./PortableTsconfig.ts";
export { ResolvedTsconfig } from "./ResolvedTsconfig.ts";
export type { FindNearestOptions } from "./TsconfigDiscovery.ts";
export { TsconfigDiscovery } from "./TsconfigDiscovery.ts";
export {
	FallbackPolling,
	Reference,
	TsconfigJson,
	TsconfigJsonFromString,
	TsconfigParseError,
	TypeAcquisition,
	WatchDirectory,
	WatchFile,
	WatchOptions,
} from "./TsconfigJson.ts";
export { TsconfigExtendsError, TsconfigLoader } from "./TsconfigLoader.ts";
export type { SyncFileSystem, SyncPath, TsconfigLoaderSyncOptions } from "./TsconfigLoaderSync.ts";
export { TsconfigLoaderSync } from "./TsconfigLoaderSync.ts";
export type { EnumFamily, ProgrammaticCompilerOptionsValue } from "./TsEnumCodec.ts";
export { ProgrammaticCompilerOptions, TsEnumCodec } from "./TsEnumCodec.ts";
