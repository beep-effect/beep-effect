/**
 * Shared document → serialized-editor-state projection atom.
 *
 * Projects an `@beep/md` {@link Md.Document} into a `@beep/lexical-schema`
 * serialized editor state through the shared professional Atom runtime (no
 * `Effect.runSyncExit` in component code per the repo atom-first law). The codec
 * is pure, so the backing effect resolves synchronously on first read — the
 * `AsyncResult` is `Success` immediately, with a codec failure surfacing as an
 * `AsyncResult.Failure`. Reused by `MessageView` (read-only render) and the
 * `Composer` (editor seed) so the projection lives in one place.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */
"use client";

import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type * as Md from "@beep/md/Md.model";

/**
 * Per-document serialized-editor-state projection, keyed by the `Md.Document`.
 *
 * **Example** (Check typeof is function)
 *
 * ```ts
 * import { documentEditorStateAtom } from "@/chat/ui/editor-state.atoms"
 *
 * console.log(typeof documentEditorStateAtom) // "function"
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const documentEditorStateAtom = Atom.family((content: Md.Document) =>
  professionalBrowserRuntime.atom(documentToEditorState(content))
);
