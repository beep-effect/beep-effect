import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import { cleanup, render } from "@testing-library/react";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const document = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "a message already on screen" })] })],
});

const encodeEditorState = S.encodeEffect(SerializedEditorState);
const EncodedState = S.toEncoded(SerializedEditorState);
const isEncodedState = S.is(EncodedState);
const equivalentEncodedState = S.toEquivalence(EncodedState);

describe("the viewer encodes a message once", { concurrent: false }, () => {
  afterEach(cleanup);

  it.effect(
    "does not re-serialize an unchanged state on every render",
    Effect.fnUntraced(function* () {
      const state = yield* documentToEditorState(document);
      const encodedState = yield* encodeEditorState(state);
      const spy = vi.spyOn(JSON, "stringify");
      yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
      const countSubjectEncodes = () =>
        A.filter(spy.mock.calls, ([value]) => isEncodedState(value) && equivalentEncodedState(value, encodedState))
          .length;

      const { rerender } = render(<EditorViewer state={state} />);
      const afterFirst = spy.mock.calls.length;
      const subjectAfterFirst = countSubjectEncodes();
      expect(subjectAfterFirst).toBeGreaterThan(0);

      rerender(<EditorViewer state={state} />);
      rerender(<EditorViewer state={state} />);
      rerender(<EditorViewer state={state} />);

      const afterRerenders = spy.mock.calls.length;
      const subjectAfterRerenders = countSubjectEncodes();
      spy.mockRestore();

      expect(afterRerenders - afterFirst, "some stringify calls come from Lexical itself").toBeLessThan(afterFirst);
      expect(
        subjectAfterRerenders,
        "a streaming transcript re-renders the same state per block; the viewer must not serialize it again each time"
      ).toBe(subjectAfterFirst);

      yield* Effect.void;
    })
  );
});
