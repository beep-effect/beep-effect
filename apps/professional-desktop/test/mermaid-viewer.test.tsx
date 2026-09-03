import { MermaidView } from "@beep/editor/mermaid-view";
import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { afterAll, afterEach, beforeAll, describe, expect } from "vitest";

const mermaidDocument = MdModel.Document.make({
  children: [
    MdModel.P.make({ children: [MdModel.Text.make({ value: "Here is the flow:" })] }),
    MdModel.Pre.make({ value: "graph TD\n  A[Start] --> B[End]", language: O.some("mermaid") }),
  ],
});

const state = documentToEditorState(mermaidDocument).pipe(Effect.runSync);

const originalGetBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, "getBBox");
const originalComputedTextLength = Object.getOwnPropertyDescriptor(SVGElement.prototype, "getComputedTextLength");

describe("persisted mermaid rendering", { concurrent: false }, () => {
  beforeAll(() => {
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: () => new DOMRect(0, 0, 100, 20),
    });
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", {
      configurable: true,
      value: () => 100,
    });
  });

  afterAll(() => {
    if (originalGetBBox === undefined) {
      Reflect.deleteProperty(SVGElement.prototype, "getBBox");
    } else {
      Object.defineProperty(SVGElement.prototype, "getBBox", originalGetBBox);
    }
    if (originalComputedTextLength === undefined) {
      Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength");
    } else {
      Object.defineProperty(SVGElement.prototype, "getComputedTextLength", originalComputedTextLength);
    }
  });

  afterEach(cleanup);

  const expectInertDiagram = (container: HTMLElement): void => {
    expect(
      container.querySelector(
        "a, animate, animateMotion, animateTransform, audio, base, button, canvas, discard, embed, feImage, foreignObject, form, iframe, image, img, input, link, meta, object, script, set, source, video"
      )
    ).toBeNull();
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
        waitFor(
          () => {
            expect(screen.getByTestId("mermaid-diagram").querySelector("svg")).toBeInTheDocument();
          },
          { timeout: 4_000 }
        )
      );

      const svg = screen.getByTestId("mermaid-diagram").querySelector("svg");
      expect(svg?.id).toMatch(/^mermaid-/u);
      expect(svg).toHaveAttribute("role", "graphics-document document");
      expect(svg).toHaveAccessibleName("Mermaid diagram");
      expect(svg).toHaveAccessibleDescription("Mermaid diagram source:\ngraph TD A[Start] --> B[End]");
      const description = svg?.querySelector("desc");
      expect(description).toHaveAttribute("id", svg?.getAttribute("aria-describedby"));
      expect(description).toHaveTextContent("graph TD A[Start] --> B[End]");
      expect(svg?.querySelector("style")?.textContent).not.toContain("@keyframes");
      expect(screen.queryByText("Diagram output did not satisfy the desktop safety policy.")).not.toBeInTheDocument();

      // The diagram IS the node now. A leftover <code> element means the old
      // hide-and-inject path is back -- and that is the shape that renders a blank
      // gap in a real browser, where Lexical reconciles the injected div away.
      expect(container.querySelector("code[data-language='mermaid']")).toBeNull();
    })
  );

  it.effect(
    "preserves authored Mermaid accessibility text",
    Effect.fnUntraced(function* () {
      const source = [
        "graph TD",
        "accTitle: Checkout flow",
        "accDescr: Start proceeds to End",
        "A[Start] --> B[End]",
      ].join("\n");
      const { container } = render(<MermaidView renderKey="authored-accessibility" source={source} />);
      const screen = within(container);

      yield* Effect.promise(() =>
        waitFor(() => {
          expect(screen.getByTestId("mermaid-diagram").querySelector("svg")).toBeInTheDocument();
        })
      );

      const svg = screen.getByTestId("mermaid-diagram").querySelector("svg");
      const title = svg?.querySelector("title");
      const description = svg?.querySelector("desc");
      expect(title).toHaveTextContent("Checkout flow");
      expect(description).toHaveTextContent("Start proceeds to End");
      expect(svg).toHaveAccessibleName("Checkout flow");
      expect(svg).toHaveAccessibleDescription("Start proceeds to End");
      expect(svg).toHaveAttribute("aria-labelledby", title?.id);
      expect(svg).toHaveAttribute("aria-describedby", description?.id);
      expect(svg).not.toHaveAttribute("aria-label");
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
    "locks ampersand theme CSS directives out of generated diagram styles",
    Effect.fnUntraced(function* () {
      const source =
        '%%{init: {"themeCSS": "& { position: fixed; inset: 0; z-index: 2147483647; pointer-events: all; }"}}%%\ngraph TD\nA-->B';
      const { container } = render(<MermaidView renderKey="theme-css-ampersand" source={source} />);
      const screen = within(container);

      yield* Effect.promise(() =>
        waitFor(() => {
          expect(screen.getByTestId("mermaid-diagram").querySelector("svg")).toBeInTheDocument();
        })
      );

      const svg = screen.getByTestId("mermaid-diagram").querySelector("svg");
      const styles = Array.from(svg?.querySelectorAll("style") ?? [], (style) => style.textContent ?? "").join("\n");
      expect(styles).not.toMatch(/position\s*:\s*fixed|inset\s*:|z-index\s*:\s*2147483647|pointer-events\s*:\s*all/iu);
      expect(globalThis.getComputedStyle(svg as SVGSVGElement).position).not.toBe("fixed");
      expectInertDiagram(container);
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
