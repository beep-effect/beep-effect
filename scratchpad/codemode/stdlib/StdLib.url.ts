/**
 * Guest URI encode/decode helpers and `URL.parse`/`URL.canParse` adapters for
 * the CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A, P } from "@beep/utils";
import { Result } from "effect";
import { dual } from "effect/Function";
import { type UrlMethod, UrlStatic } from "../Codemode.method-names.ts";
import { CodeModeURL } from "../Codemode.values.ts";
import {
  type AstNode,
  InterpreterFailure,
  InterpreterRuntimeError,
  type UriFunction,
  UriFunctionName,
} from "../interpreter/Interpreter.model.ts";
import { boundedData, coerceToString } from "./StdLib.value.ts";

export {
  UrlMethod,
  UrlSearchParamsMethod,
  UrlStatic,
} from "../Codemode.method-names.ts";

const $I = $ScratchpadId.create("codemode/stdlib/StdLib.url");

/**
 * Closed kit of readable `URL` instance property names including `origin`.
 *
 * **Example** (Confirm href and origin membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { urlProperties } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * console.log(S.is(urlProperties)("href"))
 * console.log(S.is(urlProperties)("origin"))
 * ```
 *
 * @see {@link urlWritableProperties} for the writable subset that omits origin.
 * @category schemas
 * @since 0.0.0
 */
export const urlProperties = LiteralKit([
  "href",
  "origin",
  "protocol",
  "username",
  "password",
  "host",
  "hostname",
  "port",
  "pathname",
  "search",
  "hash",
]).pipe(
  $I.annoteSchema("urlProperties", {
    description: "Guest-visible URL instance property names.",
  })
);

/**
 * Decoded value produced by {@link urlProperties}.
 *
 * @see {@link urlProperties} for the runtime kit of URL property names.
 * @category type-level
 * @since 0.0.0
 */
export type urlProperties = typeof urlProperties.Type;

/**
 * Writable URL properties; `origin` is omitted because it is computed.
 *
 * **Example** (Origin is readable but not writable)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { urlWritableProperties } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * console.log(S.is(urlWritableProperties)("href"))
 * console.log(S.is(urlWritableProperties)("origin"))
 * ```
 *
 * @see {@link urlProperties} for the full readable set including origin.
 * @category schemas
 * @since 0.0.0
 */
export const urlWritableProperties = LiteralKit(urlProperties.omitOptions(["origin"])).pipe(
  $I.annoteSchema("urlWritableProperties", {
    description: "Writable URL instance property names; origin is computed.",
  })
);

/**
 * Decoded value produced by {@link urlWritableProperties}.
 *
 * @see {@link urlWritableProperties} for the runtime writable URL property kit.
 * @category type-level
 * @since 0.0.0
 */
export type urlWritableProperties = typeof urlWritableProperties.Type;

/**
 * Coerces a URI function argument through {@link boundedData} then
 * {@link coerceToString}.
 *
 * **Example** (Stringify a URI argument)
 *
 * ```ts
 * import { uriArgument } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * console.log(uriArgument("a b", "encodeURIComponent input"))
 * ```
 *
 * @see {@link urlArgument} for URL-instance passthrough of href.
 * @see {@link invokeUriFunction} for encodeURIComponent and siblings.
 * @category utilities
 * @since 0.0.0
 */
export const uriArgument: {
  (label: string): (value: unknown) => string;
  (value: unknown, label: string): string;
} = dual(2, (value: unknown, label: string): string => coerceToString(boundedData(value, label)));

