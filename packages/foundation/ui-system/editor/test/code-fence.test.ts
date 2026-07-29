import { sendKeyBindingAtom } from "@beep/editor/chat/atoms";
import { SEND_MESSAGE_COMMAND } from "@beep/editor/chat/commands";
import { editorNodes } from "@beep/editor/nodes";
import { describe, expect, it } from "@effect/vitest";
import { $isCodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { AtomRegistry } from "effect/unstable/reactivity";
import { $createParagraphNode, $createTextNode, $getRoot, COMMAND_PRIORITY_LOW, KEY_ENTER_COMMAND } from "lexical";
import type { LexicalEditor } from "lexical";

const makeEditor = (): LexicalEditor =>
  createHeadlessEditor({
    namespace: "code-fence-test",
    nodes: [...editorNodes],
    onError: (error) => {
      throw error;
    },
  });

/** Seed the composer with one paragraph and put the caret at the end of it. */
const typeParagraph = (editor: LexicalEditor, text: string): void =>
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      const textNode = $createTextNode(text);
      paragraph.append(textNode);
      $getRoot().clear().append(paragraph);
      textNode.select(text.length, text.length);
    },
    { discrete: true }
  );

/**
 * Press Enter the way the composer's key binding sees it, and report whether the
 * message was sent. Drives the real `sendKeyBindingAtom`, so a fence that the binding
 * never consults fails here.
 */
const pressEnter = (editor: LexicalEditor, modifiers: Partial<KeyboardEvent> = {}): boolean => {
  const registry = AtomRegistry.make();
  const unmount = registry.mount(sendKeyBindingAtom(editor));

  let sent = false;
  const unregister = editor.registerCommand(
    SEND_MESSAGE_COMMAND,
    () => {
      sent = true;
      return true;
    },
    COMMAND_PRIORITY_LOW
  );

  const event = {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    keyCode: 13,
    metaKey: false,
    preventDefault: () => undefined,
    shiftKey: false,
    ...modifiers,
  } as unknown as KeyboardEvent;

  // Dispatched inside a discrete update: on its own, `dispatchCommand` commits the
  // state the handler produced asynchronously, and a read straight afterwards still
  // sees the editor as it was before the keystroke.
  editor.update(
    () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, event);
    },
    { discrete: true }
  );

  unregister();
  unmount();
  return sent;
};

const firstChildIsCode = (editor: LexicalEditor): boolean =>
  editor.getEditorState().read(() => $isCodeNode($getRoot().getFirstChild()));

const codeLanguage = (editor: LexicalEditor): null | string | undefined =>
  editor.getEditorState().read(() => {
    const first = $getRoot().getFirstChild();
    return $isCodeNode(first) ? first.getLanguage() : undefined;
  });

describe("the code fence in a composer where Enter sends", () => {
  it("opens a code block instead of sending the backticks", () => {
    // `@lexical/markdown` already knows this gesture — it just never sees it here.
    // Its shortcut fires on a trailing space or on plain Enter, and this composer
    // consumes Enter at COMMAND_PRIORITY_HIGH to send. So typing ```ts and pressing
    // Enter posted the literal backticks as a message, and the one way anybody writes
    // a code block did not work at all.
    const editor = makeEditor();
    typeParagraph(editor, "```ts");

    expect(pressEnter(editor)).toBe(false);
    expect(firstChildIsCode(editor)).toBe(true);
    expect(codeLanguage(editor)).toBe("ts");
  });

  it("takes the fence on Shift+Enter too", () => {
    // Shift+Enter is this composer's newline, and `@lexical/markdown` bails outright
    // when shiftKey is held — so even the plugin's own handler could never have taken
    // it. It is also the gesture a user reaches for after typing the opener.
    const editor = makeEditor();
    typeParagraph(editor, "```");

    expect(pressEnter(editor, { shiftKey: true })).toBe(false);
    expect(firstChildIsCode(editor)).toBe(true);
  });

  it("leaves Enter alone when the caret is not at the end of the opener", () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode("```ts");
        paragraph.append(textNode);
        $getRoot().clear().append(paragraph);
        textNode.select(2, 2);
      },
      { discrete: true }
    );

    expect(pressEnter(editor)).toBe(true);
    expect(firstChildIsCode(editor)).toBe(false);
  });

  it("does not mistake prose that merely starts with backticks for a fence", () => {
    const editor = makeEditor();
    typeParagraph(editor, "```ts is how you open a code block");

    expect(pressEnter(editor)).toBe(true);
    expect(firstChildIsCode(editor)).toBe(false);
  });

  it("still sends an ordinary message", () => {
    const editor = makeEditor();
    typeParagraph(editor, "hello");

    expect(pressEnter(editor)).toBe(true);
  });
});

describe("Enter inside a code block", () => {
  it("is a newline, not a send", () => {
    // A composer that sent on Enter inside a code block would let you write exactly
    // one line of code — which makes the block the fence just opened useless.
    const editor = makeEditor();
    typeParagraph(editor, "```ts");
    pressEnter(editor);

    expect(pressEnter(editor)).toBe(false);
  });

  it("still sends on Cmd/Ctrl+Enter, so the block is not a trap", () => {
    const editor = makeEditor();
    typeParagraph(editor, "```ts");
    pressEnter(editor);

    expect(pressEnter(editor, { metaKey: true })).toBe(true);
  });
});
