/**
 * Enter-to-send key handling and the live character count.
 *
 * Per the deep-research a11y contract, Enter-to-send is suppressed while an IME
 * composition session is active (`KeyboardEvent.isComposing` or the legacy
 * `keyCode === 229` signal), so committing a CJK/diacritic candidate never
 * sends. The send keystroke itself is configurable via `sendOn`; both the key
 * handler and the send button dispatch the same
 * {@link SEND_MESSAGE_COMMAND}. Per the repo atom-first law the key registration
 * and the character count are per-editor `@effect/atom` bindings (no `useEffect`,
 * no `useState`); see {@link sendKeyBindingAtom} and {@link characterCountAtom}.
 *
 * @packageDocumentation \@beep/editor/chat/send
 * @since 0.0.0
 */

import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { characterCountAtom, sendKeyBindingAtom } from "./atoms.ts";

/**
 * Mounts the Enter-to-send handler for the current editor. The send policy
 * (`sendOn`) and the menu-open guard are read from the per-editor atoms, so the
 * plugin takes no props. With `sendOn="enter"`, plain Enter sends and any
 * modifier inserts a newline; with `sendOn="modifierEnter"`, Cmd/Ctrl+Enter
 * sends and plain Enter inserts a newline. Enter during IME composition never
 * sends, including legacy `keyCode === 229` events, and Enter while a typeahead
 * menu is open selects the option instead.
 *
 * @example
 * ```tsx
 * import { SendPlugin } from "@beep/editor/chat"
 *
 * function EnterToSend() {
 *   return <SendPlugin />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function SendPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useAtomMount(sendKeyBindingAtom(editor));
  return null;
}

/**
 * Live exact character count of the editor's plain text, updated as the user
 * types. Deterministic and testable (no token estimation). Backed by the
 * per-editor {@link characterCountAtom}.
 *
 * @example
 * ```tsx
 * import { useCharacterCount } from "@beep/editor/chat"
 *
 * function CharacterCounter() {
 *   const count = useCharacterCount()
 *   return <span>{count} characters</span>
 * }
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export function useCharacterCount(): number {
  const [editor] = useLexicalComposerContext();
  return useAtomValue(characterCountAtom(editor));
}
