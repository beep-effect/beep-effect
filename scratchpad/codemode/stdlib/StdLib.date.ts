import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts"
import { CodeModeDate } from "../Codemode.values.ts"
import { coerceToNumber, coerceToString } from "./StdLib.value.ts"
import { LiteralKit } from "@beep/schema"
import { O } from "@beep/utils"
import { DateTime, Match } from "effect"
import * as S from "effect/Schema"
import {
  dateMethods,
  dateStatics,
  fourArgumentDateSetter,
  oneArgumentDateSetter,
  threeArgumentDateSetter,
  twoArgumentDateSetter,
} from "../Codemode.method-names.ts"

export {
  dateMethods,
  dateStatics,
} from "../Codemode.method-names.ts"

const DirectDateStatic = LiteralKit(dateStatics.omitOptions(["now"]))

export const invokeDateStatic = (name: string, args: Array<unknown>, node: AstNode): number => {
  if (!S.is(DirectDateStatic)(name)) {
    throw InterpreterRuntimeError.new(`Date.${name} is not available.`, node)
  }
  // Date.parse / Date.UTC are guest JavaScript semantic adapters. Date.now is
  // dispatched effectfully by Interpreter through the Clock-backed DateTime.now.
  return DirectDateStatic.$match(name, {
    parse: () => Date.parse(coerceToString(args[0])),
    UTC: () => Date.UTC(...(args.map((arg) => coerceToNumber(arg)) as Parameters<typeof Date.UTC>)),
  })
}

export const dateSetterArgumentCount = (name: string): O.Option<number> =>
  Match.value(name).pipe(
    Match.when(S.is(oneArgumentDateSetter), () => O.some(1)),
    Match.when(S.is(twoArgumentDateSetter), () => O.some(2)),
    Match.when(S.is(threeArgumentDateSetter), () => O.some(3)),
    Match.when(S.is(fourArgumentDateSetter), () => O.some(4)),
    Match.orElse(O.none<number>),
  )

export const invokeDateMethod = (
  value: CodeModeDate,
  name: string,
  args: Array<number>,
  node: AstNode,
  initialTime = value.time,
): unknown => {
  const hosted = DateTime.make(initialTime).pipe(
    O.match({
      onNone: () => {
        const invalid = DateTime.makeUnsafe(0).pipe(DateTime.toDate)
        invalid.setTime(Number.NaN)
        return invalid
      },
      onSome: DateTime.toDate,
    }),
  )
  if (!S.is(dateMethods)(name)) {
    throw InterpreterRuntimeError.new(`Date method '${name}' is not available.`, node)
  }
  return dateMethods.$match(name, {
    getTime: () => value.time,
    valueOf: () => value.time,
    toISOString: () => {
      if (!Number.isFinite(value.time)) throw InterpreterRuntimeError.new("Invalid time value.", node).as("RangeError")
      return hosted.toISOString()
    },
    toJSON: () => Number.isFinite(value.time) ? hosted.toISOString() : null,
    toString: () => coerceToString(value),
    toUTCString: () => hosted.toUTCString(),
    toGMTString: () => hosted.toUTCString(),
    getFullYear: () => hosted.getFullYear(),
    getMonth: () => hosted.getMonth(),
    getDate: () => hosted.getDate(),
    getDay: () => hosted.getDay(),
    getHours: () => hosted.getHours(),
    getMinutes: () => hosted.getMinutes(),
    getSeconds: () => hosted.getSeconds(),
    getMilliseconds: () => hosted.getMilliseconds(),
    getUTCFullYear: () => hosted.getUTCFullYear(),
    getUTCMonth: () => hosted.getUTCMonth(),
    getUTCDate: () => hosted.getUTCDate(),
    getUTCDay: () => hosted.getUTCDay(),
    getUTCHours: () => hosted.getUTCHours(),
    getUTCMinutes: () => hosted.getUTCMinutes(),
    getUTCSeconds: () => hosted.getUTCSeconds(),
    getUTCMilliseconds: () => hosted.getUTCMilliseconds(),
    getTimezoneOffset: () => hosted.getTimezoneOffset(),
    setTime: () => updateDate(value, hosted.setTime(args[0])),
    setMilliseconds: () => updateDate(value, hosted.setMilliseconds(args[0])),
    setUTCMilliseconds: () => updateDate(value, hosted.setUTCMilliseconds(args[0])),
    setSeconds: () => {
      if (args.length < 2) return updateDate(value, hosted.setSeconds(args[0]))
      return updateDate(value, hosted.setSeconds(args[0], args[1]))
    },
    setUTCSeconds: () => {
      if (args.length < 2) return updateDate(value, hosted.setUTCSeconds(args[0]))
      return updateDate(value, hosted.setUTCSeconds(args[0], args[1]))
    },
    setMinutes: () => {
      if (args.length < 2) return updateDate(value, hosted.setMinutes(args[0]))
      if (args.length < 3) return updateDate(value, hosted.setMinutes(args[0], args[1]))
      return updateDate(value, hosted.setMinutes(args[0], args[1], args[2]))
    },
    setUTCMinutes: () => {
      if (args.length < 2) return updateDate(value, hosted.setUTCMinutes(args[0]))
      if (args.length < 3) return updateDate(value, hosted.setUTCMinutes(args[0], args[1]))
      return updateDate(value, hosted.setUTCMinutes(args[0], args[1], args[2]))
    },
    setHours: () => {
      if (args.length < 2) return updateDate(value, hosted.setHours(args[0]))
      if (args.length < 3) return updateDate(value, hosted.setHours(args[0], args[1]))
      if (args.length < 4) return updateDate(value, hosted.setHours(args[0], args[1], args[2]))
      return updateDate(value, hosted.setHours(args[0], args[1], args[2], args[3]))
    },
    setUTCHours: () => {
      if (args.length < 2) return updateDate(value, hosted.setUTCHours(args[0]))
      if (args.length < 3) return updateDate(value, hosted.setUTCHours(args[0], args[1]))
      if (args.length < 4) return updateDate(value, hosted.setUTCHours(args[0], args[1], args[2]))
      return updateDate(value, hosted.setUTCHours(args[0], args[1], args[2], args[3]))
    },
    setDate: () => updateDate(value, hosted.setDate(args[0])),
    setUTCDate: () => updateDate(value, hosted.setUTCDate(args[0])),
    setMonth: () => {
      if (args.length < 2) return updateDate(value, hosted.setMonth(args[0]))
      return updateDate(value, hosted.setMonth(args[0], args[1]))
    },
    setUTCMonth: () => {
      if (args.length < 2) return updateDate(value, hosted.setUTCMonth(args[0]))
      return updateDate(value, hosted.setUTCMonth(args[0], args[1]))
    },
    setFullYear: () => {
      if (args.length < 2) return updateDate(value, hosted.setFullYear(args[0]))
      if (args.length < 3) return updateDate(value, hosted.setFullYear(args[0], args[1]))
      return updateDate(value, hosted.setFullYear(args[0], args[1], args[2]))
    },
    setUTCFullYear: () => {
      if (args.length < 2) return updateDate(value, hosted.setUTCFullYear(args[0]))
      if (args.length < 3) return updateDate(value, hosted.setUTCFullYear(args[0], args[1]))
      return updateDate(value, hosted.setUTCFullYear(args[0], args[1], args[2]))
    },
  })
}

const updateDate = (value: CodeModeDate, time: number): number => {
  value.time = time
  return time
}
