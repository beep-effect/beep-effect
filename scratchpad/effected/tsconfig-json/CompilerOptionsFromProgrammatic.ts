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

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { CompilerOptions } from "./CompilerOptions.ts";
import { TsEnumCodec } from "./TsEnumCodec.ts";

const $I = $ScratchpadId.create("effected/tsconfig-json/CompilerOptionsFromProgrammatic");

/**
 * The untyped record this codec accepts on its encoded side. Exported because
 * it names the codec's encoded type in the public signature; the values stay
 * `unknown`, matching the encoder's passthrough contract. Decode must also be
 * able to receive invalid known fields, including unmappable numeric enum
 * values, so it can reject them with a typed schema issue.
 *
 * **Example** (Accept a record before option validation)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ProgrammaticRecord } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic";
 *
 * const record = S.decodeUnknownSync(ProgrammaticRecord)({ target: 999 });
 * console.log(record.target); // 999
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ProgrammaticRecord = S.Record(S.String, S.Unknown).annotate(
	$I.annote("ProgrammaticRecord", { description: "Unvalidated programmatic compiler options, including invalid known fields and unknown passthrough values." }),
);

/**
 * The decoded shape of {@link (ProgrammaticRecord:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProgrammaticRecord = typeof ProgrammaticRecord.Type;

/**
 * A codec between the **programmatic** `compilerOptions` shape TypeScript's own
 * API uses and this package's decoded {@link (CompilerOptions:namespace).Type}.
 *
 * **Details**
 *
 * Decoding accepts the numeric-enum spelling (`{ target: ts.ScriptTarget.ES2025 }`),
 * the canonical string spelling, case-varying strings (`"ESNext"`), a mixture of
 * the three in one object, and `lib` entries in each of their three spellings
 * (`"esnext"`, `"lib.esnext.d.ts"`, an absolute path to the lib file) — producing
 * validated {@link (CompilerOptions:namespace).Type} with canonical lowercase enum
 * strings and short-form `lib`. Unknown and removed keys pass through, exactly as
 * {@link (CompilerOptions:variable)} itself allows. Decoding is idempotent on
 * already-canonical input.
 *
 * Encoding is {@link TsEnumCodec.encodeCompilerOptions}: numeric enum values and
 * `lib` in the file-name form (`lib.esnext.d.ts`).
 *
 * **Gotchas**
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
 * import { CompilerOptionsFromProgrammatic } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic";
 *
 * const decoded = S.decodeUnknownSync(CompilerOptionsFromProgrammatic)({
 * 	target: 12,
 * 	strict: true,
 * 	lib: ["lib.esnext.d.ts"],
 * });
 * console.log(decoded.target); // es2025
 * console.log(decoded.lib?.[0]); // esnext
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const CompilerOptionsFromProgrammatic: S.Codec<CompilerOptions, ProgrammaticRecord> =
	ProgrammaticRecord.pipe(
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
		S.annotate($I.annote("CompilerOptionsFromProgrammatic", { description: "A validating codec between programmatic numeric compiler options and canonical string compiler options." })),
	);

/**
 * The decoded shape of {@link (CompilerOptionsFromProgrammatic:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CompilerOptionsFromProgrammatic = typeof CompilerOptionsFromProgrammatic.Type;
