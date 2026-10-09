// The tsconfig.json document schema — the top-level `TsconfigJson` struct plus
// its sub-object schemas (`Reference`, `WatchOptions`, `TypeAcquisition`) and
// the JSONC codec (`TsconfigJsonFromString`), modelled on TS 6.0.3 ×
// schemastore. The three watchOptions VALUE enums
// (watchFile/watchDirectory/fallbackPolling) are defined here;
// CompilerOptions.ts owns compilerOptions only.
//
// Every parse goes through `@effected/jsonc`'s `Jsonc.schema` — there is no
// JSON-strict path. `TsconfigJsonFromString` is bound
// once at module top level, per the house Schema-producing-function
// discipline (`Jsonc.schema` derives fresh caches per call).

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { identity } from "effect/Function";
import * as Str from "effect/String";
import { Jsonc } from "../jsonc/index.ts";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { CompilerOptions } from "./CompilerOptions.ts";

const $I = $ScratchpadId.create("effected/tsconfig-json/TsconfigJson");

/**
 * Case-insensitive literal-union decode; canonical lowercase encode.
 * Replicated from `CompilerOptions.ts`'s module-private helper (not exported
 * there — reused as house style, not imported, to avoid coupling this
 * module's public schemas to CompilerOptions.ts's internals).
 */
const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: S.Literals<L>) =>
	S.String.pipe(
		S.decodeTo(
			literals,
			SchemaTransformation.transform({
				decode: Str.toLowerCase,
				encode: identity,
			}),
		),
	);

const WatchFileKit = LiteralKit([
	"fixedpollinginterval",
	"prioritypollinginterval",
	"dynamicprioritypolling",
	"fixedchunksizepolling",
	"usefsevents",
	"usefseventsonparentdirectory",
]).annotate(
	$I.annote("WatchFileLiterals", { description: "The strategy for watching individual source files." }),
);

const WatchDirectoryKit = LiteralKit([
	"usefsevents",
	"fixedpollinginterval",
	"dynamicprioritypolling",
	"fixedchunksizepolling",
]).annotate(
	$I.annote("WatchDirectoryLiterals", { description: "The strategy for watching source directories." }),
);

