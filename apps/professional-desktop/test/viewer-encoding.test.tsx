import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, render } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, vi } from "vitest";

const document = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "a message already on screen" })] })],
});

const state = documentToEditorState(document).pipe(Effect.runSync);

describe("the viewer encodes a message once", { concurrent: false }, () => {
  afterEach(cleanup);

  it.effect(
    "does not re-serialize an unchanged state on every render",
    Effect.fnUntraced(function* () {
      // A transcript re-renders on every streamed block, and the viewer re-encoded on
      // each one — every message already on screen serialized again, from scratch, to
      // produce a string identical to the one it produced last time. The cost scaled
      // with the length of the conversation and was paid per frame of the answer.
      const spy = vi.spyOn(JSON, "stringify");

      const { rerender } = render(<EditorViewer state={state} />);
      const afterFirst = spy.mock.calls.length;

      // Re-render with the SAME state, the way a streaming transcript does.
      rerender(<EditorViewer state={state} />);
      rerender(<EditorViewer state={state} />);
      rerender(<EditorViewer state={state} />);

      const afterRerenders = spy.mock.calls.length;
      spy.mockRestore();

      // Some stringify calls come from Lexical itself; what must not happen is the
      // viewer serializing this state again, once per render, forever.
      expect(afterRerenders - afterFirst).toBeLessThan(afterFirst);

      yield* Effect.void;
    })
  );
});
