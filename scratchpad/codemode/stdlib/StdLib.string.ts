import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts"
import { LiteralKit } from "@beep/schema"
import * as S from "effect/Schema"

export const stringMethods = LiteralKit([
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimStart",
  "trimEnd",
  "split",
  "slice",
  "substring",
  "includes",
  "startsWith",
  "endsWith",
  "indexOf",
  "lastIndexOf",
  "replace",
  "replaceAll",
  "repeat",
  "padStart",
  "padEnd",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "at",
  "concat",
  "toString",
  "match",
  "matchAll",
  "search",
  "localeCompare",
  "normalize",
])

export const stringStatics = LiteralKit(["fromCharCode", "fromCodePoint"])

export const invokeStringStatic = (name: string, args: Array<unknown>, node: AstNode): unknown => {
  const codes = args.map((arg) => {
    if (typeof arg !== "number") throw InterpreterRuntimeError.new(`String.${name} expects number arguments.`, node)
    return arg
  })
  if (!S.is(stringStatics)(name)) {
    throw InterpreterRuntimeError.new(`String.${name} is not available.`, node)
  }
  return stringStatics.$match(name, {
    fromCharCode: () => String.fromCharCode(...codes),
    fromCodePoint: () => String.fromCodePoint(...codes),
  })
}