/**
 * Dispatches guest `encodeURI`, `encodeURIComponent`, `decodeURI`, and
 * `decodeURIComponent`.
 *
 * **Example** (Encode a query value)
 *
 * ```ts
 * import { Result } from "effect"
 * import { UriFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { invokeUriFunction } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * const node = { type: "CallExpression" }
 * const encoded = invokeUriFunction(
 *   UriFunction.new("encodeURIComponent"),
 *   ["a b"],
 *   node
 * )
 * console.log(Result.getOrThrow(encoded))
 * ```
 *
 * @see {@link uriArgument} for the stringify used before encoding.
 * @see {@link invokeURLStatic} for URL.parse and URL.canParse.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeUriFunction = (
  ref: UriFunction,
  args: Array<unknown>,
  node: AstNode
): Result.Result<string, InterpreterFailure> => {
  const value = Result.try({
    try: () => uriArgument(args[0], `${ref.name} input`),
    catch: (error) =>
      InterpreterFailure.is(error)
        ? error
        : InterpreterRuntimeError.new(`${ref.name} input could not be converted to data.`, node),
  });
  return Result.flatMap(value, (input) =>
    Result.try({
      try: () =>
        UriFunctionName.$match(ref.name, {
          encodeURI: () => encodeURI(input),
          encodeURIComponent: () => encodeURIComponent(input),
          decodeURI: () => decodeURI(input),
          decodeURIComponent: () => decodeURIComponent(input),
        }),
      catch: (error) =>
        InterpreterRuntimeError.new(
          `${ref.name} received malformed URI data: ${error instanceof Error ? error.message : String(error)}`,
          node
        ).as("URIError"),
    })
  );
};

/**
 * Accepts a {@link CodeModeURL} by `href` or otherwise stringifies through
 * {@link uriArgument}.
 *
 * **Example** (Pass through a CodeModeURL href)
 *
 * ```ts
 * import { CodeModeURL } from "../../../codemode/Codemode.values.ts"
 * import { urlArgument } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * const url = CodeModeURL.new(new URL("https://example.test/path"))
 * console.log(urlArgument(url, "URL.parse input"))
 * console.log(urlArgument("/relative", "URL.parse input"))
 * ```
 *
 * @see {@link uriArgument} for the stringify path used for non-URL data.
 * @see {@link invokeURLStatic} for parse and canParse that consume this argument.
 * @category utilities
 * @since 0.0.0
 */
export const urlArgument: {
  (label: string): (value: unknown) => string;
  (value: unknown, label: string): string;
} = dual(2, (value: unknown, label: string): string =>
  CodeModeURL.is(value) ? value.url.href : uriArgument(value, label)
);

/**
 * Dispatches guest `URL.canParse` and `URL.parse`.
 *
 * **Gotchas**
 *
 * Empty arguments throw `TypeError`. `canParse` returns a boolean; `parse`
 * returns a {@link CodeModeURL} or `null` and never throws on a malformed URL.
 * Do not treat parse failure as an exception.
 *
 * **Example** (Distinguish canParse from parse-or-null)
 *
 * ```ts
 * import { CodeModeURL } from "../../../codemode/Codemode.values.ts"
 * import { invokeURLStatic } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeURLStatic("canParse", ["https://example.test"], node))
 * console.log(invokeURLStatic("canParse", ["not a url"], node))
 * const parsed = invokeURLStatic("parse", ["https://example.test/path"], node)
 * console.log(CodeModeURL.is(parsed))
 * console.log(invokeURLStatic("parse", ["not a url"], node))
 * ```
 *
 * @see {@link urlArgument} for URL-instance href passthrough.
 * @see {@link uriArgument} for data-to-string conversion without URL identity.
 * @see {@link invokeURLMethod} for toString/toJSON which both return href.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeURLStatic = (name: UrlStatic, args: Array<unknown>, node: AstNode): unknown => {
  if (A.isArrayEmpty(args))
    throw InterpreterRuntimeError.new(`URL.${name} requires a URL argument.`, node).as("TypeError");
  const input = urlArgument(args[0], `URL.${name} input`);
  const base = P.isUndefined(args[1]) ? undefined : urlArgument(args[1], `URL.${name} base`);
  try {
    const url = new URL(input, base);
    return UrlStatic.is.canParse(name) ? true : CodeModeURL.new(url);
  } catch {
    return UrlStatic.is.canParse(name) ? false : null;
  }
};

/**
 * Returns `value.url.href` for both `toString` and `toJSON`.
 *
 * **Gotchas**
 *
 * The method name is ignored. Both `toString` and `toJSON` return `href`; they
 * do not differ for invalid or relative URLs because the stored value is
 * already a constructed `URL`.
 *
 * **Example** (toString and toJSON both yield href)
 *
 * ```ts
 * import { CodeModeURL } from "../../../codemode/Codemode.values.ts"
 * import { invokeURLMethod } from "../../../codemode/stdlib/StdLib.url.ts"
 *
 * const node = { type: "CallExpression" }
 * const url = CodeModeURL.new(new URL("https://example.test/path"))
 * console.log(invokeURLMethod(url, "toString", node))
 * console.log(invokeURLMethod(url, "toJSON", node))
 * ```
 *
 * @see {@link invokeURLStatic} for parse (CodeModeURL or null) versus canParse.
 * @see {@link urlArgument} for how URL instances are stringified as href.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeURLMethod = (value: CodeModeURL, _name: UrlMethod, _node: AstNode): string => value.url.href;
