/**
 * The runtime reference type guards & predicates for the `@beep/codemode` interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { TaggedErrorClass } from "@beep/schema";
import { A, P, O, R, Str } from "@beep/utils";

const $I = $ScratchpadId.create("interpreter/Interpreter.references");

