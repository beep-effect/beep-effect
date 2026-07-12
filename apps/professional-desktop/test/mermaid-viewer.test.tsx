import { EditorViewer } from "@beep/editor";
import { documentToEditorState } from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { afterEach, describe, expect, it } from "vitest";

const mermaidDocument = MdModel.Document.make({
  children: [
    MdModel.P.make({ children: [MdModel.Text.make({ value: "Here is the flow:" })] }),
    MdModel.Pre.make({ value: "graph TD\n  A[Start] --> B[End]", language: O.some("mermaid") }),
  ],
});

const state = documentToEditorState(mermaidDocument).pipe(Effect.runSync);

describe("persisted mermaid rendering", { concurrent: false }, () => {
  afterEach(cleanup);

  it("never hides the diagram source without putting something in its place", async () => {
    // The decorator hides the mermaid <code> and portals a MermaidView in next to
    // it. If the portal never mounts, the block is hidden with nothing to replace
    // it and the message renders a hole where the diagram should be -- the reader
    // cannot even fall back to reading the source.
    const { container } = render(<EditorViewer state={state} />);
    const screen = within(container);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-diagram")).toBeInTheDocument();
    });
  });
});
