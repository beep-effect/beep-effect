/**
 * Dual-arity predicate for Effect Schema codec statics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as P from "effect/Predicate";
import type * as AST from "effect/SchemaAST";

const isParseOptions = (input: unknown): input is AST.ParseOptions =>
  P.hasProperty(input, "errors") ||
  P.hasProperty(input, "onExcessProperty") ||
  P.hasProperty(input, "propertyOrder") ||
  P.hasProperty(input, "disableChecks") ||
  P.hasProperty(input, "concurrency");

/**
 * Detect whether a Schema codec-style dual helper was called data-first.
 *
 * **Details**
 *
 * Effect Schema decoders and encoders accept parse options in both the
 * constructor and application positions. Use this predicate with `dual` when a
 * schema static should support `(input, options?)` and `(options?)(input)`.
 *
 * **Example** (Dual codec data-first detection)
 *
 * ```ts
 * import { isCodecDataFirst } from "@beep/schema/SchemaUtils/isCodecDataFirst"
 * import { dual } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import type * as AST from "effect/SchemaAST"
 *
 * const decodeStringOption: {
 *   (input: unknown, options?: AST.ParseOptions): O.Option<string>
 *   (options?: AST.ParseOptions): (input: unknown) => O.Option<string>
 * } = dual(isCodecDataFirst, S.decodeUnknownOption(S.String))
 *
 * console.log(O.isSome(decodeStringOption("ready"))) // true
 * ```
 *
 * @param args - The call arguments received by the dual helper.
 * @returns `true` when the arguments represent a data-first call.
 * @category utilities
 * @since 0.0.0
 */
export const isCodecDataFirst = (args: IArguments): boolean =>
  args.length >= 2 || (args.length === 1 && !isParseOptions(args[0]));
