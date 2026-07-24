/**
 * The methods for the `@beep/codemode` interpreter module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { TaggedErrorClass } from "@beep/schema";
import { A, P, O, R, Str } from "@beep/utils";

const $I = $ScratchpadId.create("interpreter/Interpreter.methods");

