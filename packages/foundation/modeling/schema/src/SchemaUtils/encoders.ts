/**
 * Schema encoding helpers that normalize Effect Schema failures as
 * {@link S.SchemaError} values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Effect, Exit, Result, SchemaAST } from "effect";
import type * as O from "effect/Option";

/**
 * Application signature shared by every encoder factory in this module.
 *
 * Each factory returns a function of this shape: it takes the value to encode
 * and optional parse options that override the options captured when the
 * encoder was built.
 *
 * Naming this call signature (instead of spelling it inline) is what lets the
 * pipeable-signature analysis relate each factory's return type.
 */
type SchemaEncoder<Input, Output> = (input: Input, overrideOptions?: SchemaAST.ParseOptions) => Output;

/**
 * Encodes a typed input (the schema's `Type`) against a schema, returning an
 * `Effect` that succeeds with the encoded value or fails with a
 * {@link S.SchemaError}.
 *
 * **When to use**
 *
 * Use when you need to encode input already typed as the schema's `Type` in
 * an `Effect` whose failure channel is `SchemaError`.
 *
 * **Details**
 *
 * For `unknown` input use {@link encodeUnknownEffect}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Example** (Encode a typed value in an Effect)
 *
 * ```ts import.meta.vitest name="Encode a typed value in an Effect"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { encodeEffect } from "@beep/schema/SchemaUtils/encoders"
 *
 * const encoded = await Effect.runPromise(encodeEffect(S.NumberFromString)(42))
 * encoded // => "42"
 * ```
 *
 * @see {@link encodeUnknownEffect} when the input is not already typed by the schema.
 * @see {@link S.SchemaParser.encodeEffect} for the adapter that fails with `SchemaIssue.Issue` directly.
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEffect: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.Constraint>(
    schema: TSchema
  ) => SchemaEncoder<TSchema["Type"], Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]>>;
  <TSchema extends S.Constraint>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.Constraint>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]>> =>
    (input, overrideOptions) =>
      S.encodeUnknownEffect(schema, options)(input, overrideOptions)
);

/**
 * Encodes unknown input with schema errors preserved in an `Effect` failure
 * channel.
 *
 * **When to use**
 *
 * Use when untrusted or erased input must be validated before serialization
 * without throwing.
 *
 * **Details**
 *
 * Successful encoding yields the schema's `Encoded` representation. Options
 * supplied at application time override options supplied when creating the
 * encoder.
 *
 * **Gotchas**
 *
 * Prefer {@link encodeEffect} when the input already has the schema's decoded
 * `Type`; this helper deliberately accepts `unknown` and validates it first.
 *
 * **Example** (Encoding a value to a string)
 *
 * ```ts import.meta.vitest name="Encoding a value to a string"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { encodeUnknownEffect } from "@beep/schema/SchemaUtils/encoders"
 *
 * const input: unknown = 42
 * const encoded = await Effect.runPromise(encodeUnknownEffect(S.NumberFromString)(input))
 * encoded // => "42"
 * ```
 *
 * @see {@link encodeEffect} for encoding an input already typed by the schema.
 * @see {@link S.encodeUnknownEffect} for the underlying Effect Schema operation.
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownEffect: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.Constraint>(
    schema: TSchema
  ) => SchemaEncoder<unknown, Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]>>;
  <TSchema extends S.Constraint>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.Constraint>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]>> =>
    (input, overrideOptions) =>
      S.encodeUnknownEffect(schema, options)(input, overrideOptions)
);

/**
 * Encodes an `unknown` input against a schema synchronously, returning an
 * `Exit` that is either a `Success` with the encoded value or a `Failure`.
 *
 * **When to use**
 *
 * Use when you need to encode unknown input into an `Exit` and capture schema
 * mismatches as `SchemaError`.
 *
 * **Details**
 *
 * Only usable with schemas that have no `EncodingServices` requirement. Prefer
 * {@link encodeExit} when the value is already typed as the schema's `Type`.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 * Schema mismatches are represented by a `Failure` cause containing
 * `SchemaError`.
 *
 * **Gotchas**
 *
 * Schema issue fail reasons are wrapped as `SchemaError`. Defects,
 * interruptions, and other non-schema reasons remain in the returned `Cause`,
 * including when they are mixed with schema issues.
 *
 * **Example** (Inspect unknown-input encoding as an Exit)
 *
 * ```ts import.meta.vitest name="Inspect unknown-input encoding as an Exit"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { encodeUnknownExit } from "@beep/schema/SchemaUtils/encoders"
 *
 * const encoded = encodeUnknownExit(S.NumberFromString)(42)
 * Exit.isSuccess(encoded) // => true
 * ```
 *
 * @see {@link encodeExit} for input already typed by the schema.
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownExit: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<unknown, Exit.Exit<TSchema["Encoded"], S.SchemaError>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Exit.Exit<TSchema["Encoded"], S.SchemaError>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Exit.Exit<TSchema["Encoded"], S.SchemaError>> =>
    (input, overrideOptions) =>
      S.encodeUnknownExit(schema, options)(input, overrideOptions)
);

/**
 * Encodes a typed input (the schema's `Type`) against a schema synchronously,
 * returning an `Exit` that is either a `Success` with the encoded value or a
 * `Failure`.
 *
 * **When to use**
 *
 * Use when you need to encode already typed schema values into an `Exit` and
 * capture schema mismatches as `SchemaError`.
 *
 * **Details**
 *
 * Only usable with schemas that have no `EncodingServices` requirement. For
 * `unknown` input use {@link encodeUnknownExit}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 * Schema mismatches are represented by a `Failure` cause containing
 * `SchemaError`.
 *
 * **Gotchas**
 *
 * Schema issue fail reasons are wrapped as `SchemaError`. Defects,
 * interruptions, and other non-schema reasons remain in the returned `Cause`,
 * including when they are mixed with schema issues.
 *
 * **Example** (Inspect typed-input encoding as an Exit)
 *
 * ```ts import.meta.vitest name="Inspect typed-input encoding as an Exit"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { encodeExit } from "@beep/schema/SchemaUtils/encoders"
 *
 * const encoded = encodeExit(S.NumberFromString)(42)
 * Exit.isSuccess(encoded) // => true
 * ```
 *
 * @see {@link encodeUnknownExit} for validating unknown input before encoding.
 * @category encoding
 * @since 0.0.0
 */
