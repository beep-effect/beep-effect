import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts"
import { SafeObject } from "@beep/schema"
import { isBlockedMember } from "../Codemode.tool-runtime.ts"
import { CodeModeRegExp } from "../Codemode.values.ts"
import { coerceToNumber, coerceToString } from "./StdLib.value.ts"
import { LiteralKit } from "@beep/schema"
import { P , R,} from "@beep/utils";
import * as S from "effect/Schema"
import {
  regexpMethods,
} from "../Codemode.method-names.ts"

export {
  regexpMethods,
  regexpStatics,
} from "../Codemode.method-names.ts"

type MatchValue = Array<unknown> & {
  index?: number
  groups?: SafeObject
  indices?: IndicesValue
}

type IndicesValue = Array<unknown> & {
  groups?: SafeObject
}

export const regexpProperties = LiteralKit([
  "source",
  "flags",
  "lastIndex",
  "hasIndices",
  "global",
  "ignoreCase",
  "multiline",
  "sticky",
  "unicode",
  "unicodeSets",
  "dotAll",
])

const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString)

export const regexFailureReason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/^Invalid regular expression:\s*/i, "")

export const escapeRegexHint =
  'To match special characters like ( ) [ ] { } + * ? . literally, escape them with a backslash (e.g. "\\\\(") or test for them with String.includes instead.'

export const toHostRegex = (arg: unknown, method: string, node: AstNode, extraFlags = ""): RegExp => {
  // Native parity: an undefined pattern behaves as an empty pattern.
  if (P.isUndefined(arg)) return new RegExp("", extraFlags)
  if (CodeModeRegExp.is(arg)) return arg.regex
  if (P.isString(arg)) {
    try {
      return new RegExp(arg, extraFlags)
    } catch (error) {
      throw InterpreterRuntimeError.new(
        `String.${method} received the string ${encodeJson(arg)}, which is not a valid regular expression pattern (${regexFailureReason(error)}). ${escapeRegexHint}`,
        node,
      ).as("SyntaxError")
    }
  }
  throw InterpreterRuntimeError.new(
    `String.${method} expects a regular expression (a /pattern/flags literal or new RegExp(...)) or a string pattern, not ${arg === null ? "null" : typeof arg}.`,
    node,
  )
}

export const matchToValue = (match: RegExpMatchArray): Array<unknown> => {
  const result: MatchValue = Array.from(match, (group) => group)
  if (P.isNotUndefined(match.index)) result.index = match.index
  if (P.isNotUndefined(match.groups)) {
    const groups = SafeObject.make(Object.create(null))
    for (const [key, group] of R.toEntries(match.groups)) {
      if (!isBlockedMember(key)) Reflect.set(groups, key, group)
    }
    result.groups = groups
  }
  if (P.isNotUndefined(match.indices)) result.indices = indicesToValue(match.indices)
  return result
}

export const invokeRegExpStatic = (name: string, args: Array<unknown>, node: AstNode): string => {
  if (name !== "escape") throw InterpreterRuntimeError.new(`RegExp.${name} is not available.`, node)
  if (!P.isString(args[0])) {
    throw InterpreterRuntimeError.new("RegExp.escape expects a string.", node).as("TypeError")
  }
  return RegExp.escape(args[0])
}

export const invokeRegExpMethod = (
  value: CodeModeRegExp,
  name: string,
  args: Array<unknown>,
  node: AstNode,
): unknown => {
  if (!S.is(regexpMethods)(name)) {
    throw InterpreterRuntimeError.new(`RegExp method '${name}' is not available.`, node)
  }
  const execute = (returnBoolean: boolean): unknown => {
    const input = coerceToString(args[0])
    const lastIndex = value.lastIndex
    const stateful = value.regex.global || value.regex.sticky
    value.regex.lastIndex = toLength(lastIndex)
    if (returnBoolean) {
      const matched = value.regex.test(input)
      if (!stateful) value.lastIndex = lastIndex
      return matched
    }
    const matched = value.regex.exec(input)
    if (!stateful) value.lastIndex = lastIndex
    return P.isNull(matched) ? null : matchToValue(matched)
  }
  return regexpMethods.$match(name, {
    test: () => execute(true),
    exec: () => execute(false),
    toString: () => coerceToString(value),
  })
}

const toLength = (value: unknown): number => {
  const number = coerceToNumber(value)
  if (Number.isNaN(number) || number <= 0) return 0
  return Math.min(Math.floor(number), Number.MAX_SAFE_INTEGER)
}

const indicesToValue = (indices: RegExpIndicesArray): IndicesValue => {
  const result: IndicesValue = Array.from(indices, (range) => (range === undefined ? undefined : [...range]))
  if (P.isNotUndefined(indices.groups)) {
    const groups = SafeObject.make(Object.create(null))
    for (const [key, range] of R.toEntries(indices.groups)) {
      if (!isBlockedMember(key)) {
        Reflect.set(groups, key, P.isUndefined(range) ? undefined : [...range])
      }
    }
    result.groups = groups
    return result
  }
  Reflect.set(result, "groups", undefined)
  return result
}
