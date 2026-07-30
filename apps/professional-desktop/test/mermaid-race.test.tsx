import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { Effect } from "effect";
import { afterEach, describe, expect, vi } from "vitest";

interface PendingRender {
  readonly id: string;
  readonly promise: Promise<{ readonly svg: string }>;
  readonly resolve: (result: { readonly svg: string }) => void;
  readonly source: string;
}

const mermaidStub = vi.hoisted(() => {
  const pending = new Map<string, PendingRender>();
  return {
    initialize: vi.fn(),
    parse: vi.fn(() => Promise.resolve(true)),
    pending,
    render: vi.fn((id: string, source: string) => {
      const current = pending.get(source);
      if (current?.id === id) return current.promise;
      const deferred = Promise.withResolvers<{ readonly svg: string }>();
      pending.set(source, { id, promise: deferred.promise, resolve: deferred.resolve, source });
      return deferred.promise;
    }),
  };
});

const mermaidRootRole = "graphics-document document";

const mermaidSvg = (id: string, contents = ""): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" role="${mermaidRootRole}">${contents}</svg>`;

const getPendingRender = (source: string): PendingRender => {
  const pending = mermaidStub.pending.get(source);
  if (pending === undefined) throw new Error(`Missing pending Mermaid render for ${source}`);
  return pending;
};

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidStub.initialize,
    parse: mermaidStub.parse,
    render: mermaidStub.render,
  },
}));

import { MermaidView } from "@beep/editor/mermaid-view";

