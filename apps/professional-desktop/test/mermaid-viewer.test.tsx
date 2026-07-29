import { MermaidView } from "@beep/editor/mermaid-view";
import { EditorViewer } from "@beep/editor/viewer";
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

  const expectInertDiagram = (container: HTMLElement): void => {
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror], [onload], [onclick], [onfocus]")).toBeNull();
    expect(
      container.querySelector(
        '[href^="javascript:"], [xlink\\:href^="javascript:"], [href^="data:text/html"], [src^="javascript:"]'
      )
    ).toBeNull();
  };

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

  it.effect(
    "keeps the strict-mode adversarial corpus inert",
    Effect.fnUntraced(function* () {
      const corpus = [
        `graph TD\nA["<script>alert(1)</script>"] --> B`,
        `graph TD\nA["<img src=x onerror=alert(1)>"] --> B`,
        `graph TD\nA --> B\nclick A "javascript:alert(1)"`,
        `%%{init: {"securityLevel": "loose", "htmlLabels": true}}%%\ngraph TD\nA["<img src=x onerror=alert(1)>"]`,
        `graph TD\nA["<foreignObject><script>alert(1)</script></foreignObject>"]`,
      ];

      for (const [index, source] of corpus.entries()) {
        const { container, unmount } = render(<MermaidView renderKey={`adversarial-${index}`} source={source} />);
        yield* Effect.promise(() =>
          waitFor(() => {
            expect(within(container).getByTestId("mermaid-diagram")).toBeInTheDocument();
            expect(within(container).queryByText("Rendering diagram...")).not.toBeInTheDocument();
          })
        );
        expectInertDiagram(container);
        unmount();
      }
    })
  );

  it.effect(
    "refuses oversized source before rendering and escapes it as text",
    Effect.fnUntraced(function* () {
      const source = `<script data-diagram-xss="no">${"x".repeat(20_001)}</script>`;
      const { container } = render(<MermaidView renderKey="oversized" source={source} />);

      yield* Effect.promise(() =>
        waitFor(() => expect(within(container).getByText(/Diagram source is too large/u)).toBeInTheDocument())
      );
      expect(container.querySelector("script")).toBeNull();
      expect(within(container).getByTestId("mermaid-diagram")).toHaveTextContent("<script");
    })
  );
});
