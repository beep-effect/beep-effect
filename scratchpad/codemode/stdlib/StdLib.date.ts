import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts"
import { CodeModeDate } from "../Codemode.values.ts"
import { coerceToNumber, coerceToString } from "./StdLib.value.ts"
import { LiteralKit } from "@beep/schema"
import { O } from "@beep/utils"
import { DateTime } from "effect"
import * as S from "effect/Schema"
import {
  type DateMethod,
  type DateStatic,
  DateSetterArity,
  DateSetterName,
  dateMethods,
  dateStatics,
} from "../Codemode.method-names.ts"

export {
  dateMethods,
  dateStatics,
} from "../Codemode.method-names.ts"

const DirectDateStatic = LiteralKit(dateStatics.omitOptions(["now"]))
type DirectDateStatic = Exclude<DateStatic, "now">;

// Date.parse / Date.UTC are guest JavaScript semantic adapters. Date.now is
// dispatched effectfully by Interpreter through the Clock-backed DateTime.now.
export const invokeDateStatic = (name: DirectDateStatic, args: Array<unknown>, _node: AstNode): number =>
  DirectDateStatic.$match(name, {
    parse: () => Date.parse(coerceToString(args[0])),
    UTC: () => Reflect.apply(Date.UTC, Date, args.map(coerceToNumber)),
  });

export const dateSetterArgumentCount = (name: DateMethod): O.Option<1 | 2 | 3 | 4> =>
  S.is(DateSetterName)(name)
    ? O.some(DateSetterArity[name])
    : O.none();

export const invokeDateMethod = (
  value: CodeModeDate,
  name: DateMethod,
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
