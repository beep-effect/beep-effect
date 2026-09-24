/**
 * Guest `String.fromCharCode` and `String.fromCodePoint` dispatch for the
 * CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as P from "effect/Predicate";
import { dual } from "effect/Function";
import { type StringStatic, stringStatics } from "../Codemode.method-names.ts";
import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts";

export {
  stringMethods,
  stringStatics,
} from "../Codemode.method-names.ts";

/**
 * Dispatches guest `String.fromCharCode` and `String.fromCodePoint`.
 *
 * **Gotchas**
 *
 * Every argument must be a number; non-numeric arguments throw. There is no
 * general String static table beyond these two constructors.
 *
 * **Example** (Build a string from char codes)
 *
 * ```ts
 * import { invokeStringStatic } from "../../../codemode/stdlib/StdLib.string.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeStringStatic("fromCharCode", [65, 66], node))
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export const invokeStringStatic: {
  (args: Array<unknown>, node: AstNode): (name: StringStatic) => unknown;
  (name: StringStatic, args: Array<unknown>, node: AstNode): unknown;
} = dual(3, (name: StringStatic, args: Array<unknown>, node: AstNode): unknown => {
  const codes = args.map((arg) => {
    if (!P.isNumber(arg)) throw InterpreterRuntimeError.new(`String.${name} expects number arguments.`, node);
    return arg;
  });
  return stringStatics.$match(name, {
    fromCharCode: () => String.fromCharCode(...codes),
    fromCodePoint: () => String.fromCodePoint(...codes),
  });
});
