import { EditorViewer } from "@beep/editor";
import { documentToEditorState } from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { afterEach, describe, expect } from "vitest";

const mermaidDocument = MdModel.Document.make({
  children: [
    MdModel.P.make({ children: [MdModel.Text.make({ value: "Here is the flow:" })] }),
    MdModel.Pre.make({ value: "graph TD\n  A[Start] --> B[End]", language: O.some("mermaid") }),
  ],
});

const state = documentToEditorState(mermaidDocument).pipe(Effect.runSync);

describe("persisted mermaid rendering", { concurrent: false }, () => {
  afterEach(cleanup);

  it.effect(
    "renders the diagram as a Lexical node, leaving no hidden source behind",
    Effect.fnUntraced(function* () {
      // The diagram used to be drawn by hiding the mermaid <code> and injecting a
      // sibling <div> into the contenteditable subtree to portal into. Lexical owns
      // and reconciles that subtree, so it removed the div: the source stayed hidden
      // with nothing in its place, and a persisted diagram rendered as a blank gap.
      // It rendered while streaming and vanished the moment it landed.
      const { container } = render(<EditorViewer state={state} />);
      const screen = within(container);

      yield* Effect.promise(() =>
        waitFor(() => {
          expect(screen.getByTestId("mermaid-diagram")).toBeInTheDocument();
        })
      );

      // The diagram IS the node now. A leftover <code> element means the old
      // hide-and-inject path is back -- and that is the shape that renders a blank
      // gap in a real browser, where Lexical reconciles the injected div away.
      expect(container.querySelector("code[data-language='mermaid']")).toBeNull();
    })
  );
});
