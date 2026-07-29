/**
 * Runtime admission boundary for serialized Lexical state.
 *
 * @packageDocumentation \@beep/editor/runtime
 * @since 0.0.0
 */

import { decodeEditorStateStrict, SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type { LexicalDecodeError } from "@beep/lexical-schema/Lexical.model";

const isSerializedEditorState = S.is(SerializedEditorState);

/**
 * Admits a schema-decoded state or decodes unknown wire before it is passed to a
 * live Lexical editor or emitted through an editor persistence callback.
 *
 * Wire-valid but runtime-incompatible future/extension nodes are rejected by
 * the strict semantic decoder. Use the lexical compatibility decoder for a
 * lossless read-only fallback; never mount incompatible wire in Lexical.
 *
 * @example
 * ```ts
 * import { decodeEditorStateForRuntime } from "@beep/editor/runtime"
 * import { Effect } from "effect"
 *
 * const exit = Effect.runSyncExit(
 *   decodeEditorStateForRuntime({
 *     root: { type: "root", version: 1, children: [], direction: null, format: "", indent: 0 },
 *   })
 * )
 * console.log(exit._tag) // "Success"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEditorStateForRuntime = (
  input: unknown
): Effect.Effect<SerializedEditorState, LexicalDecodeError> =>
  isSerializedEditorState(input) ? Effect.succeed(input) : decodeEditorStateStrict(input);
