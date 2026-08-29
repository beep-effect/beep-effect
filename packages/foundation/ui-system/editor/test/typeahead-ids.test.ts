import { typeaheadOptionId } from "@beep/editor/chat/atoms";
import { typeaheadMenuId } from "@beep/editor/chat/typeahead";
import { editorNodes } from "@beep/editor/nodes";
import { describe, expect, it } from "@effect/vitest";
import { createHeadlessEditor } from "@lexical/headless";

const makeEditor = () =>
  createHeadlessEditor({
    namespace: "typeahead-ids-test",
    nodes: [...editorNodes],
    onError: (error) => {
      throw error;
    },
  });

describe("typeahead ids", () => {
  it("does not collide across composers", () => {
    // Lexical points the editor root's `aria-activedescendant` at a hardcoded
    // `typeahead-item-${index}`, so two composers on one page emitted the same ids for
    // their first option — and `aria-activedescendant` resolves document-wide, first
    // match wins. A screen reader in one composer could be told about an option
    // belonging to the other composer's menu.
    const first = makeEditor();
    const second = makeEditor();

    expect(typeaheadOptionId(first, 0)).not.toBe(typeaheadOptionId(second, 0));
  });

  it("still distinguishes the options within one composer", () => {
    const editor = makeEditor();

    expect(typeaheadOptionId(editor, 0)).not.toBe(typeaheadOptionId(editor, 1));
    expect(typeaheadOptionId(editor, 0)).not.toBe("typeahead-item-0");
  });

  it("keeps menu ids stable within one editor and distinct across composers", () => {
    const first = makeEditor();
    const second = makeEditor();

    expect(typeaheadMenuId(first)).toBe(typeaheadMenuId(first));
    expect(typeaheadMenuId(first)).not.toBe(typeaheadMenuId(second));
  });
});
