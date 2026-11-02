/**
 * TypeScript tsconfig.json document model with tsc merge semantics and
 * compiler-option codecs.
 *
 * **Details**
 *
 * `TsconfigJson` and `CompilerOptions` are the string-level document schemas
 * (TS 6.0.3 × schemastore), `TsconfigJsonFromString` parses JSONC text,
 * `ResolvedTsconfig` reproduces tsc's `extends` merge as pure string
 * transforms, `PortableTsconfig` projects a resolved config down to its
 * machine-independent slice, and `TsEnumCodec` with
 * `CompilerOptionsFromProgrammatic` bridges TypeScript's numeric enum
 * spelling. Nothing here performs IO.
 *
 * **Example** (Decode a tsconfig.json document)
 *
 * ```ts
 * import { TsconfigJsonFromString } from "@beep/tsconfig/TsconfigJson";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const program = S.decodeEffect(TsconfigJsonFromString)('{ "compilerOptions": { "target": "ES2022" } }');
 *
 * console.log(Effect.runSync(program).compilerOptions?.target);
 * // => "es2022"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  ClosedCompilerOptions,
  CompilerOptions,
  Jsx,
  Lib,
  Module,
  ModuleDetection,
  ModuleResolution,
  NewLine,
  Target,
} from "./CompilerOptions.ts";
export { CompilerOptionsFromProgrammatic, ProgrammaticRecord } from "./CompilerOptionsFromProgrammatic.ts";
export { JsxConfig } from "./JsxConfig.ts";
export { PortableTsconfig, PortableTsconfigOptions } from "./PortableTsconfig.ts";
export { ResolvedTsconfig } from "./ResolvedTsconfig.ts";
export {
  ClosedTsconfigJson,
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
export { ProgrammaticCompilerOptions, TsEnumCodec } from "./TsEnumCodec.ts";
export type { EnumFamily, ProgrammaticCompilerOptionsValue } from "./TsEnumCodec.ts";
