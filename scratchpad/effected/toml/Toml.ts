// The `Toml` facade: value-level parsing, canonical stringification and the
// flagship schema factories, plus the stringify options and the errors the
// entry points raise.
//
// Cycle firewall: the internal engine throws raw carriers (`RawTomlError`
// with a `{ code, message, offset, length }` record, `GuardExceeded` from the
// depth guards); this module materializes `TomlDiagnostic` instances
// (deriving `line`/`character` from `offset`) and constructs the tagged
// TomlParseError / TomlStringifyError. The dependency edge runs facade →
// engine only, so `noImportCycles` stays satisfied.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { buildValue } from "./internal/semantic.ts";
import { stringifyValue } from "./internal/stringifyValue.ts";
import { TomlDiagnostic } from "./TomlDiagnostic.ts";

const $I = $ScratchpadId.create("effected/toml/Toml");

/**
 * Options controlling stringify behavior. The only knob is `newline` —
 * omitted, it resolves to `"\n"`.
 *
 * **Details**
 *
 * Stringify deliberately emits only TOML 1.0.0 spellings — seconds always
 * present in times, no `\e`/`\xHH` escapes, single-line inline tables — even
 * though {@link Toml.parse} accepts the full TOML 1.1.0 grammar. Every 1.0
 * document is valid 1.1, so this conservative-write/liberal-read asymmetry
 * keeps emitted documents readable by 1.0-only consumers.
 *
 * **Example** (Choose CRLF line separators)
 *
 * ```ts
 * import { TomlStringifyOptions } from "@beep/scratchpad/effected/toml/Toml";
 *
 * const options = TomlStringifyOptions.make({ newline: "\r\n" });
 * console.log(options.newline === "\r\n"); // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class TomlStringifyOptions extends S.Class<TomlStringifyOptions>($I`TomlStringifyOptions`)({
	newline: S.optionalKey(S.Literals(["\n", "\r\n"])).annotateKey({ description: "Line separator in emitted TOML, either LF or CRLF, defaulting to LF" }),
}, $I.annote("TomlStringifyOptions", { description: "Options controlling stringify behavior. The only knob is `newline` — omitted, it resolves to `\"\\n\"`." })) {}

/**
 * Parse failure: the {@link TomlDiagnostic} entries describing why the
 * document was rejected (first violation wins, so there is one today; the
 * array shape matches `@effected/yaml`'s aggregate contract). Raised by
 * {@link Toml.parse} and the decode direction of the schema factories.
 *
 * **Details**
 *
 * The `message` renders the first diagnostic's position 1-based
 * (`line + 1:character + 1`) for human readers — a CLI printing this string
 * shows the line/column a person counts in their editor. The structured
 * {@link TomlDiagnostic} `line`/`character` fields stay 0-based (LSP
 * convention); the offset applies to the rendered message only.
 *
 * **Example** (Inspect an empty parse failure)
 *
 * ```ts
 * import { TomlParseError } from "@beep/scratchpad/effected/toml/Toml";
 *
 * const error = TomlParseError.make({ diagnostics: [] });
 * console.log(error.message); // TOML parse failed with 0 errors
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TomlParseError extends S.TaggedError<TomlParseError>($I`TomlParseError`)("TomlParseError", {
	diagnostics: S.Array(TomlDiagnostic).annotateKey({ description: "Structured reasons the TOML document was rejected, currently containing only the first violation" }),
}, $I.annote("TomlParseError", { description: "Parse failure: the TomlDiagnostic entries describing why the document was rejected (first violation wins, so there is one today; the array shape matches `@effected/yaml`'s aggregate contract). Raised by Toml.parse and the decode direction of the schema factories." })) {
	/**
	 * Formats the diagnostic count and first diagnostic with a human-readable, 1-based position.
	 *
	 * **Example** (Inspect an empty parse failure message)
	 *
	 * ```ts
	 * import { TomlParseError } from "@beep/scratchpad/effected/toml/Toml";
	 *
	 * const error = TomlParseError.make({ diagnostics: [] });
	 * console.log(error.message); // TOML parse failed with 0 errors
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		const count = this.diagnostics.length;
		const first = this.diagnostics[0];
		const detail =
			first === undefined ? "" : `: ${first.code} at ${first.line + 1}:${first.character + 1} ${first.message}`;
		return `TOML parse failed with ${count} error${count === 1 ? "" : "s"}${detail}`;
	}
}

/**
 * Stringification failure: an unsupported value, an out-of-range integer, a
 * circular reference or a tripped depth guard, as one structured
 * {@link TomlDiagnostic} (offset `0` — there is no source text). Raised by
 * {@link Toml.stringify} and the encode direction of the schema factories.
 *
 * **Example** (Inspect unsupported null values)
 *
 * ```ts
 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
 * import * as Result from "effect/Result";
 *
 * const result = Toml.stringifyResult({ value: null });
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.message); // TOML stringify failed: UnsupportedValue unsupported null value at value
 * }
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TomlStringifyError extends S.TaggedError<TomlStringifyError>($I`TomlStringifyError`)("TomlStringifyError", {
	diagnostic: TomlDiagnostic.annotateKey({ description: "Structured reason TOML encoding failed, with source offset zero because no source text exists" }),
}, $I.annote("TomlStringifyError", { description: "Stringification failure: an unsupported value, an out-of-range integer, a circular reference or a tripped depth guard, as one structured TomlDiagnostic (offset `0` — there is no source text). Raised by Toml.stringify and the encode direction of the schema factories." })) {
	/**
	 * Formats the diagnostic code and explanation as a stringification failure message.
	 *
	 * **Example** (Inspect unsupported null values message)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as Result from "effect/Result";
	 *
	 * const result = Toml.stringifyResult({ value: null });
	 * if (Result.isFailure(result)) {
	 *   console.log(result.failure.message); // TOML stringify failed: UnsupportedValue unsupported null value at value
	 * }
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `TOML stringify failed: ${this.diagnostic.code} ${this.diagnostic.message}`;
	}
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Run the parser and semantic pass, materializing the engine's raw carriers
 * into the typed error: `RawTomlError` becomes a positioned diagnostic and a
 * `GuardExceeded` depth trip becomes a `NestingDepthExceeded` diagnostic
 * (never an unhandled defect). Anything else is a genuine defect and rethrows
 * — synchronously to a `Result` caller, and as a `Die` through the `Effect`
 * forms, which evaluate this inside the effect.
 */
