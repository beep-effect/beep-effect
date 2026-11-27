import { sendKeyBindingAtom } from "@beep/editor/chat/atoms";
import { SEND_MESSAGE_COMMAND } from "@beep/editor/chat/commands";
import { editorNodes } from "@beep/editor/nodes";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { $isCodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { pipe } from "effect/Function";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
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

const typeParagraphAtEnd = (editor: LexicalEditor, text: string): void =>
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

const dispatchComposerEnter = (editor: LexicalEditor, modifiers: Partial<KeyboardEvent> = {}): boolean => {
  const registry = AtomRegistry.make();
  try {
    const unmount = registry.mount(sendKeyBindingAtom(editor));
    try {
      let sent = false;
      const unregister = editor.registerCommand(
        SEND_MESSAGE_COMMAND,
        () => {
          sent = true;
          return true;
        },
        COMMAND_PRIORITY_LOW
      );

      try {
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

        editor.update(
          () => {
            editor.dispatchCommand(KEY_ENTER_COMMAND, event);
          },
          { discrete: true }
        );

        return sent;
      } finally {
        unregister();
      }
    } finally {
      unmount();
    }
  } finally {
    registry.dispose();
  }
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
    const editor = makeEditor();
    typeParagraphAtEnd(editor, "```ts");

    assertFalse(
      dispatchComposerEnter(editor),
      "The high-priority composer handles fence Enter before the lower-priority markdown shortcut can see it."
    );
    assertTrue(firstChildIsCode(editor), "The composer must open the fence before its send binding consumes Enter.");
    expect(
      codeLanguage(editor),
      "Discrete updates commit command results synchronously; a bare dispatch would leave this immediate read stale."
    ).toBe("ts");
  });

  it("takes the fence on Shift+Enter too", () => {
    const editor = makeEditor();
    typeParagraphAtEnd(editor, "```");

    pipe(dispatchComposerEnter(editor, { shiftKey: true }), assertFalse);
    assertTrue(
      firstChildIsCode(editor),
      "The markdown plugin ignores shiftKey, so the composer must handle a Shift+Enter fence itself."
    );
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

    pipe(dispatchComposerEnter(editor), assertTrue);
    pipe(firstChildIsCode(editor), assertFalse);
  });

  it("does not mistake prose that merely starts with backticks for a fence", () => {
    const editor = makeEditor();
    typeParagraphAtEnd(editor, "```ts is how you open a code block");

    pipe(dispatchComposerEnter(editor), assertTrue);
    pipe(firstChildIsCode(editor), assertFalse);
  });

  it("still sends an ordinary message", () => {
    const editor = makeEditor();
    typeParagraphAtEnd(editor, "hello");

    pipe(dispatchComposerEnter(editor), assertTrue);
  });
});

describe("Enter inside a code block", () => {
  it("keeps Enter available for multiple code lines instead of sending", () => {
    const editor = makeEditor();
    typeParagraphAtEnd(editor, "```ts");
    dispatchComposerEnter(editor);

    assertFalse(
      dispatchComposerEnter(editor),
      "Enter must remain a newline inside a code block so the user can write more than one line."
    );
  });

  it("still sends on Cmd/Ctrl+Enter, so the block is not a trap", () => {
    const editor = makeEditor();
    typeParagraphAtEnd(editor, "```ts");
    dispatchComposerEnter(editor);

    pipe(dispatchComposerEnter(editor, { metaKey: true }), assertTrue);
  });
});
