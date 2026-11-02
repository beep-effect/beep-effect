/**
 * Shared utilities for Effect Schema adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaParser from "effect/SchemaParser";

/**
 * Assertion function compiled for a concrete schema.
 *
 * @typeParam Sch - Schema whose decoded type is added to the asserted input.
 * @category type-level
 * @since 0.0.0
 */
export type CompiledAssertion<Sch extends S.Constraint> = <I>(input: I) => asserts input is I & Sch["Type"];

const schemaIssueFromCause = (cause: Cause.Cause<SchemaIssue.Issue>): SchemaIssue.Issue | undefined => {
  let issue: SchemaIssue.Issue | undefined;
  for (const reason of cause.reasons) {
    if (!Cause.isFailReason(reason) || !SchemaIssue.isIssue(reason.error)) return undefined;
    issue ??= reason.error;
  }
  return issue;
};

/**
 * Compiles a reusable assertion against the decoded side of a schema.
 *
 * **Details**
 *
 * Compilation happens once when this function is called. Schema failures throw
 * `Error("Schema validation failed")` with the `SchemaIssue.Issue` as their
 * cause, matching `S.asserts`.
 *
 * **Gotchas**
 *
 * Defects, interruptions, asynchronous work, and mixed causes throw
 * `Error("Assertion adapter can only throw schema issues")` with the complete
 * `Cause` preserved.
 *
 * **Example** (Compile and apply a string assertion)
 *
 * ```ts
 * import { compileAssertion } from "@beep/utils/Schema"
 * import * as S from "effect/Schema"
 *
 * const assertString: <I>(input: I) => asserts input is I & string = compileAssertion(S.String)
 * const input: unknown = "beep"
 * assertString(input)
 * input.toUpperCase() // => "BEEP"
 * ```
 *
 * @throws `Error` when validation fails or the synchronous parser produces a non-schema cause.
 * @see {@link S.asserts} for the equivalent uncurried Effect Schema assertion.
 * @category assertions
 * @since 0.0.0
 */
export const compileAssertion = <Sch extends S.Constraint>(schema: Sch): CompiledAssertion<Sch> => {
  const decode = SchemaParser.decodeUnknownExit(S.toType(schema));
  return <I>(input: I): asserts input is I & Sch["Type"] => {
    const exit = decode(input);
    if (Exit.isSuccess(exit)) return;

    const issue = schemaIssueFromCause(exit.cause);
    if (issue === undefined) {
      throw new Error("Assertion adapter can only throw schema issues", { cause: exit.cause });
    }
    throw new Error("Schema validation failed", { cause: issue });
  };
};

/**
 * Overloads of a text-format composer built by {@link makeTextDecodeTo}.
 *
 * **Details**
 *
 * Data-first `(target, options?)` and data-last `(options?)(target)` both
 * yield a codec that decodes source text straight into the target's type. The
 * composer is generic over the target schema itself, not over a `Codec<T, E>`
 * view of it, so an `S.Opaque` class keeps its branded `Type` through the
 * composition (a `Codec` view would widen it to the underlying struct).
 *
 * **Example** (Type a text-format composer)
 *
 * ```ts
 * import type { TextDecodeTo } from "@beep/utils/Schema"
 * import { makeTextDecodeTo } from "@beep/utils/Schema"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const json: TextDecodeTo<undefined> = makeTextDecodeTo(() => S.fromJsonString(S.Unknown))
 *
 * console.log(Result.getOrThrow(S.decodeResult(json(S.Struct({ port: S.Finite })))('{"port":3000}'))) // { port: 3000 }
 * ```
 *
 * @typeParam Options - The text format's parse options.
 * @category type-level
 * @since 0.0.0
 */
export type TextDecodeTo<Options> = {
  <Target extends S.Top>(
    target: Target,
    options?: Options
  ): S.Codec<Target["Type"], string, Target["DecodingServices"], Target["EncodingServices"]>;
  (
    options?: Options
  ): <Target extends S.Top>(
    target: Target
  ) => S.Codec<Target["Type"], string, Target["DecodingServices"], Target["EncodingServices"]>;
};

/**
 * Builds the dual `schema` composer of a text format from its string codec.
 *
 * **Details**
 *
 * Each call of the returned composer builds `fromString(options)` and pipes it
 * through `S.decodeTo(target)`, so a text format (JSONC, YAML, ...) exposes
 * one composition instead of restating the dual plumbing. A call is
 * data-first when its first argument is a schema.
 *
 * **Gotchas**
 *
 * Every call composes a fresh schema; bind the result to a constant.
 *
 * **Example** (Compose JSON text with a domain schema)
 *
 * ```ts
 * import { makeTextDecodeTo } from "@beep/utils/Schema"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const fromJson = makeTextDecodeTo((_options?: undefined) => S.fromJsonString(S.Unknown))
 * const Config = S.Struct({ port: S.Finite })
 *
 * console.log(Result.getOrThrow(S.decodeResult(fromJson(Config))('{"port":3000}'))) // { port: 3000 }
 * console.log(Result.getOrThrow(S.decodeResult(fromJson()(Config))('{"port":8080}'))) // { port: 8080 }
 * ```
 *
 * @typeParam Options - The text format's parse options.
 * @param fromString - Builds the format's `string -> unknown` codec for the given options.
 * @returns The dual composer of text and target schemas.
 * @category constructors
 * @since 0.0.0
 */
export const makeTextDecodeTo = <Options>(
  fromString: (options?: Options) => S.Codec<unknown, string>
): TextDecodeTo<Options> =>
  dual(
    (args) => S.isSchema(args[0]),
    <Target extends S.Top>(
      target: Target,
      options?: Options
    ): S.Codec<Target["Type"], string, Target["DecodingServices"], Target["EncodingServices"]> =>
      fromString(options).pipe(S.decodeTo(target))
  );
