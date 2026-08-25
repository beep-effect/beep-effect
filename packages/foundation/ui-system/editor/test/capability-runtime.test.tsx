// @vitest-environment jsdom
import { editorCapabilityCatalog } from "@beep/editor/capability/catalog";
import { CapabilityComposer } from "@beep/editor/capability/composer";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { chordFromKeyboardEvent } from "@beep/editor/capability/runtime";
import { CapabilityId, EditorProfile, ProfileId } from "@beep/editor/capability/schemas";
import { decodeEditorStateForRuntimeResult } from "@beep/editor/runtime";
import { documentToEditorState, editorStateToDocument } from "@beep/lexical-schema";
import * as Md from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "@effect/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { afterEach } from "vitest";

afterEach(cleanup);
const chord = (event: KeyboardEvent, platform: "apple" | "windows-linux") =>
  O.getOrThrow(chordFromKeyboardEvent(event, platform));

describe("capability runtime", { concurrent: false }, () => {
  it.effect(
    "normalizes keyboard letters, code digits, punctuation, and Apple meta",
    Effect.fnUntraced(function* () {
      expect(chord(new KeyboardEvent("keydown", { key: "B", ctrlKey: true }), "windows-linux")).toMatchObject({
        modifiers: ["control"],
        key: "b",
      });
      expect(
        chord(
          new KeyboardEvent("keydown", { key: "&", code: "Digit7", ctrlKey: true, shiftKey: true }),
          "windows-linux"
        )
      ).toMatchObject({ modifiers: ["control", "shift"], key: "7" });
      expect(chord(new KeyboardEvent("keydown", { key: "\\", ctrlKey: true }), "windows-linux")).toMatchObject({
        key: "\\",
      });
      expect(chord(new KeyboardEvent("keydown", { key: "b", metaKey: true }), "apple")).toMatchObject({
        modifiers: ["meta"],
        key: "b",
      });
      yield* Effect.void;
    })
  );

  it.effect(
    "keeps runtime-incompatible initial state readable as escaped wire instead of an empty editor",
    Effect.fnUntraced(function* () {
      // A decoded state that later grows a future node is wire-shaped but
      // rejected by the strict runtime decoder (same construction as
      // test/runtime.test.ts).
      const futureWire = Result.getOrThrow(
        decodeEditorStateForRuntimeResult({
          root: {
            type: "root",
            version: 1,
            direction: null,
            format: "",
            indent: 0,
            children: [{ type: "paragraph", version: 1, children: [], direction: null, format: "", indent: 0 }],
          },
        })
      );
      Reflect.set(futureWire.root.children, 1, { type: "future-block", version: 1 });
      const { container } = render(
        <CapabilityComposer
          profile={referenceProfiles.minimal}
          catalog={editorCapabilityCatalog}
          initialState={futureWire}
        />
      );
      expect(document.querySelector("[contenteditable='true']")).toBeNull();
      expect(container.textContent).toContain("future-block");
      yield* Effect.void;
    })
  );

  it.effect(
    "renders a resolution alert without mounting an editor",
    Effect.fnUntraced(function* () {
      const invalid = EditorProfile.make({
        id: ProfileId.make("editor.invalid"),
        capabilities: [CapabilityId.make("authoring.undo")],
        keybindingOverrides: [],
      });
      render(<CapabilityComposer profile={invalid} catalog={editorCapabilityCatalog} />);
      expect(screen.getByRole("alert")).toHaveTextContent("MissingDependencyError");
      expect(document.querySelector("[contenteditable]")).toBeNull();
      yield* Effect.void;
    })
  );

  it.effect(
    "guards underline while allowing bold",
    Effect.fnUntraced(function* () {
      type State = Parameters<NonNullable<React.ComponentProps<typeof CapabilityComposer>["onSerializedChange"]>>[0];
      let latest: O.Option<State> = O.none();
      const initial = yield* documentToEditorState(
        Md.Document.make({ children: [Md.P.make({ children: [Md.Text.make({ value: "proof" })] })] })
      );
      render(
        <CapabilityComposer
          profile={referenceProfiles.documentProof}
          initialState={initial}
          platform="windows-linux"
          onSerializedChange={(state) => {
            latest = O.some(state);
          }}
        />
      );
      const editable = screen.getByRole("textbox");
      fireEvent.click(editable);
      const underline = new KeyboardEvent("keydown", { key: "u", code: "KeyU", ctrlKey: true, cancelable: true });
      const bold = new KeyboardEvent("keydown", { key: "b", code: "KeyB", ctrlKey: true, cancelable: true });
      editable.dispatchEvent(underline);
      editable.dispatchEvent(bold);
      expect(underline.defaultPrevented).toBe(true);
      expect(bold.defaultPrevented).toBe(true);
      const hasBit = (state: State, bit: number): boolean =>
        A.some(
          state.root.children,
          (block) =>
            "children" in block && A.some(block.children, (node) => node.type === "text" && (node.format & bit) !== 0)
        );
      expect(O.exists(latest, (state) => hasBit(state, 8))).toBe(false);
      yield* Effect.void;
    })
  );

  it.effect(
    "preserves the canonical document through a remount transaction",
    Effect.fnUntraced(function* () {
      const canonical = Md.Document.make({
        children: [Md.Heading.make({ level: 1, children: [Md.Text.make({ value: "Proof" })] })],
      });
      const first = yield* documentToEditorState(canonical);
      const projected = editorStateToDocument(first);
      const second = yield* documentToEditorState(projected);
      expect(editorStateToDocument(second)).toEqual(canonical);
    })
  );
});
