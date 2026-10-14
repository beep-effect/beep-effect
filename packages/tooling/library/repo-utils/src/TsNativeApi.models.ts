/**
 * Configuration, detached diagnostics and typed failures for native compiler access.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("TsNativeApi.models");

/**
 * Binary selection and repository paths for one native compiler process.
 *
 * **Example** (Import TsNativeConfig)
 *
 * ```ts
 * import { TsNativeConfig } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeConfig)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class TsNativeConfig extends S.Class<TsNativeConfig>($I`TsNativeConfig`)(
  {
    executable: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    cwd: S.NonEmptyString,
    tsconfig: S.NonEmptyString,
  },
  $I.annote("TsNativeConfig", {
    description: "Native compiler executable override, working directory and default project config.",
  })
) {}

/**
 * Categories surfaced by the native compiler diagnostic protocol.
 *
 * **Example** (Import TsNativeDiagnosticCategory)
 *
 * ```ts
 * import { TsNativeDiagnosticCategory } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeDiagnosticCategory)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TsNativeDiagnosticCategory = LiteralKit(["warning", "error", "suggestion", "message"]).pipe(
  $I.annoteSchema("TsNativeDiagnosticCategory", { description: "Native diagnostic severity categories." })
);
/**
 * Native diagnostic category decoded from the protocol.
 *
 * **Example** (Describe a diagnostic category)
 *
 * ```ts
 * import type { TsNativeDiagnosticCategory } from "@beep/repo-utils/TsNativeApi"
 * const category: TsNativeDiagnosticCategory = "error"
 * console.log(category)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TsNativeDiagnosticCategory = typeof TsNativeDiagnosticCategory.Type;

/**
 * A diagnostic detached from native snapshot handles.
 *
 * **Example** (Import TsNativeDiagnostic)
 *
 * ```ts
 * import { TsNativeDiagnostic } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeDiagnostic)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsNativeDiagnostic extends S.Class<TsNativeDiagnostic>($I`TsNativeDiagnostic`)(
  {
    fileName: S.OptionFromOptionalKey(S.String),
    pos: S.Int,
    end: S.Int,
    code: S.Int,
    category: TsNativeDiagnosticCategory,
    text: S.String,
  },
  $I.annote("TsNativeDiagnostic", {
    description: "Serializable native diagnostic with optional source filename and UTF-16 offsets.",
  })
) {}

/**
 * The selected native compiler executable could not be resolved or accessed.
 *
 * **Example** (Import TsNativeBinaryNotFound)
 *
 * ```ts
 * import { TsNativeBinaryNotFound } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeBinaryNotFound)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class TsNativeBinaryNotFound extends S.TaggedError<TsNativeBinaryNotFound>($I`TsNativeBinaryNotFound`)(
  "TsNativeBinaryNotFound",
  { executable: S.String, cause: S.Defect({ includeStack: true }) },
  $I.annoteError<TsNativeBinaryNotFound>("TsNativeBinaryNotFound", {
    description: "The selected native compiler executable could not be resolved or accessed.",
  })
) {}

/**
 * A native API request or response failed.
 *
 * **Example** (Import TsNativeProtocolFailure)
 *
 * ```ts
 * import { TsNativeProtocolFailure } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeProtocolFailure)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class TsNativeProtocolFailure extends S.TaggedError<TsNativeProtocolFailure>($I`TsNativeProtocolFailure`)(
  "TsNativeProtocolFailure",
  { operation: S.String, cause: S.Defect({ includeStack: true }) },
  $I.annoteError<TsNativeProtocolFailure>("TsNativeProtocolFailure", {
    description: "A native API request or response failed.",
  })
) {}

/**
 * The requested source file was absent from the selected native project.
 *
 * **Example** (Import TsNativeFileNotInProgram)
 *
 * ```ts
 * import { TsNativeFileNotInProgram } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeFileNotInProgram)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class TsNativeFileNotInProgram extends S.TaggedError<TsNativeFileNotInProgram>($I`TsNativeFileNotInProgram`)(
  "TsNativeFileNotInProgram",
  { filePath: S.String, tsconfig: S.String },
  $I.annoteError<TsNativeFileNotInProgram>("TsNativeFileNotInProgram", {
    description: "The requested source file was absent from the selected native project.",
  })
) {}