describe("Mermaid async ownership", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    mermaidStub.pending.clear();
    vi.clearAllMocks();
  });

  it.effect(
    "does not let an obsolete same-prefix, same-length render overwrite the current source",
    Effect.fnUntraced(function* () {
      const prefix = `graph TD\n${"A".repeat(80)}`;
      const first = `${prefix}\nX-->Y`;
      const second = `${prefix}\nP-->Q`;
      expect(first.length).toBe(second.length);

      const view = render(<MermaidView renderKey="replacement-race" source={first} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(first)).toBe(true)));
      const firstRender = mermaidStub.pending.get(first);
      expect(firstRender).toBeDefined();

      view.rerender(<MermaidView renderKey="replacement-race" source={second} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(second)).toBe(true)));
      const secondRender = mermaidStub.pending.get(second);
      expect(secondRender).toBeDefined();
      expect(firstRender?.id).not.toBe(secondRender?.id);

      yield* Effect.sync(() => {
        act(() => secondRender?.resolve({ svg: mermaidSvg(secondRender.id, '<g data-source="second"></g>') }));
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("[data-source]")).toHaveAttribute(
            "data-source",
            "second"
          )
        )
      );

      yield* Effect.sync(() => {
        act(() => firstRender?.resolve({ svg: mermaidSvg(firstRender.id, '<g data-source="first"></g>') }));
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("[data-source]")).toHaveAttribute(
            "data-source",
            "second"
          )
        )
      );
    })
  );

  it.effect(
    "leaves no sink behind when an obsolete render resolves after unmount",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nUnmount-->Done";
      const view = render(<MermaidView renderKey="unmount-race" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = mermaidStub.pending.get(source);

      view.unmount();
      yield* Effect.sync(() => {
        act(() => pending?.resolve({ svg: mermaidSvg(pending.id, '<g data-after-unmount="no"></g>') }));
      });
      yield* Effect.yieldNow;

      expect(view.container).toBeEmptyDOMElement();
    })
  );

  it.effect(
    "rejects active or foreign renderer output before the HTML sink",
    Effect.fnUntraced(function* () {
      const source = `graph TD\nA["<img src=x onerror=alert(1)>"] --> B`;
      const view = render(<MermaidView renderKey="unsafe-renderer-output" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));

      expect(mermaidStub.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlLabels: false,
          secure: expect.arrayContaining(["htmlLabels", "securityLevel"]),
        })
      );

      yield* Effect.sync(() => {
        const pending = getPendingRender(source);
        act(() =>
          pending.resolve({
            svg: mermaidSvg(pending.id, '<foreignObject><img src="x" onerror="alert(1)"></foreignObject>'),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
        )
      );

      expect(view.container.querySelector("svg, foreignObject, img, [onerror]")).toBeNull();
      expect(within(view.container).getByTestId("mermaid-diagram")).toHaveTextContent("<img");
    })
  );

  it.effect(
    "sanitizes the XML-versus-HTML parser differential before the HTML sink",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nXML-->HTML";
      const view = render(<MermaidView renderKey="parser-differential" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));

      yield* Effect.sync(() => {
        const pending = getPendingRender(source);
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              '<desc><style><![CDATA[</style><img src=x onerror="globalThis.__xss=1">]]></style></desc>'
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
        )
      );

      expect(view.container.querySelector("svg, img, [onerror]")).toBeNull();
    })
  );

  it.effect(
    "rejects stylesheet rules that can affect the containing document",
    Effect.fnUntraced(function* () {
      const attacks = [
        {
          key: "document-selector",
          stylesheet: (_renderId: string) => "body { display: none !important; }",
        },
        {
          key: "sibling-selector",
          stylesheet: (renderId: string) => `#${renderId} + #mermaid-outside { display: none !important; }`,
        },
        {
          key: "global-keyframes",
          stylesheet: (renderId: string) =>
            `#${renderId} .spinner { animation: global-spin 1s; } @keyframes global-spin { to { opacity: 0; } }`,
        },
        {
          key: "external-url",
          stylesheet: (renderId: string) =>
            `#${renderId} .spinner { background-image: url("https://attacker.invalid/pixel"); }`,
        },
      ];

      for (const attack of attacks) {
        const source = `graph TD\nCSS-->${attack.key}`;
        const view = render(
          <>
            <div id="mermaid-outside">Outside diagram</div>
            <MermaidView renderKey={attack.key} source={source} />
          </>
        );
        yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
        const pending = getPendingRender(source);

        yield* Effect.sync(() => {
          act(() =>
            pending.resolve({
              svg: mermaidSvg(pending.id, `<style>${attack.stylesheet(pending.id)}</style><g class="spinner"></g>`),
            })
          );
        });
        yield* Effect.promise(() =>
          waitFor(() =>
            expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
          )
        );

        expect(view.container.querySelector("svg, style")).toBeNull();
        expect(within(view.container).getByText("Outside diagram")).toBeVisible();
        expect(globalThis.getComputedStyle(document.body).display).not.toBe("none");
        view.unmount();
      }
    })
  );

  it.effect(
    "renders parse and render rejections through the typed async failure branch",
    Effect.fnUntraced(function* () {
      mermaidStub.parse.mockRejectedValueOnce(new Error("private parser detail"));
      const parseView = render(<MermaidView renderKey="parse-failure" source="not a graph" />);
      yield* Effect.promise(() =>
        waitFor(() => expect(within(parseView.container).getByText("Diagram could not be parsed.")))
      );
      expect(parseView.container).not.toHaveTextContent("private parser detail");
      parseView.unmount();

      mermaidStub.render.mockRejectedValueOnce(new Error("private renderer detail"));
      const renderView = render(<MermaidView renderKey="render-failure" source="graph TD\nA-->B" />);
      yield* Effect.promise(() =>
        waitFor(() => expect(within(renderView.container).getByText("Unable to render diagram.")))
      );
      expect(renderView.container).not.toHaveTextContent("private renderer detail");
    })
  );

  it.effect(
    "rejects oversized source through the typed async failure branch before Mermaid loads",
    Effect.fnUntraced(function* () {
      const source = "A".repeat(20_001);
      const view = render(<MermaidView renderKey="oversized" source={source} />);

      yield* Effect.promise(() =>
        waitFor(() => expect(within(view.container).getByText(/Diagram source is too large to render/iu)))
      );
      expect(mermaidStub.initialize).not.toHaveBeenCalled();
      expect(mermaidStub.render).not.toHaveBeenCalled();
    })
  );
});
