import {
  type AstNode,
  InterpreterRuntimeError,
  UriFunction,
  UriFunctionName,
} from "../interpreter/Interpreter.model.ts"
import { CodeModeURL } from "../Codemode.values.ts"
import { boundedData, coerceToString } from "./StdLib.value.ts"
import { Result } from "effect"
import { LiteralKit } from "@beep/schema"
import * as S from "effect/Schema"
import { P, A } from "@beep/utils";
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

export const urlWritableProperties = LiteralKit([
  "href",
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

export const UrlMethod = LiteralKit(["toString", "toJSON"])
export const UrlStatic = LiteralKit(["canParse", "parse"])
export const UrlSearchParamsMethod = LiteralKit([
  "append",
  "delete",
  "get",
  "getAll",
  "has",
  "set",
  "sort",
  "forEach",
  "keys",
  "values",
  "entries",
  "toString",
])

export const uriArgument = (value: unknown, label: string): string => coerceToString(boundedData(value, label))

export const invokeUriFunction = (
  ref: UriFunction,
  args: Array<unknown>,
  node: AstNode
): Result.Result<string, InterpreterRuntimeError> => {
  const value = uriArgument(args[0], `${ref.name} input`)
  return Result.try({
    try: () =>
      UriFunctionName.$match(ref.name, {
        encodeURI: () => encodeURI(value),
        encodeURIComponent: () => encodeURIComponent(value),
        decodeURI: () => decodeURI(value),
        decodeURIComponent: () => decodeURIComponent(value),
      }),
    catch: (error) =>
      InterpreterRuntimeError.new(
        `${ref.name} received malformed URI data: ${error instanceof Error ? error.message : String(error)}`,
        node,
      ).as("URIError"),
  })
}

export const urlArgument = (value: unknown, label: string): string =>
  S.is(CodeModeURL)(value) ? value.url.href : uriArgument(value, label)

export const invokeURLStatic = (name: string, args: Array<unknown>, node: AstNode): unknown => {
  if (!S.is(UrlStatic)(name)) throw InterpreterRuntimeError.new(`URL.${name} is not available.`, node)
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

export const invokeURLMethod = (value: CodeModeURL, name: string, node: AstNode): string => {
  if (name === "toString" || name === "toJSON") return value.url.href
  throw InterpreterRuntimeError.new(`URL method '${name}' is not available.`, node)
}
