// The programmatic-shape door INTO this package's schemas. A caller holding
// TypeScript's own programmatic spelling of `compilerOptions` — `{ target:
// ts.ScriptTarget.ES2025 }`, a live `ts.CompilerOptions` read off a Program,
// or the output of `TsEnumCodec.encodeCompilerOptions` — has, without this
// module, no typed way in: `CompilerOptions` types every enum family as a
// canonical string union, so a numeric value fails its decode.
//
// This module is deliberately a CODEC, not a normalizer function.
// `TsEnumCodec.decodeCompilerOptions` already performs the whole value-level
// normalization (numeric → canonical string, `lib` in any of its three
// spellings → the short form, strings untouched so it is idempotent on
// canonical input and tolerant of mixed input). What was missing is the
// VALIDATING door: that normalizer deliberately returns the wide
// `Record<string, unknown>` because an unmappable numeric — a future TS enum
// member — passes through unchanged, which would violate
// `CompilerOptions.Type`'s contract (see its TSDoc). Composing the normalizer
// with `CompilerOptions`'s own decode makes the schema enforce "never guess":
// the surviving numeric is rejected by `Target`/`Module`/… as a typed decode
// failure instead of being asserted away by a cast at the call site.
// Case-insensitivity (`"ESNext"`) comes free from `CompilerOptions`'s existing
// case-insensitive literal decode.
//
// It is its own module because `TsEnumCodec.ts` performs no validation
// (see its banner), and because putting the codec
// in `CompilerOptions.ts` would make that schema module import `TsEnumCodec` at
// runtime while `TsEnumCodec` type-imports it back — a conceptual inversion and
// a `noImportCycles` risk. This module imports both; nothing imports it.

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { CompilerOptions } from "./CompilerOptions.ts";
import { TsEnumCodec } from "./TsEnumCodec.ts";

/**
 * The untyped record this codec accepts on its encoded side. Exported because
 * it names the codec's encoded type in the public signature; the values stay
 * `unknown`, matching the encoder's passthrough contract. Decode must also be
 * able to receive invalid known fields, including unmappable numeric enum
 * values, so it can reject them with a typed schema issue.
 *
 * @public
 */
export interface ProgrammaticRecord {
	readonly [key: string]: unknown;
}

/**
 * A codec between the **programmatic** `compilerOptions` shape TypeScript's own
 * API uses and this package's decoded {@link (CompilerOptions:namespace).Type}.
 *
 * Decoding accepts the numeric-enum spelling (`{ target: ts.ScriptTarget.ES2025 }`),
 * the canonical string spelling, case-varying strings (`"ESNext"`), any mixture of
 * the three in one object, and `lib` entries in any of their three spellings
 * (`"esnext"`, `"lib.esnext.d.ts"`, an absolute path to the lib file) — producing
 * validated {@link (CompilerOptions:namespace).Type} with canonical lowercase enum
 * strings and short-form `lib`. Unknown and removed keys pass through, exactly as
 * {@link (CompilerOptions:variable)} itself allows. Decoding is idempotent on
 * already-canonical input.
 *
 * Encoding is {@link TsEnumCodec.encodeCompilerOptions}: numeric enum values and
 * `lib` in the file-name form (`lib.esnext.d.ts`).
 *
 * **Details**
 *
 * A numeric value with no table entry — a future TypeScript enum member — survives
 * normalization as a number and then **fails decode** with a typed schema issue,
 * rather than passing through. That is deliberate: this is the validating door
 * {@link TsEnumCodec.decodeCompilerOptions} is not, which is why that function's
 * return type stays the wider `Record<string, unknown>`.
 *
 * **Example** (Decode programmatic compiler options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { CompilerOptionsFromProgrammatic } from "./index.ts";
 *
 * const decoded = S.decodeUnknownResult(CompilerOptionsFromProgrammatic)({
 * 	target: 12,
 * 	strict: true,
 * 	lib: ["lib.esnext.d.ts"],
 * });
 * console.log(decoded); // Success containing { target: "es2025", strict: true, lib: ["esnext"] }
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const CompilerOptionsFromProgrammatic: S.Codec<typeof CompilerOptions.Type, ProgrammaticRecord> =
	S.Record(S.String, S.Unknown).pipe(
		S.decodeTo(
			CompilerOptions,
			SchemaTransformation.transformEffect({
				decode: (input) => Effect.succeed(TsEnumCodec.decodeCompilerOptions(input)),
				encode: (input, options) =>
					SchemaParser.decodeEffect(CompilerOptions)(input, options).pipe(
						Effect.map(TsEnumCodec.encodeCompilerOptions),
					),
			}),
		),
	);
