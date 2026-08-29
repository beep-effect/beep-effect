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
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isSerializedEditorState = S.is(SerializedEditorState);
const encodeSerializedEditorState = S.encodeUnknownResult(SerializedEditorState);
const runtimeEditorStateValidationError = (cause: unknown): LexicalDecodeError =>
  LexicalDecodeError.make({
    cause,
    message: "Schema-decoded Lexical editor state failed runtime revalidation.",
  });

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
 * **Example** (Decode valid root state)
 *
 * ```ts import.meta.vitest name="Decode valid root state"
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
 * Result.isSuccess(result) // => true
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
 * **Details**
 *
 * Wire-valid but runtime-incompatible content, including empty roots and
 * future/extension nodes, is rejected by the strict semantic decoder. Use the
 * lexical compatibility decoder for a lossless read-only fallback; never
 * mount incompatible wire in Lexical.
 *
 * **Example** (Effect decode of root state)
 *
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

/**
 * Admits an optional schema-decoded initial state for a live editor mount:
 * `None` when the state is absent or the strict runtime decoder rejects it,
 * so a composer can fall back to the read-only wire viewer instead of
 * mounting an empty editor.
 *
 * **Example** (Absent state stays None)
 *
 * ```ts import.meta.vitest name="Absent state stays None"
 * import * as O from "effect/Option"
 * import { runtimeInitialStateOption } from "@beep/editor/runtime"
 *
 * O.isNone(runtimeInitialStateOption(undefined)) // => true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const runtimeInitialStateOption = (
  initialState: SerializedEditorState | undefined
): O.Option<SerializedEditorState> =>
  O.flatMap(O.fromUndefinedOr(initialState), (state) => Result.getSuccess(decodeEditorStateForRuntimeResult(state)));
