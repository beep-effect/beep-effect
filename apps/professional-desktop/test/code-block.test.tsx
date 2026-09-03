import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { afterEach, describe, expect } from "vitest";

const LONG_LINE = `const result = await fetch("https://example.test/a/very/long/url/that/keeps/going/and/going?with=params&and=more");`;

const document = MdModel.Document.make({
  children: [
    MdModel.P.make({ children: [MdModel.Text.make({ value: "Here:" })] }),
    MdModel.Pre.make({ value: LONG_LINE, language: O.some("typescript") }),
  ],
});

const state = documentToEditorState(document).pipe(Effect.runSync);

describe("persisted code blocks", { concurrent: false }, () => {
  afterEach(cleanup);

  it.effect(
    "are copyable, and scroll rather than wrap",
    Effect.fnUntraced(function* () {
      // Lexical renders code inside a contenteditable whose `white-space` is
      // `pre-wrap`, so a long line folded back on itself instead of scrolling — code
      // that wraps at an arbitrary column has to be reassembled in the reader's head.
      // And there was no way to take it: the only way to use a snippet the assistant
      // wrote was to select it by hand and hope the selection missed the prose.
      const { container } = render(<EditorViewer state={state} />);
      const screen = within(container);

      const block = yield* Effect.promise(() => waitFor(() => screen.getByTestId("code-block")));

      expect(block).toHaveTextContent("const result = await fetch");
      expect(screen.getByTestId("code-block-copy")).toBeInTheDocument();

      // The code does not wrap, and its container is what scrolls.
      const code = block.querySelector("code");
      expect(code?.className).toContain("whitespace-pre");
      expect(block.querySelector("pre")?.className).toContain("overflow-x-auto");
    })
  );
});
