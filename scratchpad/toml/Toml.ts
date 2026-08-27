/**
 * Typed TOML 1.1 parse, conservative 1.0 stringify, and schema factories.
 *
 * **Details**
 *
 * Cycle firewall: the internal engine throws raw carriers (`RawTomlError`
 * with a `{ code, message, offset, length }` record, `GuardExceeded` from the
 * depth guards); this module materializes {@link TomlDiagnostic} instances
 * (deriving `line`/`character` from `offset`) and constructs the tagged
 * {@link TomlParseError} / {@link TomlStringifyError}. The dependency edge
 * runs facade → engine only, so `noImportCycles` stays satisfied.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Result, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { buildValue } from "./internal/semantic.ts";
import { stringifyValue } from "./internal/stringifyValue.ts";
import { TomlDiagnostic } from "./TomlDiagnostic.ts";

const $I = $ScratchpadId.create("toml/Toml");

/**
 * Options controlling stringify behavior. The only knob is `newline` —
 * omitted, it resolves to `"\n"`.
 *
 * **Gotchas**
 *
 * Stringify deliberately emits only TOML 1.0.0 spellings — seconds always
 * present in times, no `\e`/`\xHH` escapes, single-line inline tables — even
 * though {@link Toml.parse} accepts the full TOML 1.1.0 grammar. Every 1.0
 * document is valid 1.1, so this conservative-write/liberal-read asymmetry
 * keeps emitted documents readable by 1.0-only consumers.
 *
 * **Example** (Stringify with CRLF newlines)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Toml, TomlStringifyOptions } from "@beep/scratchpad/toml"
 *
 * const options = TomlStringifyOptions.make({ newline: "\r\n" })
 * const encoded = Toml.stringifyResult({ name: "Alice" }, options)
 * console.log(Result.isSuccess(encoded) && encoded.success) // "name = \"Alice\"\r\n"
 * ```
 *
 * @see {@link Toml.stringify} for the Effect entry point that consumes these options.
 * @see {@link Toml.stringifyResult} for the synchronous Result entry point.
 * @category configuration
 * @since 0.0.0
 */
export class TomlStringifyOptions extends Schema.Class<TomlStringifyOptions>($I`TomlStringifyOptions`)(
  {
    newline: Schema.optionalKey(Schema.Literals(["\n", "\r\n"])),
  },
  $I.annote("TomlStringifyOptions", {
    description: "Stringify options whose only knob is newline; omitted, it resolves to LF.",
  })
) {}

/**
 * Parse failure: the {@link TomlDiagnostic} entries describing why the
 * document was rejected (first violation wins, so there is one today; the
 * array shape matches yaml's aggregate contract). Raised by {@link Toml.parse}
 * and the decode direction of the schema factories.
 *
 * **Example** (Inspect the first diagnostic)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Toml } from "@beep/scratchpad/toml"
 *
 * const bad = Toml.parseResult("name = ")
 * console.log(Result.isFailure(bad) && bad.failure._tag) // "TomlParseError"
 * console.log(Result.isFailure(bad) && bad.failure.diagnostics[0]?.code) // "ExpectedValue"
 * ```
 *
 * @see {@link TomlDiagnostic} for the positioned diagnostic each entry carries.
 * @see {@link Toml.parseResult} for the synchronous entry point that raises this error.
 * @category errors
 * @since 0.0.0
 */
export class TomlParseError extends Schema.TaggedError<TomlParseError>($I`TomlParseError`)(
  "TomlParseError",
  {
    diagnostics: Schema.Array(TomlDiagnostic),
  },
  $I.annote("TomlParseError", {
    description: "Tagged parse failure carrying positioned TomlDiagnostic entries (first violation wins).",
  })
) {
  /** @internal */
  override get message(): string {
    const count = this.diagnostics.length;
    const first = this.diagnostics[0];
    const detail = first === undefined ? "" : `: ${first.code} at ${first.line}:${first.character} ${first.message}`;
    return `TOML parse failed with ${count} error${count === 1 ? "" : "s"}${detail}`;
  }
}