const FallbackPollingKit = LiteralKit([
	"fixedinterval",
	"priorityinterval",
	"dynamicpriority",
	"fixedchunksize",
]).annotate(
	$I.annote("FallbackPollingLiterals", { description: "The polling strategy used when filesystem events are unavailable." }),
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
 * import { WatchFile } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const WatchFile = caseInsensitiveLiterals(WatchFileKit).annotate(
	$I.annote("WatchFile", { description: "The strategy for watching individual source files." }),
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
 * import { WatchDirectory } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const WatchDirectory = caseInsensitiveLiterals(WatchDirectoryKit).annotate(
	$I.annote("WatchDirectory", { description: "The strategy for watching source directories." }),
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
 * import { FallbackPolling } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const FallbackPolling = caseInsensitiveLiterals(FallbackPollingKit).annotate(
	$I.annote("FallbackPolling", { description: "The polling strategy used when filesystem events are unavailable." }),
);

/**
 * Decoded value accepted by {@link (FallbackPolling:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FallbackPolling = typeof FallbackPolling.Type;

/**
 * One `references[]` entry: `path` is required and non-empty; every other key
 * is preserved verbatim.
 *
 * **Example** (Preserve project reference metadata)
 *
 * ```ts
 * import { Reference } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const Reference = S.StructWithRest(
	S.Struct({
		path: S.String.check(S.isMinLength(1)).annotateKey({ description: "The non-empty path to a referenced TypeScript project." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("Reference", { description: "A referenced TypeScript project with additional reference metadata preserved." }));

/**
 * Decoded value accepted by {@link (Reference:variable)}.
 *
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
 * import { WatchOptions } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const WatchOptions = S.StructWithRest(
	S.Struct({
		watchFile: S.optionalKey(WatchFile).annotateKey({ description: "The strategy for watching individual files." }),
		watchDirectory: S.optionalKey(WatchDirectory).annotateKey({ description: "The strategy for watching directories." }),
		fallbackPolling: S.optionalKey(FallbackPolling).annotateKey({ description: "The polling fallback when filesystem events are unavailable." }),
		synchronousWatchDirectory: S.optionalKey(S.Boolean).annotateKey({ description: "Updates directory watchers synchronously." }),
		excludeDirectories: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Directory patterns excluded from watching." }),
		excludeFiles: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "File patterns excluded from watching." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("WatchOptions", { description: "Optional filesystem watch settings with unknown keys preserved." }));

/**
 * Decoded value accepted by {@link (WatchOptions:variable)}.
 *
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

/**
 * `typeAcquisition` — the automatic type-acquisition settings, with unknown keys preserved.
 *
 * **Example** (Decode automatic type acquisition settings)
 *
 * ```ts
 * import { TypeAcquisition } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const TypeAcquisition = S.StructWithRest(
	S.Struct({
		enable: S.optionalKey(S.Boolean).annotateKey({ description: "Enables automatic type acquisition." }),
		include: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Type packages included in automatic acquisition." }),
		exclude: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Type packages excluded from automatic acquisition." }),
		disableFilenameBasedTypeAcquisition: S.optionalKey(S.Boolean).annotateKey({ description: "Disables type acquisition inferred from filenames." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("TypeAcquisition", { description: "Automatic type-acquisition settings with unknown keys preserved." }));

/**
 * Decoded value accepted by {@link (TypeAcquisition:variable)}.
 *
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
 * import { TsconfigJson } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const TsconfigJson = S.StructWithRest(
	S.Struct({
		compilerOptions: S.optionalKey(CompilerOptions).annotateKey({ description: "The compilation options for this project." }),
		extends: S.optionalKey(S.Union([S.String, S.Array(S.String)])).annotateKey({ description: "The base configuration path or ordered list of base configurations." }),
		files: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "The source files explicitly included in compilation." }),
		include: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Source-file patterns included in compilation." }),
		exclude: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Source-file patterns excluded from compilation." }),
		references: Reference.pipe(S.Array, S.optionalKey).annotateKey({ description: "The projects referenced by this configuration." }),
		watchOptions: S.optionalKey(WatchOptions).annotateKey({ description: "The filesystem watch settings." }),
		typeAcquisition: S.optionalKey(TypeAcquisition).annotateKey({ description: "The automatic type-acquisition settings." }),
		compileOnSave: S.optionalKey(S.Boolean).annotateKey({ description: "Requests compilation when a file is saved." }),
		$schema: S.optionalKey(S.String).annotateKey({ description: "The schema URI associated with this configuration." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("TsconfigJson", { description: "A tsconfig.json document with optional typed fields and unknown keys preserved." }));

/**
 * Decoded value accepted by {@link (TsconfigJson:variable)}.
 *
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
 * import { TsconfigJsonFromString } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export const TsconfigJsonFromString: S.Codec<TsconfigJson, string> = Jsonc.schema(TsconfigJson).annotate(
	$I.annote("TsconfigJsonFromString", { description: "A JSONC string codec for a validated tsconfig.json document." }),
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
 * import { TsconfigParseError } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
export class TsconfigParseError extends S.TaggedError<TsconfigParseError>($I`TsconfigParseError`)("TsconfigParseError", {
	/** The file path that failed to parse, or `""` when not file-bound. */
	path: S.String.annotateKey({ description: "The file path that failed to parse, or `\"\"` when not file-bound." }),
	/** The underlying decode failure. */
	cause: S.Defect({ includeStack: true }).annotateKey({ description: "The underlying decode failure." }),
}, $I.annote("TsconfigParseError", { description: "Raised when a tsconfig.json document fails to parse or decode. `path` is the file path when the failure is file-bound, and the empty string otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps file-bound decode failures in this error." })) {
	/**
	 * Formats the parse failure message, including the file path when it is non-empty.
	 *
	 * **Example** (Inspect path-sensitive failure messages)
	 *
	 * ```ts
	 * import { TsconfigParseError } from "@beep/scratchpad/effected/tsconfig-json/TsconfigJson"
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