export const encodeExit: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<TSchema["Type"], Exit.Exit<TSchema["Encoded"], S.SchemaError>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Exit.Exit<TSchema["Encoded"], S.SchemaError>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Exit.Exit<TSchema["Encoded"], S.SchemaError>> =>
    (input, overrideOptions) =>
      S.encodeUnknownExit(schema, options)(input, overrideOptions)
);
/**
 * Encodes an `unknown` input against a schema, returning an `Option` that is
 * `Some` with the encoded value on success or `None` for schema mismatches.
 *
 * **When to use**
 *
 * Use when you do not know the input type statically and only need to know
 * whether encoding succeeded.
 *
 * **Details**
 *
 * Prefer this over {@link encodeUnknownExit} or {@link encodeUnknownEffect}
 * when you don't need error details. For values already typed as the schema's
 * `Type` use {@link encodeOption}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Gotchas**
 *
 * Only causes made entirely of schema issues are converted to `None`. Causes
 * that contain defects, interruptions, or other non-schema reasons throw
 * instead.
 *
 * **Example** (Discard unknown-input error details)
 *
 * ```ts import.meta.vitest name="Discard unknown-input error details"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { encodeUnknownOption } from "@beep/schema/SchemaUtils/encoders"
 *
 * O.isSome(encodeUnknownOption(S.NumberFromString)(42)) // => true
 * O.isNone(encodeUnknownOption(S.NumberFromString)("nope")) // => true
 * ```
 *
 * @see {@link encodeOption} for input already typed by the schema.
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownOption: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<unknown, O.Option<TSchema["Encoded"]>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, O.Option<TSchema["Encoded"]>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, O.Option<TSchema["Encoded"]>> =>
    (input, overrideOptions) =>
      S.encodeUnknownOption(schema, options)(input, overrideOptions)
);

/**
 * Encodes a typed input (the schema's `Type`) against a schema, returning an
 * `Option` that is `Some` with the encoded value on success or `None` for schema
 * mismatches.
 *
 * **When to use**
 *
 * Use when you already have a value typed as the schema's `Type` and only need
 * to know whether encoding succeeded.
 *
 * **Details**
 *
 * For `unknown` input use {@link encodeUnknownOption}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Gotchas**
 *
 * Only causes made entirely of schema issues are converted to `None`. Causes
 * that contain defects, interruptions, or other non-schema reasons throw
 * instead.
 *
 * **Example** (Encode a typed value as an Option)
 *
 * ```ts import.meta.vitest name="Encode a typed value as an Option"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { encodeOption } from "@beep/schema/SchemaUtils/encoders"
 *
 * const encoded = encodeOption(S.NumberFromString)(42)
 * O.getOrElse(encoded, () => "missing") // => "42"
 * ```
 *
 * @see {@link encodeUnknownOption} for validating unknown input before encoding.
 * @category encoding
 * @since 0.0.0
 */