/**
 * Stringification failure: an unsupported value, an out-of-range integer, a
 * circular reference or a tripped depth guard, as one structured
 * {@link TomlDiagnostic} (offset `0` — there is no source text). Raised by
 * {@link Toml.stringify} and the encode direction of the schema factories.
 *
 * **Example** (Reject a null value)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Toml } from "@beep/scratchpad/toml"
 *
 * const bad = Toml.stringifyResult({ nope: null })
 * console.log(Result.isFailure(bad) && bad.failure._tag) // "TomlStringifyError"
 * console.log(Result.isFailure(bad) && bad.failure.diagnostic.code) // "UnsupportedValue"
 * ```
 *
 * @see {@link TomlDiagnostic} for the single diagnostic this error carries.
 * @see {@link Toml.stringifyResult} for the synchronous entry point that raises this error.
 * @category errors
 * @since 0.0.0
 */
export class TomlStringifyError extends Schema.TaggedError<TomlStringifyError>($I`TomlStringifyError`)(
  "TomlStringifyError",
  {
    diagnostic: TomlDiagnostic,
  },
  $I.annote("TomlStringifyError", {
    description: "Tagged stringify failure carrying one TomlDiagnostic at offset 0.",
  })
) {
  /** @internal */
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
        })
      );
    }
    throw defect;
  }
};

const stringifyToResult = (
  value: unknown,
  options?: TomlStringifyOptions
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
        })
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
 * @see {@link Toml.bind} to construct this codec from a target schema.
 * @see {@link Toml.schema} for the same composition without pre-derived directions.
 * @category type-level
 * @since 0.0.0
 */
