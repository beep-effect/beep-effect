import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts"
import * as S from "effect/Schema"
import {
  stringStatics,
} from "../Codemode.method-names.ts"

export {
  stringMethods,
  stringStatics,
} from "../Codemode.method-names.ts"

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
