/**
 * Runtime admission boundary for serialized Lexical state.
 *
 * @packageDocumentation \@beep/editor/runtime
 * @since 0.0.0
 */

import {
  decodeEditorStateStrictResult,
  LexicalDecodeError,
  SerializedEditorState,
} from "@beep/lexical-schema/Lexical.model";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";

const isSerializedEditorState = S.is(SerializedEditorState);
const encodeSerializedEditorState = S.encodeUnknownResult(SerializedEditorState);
const runtimeEditorStateValidationError = LexicalDecodeError.new(
  "Schema-decoded Lexical editor state failed runtime revalidation."
);

const revalidateSerializedEditorState = (
  state: SerializedEditorState
): Result.Result<SerializedEditorState, LexicalDecodeError> =>
  Result.try({
    try: () => encodeSerializedEditorState(state, { onExcessProperty: "error" }),
    catch: runtimeEditorStateValidationError,
  }).pipe(
    Result.flatMap(Result.mapError(runtimeEditorStateValidationError)),
    Result.map(() => state)
  );

/**
 * Synchronously admits a deeply revalidated decoded state or strictly decodes
 * unknown wire without throwing.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { decodeEditorStateForRuntimeResult } from "@beep/editor/runtime"
 *
 * const result = decodeEditorStateForRuntimeResult({
 *   root: {
 *     type: "root", version: 1, direction: null, format: "", indent: 0,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   },
 * })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEditorStateForRuntimeResult = (
  input: unknown
): Result.Result<SerializedEditorState, LexicalDecodeError> =>
  isSerializedEditorState(input) ? revalidateSerializedEditorState(input) : decodeEditorStateStrictResult(input);

/**
 * Admits a schema-decoded state or decodes unknown wire before it is passed to a
 * live Lexical editor or emitted through an editor persistence callback.
 *
 * Wire-valid but runtime-incompatible content, including empty roots and
 * future/extension nodes, is rejected by the strict semantic decoder. Use the
 * lexical compatibility decoder for a lossless read-only fallback; never
 * mount incompatible wire in Lexical.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { decodeEditorStateForRuntime } from "@beep/editor/runtime"
 *
 * const program = decodeEditorStateForRuntime({
 *   root: {
 *     type: "root", version: 1, direction: null, format: "", indent: 0,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   },
 * })
 * Effect.runPromise(program).then((state) => console.log(state.root.type)) // "root"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEditorStateForRuntime = (input: unknown): Effect.Effect<SerializedEditorState, LexicalDecodeError> =>
  Effect.fromResult(decodeEditorStateForRuntimeResult(input));
