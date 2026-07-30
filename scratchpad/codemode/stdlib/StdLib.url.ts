import {
  type AstNode,
  InterpreterFailure,
  InterpreterRuntimeError,
  UriFunction,
  UriFunctionName,
} from "../interpreter/Interpreter.model.ts"
import { CodeModeURL } from "../Codemode.values.ts"
import { boundedData, coerceToString } from "./StdLib.value.ts"
import { Result } from "effect"
import { LiteralKit } from "@beep/schema"
import { P, A } from "@beep/utils";
import {
  type UrlMethod,
  UrlStatic,
} from "../Codemode.method-names.ts"

export {
  UrlMethod,
  UrlSearchParamsMethod,
  UrlStatic,
} from "../Codemode.method-names.ts"
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
])

export const urlWritableProperties = LiteralKit(
  urlProperties.omitOptions(["origin"])
)

export const uriArgument = (value: unknown, label: string): string => coerceToString(boundedData(value, label))

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
        : InterpreterRuntimeError.new(
            `${ref.name} input could not be converted to data.`,
            node
          ),
  })
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
          node,
        ).as("URIError"),
    })
  )
}

export const urlArgument = (value: unknown, label: string): string =>
  CodeModeURL.is(value) ? value.url.href : uriArgument(value, label)

export const invokeURLStatic = (name: UrlStatic, args: Array<unknown>, node: AstNode): unknown => {
  if (A.isArrayEmpty(args)) throw InterpreterRuntimeError.new(`URL.${name} requires a URL argument.`, node).as("TypeError")
  const input = urlArgument(args[0], `URL.${name} input`)
  const base =  P.isUndefined(args[1]) ? undefined : urlArgument(args[1], `URL.${name} base`)
  try {
    const url = new URL(input, base)
    return UrlStatic.is.canParse(name) ? true : CodeModeURL.new(url)
  } catch {
    return UrlStatic.is.canParse(name) ? false : null
  }
}

export const invokeURLMethod = (value: CodeModeURL, _name: UrlMethod, _node: AstNode): string =>
  value.url.href;