const parseToResult = (text: string): Result.Result<unknown, TomlParseError> => {
	try {
		return Result.succeed(buildValue(parseExpressions(text)));
	} catch (defect) {
		if (isRawTomlError(defect)) {
			return Result.fail(TomlParseError.make({ diagnostics: [TomlDiagnostic.fromRaw(text, defect.diagnostic)] }));
		}
		if (isGuardExceeded(defect)) {
			return Result.fail(
				TomlParseError.make({
					diagnostics: [
						TomlDiagnostic.fromRaw(text, {
							code: "NestingDepthExceeded",
							message: defect.message,
							offset: defect.offset,
							length: 0,
						}),
					],
				}),
			);
		}
		throw defect;
	}
};

const stringifyToResult = (
	value: unknown,
	options?: TomlStringifyOptions,
): Result.Result<string, TomlStringifyError> => {
	try {
		return Result.succeed(stringifyValue(value, options?.newline ?? "\n"));
	} catch (defect) {
		if (isRawTomlError(defect)) {
			return Result.fail(TomlStringifyError.make({ diagnostic: TomlDiagnostic.fromRaw("", defect.diagnostic) }));
		}
		if (isGuardExceeded(defect)) {
			return Result.fail(
				TomlStringifyError.make({
					diagnostic: TomlDiagnostic.fromRaw("", {
						code: "NestingDepthExceeded",
						message: defect.message,
						offset: 0,
						length: 0,
					}),
				}),
			);
		}
		throw defect;
	}
};

