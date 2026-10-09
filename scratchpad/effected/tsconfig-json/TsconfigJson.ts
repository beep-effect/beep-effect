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
const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: L) =>
	S.String.pipe(
		S.decodeTo(
			S.Literals(literals),
			SchemaTransformation.transform({
				decode: (s: string) => s.toLowerCase(),
				encode: (s: string) => s,
			}),
		),
	);

/** `watchOptions.watchFile`. @public */
export const WatchFile = caseInsensitiveLiterals([
	"fixedpollinginterval",
	"prioritypollinginterval",
	"dynamicprioritypolling",
	"fixedchunksizepolling",
	"usefsevents",
	"usefseventsonparentdirectory",
]);

/** `watchOptions.watchDirectory`. @public */
export const WatchDirectory = caseInsensitiveLiterals([
	"usefsevents",
	"fixedpollinginterval",
	"dynamicprioritypolling",
	"fixedchunksizepolling",
]);

/** `watchOptions.fallbackPolling`. @public */
export const FallbackPolling = caseInsensitiveLiterals([
	"fixedinterval",
	"priorityinterval",
	"dynamicpriority",
	"fixedchunksize",
]);

/**
 * One `references[]` entry: `path` is required and non-empty; every other key
 * is preserved verbatim.
 *
 * @public
 */
export const Reference = S.StructWithRest(
	S.Struct({
		path: S.String.check(S.isMinLength(1)),
	}),
	[S.Record(S.String, S.Unknown)],
);

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
	export type Type = typeof Reference.Type;
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
		watchFile: S.optionalKey(WatchFile),
		watchDirectory: S.optionalKey(WatchDirectory),
		fallbackPolling: S.optionalKey(FallbackPolling),
		synchronousWatchDirectory: S.optionalKey(S.Boolean),
		excludeDirectories: S.String.pipe(S.Array, S.optionalKey),
		excludeFiles: S.String.pipe(S.Array, S.optionalKey),
	}),
	[S.Record(S.String, S.Unknown)],
);

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
	export type Type = typeof WatchOptions.Type;
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
		enable: S.optionalKey(S.Boolean),
		include: S.String.pipe(S.Array, S.optionalKey),
		exclude: S.String.pipe(S.Array, S.optionalKey),
		disableFilenameBasedTypeAcquisition: S.optionalKey(S.Boolean),
	}),
	[S.Record(S.String, S.Unknown)],
);

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
	export type Type = typeof TypeAcquisition.Type;
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
		compilerOptions: S.optionalKey(CompilerOptions),
		extends: S.optionalKey(S.Union([S.String, S.Array(S.String)])),
		files: S.String.pipe(S.Array, S.optionalKey),
		include: S.String.pipe(S.Array, S.optionalKey),
		exclude: S.String.pipe(S.Array, S.optionalKey),
		references: Reference.pipe(S.Array, S.optionalKey),
		watchOptions: S.optionalKey(WatchOptions),
		typeAcquisition: S.optionalKey(TypeAcquisition),
		compileOnSave: S.optionalKey(S.Boolean),
		$schema: S.optionalKey(S.String),
	}),
	[S.Record(S.String, S.Unknown)],
);

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
	export type Type = typeof TsconfigJson.Type;
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
export const TsconfigJsonFromString: S.Codec<typeof TsconfigJson.Type, string> = Jsonc.schema(TsconfigJson);

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
	cause: S.Defect().annotateKey({ description: "The underlying decode failure." }),
}, $I.annote("TsconfigParseError", { description: "Raised when a tsconfig.json document fails to parse or decode. `path` is the file path when the failure is file-bound, and the empty string otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps file-bound decode failures in this error." })) {
	override get message(): string {
		return this.path.length > 0 ? `failed to parse tsconfig.json at "${this.path}"` : "failed to parse tsconfig.json";
	}
}
