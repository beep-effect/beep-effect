import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts"
import {
  type StringStatic,
  stringStatics,
} from "../Codemode.method-names.ts"

export {
  stringMethods,
  stringStatics,
} from "../Codemode.method-names.ts"

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const invokeStringStatic = (name: StringStatic, args: Array<unknown>, node: AstNode): unknown => {
  const codes = args.map((arg) => {
    if (typeof arg !== "number") throw InterpreterRuntimeError.new(`String.${name} expects number arguments.`, node)
    return arg
  })
  return stringStatics.$match(name, {
    fromCharCode: () => String.fromCharCode(...codes),
    fromCodePoint: () => String.fromCodePoint(...codes),
  })
}
