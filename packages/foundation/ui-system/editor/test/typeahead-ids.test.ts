import { typeaheadOptionId } from "@beep/editor/chat/atoms";
import { typeaheadMenuId } from "@beep/editor/chat/typeahead";
import { editorNodes } from "@beep/editor/nodes";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { createHeadlessEditor } from "@lexical/headless";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

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

it.prop(
  "keeps generated option ids stable and unique across composers and indices",
  [
    Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 10000 }))),
    Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 }))),
  ],
  ([index, offset]) => {
    const first = makeEditor();
    const second = makeEditor();
    const ids = [
      typeaheadOptionId(first, index),
      typeaheadOptionId(first, index + offset),
      typeaheadOptionId(second, index),
      typeaheadOptionId(second, index + offset),
    ];
    expect(new Set(ids).size).toBe(4);
    expect(typeaheadOptionId(first, index)).toBe(ids[0]);
    expect(typeaheadOptionId(second, index + offset)).toBe(ids[3]);
    for (const id of ids) expect(id).toMatch(/^\S+$/);
  },
  { arbitrary: fcRuns(100) }
);
