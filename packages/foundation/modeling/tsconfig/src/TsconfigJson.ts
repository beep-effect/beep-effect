/**
 * The tsconfig.json document schema — the top-level `TsconfigJson` struct plus
 * its sub-object schemas (`Reference`, `WatchOptions`, `TypeAcquisition`) and
 * the JSONC codec (`TsconfigJsonFromString`), modelled on TS 6.0.3 ×
 * schemastore. The three watchOptions VALUE enums
 * (watchFile/watchDirectory/fallbackPolling) are defined here;
 * CompilerOptions.ts owns compilerOptions only.
 *
 * **Details**
 *
 * Every parse goes through `@beep/jsonc`'s `Jsonc.schema` — there is no
 * JSON-strict path. `TsconfigJsonFromString` is bound
 * once at module top level, per the house Schema-producing-function
 * discipline (`Jsonc.schema` derives fresh caches per call).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TsconfigId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { ClosedCompilerOptions, CompilerOptions } from "./CompilerOptions.ts";
import { caseInsensitiveLiterals } from "./internal/caseInsensitiveLiterals.ts";

const $I = $TsconfigId.create("TsconfigJson");

const WatchFileKit = LiteralKit([
  "fixedpollinginterval",
  "prioritypollinginterval",
  "dynamicprioritypolling",
  "fixedchunksizepolling",
  "usefsevents",
  "usefseventsonparentdirectory",
]).pipe($I.annoteSchema("WatchFileLiterals", { description: "The strategy for watching individual source files." }));

const WatchDirectoryKit = LiteralKit([
  "usefsevents",
  "fixedpollinginterval",
  "dynamicprioritypolling",
  "fixedchunksizepolling",
]).pipe($I.annoteSchema("WatchDirectoryLiterals", { description: "The strategy for watching source directories." }));

const FallbackPollingKit = LiteralKit(["fixedinterval", "priorityinterval", "dynamicpriority", "fixedchunksize"]).pipe(
  $I.annoteSchema("FallbackPollingLiterals", {
    description: "The polling strategy used when filesystem events are unavailable.",
  })
);

/**
 * Validates the strategy for individual source files in `watchOptions.watchFile`.
 *
 * **Details**
 *
 * Decoding accepts case-insensitive literals; encoding uses their canonical lowercase spelling.
 *
 * **Example** (Normalize watchFile casing)
 *
 * ```ts
 * import { WatchFile } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const strategy = S.decodeUnknownSync(WatchFile)("UseFsEvents")
 * console.log(strategy) // usefsevents
 * console.log(S.encodeSync(WatchFile)(strategy)) // usefsevents
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WatchFile = caseInsensitiveLiterals(WatchFileKit).pipe(
  $I.annoteSchema("WatchFile", { description: "The strategy for watching individual source files." })
);

/**
 * Decoded value accepted by {@link (WatchFile:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WatchFile = typeof WatchFile.Type;

/**
 * Validates the strategy for source directories in `watchOptions.watchDirectory`.
 *
 * **Details**
 *
 * Decoding accepts case-insensitive literals; encoding uses their canonical lowercase spelling.
 *
 * **Example** (Normalize watchDirectory casing)
 *
 * ```ts
 * import { WatchDirectory } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const strategy = S.decodeUnknownSync(WatchDirectory)("FixedPollingInterval")
 * console.log(strategy) // fixedpollinginterval
 * console.log(S.encodeSync(WatchDirectory)(strategy)) // fixedpollinginterval
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WatchDirectory = caseInsensitiveLiterals(WatchDirectoryKit).pipe(
  $I.annoteSchema("WatchDirectory", { description: "The strategy for watching source directories." })
);

/**
 * Decoded value accepted by {@link (WatchDirectory:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WatchDirectory = typeof WatchDirectory.Type;

/**
 * Validates the strategy for polling when filesystem events are unavailable in `watchOptions.fallbackPolling`.
 *
 * **Details**
 *
 * Decoding accepts case-insensitive literals; encoding uses their canonical lowercase spelling.
 *
 * **Example** (Normalize fallbackPolling casing)
 *
 * ```ts
 * import { FallbackPolling } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const strategy = S.decodeUnknownSync(FallbackPolling)("DynamicPriority")
 * console.log(strategy) // dynamicpriority
 * console.log(S.encodeSync(FallbackPolling)(strategy)) // dynamicpriority
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FallbackPolling = caseInsensitiveLiterals(FallbackPollingKit).pipe(
  $I.annoteSchema("FallbackPolling", {
    description: "The polling strategy used when filesystem events are unavailable.",
  })
);

/**
 * Decoded value accepted by {@link (FallbackPolling:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FallbackPolling = typeof FallbackPolling.Type;

// The known fields; unknown keys ride the passthrough record below.
const ReferenceFields = S.Struct({
  path: S.String.check(S.isMinLength(1)).pipe(
    $I.annoteKey("Reference.path", { description: "The non-empty path to a referenced TypeScript project." })
  ),
});

/**
 * One `references[]` entry: `path` is required and non-empty; every other key
 * is preserved verbatim.
 *
 * **Example** (Preserve project reference metadata)
 *
 * ```ts
 * import { Reference } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const reference = S.decodeUnknownSync(Reference)({ path: "./core", custom: true })
 * console.log(reference.path) // ./core
 * console.log(reference["custom"]) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Reference = S.StructWithRest(ReferenceFields, [S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("Reference", {
    description: "A referenced TypeScript project with additional reference metadata preserved.",
  })
);

/**
 * Decoded value accepted by {@link (Reference:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type Reference = typeof Reference.Type;

/**
 * Type-only companion namespace for {@link (Reference:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Reference {
  /**
   * The decoded `references[]` entry shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = Reference;
  /**
   * The encoded (on-disk JSON) `references[]` entry shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Reference.Encoded;
}

// The known fields; unknown keys ride the passthrough record below.
const WatchOptionsFields = S.Struct({
  watchFile: S.optionalKey(WatchFile).pipe(
    $I.annoteKey("WatchOptions.watchFile", { description: "The strategy for watching individual files." })
  ),
  watchDirectory: S.optionalKey(WatchDirectory).pipe(
    $I.annoteKey("WatchOptions.watchDirectory", { description: "The strategy for watching directories." })
  ),
  fallbackPolling: S.optionalKey(FallbackPolling).pipe(
    $I.annoteKey("WatchOptions.fallbackPolling", {
      description: "The polling fallback when filesystem events are unavailable.",
    })
  ),
  synchronousWatchDirectory: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("WatchOptions.synchronousWatchDirectory", {
      description: "Updates directory watchers synchronously.",
    })
  ),
  excludeDirectories: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("WatchOptions.excludeDirectories", { description: "Directory patterns excluded from watching." })
  ),
  excludeFiles: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("WatchOptions.excludeFiles", { description: "File patterns excluded from watching." })
  ),
});

/**
 * Validates filesystem watch settings while preserving additional settings.
 *
 * **Details**
 *
 * `watchOptions` — the three enum fields, the two live booleans/arrays,
 * and a passthrough record (schemastore's `force` is phantom).
 *
 * **Example** (Normalize watch settings and preserve unknown keys)
 *
 * ```ts
 * import { WatchOptions } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(WatchOptions)({ watchFile: "UseFsEvents", force: true })
 * console.log(options.watchFile) // usefsevents
 * console.log(options["force"]) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WatchOptions = S.StructWithRest(WatchOptionsFields, [S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("WatchOptions", { description: "Optional filesystem watch settings with unknown keys preserved." })
);

/**
 * Decoded value accepted by {@link (WatchOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WatchOptions = typeof WatchOptions.Type;

/**
 * Type-only companion namespace for {@link (WatchOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WatchOptions {
  /**
   * The decoded `watchOptions` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = WatchOptions;
  /**
   * The encoded (on-disk JSON) `watchOptions` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WatchOptions.Encoded;
}

// The known fields; unknown keys ride the passthrough record below.
const TypeAcquisitionFields = S.Struct({
  enable: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("TypeAcquisition.enable", { description: "Enables automatic type acquisition." })
  ),
  include: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("TypeAcquisition.include", { description: "Type packages included in automatic acquisition." })
  ),
  exclude: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("TypeAcquisition.exclude", { description: "Type packages excluded from automatic acquisition." })
  ),
  disableFilenameBasedTypeAcquisition: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("TypeAcquisition.disableFilenameBasedTypeAcquisition", {
      description: "Disables type acquisition inferred from filenames.",
    })
  ),
});

/**
 * `typeAcquisition` — the automatic type-acquisition settings, with unknown keys preserved.
 *
 * **Example** (Decode automatic type acquisition settings)
 *
 * ```ts
 * import { TypeAcquisition } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const settings = S.decodeUnknownSync(TypeAcquisition)({ enable: true, include: ["node"], custom: "retained" })
 * console.log(settings.enable) // true
 * console.log(settings["custom"]) // retained
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TypeAcquisition = S.StructWithRest(TypeAcquisitionFields, [S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("TypeAcquisition", {
    description: "Automatic type-acquisition settings with unknown keys preserved.",
  })
);

/**
 * Decoded value accepted by {@link (TypeAcquisition:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TypeAcquisition = typeof TypeAcquisition.Type;

/**
 * Type-only companion namespace for {@link (TypeAcquisition:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TypeAcquisition {
  /**
   * The decoded `typeAcquisition` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = TypeAcquisition;
  /**
   * The encoded (on-disk JSON) `typeAcquisition` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TypeAcquisition.Encoded;
}

// The known fields; unknown keys ride the passthrough record below.
const TsconfigJsonFields = S.Struct({
  compilerOptions: S.optionalKey(CompilerOptions).pipe(
    $I.annoteKey("TsconfigJson.compilerOptions", { description: "The compilation options for this project." })
  ),
  extends: S.optionalKey(S.Union([S.String, S.Array(S.String)])).pipe(
    $I.annoteKey("TsconfigJson.extends", {
      description: "The base configuration path or ordered list of base configurations.",
    })
  ),
  files: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("TsconfigJson.files", { description: "The source files explicitly included in compilation." })
  ),
  include: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("TsconfigJson.include", { description: "Source-file patterns included in compilation." })
  ),
  exclude: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("TsconfigJson.exclude", { description: "Source-file patterns excluded from compilation." })
  ),
  references: Reference.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("TsconfigJson.references", { description: "The projects referenced by this configuration." })
  ),
  watchOptions: S.optionalKey(WatchOptions).pipe(
    $I.annoteKey("TsconfigJson.watchOptions", { description: "The filesystem watch settings." })
  ),
  typeAcquisition: S.optionalKey(TypeAcquisition).pipe(
    $I.annoteKey("TsconfigJson.typeAcquisition", { description: "The automatic type-acquisition settings." })
  ),
  compileOnSave: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("TsconfigJson.compileOnSave", { description: "Requests compilation when a file is saved." })
  ),
  $schema: S.optionalKey(S.String).pipe(
    $I.annoteKey("TsconfigJson.$schema", { description: "The schema URI associated with this configuration." })
  ),
});

/**
 * Validates a tsconfig.json document while retaining unrecognized top-level keys.
 *
 * **Details**
 *
 * The tsconfig.json document: every typed top-level field optional,
 * plus a passthrough record so unrecognized keys (`buildOptions`, `ts-node`,
 * …) survive decode and re-encode untouched — tsc itself silently ignores
 * unknown top-level keys, and this schema follows suit.
 *
 * **Example** (Round trip an unrecognized top-level setting)
 *
 * ```ts
 * import { TsconfigJson } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(TsconfigJson)({ compileOnSave: true, "ts-node": { transpileOnly: true } })
 * const encoded = S.encodeSync(TsconfigJson)(config)
 * console.log(encoded.compileOnSave) // true
 * console.log(encoded["ts-node"] === config["ts-node"]) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TsconfigJson = S.StructWithRest(TsconfigJsonFields, [S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("TsconfigJson", {
    description: "A tsconfig.json document with optional typed fields and unknown keys preserved.",
  })
);

/**
 * Decoded value accepted by {@link (TsconfigJson:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigJson = typeof TsconfigJson.Type;

/**
 * Type-only companion namespace for {@link (TsconfigJson:variable)}, exposing its decoded
 * and encoded shapes plus the JSONC codec.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TsconfigJson {
  /**
   * The decoded tsconfig.json shape: every typed field optional, plus passthrough for unknown keys.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = TsconfigJson;
  /**
   * The encoded (on-disk JSON) tsconfig.json shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TsconfigJson.Encoded;
}

// The closed sections: the typed fields of each passthrough section, no rest record.
const ClosedReference = ReferenceFields.pipe(
  $I.annoteSchema("ClosedReference", {
    description: "A referenced TypeScript project with no passthrough: an unknown key is an excess property.",
  })
);
const ClosedWatchOptions = WatchOptionsFields.pipe(
  $I.annoteSchema("ClosedWatchOptions", {
    description: "The typed watch options with no passthrough: an unknown key is an excess property.",
  })
);
const ClosedTypeAcquisition = TypeAcquisitionFields.pipe(
  $I.annoteSchema("ClosedTypeAcquisition", {
    description: "The typed type-acquisition settings with no passthrough: an unknown key is an excess property.",
  })
);

/**
 * The closed view of {@link (TsconfigJson:variable)}: the same typed top-level
 * fields with no passthrough record, and every nested section (`compilerOptions`,
 * `references[]`, `watchOptions`, `typeAcquisition`) closed the same way.
 *
 * **Details**
 *
 * The passthrough schema admits `buildOptions`, `ts-node` and any other key
 * tsc ignores; here each is an excess property. Decoding with
 * `onExcessProperty: "error"` rejects it; the default `"ignore"` drops it.
 * `@beep/repo-tsconfig` `TsconfigValidator` layers tsc's cross-field and
 * uniqueness checks over this view.
 *
 * **Example** (Reject an unknown top-level key)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ClosedTsconfigJson } from "@beep/tsconfig/TsconfigJson";
 *
 * const strict = S.decodeUnknownExit(ClosedTsconfigJson);
 * console.log(strict({ compileOnSave: true }, { onExcessProperty: "error" })._tag); // Success
 * console.log(strict({ "ts-node": { transpileOnly: true } }, { onExcessProperty: "error" })._tag); // Failure
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ClosedTsconfigJson = S.Struct({
  ...TsconfigJsonFields.fields,
  compilerOptions: S.optionalKey(ClosedCompilerOptions).pipe(
    $I.annoteKey("ClosedTsconfigJson.compilerOptions", {
      description: "The compilation options for this project, closed to the typed options.",
    })
  ),
  references: ClosedReference.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("ClosedTsconfigJson.references", {
      description: "The projects referenced by this configuration, each closed to `path`.",
    })
  ),
  watchOptions: S.optionalKey(ClosedWatchOptions).pipe(
    $I.annoteKey("ClosedTsconfigJson.watchOptions", {
      description: "The filesystem watch settings, closed to the typed options.",
    })
  ),
  typeAcquisition: S.optionalKey(ClosedTypeAcquisition).pipe(
    $I.annoteKey("ClosedTsconfigJson.typeAcquisition", {
      description: "The automatic type-acquisition settings, closed to the typed options.",
    })
  ),
}).pipe(
  $I.annoteSchema("ClosedTsconfigJson", {
    description:
      "A tsconfig.json document closed to its typed fields at every level: an unknown key is an excess property.",
  })
);

/**
 * Decoded value accepted by {@link (ClosedTsconfigJson:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ClosedTsconfigJson = typeof ClosedTsconfigJson.Type;

/**
 * Type-only companion namespace for {@link (ClosedTsconfigJson:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClosedTsconfigJson {
  /**
   * The decoded closed tsconfig.json shape: every typed field optional, no index signature at any level.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ClosedTsconfigJson;
  /**
   * The encoded (on-disk JSON) closed tsconfig.json shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClosedTsconfigJson.Encoded;
}

/**
 * Decodes a JSONC-encoded tsconfig.json document straight into
 * {@link (TsconfigJson:variable)}.
 *
 * **Details**
 *
 * Bound once at module top level —
 * `Jsonc.schema` is schema-producing, and this is the shared instance
 * (`TsconfigJson` is a `Schema.StructWithRest` value rather than a
 * `Schema.Class`, so the codec is a sibling export, not a static).
 *
 * **Example** (Decode comments and a trailing comma)
 *
 * ```ts
 * import { TsconfigJsonFromString } from "@beep/tsconfig/TsconfigJson"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(TsconfigJsonFromString)(
 *   '{ // editor configuration\n "compileOnSave": true, }'
 * )
 * console.log(config.compileOnSave) // true
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const TsconfigJsonFromString: S.Codec<TsconfigJson, string> = Jsonc.fromString().pipe(
  S.decodeTo(TsconfigJson),
  $I.annoteSchema("TsconfigJsonFromString", {
    description: "A JSONC string codec for a validated tsconfig.json document.",
  })
);

/**
 * Decoded value accepted by {@link (TsconfigJsonFromString:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigJsonFromString = typeof TsconfigJsonFromString.Type;

/**
 * Raised when a tsconfig.json document fails to parse or decode.
 *
 * **Details**
 *
 * `path` is
 * the file path when the failure is file-bound, and the empty string
 * otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps
 * file-bound decode failures in this error.
 *
 * **Example** (Construct file-bound and in-memory parse errors)
 *
 * ```ts
 * import { TsconfigParseError } from "@beep/tsconfig/TsconfigJson"
 *
 * const fileError = new TsconfigParseError({ path: "tsconfig.json", cause: new Error("Invalid input") })
 * const memoryError = new TsconfigParseError({ path: "", cause: new Error("Invalid input") })
 * console.log(fileError.message) // failed to parse tsconfig.json at "tsconfig.json"
 * console.log(memoryError.message) // failed to parse tsconfig.json
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TsconfigParseError extends S.TaggedError<TsconfigParseError, { readonly brand: unique symbol }>(
  $I`TsconfigParseError`
)(
  "TsconfigParseError",
  {
    /** The file path that failed to parse, or `""` when not file-bound. */
    path: S.String.pipe(
      $I.annoteKey("TsconfigParseError.path", {
        description: 'The file path that failed to parse, or `""` when not file-bound.',
      })
    ),
    /** The underlying decode failure. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("TsconfigParseError.cause", { description: "The underlying decode failure." })
    ),
  },
  $I.annoteError<TsconfigParseError>("TsconfigParseError", {
    description:
      "Raised when a tsconfig.json document fails to parse or decode. `path` is the file path when the failure is file-bound, and the empty string otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps file-bound decode failures in this error.",
  })
) {
  /**
   * Formats the parse failure message, including the file path when it is non-empty.
   *
   * **Example** (Inspect path-sensitive failure messages)
   *
   * ```ts
   * import { TsconfigParseError } from "@beep/tsconfig/TsconfigJson"
   *
   * const fileError = new TsconfigParseError({ path: "tsconfig.json", cause: new Error("Invalid input") })
   * const memoryError = new TsconfigParseError({ path: "", cause: new Error("Invalid input") })
   * console.log(fileError.message) // failed to parse tsconfig.json at "tsconfig.json"
   * console.log(memoryError.message) // failed to parse tsconfig.json
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return this.path.length > 0 ? `failed to parse tsconfig.json at "${this.path}"` : "failed to parse tsconfig.json";
  }
}