export const encodeOption: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<TSchema["Type"], O.Option<TSchema["Encoded"]>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], O.Option<TSchema["Encoded"]>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], O.Option<TSchema["Encoded"]>> =>
    (input, overrideOptions) =>
      S.encodeOption(schema, options)(input, overrideOptions)
);
/**
 * Encodes an `unknown` input against a schema, returning a `Result` that
 * succeeds with the encoded value or fails with a {@link S.SchemaError} for schema
 * mismatches.
 *
 * **When to use**
 *
 * Use when you do not know the input type statically and want schema mismatches
 * returned as `Result.fail` with `SchemaError`.
 *
 * **Details**
 *
 * For values already typed as the schema's `Type` use {@link encodeResult}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 * Schema mismatches are returned as `Result.fail` with `SchemaError`.
 *
 * **Gotchas**
 *
 * Only causes made entirely of schema issues are returned as `Result.fail`.
 * Causes that contain defects, interruptions, or other non-schema reasons throw
 * instead.
 *
 * **Example** (Inspect unknown-input encoding as a Result)
 *
 * ```ts import.meta.vitest name="Inspect unknown-input encoding as a Result"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { encodeUnknownResult } from "@beep/schema/SchemaUtils/encoders"
 *
 * const encoded = encodeUnknownResult(S.NumberFromString)(42)
 * Result.isSuccess(encoded) // => true
 * ```
 *
 * @see {@link encodeResult} for input already typed by the schema.
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownResult: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<unknown, Result.Result<TSchema["Encoded"], S.SchemaError>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Result.Result<TSchema["Encoded"], S.SchemaError>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Result.Result<TSchema["Encoded"], S.SchemaError>> =>
    (input, overrideOptions) =>
      S.encodeUnknownResult(schema, options)(input, overrideOptions)
);

/**
 * Encodes a typed input (the schema's `Type`) against a schema, returning a
 * `Result` that succeeds with the encoded value or fails with a
 * {@link S.SchemaError} for schema mismatches.
 *
 * **When to use**
 *
 * Use when you already have a value typed as the schema's `Type` and want schema
 * mismatches returned as `Result.fail` with `SchemaError`.
 *
 * **Details**
 *
 * For `unknown` input use {@link encodeUnknownResult}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 * Schema mismatches are returned as `Result.fail` with `SchemaError`.
 *
 * **Gotchas**
 *
 * Only causes made entirely of schema issues are returned as `Result.fail`.
 * Causes that contain defects, interruptions, or other non-schema reasons throw
 * instead.
 *
 * **Example** (Inspect typed-input encoding as a Result)
 *
 * ```ts import.meta.vitest name="Inspect typed-input encoding as a Result"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { encodeResult } from "@beep/schema/SchemaUtils/encoders"
 *
 * const encoded = encodeResult(S.NumberFromString)(42)
 * Result.isSuccess(encoded) // => true
 * ```
 *
 * @see {@link encodeUnknownResult} for validating unknown input before encoding.
 * @category encoding
 * @since 0.0.0
 */
export const encodeResult: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<TSchema["Type"], Result.Result<TSchema["Encoded"], S.SchemaError>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Result.Result<TSchema["Encoded"], S.SchemaError>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Result.Result<TSchema["Encoded"], S.SchemaError>> =>
    (input, overrideOptions) =>
      S.encodeResult(schema, options)(input, overrideOptions)
);
/**
 * Encodes an `unknown` input against a schema, returning a `Promise` that
 * resolves with the encoded value or rejects with a {@link S.SchemaError} for
 * schema mismatches.
 *
 * **When to use**
 *
 * Use when you need encoding of unknown input to return a JavaScript `Promise`
 * that rejects with `SchemaError` for schema mismatches.
 *
 * **Details**
 *
 * For values already typed as the schema's `Type` use {@link encodePromise}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Gotchas**
 *
 * Non-schema failures may reject with a runtime failure instead of
 * `SchemaError`.
 *
 * **Example** (Encode unknown input as a Promise)
 *
 * ```ts import.meta.vitest name="Encode unknown input as a Promise"
 * import * as S from "effect/Schema"
 * import { encodeUnknownPromise } from "@beep/schema/SchemaUtils/encoders"
 *
 * const input: unknown = 42
 * await encodeUnknownPromise(S.NumberFromString)(input) // => "42"
 * ```
 *
 * @see {@link encodePromise} for input already typed by the schema.
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownPromise: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<unknown, Promise<TSchema["Encoded"]>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Promise<TSchema["Encoded"]>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, Promise<TSchema["Encoded"]>> =>
    (input, overrideOptions) =>
      S.encodeUnknownPromise(schema, options)(input, overrideOptions)
);

/**
 * Encodes a typed input (the schema's `Type`) against a schema, returning a
 * `Promise` that resolves with the encoded value or rejects with a
 * {@link S.SchemaError} for schema mismatches.
 *
 * **When to use**
 *
 * Use when you already have a value typed as the schema's `Type` and need
 * encoding to return a JavaScript `Promise` that rejects with `SchemaError` for
 * schema mismatches.
 *
 * **Details**
 *
 * For `unknown` input use {@link encodeUnknownPromise}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Gotchas**
 *
 * Non-schema failures may reject with a runtime failure instead of
 * `SchemaError`.
 *
 * **Example** (Encode a typed value as a Promise)
 *
 * ```ts import.meta.vitest name="Encode a typed value as a Promise"
 * import * as S from "effect/Schema"
 * import { encodePromise } from "@beep/schema/SchemaUtils/encoders"
 *
 * await encodePromise(S.NumberFromString)(42) // => "42"
 * ```
 *
 * @see {@link encodeUnknownPromise} for validating unknown input before encoding.
 * @category encoding
 * @since 0.0.0
 */
