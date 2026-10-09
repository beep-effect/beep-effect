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

/** `watchOptions.watchFile`. @public */
export const WatchFile = caseInsensitiveLiterals(WatchFileKit).annotate(
	$I.annote("WatchFile", { description: "The strategy for watching individual source files." }),
);

export type WatchFile = typeof WatchFile.Type;

/** `watchOptions.watchDirectory`. @public */
export const WatchDirectory = caseInsensitiveLiterals(WatchDirectoryKit).annotate(
	$I.annote("WatchDirectory", { description: "The strategy for watching source directories." }),
);

export type WatchDirectory = typeof WatchDirectory.Type;

/** `watchOptions.fallbackPolling`. @public */
export const FallbackPolling = caseInsensitiveLiterals(FallbackPollingKit).annotate(
	$I.annote("FallbackPolling", { description: "The polling strategy used when filesystem events are unavailable." }),
);

export type FallbackPolling = typeof FallbackPolling.Type;

/**
 * One `references[]` entry: `path` is required and non-empty; every other key
 * is preserved verbatim.
 *
 * @public
 */
export const Reference = S.StructWithRest(
	S.Struct({
		path: S.String.check(S.isMinLength(1)).annotateKey({ description: "The non-empty path to a referenced TypeScript project." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("Reference", { description: "A referenced TypeScript project with additional reference metadata preserved." }));

export type Reference = typeof Reference.Type;

/**
 * Type-only companion namespace for {@link (Reference:variable)}.
 *
 * @public
 */
export declare namespace Reference {
	/**
	 * The decoded `references[]` entry shape.
	 *
	 * @public
	 */
	export type Type = Reference;
	/**
	 * The encoded (on-disk JSON) `references[]` entry shape.
	 *
	 * @public
	 */
	export type Encoded = typeof Reference.Encoded;
}

/**
 * `watchOptions` — the three enum fields, the two live booleans/arrays,
 * and a passthrough record (schemastore's `force` is phantom).
 *
 * @public
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

export type WatchOptions = typeof WatchOptions.Type;

/**
 * Type-only companion namespace for {@link (WatchOptions:variable)}.
 *
 * @public
 */
export declare namespace WatchOptions {
	/**
	 * The decoded `watchOptions` shape.
	 *
	 * @public
	 */
	export type Type = WatchOptions;
	/**
	 * The encoded (on-disk JSON) `watchOptions` shape.
	 *
	 * @public
	 */
	export type Encoded = typeof WatchOptions.Encoded;
}

/**
 * `typeAcquisition` — the automatic type-acquisition settings, with unknown keys preserved.
 *
 * @public
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

export type TypeAcquisition = typeof TypeAcquisition.Type;

/**
 * Type-only companion namespace for {@link (TypeAcquisition:variable)}.
 *
 * @public
 */
export declare namespace TypeAcquisition {
	/**
	 * The decoded `typeAcquisition` shape.
	 *
	 * @public
	 */
	export type Type = TypeAcquisition;
	/**
	 * The encoded (on-disk JSON) `typeAcquisition` shape.
	 *
	 * @public
	 */
	export type Encoded = typeof TypeAcquisition.Encoded;
}

/**
 * The tsconfig.json document: every typed top-level field optional,
 * plus a passthrough record so unrecognized keys (`buildOptions`, `ts-node`,
 * …) survive decode and re-encode untouched — tsc itself silently ignores
 * unknown top-level keys, and this schema follows suit.
 *
 * @public
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

export type TsconfigJson = typeof TsconfigJson.Type;

/**
 * Type-only companion namespace for {@link (TsconfigJson:variable)}, exposing its decoded
 * and encoded shapes plus the JSONC codec.
 *
 * @public
 */
export declare namespace TsconfigJson {
	/**
	 * The decoded tsconfig.json shape: every typed field optional, plus passthrough for unknown keys.
	 *
	 * @public
	 */
	export type Type = TsconfigJson;
	/**
	 * The encoded (on-disk JSON) tsconfig.json shape.
	 *
	 * @public
	 */
	export type Encoded = typeof TsconfigJson.Encoded;
}

/**
 * Decodes a JSONC-encoded tsconfig.json document straight into
 * {@link (TsconfigJson:variable)}. Bound once at module top level —
 * `Jsonc.schema` is schema-producing, and this is the shared instance
 * (`TsconfigJson` is a `Schema.StructWithRest` value rather than a
 * `Schema.Class`, so the codec is a sibling export, not a static).
 *
 * @public
 */
export const TsconfigJsonFromString: S.Codec<TsconfigJson, string> = Jsonc.schema(TsconfigJson).annotate(
	$I.annote("TsconfigJsonFromString", { description: "A JSONC string codec for a validated tsconfig.json document." }),
);

export type TsconfigJsonFromString = typeof TsconfigJsonFromString.Type;

/**
 * Raised when a tsconfig.json document fails to parse or decode. `path` is
 * the file path when the failure is file-bound, and the empty string
 * otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps
 * file-bound decode failures in this error.
 *
 * @public
 */
export class TsconfigParseError extends S.TaggedError<TsconfigParseError>($I`TsconfigParseError`)("TsconfigParseError", {
	/** The file path that failed to parse, or `""` when not file-bound. */
	path: S.String.annotateKey({ description: "The file path that failed to parse, or `\"\"` when not file-bound." }),
	/** The underlying decode failure. */
	cause: S.Defect({ includeStack: true }).annotateKey({ description: "The underlying decode failure." }),
}, $I.annote("TsconfigParseError", { description: "Raised when a tsconfig.json document fails to parse or decode. `path` is the file path when the failure is file-bound, and the empty string otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps file-bound decode failures in this error." })) {
	override get message(): string {
		return this.path.length > 0 ? `failed to parse tsconfig.json at "${this.path}"` : "failed to parse tsconfig.json";
	}
}
