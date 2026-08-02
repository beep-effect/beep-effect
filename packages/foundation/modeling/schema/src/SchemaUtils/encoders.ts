/**
 *
 */

import * as S from "effect/Schema";
import type { Effect, Exit, Result, SchemaAST } from "effect";
import type * as O from "effect/Option";

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
 * @see {@link S.SchemaParser.encodeEffect} for the adapter that fails with `SchemaIssue.Issue` directly
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEffect =
  <TSchema extends S.Constraint>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: TSchema["Type"]): Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]> =>
    S.encodeUnknownEffect(schema, options)(input);

/**
 * Encodes an `unknown` input against a schema, returning an `Effect` that
 * succeeds with the encoded value or fails with a {@link S.SchemaError}.
 *
 * **When to use**
 *
 * Use when you need to encode unknown input in an `Effect` whose failure
 * channel is `SchemaError`.
 *
 * **Details**
 *
 * Prefer {@link encodeEffect} when the value is already typed as the schema's
 * `Type`.
 * Options may be provided either when creating the encoder or when applying it;
 * application options override creation options.
 *
 * **Example** (Encoding a value to a string)
 *
 * ```ts
 * import { Effect, Schema } from "effect"
 *
 * const NumberFromString = Schema.NumberFromString
 *
 * Effect.runPromise(Schema.encodeUnknownEffect(NumberFromString)(42)).then(console.log)
 * // Output: "42"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownEffect =
  <TSchema extends S.Constraint>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: unknown): Effect.Effect<TSchema["Encoded"], S.SchemaError, TSchema["EncodingServices"]> =>
    S.encodeUnknownEffect(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownExit =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: unknown): Exit.Exit<TSchema["Encoded"], S.SchemaError> =>
    S.encodeUnknownExit(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodeExit =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: TSchema["Type"]): Exit.Exit<TSchema["Encoded"], S.SchemaError> =>
    S.encodeUnknownExit(schema, options)(input);
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
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownOption =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: unknown): O.Option<TSchema["Encoded"]> =>
    S.encodeUnknownOption(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodeOption =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: TSchema["Type"]): O.Option<TSchema["Encoded"]> =>
    S.encodeOption(schema, options)(input);
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
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownResult =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: unknown): Result.Result<TSchema["Encoded"], S.SchemaError> =>
    S.encodeUnknownResult(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodeResult =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: TSchema["Type"]): Result.Result<TSchema["Encoded"], S.SchemaError> =>
    S.encodeResult(schema, options)(input);
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
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownPromise =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: unknown) =>
    S.encodeUnknownPromise(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodePromise =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: TSchema["Type"]): Promise<TSchema["Encoded"]> =>
    S.encodePromise(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodeUnknownSync =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: unknown): TSchema["Encoded"] =>
    S.encodeUnknownSync(schema, options)(input);

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
 * @category encoding
 * @since 0.0.0
 */
export const encodeSync =
  <TSchema extends S.ConstraintEncoder<unknown>>(schema: TSchema, options?: SchemaAST.ParseOptions) =>
  (input: TSchema["Type"]): TSchema["Encoded"] =>
    S.encodeSync(schema, options)(input);