export const encodePromise: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<TSchema["Type"], Promise<TSchema["Encoded"]>>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Promise<TSchema["Encoded"]>>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], Promise<TSchema["Encoded"]>> =>
    (input, overrideOptions) =>
      S.encodePromise(schema, options)(input, overrideOptions)
);

/**
 * Encodes an `unknown` input against a schema synchronously, throwing a
 * {@link S.SchemaError} for schema mismatches.
 *
 * **When to use**
 *
 * Use when you need to serialize unknown data at a synchronous boundary and
 * want schema mismatches to throw `SchemaError`.
 *
 * **Details**
 *
 * For alternatives that do not throw on schema mismatches, see
 * {@link encodeUnknownOption}, {@link encodeUnknownExit}, or
 * {@link encodeUnknownEffect}. For values already typed as the schema's `Type`
 * use {@link encodeSync}. Options may be provided either when creating the
 * encoder or when applying it; application options override creation options.
 *
 * **Gotchas**
 *
 * Non-schema failures may throw a runtime failure instead of `SchemaError`.
 *
 * **Example** (Synchronously encode unknown input)
 *
 * ```ts import.meta.vitest name="Synchronously encode unknown input"
 * import * as S from "effect/Schema"
 * import { encodeUnknownSync } from "@beep/schema/SchemaUtils/encoders"
 *
 * const input: unknown = 42
 * encodeUnknownSync(S.NumberFromString)(input) // => "42"
 * ```
 *
 * @see {@link encodeSync} for input already typed by the schema.
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownSync: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema) => SchemaEncoder<unknown, TSchema["Encoded"]>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, TSchema["Encoded"]>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<unknown, TSchema["Encoded"]> =>
    (input, overrideOptions) =>
      S.encodeUnknownSync(schema, options)(input, overrideOptions)
);

/**
 * Encodes a typed input (the schema's `Type`) against a schema synchronously,
 * throwing a {@link S.SchemaError} for schema mismatches.
 *
 * **When to use**
 *
 * Use when you already have a value typed as the schema's `Type` and want
 * schema mismatches to throw `SchemaError` synchronously.
 *
 * **Details**
 *
 * For `unknown` input use {@link encodeUnknownSync}.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Gotchas**
 *
 * Non-schema failures may throw a runtime failure instead of `SchemaError`.
 *
 * **Example** (Synchronously encode a typed value)
 *
 * ```ts import.meta.vitest name="Synchronously encode a typed value"
 * import * as S from "effect/Schema"
 * import { encodeSync } from "@beep/schema/SchemaUtils/encoders"
 *
 * encodeSync(S.NumberFromString)(42) // => "42"
 * ```
 *
 * @see {@link encodeUnknownSync} for validating unknown input before encoding.
 * @category encoding
 * @since 0.0.0
 */
export const encodeSync: {
  (
    options?: SchemaAST.ParseOptions
  ): <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema
  ) => SchemaEncoder<TSchema["Type"], TSchema["Encoded"]>;
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], TSchema["Encoded"]>;
} = dual(
  (args) => S.isSchema(args[0]),
  <TSchema extends S.ConstraintEncoder<unknown>>(
    schema: TSchema,
    options?: SchemaAST.ParseOptions
  ): SchemaEncoder<TSchema["Type"], TSchema["Encoded"]> =>
    (input, overrideOptions) =>
      S.encodeSync(schema, options)(input, overrideOptions)
);