export interface TomlBoundCodec<T, RD = never, RE = never> {
  /** The composed codec decoding a TOML `string` straight into `T`. */
  readonly schema: Schema.Codec<T, string, RD, RE>;
  /** Decode TOML text into a validated `T`. */
  readonly decode: (text: string) => Effect.Effect<T, Schema.SchemaError, RD>;
  /** Encode a `T` back to canonical TOML text. */
  readonly encode: (value: T) => Effect.Effect<string, Schema.SchemaError, RE>;
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Static entry points for TOML 1.1 parsing, conservative 1.0 stringification,
 * and the schema factories that decode TOML text into a validated domain value.
 *
 * **Details**
 *
 * `parse`, `stringify`, and the schema factories carry real typed error
 * channels — including the hardening guards (nesting-depth caps on both
 * sides, circular-reference detection on encode) that keep malformed or
 * adversarial input on the typed channel instead of surfacing as an
 * unhandled defect. `parse` takes no options: TOML 1.1.0 parsing has no
 * knobs. This class is not instantiable.
 *
 * **Gotchas**
 *
 * Stringify emits only TOML 1.0.0 spellings while parse accepts 1.1.0, so a
 * round-trip of a 1.1-only document silently drops 1.1 spellings.
 * {@link Toml.parse} / {@link Toml.stringify} exist for the tracing span and
 * are defined in terms of the `*Result` variants — reach for
 * {@link Toml.parseResult} at a synchronous boundary. `fromString` /
 * `schema` / `bind` are schema-producing: each call returns a fresh derivation
 * cache, so bind the result to a `const` on hot paths (`TomlFromString` is the
 * pre-bound common case). First violation wins. Integers become `number` or
 * `bigint` past 2^53. `__proto__` is defined as an own data property.
 *
 * **Example** (Parse a document to a plain value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Toml } from "@beep/scratchpad/toml"
 *
 * const value = Effect.runSync(Toml.parse('name = "Alice"\nage = 30'))
 * console.log(value) // { name: "Alice", age: 30 }
 * ```
 *
 * @see {@link Toml.parseResult} for the synchronous Result form of parse.
 * @see {@link Toml.stringifyResult} for the synchronous Result form of stringify.
 * @see {@link Toml.bind} to pre-bind a domain schema's decode/encode directions.
 * @see {@link TomlParseError} for the tagged parse failure.
 * @see {@link TomlStringifyError} for the tagged stringify failure.
 * @category codecs
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
   * {@link TomlParseError} at the first violation; returns `unknown`, never
   * `any`.
   *
   * A nesting-depth bomb (arrays or inline tables past the engine cap) also
   * fails through {@link TomlParseError} with a `NestingDepthExceeded`
   * diagnostic, never as an unhandled defect.
   *
   * **Details**
   *
   * {@link Toml.parse} is defined in terms of this function; the two never
   * diverge. Reach for the `Effect` variant inside Effect code — it carries
   * the `Toml.parse` tracing span — and for this one at synchronous
   * boundaries such as a lint-staged handler.
   *
   * **Example** (Inspect success and failure)
   *
   * ```ts
   * import { Result } from "effect"
   * import { Toml } from "@beep/scratchpad/toml"
   *
   * const ok = Toml.parseResult('name = "Alice"')
   * console.log(Result.isSuccess(ok) && ok.success) // { name: "Alice" }
   *
   * const bad = Toml.parseResult("name = ")
   * console.log(Result.isFailure(bad) && bad.failure._tag) // "TomlParseError"
   * ```
   *
   * @param text - The TOML source to parse.
   * @see {@link Toml.parse} for the Effect form that wraps this Result with a tracing span.
   * @see {@link TomlParseError} for the tagged failure this Result carries.
   */
  static parseResult(text: string): Result.Result<unknown, TomlParseError> {
    return parseToResult(text);
  }

  /**
   * Parse a TOML 1.1.0 document into a plain JavaScript value. Defined in
   * terms of {@link Toml.parseResult} — synchronous callers can use that
   * variant directly.
   *
   * @param text - The TOML source to parse.
   * @see {@link Toml.parseResult} for the synchronous Result form.
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
   * **Example** (Inspect success and an unsupported value)
   *
   * ```ts
   * import { Result } from "effect"
   * import { Toml } from "@beep/scratchpad/toml"
   *
   * const ok = Toml.stringifyResult({ name: "Alice" })
   * console.log(Result.isSuccess(ok) && ok.success) // 'name = "Alice"\n'
   *
   * const bad = Toml.stringifyResult({ nope: null })
   * console.log(Result.isFailure(bad) && bad.failure._tag) // "TomlStringifyError"
   * ```
   *
   * @param value - The plain JavaScript value to stringify.
   * @param options - Optional {@link TomlStringifyOptions}; `newline` defaults to `"\n"`.
   * @see {@link Toml.stringify} for the Effect form that wraps this Result with a tracing span.
   * @see {@link TomlStringifyError} for the tagged failure this Result carries.
   */
  static stringifyResult(value: unknown, options?: TomlStringifyOptions): Result.Result<string, TomlStringifyError> {
    return stringifyToResult(value, options);
  }

  /**
   * Stringify a plain JavaScript value as a canonical TOML document. Defined
   * in terms of {@link Toml.stringifyResult} — synchronous callers can use
   * that variant directly.
   *
   * @param value - The plain JavaScript value to stringify.
   * @param options - Optional {@link TomlStringifyOptions}; `newline` defaults to `"\n"`.
   * @see {@link Toml.stringifyResult} for the synchronous Result form.
   */
  static readonly stringify = Effect.fn("Toml.stringify")((value: unknown, options?: TomlStringifyOptions) =>
    Effect.fromResult(Toml.stringifyResult(value, options))
  );

  /**
   * A `Schema<unknown, string>` decoding a TOML document and encoding values
   * back to canonical TOML text.
   *
   * Schema-producing: each call returns a fresh schema whose derivation
   * caches are not shared across calls. Bind the result to a `const` on hot
   * paths; the pre-bound {@link Toml.TomlFromString} covers the common case.
   *
   * **Example** (Decode TOML through a bound schema)
   *
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { Toml } from "@beep/scratchpad/toml"
   *
   * const schema = Toml.fromString()
   * const value = Effect.runSync(S.decodeUnknownEffect(schema)('name = "Alice"'))
   * console.log(value) // { name: "Alice" }
   * ```
   *
   * @see {@link Toml.TomlFromString} for the pre-bound common case.
   * @see {@link Toml.schema} to compose this codec with a domain schema.
   */
  static fromString(): Schema.Codec<unknown, string> {
    return Schema.String.pipe(
      Schema.decodeTo(
        Schema.Unknown,
        SchemaTransformation.transformOrFail({
          decode: (input: string) =>
            Toml.parse(input).pipe(
              Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input))
            ),
          encode: (value: unknown) =>
            Effect.fromResult(Toml.stringifyResult(value)).pipe(
              Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, value))
            ),
        })
      )
    );
  }

  /**
   * The zero-config `Schema<unknown, string>` — `Toml.fromString()`
   * pre-bound so the common case needs no memoization discipline.
   */
  static readonly TomlFromString: Schema.Codec<unknown, string> = Toml.fromString();

  /**
   * Compose {@link Toml.fromString} with a target schema, yielding a
   * `Schema<A, string>` that decodes TOML straight into a validated domain
   * value. The target's decoding/encoding service requirements flow through.
   *
   * Schema-producing: bind the result to a `const` on hot paths (see
   * {@link Toml.fromString}).
   *
   * **Example** (Decode TOML into a struct)
   *
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { Toml } from "@beep/scratchpad/toml"
   *
   * const Config = S.Struct({ name: S.String })
   * const schema = Toml.schema(Config)
   * const value = Effect.runSync(S.decodeUnknownEffect(schema)('name = "Alice"'))
   * console.log(value) // { name: "Alice" }
   * ```
   *
   * @see {@link Toml.bind} to also pre-derive `decode`/`encode` functions.
   * @see {@link Toml.fromString} for the untyped TOML codec this composes.
   */
  static schema<T, E, RD = never, RE = never>(target: Schema.Codec<T, E, RD, RE>): Schema.Codec<T, string, RD, RE> {
    return Toml.TomlFromString.pipe(
      Schema.decodeTo(target as unknown as Schema.Codec<T, unknown, RD, RE>)
    ) as unknown as Schema.Codec<T, string, RD, RE>;
  }

  /**
   * Bind a target schema to the TOML codec once, yielding the composed
   * schema plus pre-derived `decode`/`encode` directions — the
   * {@link Toml.schema} composition without the generic `Schema` machinery
   * at every use site. Binds the plain form only: TOML 1.1.0 parsing on
   * decode, default stringify options on encode.
   *
   * Both directions fail with `Schema.SchemaError`, exactly as
   * `Schema.decodeEffect`/`Schema.encodeEffect` over {@link Toml.schema}
   * would; the target's decoding/encoding service requirements flow through.
   *
   * **Gotchas**
   *
   * Schema-producing: each call composes a fresh schema and derives both
   * directions from it. Bind the result to a `const` — that single binding is
   * the point.
   *
   * **Example** (Decode and encode through a bound codec)
   *
   * ```ts
   * import { Effect, Schema } from "effect"
   * import { Toml } from "@beep/scratchpad/toml"
   *
   * const Config = Schema.Struct({ name: Schema.String })
   * const config = Toml.bind(Config)
   * const value = Effect.runSync(config.decode('name = "Alice"'))
   * const text = Effect.runSync(config.encode(value))
   * console.log(value) // { name: "Alice" }
   * console.log(text) // 'name = "Alice"\n'
   * ```
   *
   * @param target - The domain schema decoded values must satisfy.
   * @see {@link Toml.schema} for the same composition without pre-derived directions.
   * @see {@link TomlBoundCodec} for the shape this method returns.
   */
  static bind<T, E, RD = never, RE = never>(target: Schema.Codec<T, E, RD, RE>): TomlBoundCodec<T, RD, RE> {
    const schema = Toml.schema(target);
    return {
      schema,
      decode: Schema.decodeEffect(schema),
      encode: Schema.encodeEffect(schema),
    };
  }
}
