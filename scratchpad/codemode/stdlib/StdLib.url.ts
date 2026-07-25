import {
  type AstNode,
  InterpreterRuntimeError,
  UriFunction,
} from "../interpreter/Interpreter.model.ts"
import { CodeModeURL } from "../Codemode.values.ts"
import { boundedData, coerceToString } from "./StdLib.value.ts"
import { Result } from "effect"
import { LiteralKit } from "@beep/schema"
import * as S from "effect/Schema"

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

export const urlMethods = LiteralKit(["toString", "toJSON"])
export const urlStatics = LiteralKit(["canParse", "parse"])
export const urlSearchParamsMethods = LiteralKit([
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
      UriFunction.match(ref, {
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
  value instanceof CodeModeURL ? value.url.href : uriArgument(value, label)

export const invokeURLStatic = (name: string, args: Array<unknown>, node: AstNode): unknown => {
  if (!S.is(urlStatics)(name)) throw InterpreterRuntimeError.new(`URL.${name} is not available.`, node)
  if (args.length === 0) throw InterpreterRuntimeError.new(`URL.${name} requires a URL argument.`, node).as("TypeError")
  const input = urlArgument(args[0], `URL.${name} input`)
  const base = args[1] === undefined ? undefined : urlArgument(args[1], `URL.${name} base`)
  try {
    const url = new URL(input, base)
    return name === "canParse" ? true : CodeModeURL.new(url)
  } catch {
    return name === "canParse" ? false : null
  }
}

export const invokeURLMethod = (value: CodeModeURL, name: string, node: AstNode): string => {
  if (name === "toString" || name === "toJSON") return value.url.href
  throw InterpreterRuntimeError.new(`URL method '${name}' is not available.`, node)
}