// ── Bound codec ─────────────────────────────────────────────────────────────

/**
 * A domain codec pre-bound to its two directions, returned by
 * {@link Toml.bind}: the composed `schema` (what {@link Toml.schema} returns)
 * plus `decode` and `encode` functions derived from it once, so callers need
 * no generic `Schema` machinery at the use site.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface TomlBoundCodec<T, RD = never, RE = never> {
	/**
	 * The composed codec decoding a TOML `string` straight into `T`.
	 *
	 * @since 0.0.0
	 */
	readonly schema: S.Codec<T, string, RD, RE>;
	/**
	 * Decode TOML text into a validated `T`.
	 *
	 * @since 0.0.0
	 */
	readonly decode: (text: string) => Effect.Effect<T, S.SchemaError, RD>;
	/**
	 * Encode a `T` back to canonical TOML text.
	 *
	 * @since 0.0.0
	 */
	readonly encode: (value: T) => Effect.Effect<string, S.SchemaError, RE>;
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Static entry points for TOML parsing, stringification and the schema
 * factories. Not instantiable.
 *
 * **Details**
 *
 * `parse`, `stringify` and the schema factories carry real typed error
 * channels — including the hardening guards (nesting-depth caps on both
 * sides, circular-reference detection on encode) that keep malformed or
 * adversarial input on the typed channel instead of surfacing as an
 * unhandled defect. `parse` takes no options: TOML 1.1.0 parsing has no
 * knobs.
 *
 * **Example** (Parse TOML values in an Effect)
 *
 * ```ts
 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const value = yield* Toml.parse('name = "Alice"\nage = 30');
 *   return value;
 * });
 *
 * console.log(JSON.stringify(Effect.runSync(program))); // {"name":"Alice","age":30}
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class Toml {
	private constructor() {}

	/**
	 * Parse a TOML 1.1.0 document into a plain JavaScript value, synchronously,
	 * returning a `Result` instead of an `Effect`: tables and inline tables
	 * become plain objects (`__proto__` lands as an own data property), arrays
	 * become plain arrays, integers become `number` (or `bigint` past 2^53) and
	 * date-times become the four `TomlDateTime` classes. Fails with
	 * {@link TomlParseError} at the first violation; returns `unknown`,
	 * with no unchecked escape type.
	 *
	 * **Details**
	 *
	 * A nesting-depth bomb (arrays or inline tables past the engine cap) also
	 * fails through {@link TomlParseError} with a `NestingDepthExceeded`
	 * diagnostic, never as an unhandled defect.
	 *
	 * {@link Toml.parse} is defined in terms of this function; the two never
	 * diverge. Reach for the `Effect` variant inside Effect code — it carries
	 * the `Toml.parse` tracing span — and for this one at synchronous
	 * boundaries such as a lint-staged handler.
	 *
	 * **Example** (Handle synchronous TOML parse results)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as Result from "effect/Result";
	 *
	 * const ok = Toml.parseResult('name = "Alice"');
	 * if (Result.isSuccess(ok)) {
	 *   console.log(JSON.stringify(ok.success)); // {"name":"Alice"}
	 * }
	 *
	 * const bad = Toml.parseResult("name = ");
	 * if (Result.isFailure(bad)) {
	 *   console.log(bad.failure._tag); // TomlParseError
	 * }
	 * ```
	 *
	 * @param text - The TOML source to parse.
	 * @returns A `Result` succeeding with the decoded value (`unknown`, with no
	 *   unchecked escape type), or failing with {@link TomlParseError}.
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(text: string): Result.Result<unknown, TomlParseError> {
		return parseToResult(text);
	}

	/**
	 * Parse a TOML 1.1.0 document into a plain JavaScript value. Defined in
	 * terms of {@link Toml.parseResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * **Example** (Run a TOML parse)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(JSON.stringify(Effect.runSync(Toml.parse("age = 30")))); // {"age":30}
	 * ```
	 *
	 * @param text - The TOML source to parse.
	 * @returns An `Effect` that succeeds with the decoded value, or fails with
	 *   {@link TomlParseError}.
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("Toml.parse")((text: string) => Effect.fromResult(Toml.parseResult(text)));

	/**
	 * Stringify a plain JavaScript value as a canonical TOML document,
	 * synchronously, returning a `Result` instead of an `Effect`: within a
	 * table, non-table pairs first, then sub-tables as `[dotted.header]`
	 * sections depth-first, then arrays of tables as `[[dotted.header]]`
	 * sections, a blank line before every header except at document start.
	 * Fails with {@link TomlStringifyError} on unsupported values (TOML has no
	 * null), out-of-int64-range `bigint`s, circular references and
	 * depth-guard trips — all on the typed channel.
	 *
	 * **Details**
	 *
	 * {@link Toml.stringify} is defined in terms of this function; the two
	 * never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `Toml.stringify` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * **Example** (Handle synchronous TOML stringify results)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as Result from "effect/Result";
	 *
	 * const ok = Toml.stringifyResult({ name: "Alice" });
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success === 'name = "Alice"\n'); // true
	 * }
	 *
	 * const bad = Toml.stringifyResult({ nope: null });
	 * if (Result.isFailure(bad)) {
	 *   console.log(bad.failure._tag); // TomlStringifyError
	 * }
	 * ```
	 *
	 * @param value - The plain JavaScript value to stringify.
	 * @param options - Optional {@link TomlStringifyOptions}; `newline`
	 *   defaults to `"\n"`.
	 * @returns A `Result` succeeding with the TOML text, or failing with
	 *   {@link TomlStringifyError}.
	 * @category formatting
	 * @since 0.0.0
	 */
	static stringifyResult(value: unknown, options?: TomlStringifyOptions): Result.Result<string, TomlStringifyError> {
		return stringifyToResult(value, options);
	}

	/**
	 * Stringify a plain JavaScript value as a canonical TOML document. Defined
	 * in terms of {@link Toml.stringifyResult} — synchronous callers can use
	 * that variant directly.
	 *
	 * **Example** (Emit a canonical TOML line)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(Toml.stringify({ age: 30 })) === "age = 30\n"); // true
	 * ```
	 *
	 * @param value - The plain JavaScript value to stringify.
	 * @param options - Optional {@link TomlStringifyOptions}; `newline`
	 *   defaults to `"\n"`.
	 * @returns An `Effect` that succeeds with the TOML text, or fails with
	 *   {@link TomlStringifyError}.
	 * @category formatting
	 * @since 0.0.0
	 */
	static readonly stringify = Effect.fn("Toml.stringify")((value: unknown, options?: TomlStringifyOptions) =>
		Effect.fromResult(Toml.stringifyResult(value, options)),
	);

	/**
	 * A `Schema<unknown, string>` decoding a TOML document and encoding values
	 * back to canonical TOML text.
	 *
	 * **Details**
	 *
	 * Schema-producing: each call returns a fresh schema whose derivation
	 * caches are not shared across calls. Bind the result to a `const` on hot
	 * paths; the pre-bound {@link Toml.TomlFromString} covers the common case.
	 *
	 * **Example** (Decode with a fresh TOML codec)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as S from "effect/Schema";
	 *
	 * const codec = Toml.fromString();
	 * console.log(JSON.stringify(S.decodeUnknownSync(codec)("age = 30"))); // {"age":30}
	 * ```
	 * @category schemas
	 * @since 0.0.0
	 */
	static fromString(): S.Codec<unknown, string> {
		return S.String.pipe(
			S.decodeTo(
				S.Unknown,
				SchemaTransformation.transformEffect({
					decode: (input: string) =>
						Toml.parse(input).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input)),
						),
					encode: (value: unknown) =>
						Effect.fromResult(Toml.stringifyResult(value)).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, value)),
						),
				}),
			),
		);
	}

	/**
	 * The zero-config `Schema<unknown, string>` — `Toml.fromString()`
	 * pre-bound so the common case needs no memoization discipline.
	 *
	 * **Example** (Decode with the shared TOML codec)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as S from "effect/Schema";
	 *
	 * console.log(JSON.stringify(S.decodeUnknownSync(Toml.TomlFromString)("age = 30"))); // {"age":30}
	 * ```
	 * @category schemas
	 * @since 0.0.0
	 */
	static readonly TomlFromString: S.Codec<unknown, string> = Toml.fromString();

	/**
	 * Compose {@link Toml.fromString} with a target schema, yielding a
	 * `Schema<A, string>` that decodes TOML straight into a validated domain
	 * value. The target's decoding/encoding service requirements flow through.
	 *
	 * **Details**
	 *
	 * Schema-producing: bind the result to a `const` on hot paths (see
	 * {@link Toml.fromString}).
	 *
	 * **Example** (Validate a TOML domain value)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as S from "effect/Schema";
	 *
	 * const Config = Toml.schema(S.Struct({ name: S.String }));
	 * console.log(JSON.stringify(S.decodeUnknownSync(Config)('name = "Alice"'))); // {"name":"Alice"}
	 * ```
	 *
	 * @param target - The domain schema decoded values must satisfy.
	 * @returns A `Schema.Codec<T, string>` decoding TOML text straight into `T`.
	 * @category schemas
	 * @since 0.0.0
	 */
	static schema<T, E, RD = never, RE = never>(target: S.Codec<T, E, RD, RE>): S.Codec<T, string, RD, RE> {
		return Toml.TomlFromString.pipe(S.decodeTo(target));
	}

	/**
	 * Bind a target schema to the TOML codec once, yielding the composed
	 * schema plus pre-derived `decode`/`encode` directions — the
	 * {@link Toml.schema} composition without the generic `Schema` machinery
	 * at every use site. Binds the plain form only: TOML 1.1.0 parsing on
	 * decode, default stringify options on encode.
	 *
	 * **Details**
	 *
	 * Both directions fail with `Schema.SchemaError`, exactly as
	 * `Schema.decodeEffect`/`Schema.encodeEffect` over {@link Toml.schema}
	 * would; the target's decoding/encoding service requirements flow through.
	 *
	 * Schema-producing: each call composes a fresh schema and derives both
	 * directions from it. Bind the result to a `const` — that single binding is
	 * the point.
	 *
	 * **Example** (Bind a schema to decode and encode TOML)
	 *
	 * ```ts
	 * import { Toml } from "@beep/scratchpad/effected/toml/Toml";
	 * import * as Effect from "effect/Effect";
	 * import * as S from "effect/Schema";
	 *
	 * const Config = S.Struct({ name: S.String });
	 * const config = Toml.bind(Config);
	 *
	 * const program = Effect.gen(function* () {
	 *   const value = yield* config.decode('name = "Alice"');
	 *   const text = yield* config.encode(value);
	 *   return { value, text };
	 * });
	 *
	 * console.log(Effect.runSync(program).text === 'name = "Alice"\n'); // true
	 * ```
	 *
	 * @param target - The domain schema decoded values must satisfy.
	 * @returns A {@link TomlBoundCodec} carrying the composed schema and its
	 *   two pre-bound directions.
	 * @category codecs
	 * @since 0.0.0
	 */
	static bind<T, E, RD = never, RE = never>(target: S.Codec<T, E, RD, RE>): TomlBoundCodec<T, RD, RE> {
		const schema = Toml.schema(target);
		return {
			schema,
			decode: S.decodeEffect(schema),
			encode: S.encodeEffect(schema),
		};
	}
}
