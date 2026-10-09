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

import { Jsonc } from "../jsonc/index.ts";
import { Schema, SchemaTransformation } from "effect";
import { CompilerOptions } from "./CompilerOptions.ts";

/**
 * Case-insensitive literal-union decode; canonical lowercase encode.
 * Replicated from `CompilerOptions.ts`'s module-private helper (not exported
 * there — reused as house style, not imported, to avoid coupling this
 * module's public schemas to CompilerOptions.ts's internals).
 */
const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: L) =>
	Schema.String.pipe(
		Schema.decodeTo(
			Schema.Literals(literals),
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
export const Reference = Schema.StructWithRest(
	Schema.Struct({
		path: Schema.String.check(Schema.isMinLength(1)),
	}),
	[Schema.Record(Schema.String, Schema.Unknown)],
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
export const WatchOptions = Schema.StructWithRest(
	Schema.Struct({
		watchFile: Schema.optionalKey(WatchFile),
		watchDirectory: Schema.optionalKey(WatchDirectory),
		fallbackPolling: Schema.optionalKey(FallbackPolling),
		synchronousWatchDirectory: Schema.optionalKey(Schema.Boolean),
		excludeDirectories: Schema.optionalKey(Schema.Array(Schema.String)),
		excludeFiles: Schema.optionalKey(Schema.Array(Schema.String)),
	}),
	[Schema.Record(Schema.String, Schema.Unknown)],
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
export const TypeAcquisition = Schema.StructWithRest(
	Schema.Struct({
		enable: Schema.optionalKey(Schema.Boolean),
		include: Schema.optionalKey(Schema.Array(Schema.String)),
		exclude: Schema.optionalKey(Schema.Array(Schema.String)),
		disableFilenameBasedTypeAcquisition: Schema.optionalKey(Schema.Boolean),
	}),
	[Schema.Record(Schema.String, Schema.Unknown)],
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
export const TsconfigJson = Schema.StructWithRest(
	Schema.Struct({
		compilerOptions: Schema.optionalKey(CompilerOptions),
		extends: Schema.optionalKey(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
		files: Schema.optionalKey(Schema.Array(Schema.String)),
		include: Schema.optionalKey(Schema.Array(Schema.String)),
		exclude: Schema.optionalKey(Schema.Array(Schema.String)),
		references: Schema.optionalKey(Schema.Array(Reference)),
		watchOptions: Schema.optionalKey(WatchOptions),
		typeAcquisition: Schema.optionalKey(TypeAcquisition),
		compileOnSave: Schema.optionalKey(Schema.Boolean),
		$schema: Schema.optionalKey(Schema.String),
	}),
	[Schema.Record(Schema.String, Schema.Unknown)],
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
export const TsconfigJsonFromString: Schema.Codec<typeof TsconfigJson.Type, string> = Jsonc.schema(TsconfigJson);

/**
 * Raised when a tsconfig.json document fails to parse or decode. `path` is
 * the file path when the failure is file-bound, and the empty string
 * otherwise (e.g. decoding an in-memory string). `TsconfigLoader` wraps
 * file-bound decode failures in this error.
 *
 * @public
 */
export class TsconfigParseError extends Schema.TaggedError<TsconfigParseError>()("TsconfigParseError", {
	/** The file path that failed to parse, or `""` when not file-bound. */
	path: Schema.String,
	/** The underlying decode failure. */
	cause: Schema.Defect(),
}) {
	override get message(): string {
		return this.path.length > 0 ? `failed to parse tsconfig.json at "${this.path}"` : "failed to parse tsconfig.json";
	}
}
