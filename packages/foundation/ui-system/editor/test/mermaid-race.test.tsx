// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { A } from "@beep/utils";
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
      const next = { id, promise: deferred.promise, resolve: deferred.resolve, source };
      pending.set(source, next);
      return deferred.promise;
    }),
  };
});

const mermaidRootRole = "graphics-document document";

const mermaidSvg = (id: string, contents = ""): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="${id}" role="${mermaidRootRole}">${contents}</svg>`;

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
      expect(within(view.container).getByTestId("mermaid-diagram")).toHaveStyle({ contain: "paint" });

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
          secure: expect.arrayContaining([
            "htmlLabels",
            "securityLevel",
            "themeCSS",
            "themeVariables",
            "fontFamily",
            "altFontFamily",
            "fontSize",
          ]),
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
    "rejects escaped external CSS URLs in SVG presentation attributes",
    Effect.fnUntraced(function* () {
      const attacks = [
        ["fill", "u/**/\\72 l(https://attacker.invalid/fill)"],
        ["filter", "u\\72 l(https://attacker.invalid/filter)"],
        ["clip-path", "u\\72 l(https://attacker.invalid/clip-path)"],
        ["marker-start", "u\\72 l(https://attacker.invalid/marker-start)"],
      ] as const;

      for (const [attribute, value] of attacks) {
        const source = `graph TD\nPresentation-->${attribute}`;
        const view = render(<MermaidView renderKey={`presentation-${attribute}`} source={source} />);
        yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
        const pending = getPendingRender(source);

        yield* Effect.sync(() => {
          act(() =>
            pending.resolve({
              svg: mermaidSvg(pending.id, `<path ${attribute}="${value}" d="M0 0L1 1"></path>`),
            })
          );
        });
        yield* Effect.promise(() =>
          waitFor(() =>
            expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
          )
        );

        expect(view.container.querySelector("svg, path")).toBeNull();
        view.unmount();
      }
    })
  );

  it.effect(
    "retains CSS and URL fragments with unique targets inside the exact SVG",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nLocal-->Fragment";
      const view = render(<MermaidView renderKey="local-fragment-presentation" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              `<defs><linearGradient id="paint"></linearGradient><filter id="shadow"></filter><clipPath id="clip"></clipPath><marker id="marker"></marker><path id="shape" d="M0 0L1 1"></path></defs><path data-safe-fragments="yes" fill="u\\72 l(#paint)" filter="url(#shadow)" clip-path="url(&quot;#clip&quot;)" marker-start="url('#marker')" d="M0 0L1 1"></path><text><textPath data-safe-href="yes" href="#shape" xlink:href="#shape">Safe</textPath></text>`
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("[data-safe-fragments]"))
        )
      );

      const path = view.container.querySelector("[data-safe-fragments]");
      const paintId = view.container.querySelector("linearGradient")?.getAttribute("id");
      const shadowId = view.container.querySelector("filter")?.getAttribute("id");
      const clipId = view.container.querySelector("clipPath")?.getAttribute("id");
      const markerId = view.container.querySelector("marker")?.getAttribute("id");
      const shapeId = view.container.querySelector("defs path")?.getAttribute("id");
      expect(path).toHaveAttribute("data-safe-fragments", "yes");
      expect(path).toHaveAttribute("fill", `url(#${paintId})`);
      expect(path).toHaveAttribute("filter", `url(#${shadowId})`);
      expect(path).toHaveAttribute("clip-path", `url(#${clipId})`);
      expect(path).toHaveAttribute("marker-start", `url(#${markerId})`);
      expect(view.container.querySelector("[data-safe-href]")).toHaveAttribute("href", `#${shapeId}`);
      expect(view.container.querySelector("[data-safe-href]")).toHaveAttribute("xlink:href", `#${shapeId}`);
      for (const id of [paintId, shadowId, clipId, markerId, shapeId]) expect(id).toContain("-fragment-");
      expect(view.container.querySelector("svg")).toHaveAccessibleName("Mermaid diagram");
    })
  );

  it.effect(
    "rewrites every admitted SVG ARIA IDREF to an internal scoped target",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nARIA-->Internal";
      const view = render(<MermaidView renderKey="safe-aria-idrefs" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);
      const attributes = [
        "aria-activedescendant",
        "aria-controls",
        "aria-describedby",
        "aria-details",
        "aria-errormessage",
        "aria-flowto",
        "aria-labelledby",
        "aria-owns",
      ];

      yield* Effect.sync(() => {
        const idRefs = A.join(
          A.map(attributes, (attribute) => `${attribute}="local-label"`),
          " "
        );
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              `<text id="local-label">Safe label</text><g data-safe-idrefs="yes" ${idRefs}></g>`
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() => expect(within(view.container).getByTestId("mermaid-diagram").querySelector("[data-safe-idrefs]")))
      );

      const labelId = view.container.querySelector("text")?.getAttribute("id");
      const controlled = view.container.querySelector("[data-safe-idrefs]");
      expect(labelId).toContain("-fragment-");
      for (const attribute of attributes) expect(controlled).toHaveAttribute(attribute, labelId);
    })
  );

  it.effect(
    "rejects missing and external same-document SVG ARIA IDREF targets",
    Effect.fnUntraced(function* () {
      const attacks = [
        { attribute: "aria-controls", key: "missing", target: "missing-label" },
        { attribute: "aria-labelledby", key: "external", target: "external-label" },
      ];

      for (const { attribute, key, target } of attacks) {
        const source = `graph TD\nARIA-->${key}`;
        const view = render(
          <>
            <span id="external-label">Outside diagram</span>
            <MermaidView renderKey={`aria-${key}`} source={source} />
          </>
        );
        yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
        const pending = getPendingRender(source);

        yield* Effect.sync(() => {
          act(() =>
            pending.resolve({
              svg: mermaidSvg(pending.id, `<g ${attribute}="${target}"></g>`),
            })
          );
        });
        yield* Effect.promise(() =>
          waitFor(() =>
            expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
          )
        );

        expect(within(view.container).getByTestId("mermaid-diagram").querySelector("svg, g")).toBeNull();
        expect(within(view.container).getByText("Outside diagram")).toBeVisible();
        view.unmount();
      }
    })
  );

  it.effect(
    "rejects missing fragment targets and unsafe links across every admitted URL surface",
    Effect.fnUntraced(function* () {
      const attacks = [
        '<path fill="url(#missing)" d="M0 0L1 1"></path>',
        '<path style="fill: url(&quot;#missing&quot;)" d="M0 0L1 1"></path>',
        '<text><textPath href="#missing">Missing</textPath></text>',
        '<text><textPath xlink:href="#missing">Missing</textPath></text>',
        '<text><textPath href="https://attacker.invalid/path">External</textPath></text>',
        '<text><textPath xlink:href="javascript:alert(1)">Script</textPath></text>',
      ];

      for (const [index, contents] of attacks.entries()) {
        const source = `graph TD\nMissing-->Fragment${index}`;
        const view = render(<MermaidView renderKey={`missing-fragment-${index}`} source={source} />);
        yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
        const pending = getPendingRender(source);

        yield* Effect.sync(() => {
          act(() => pending.resolve({ svg: mermaidSvg(pending.id, contents) }));
        });
        yield* Effect.promise(() =>
          waitFor(() =>
            expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
          )
        );

        expect(view.container.querySelector("svg, path, textPath")).toBeNull();
        view.unmount();
      }
    })
  );

  it.effect(
    "rewrites prefix IDs independently without changing hex-color declarations",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nPrefix-->Hex";
      const view = render(<MermaidView renderKey="prefix-and-hex" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              `<defs><linearGradient id="a"></linearGradient><linearGradient id="abc"></linearGradient></defs><style>#${pending.id} .hex { fill: #fff; stroke: #abcdef; }</style><path class="hex" data-prefix-id="a" fill="url(#a)" d="M0 0L1 1"></path><path data-prefix-id="abc" fill="url(#abc)" d="M0 0L1 1"></path>`
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() => expect(view.container.querySelectorAll("[data-prefix-id]")).toHaveLength(2))
      );

      const gradients = view.container.querySelectorAll("linearGradient");
      const paths = view.container.querySelectorAll("[data-prefix-id]");
      expect(paths[0]).toHaveAttribute("fill", `url(#${gradients[0]?.getAttribute("id")})`);
      expect(paths[1]).toHaveAttribute("fill", `url(#${gradients[1]?.getAttribute("id")})`);
      expect(paths[0]?.getAttribute("fill")).not.toBe(paths[1]?.getAttribute("fill"));
      expect(view.container.querySelector("style")).toHaveTextContent("fill: #fff");
      expect(view.container.querySelector("style")).toHaveTextContent("stroke: #abcdef");
    })
  );

  it.effect(
    "rejects unsupported descendant ID selectors instead of rewriting CSS text",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nSelector-->Id";
      const view = render(<MermaidView renderKey="descendant-id-selector" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              `<style>#${pending.id} #a { fill: #fff; }</style><path id="a" d="M0 0L1 1"></path>`
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
        )
      );

      expect(view.container.querySelector("svg, style, path")).toBeNull();
    })
  );

  it.effect(
    "scopes internal fragment targets away from external same-document IDs",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nFragment-->ExternalCollision";
      const view = render(
        <>
          <svg aria-hidden="true">
            <defs>
              <linearGradient id="shared-paint" />
            </defs>
          </svg>
          <MermaidView renderKey="external-collision" source={source} />
        </>
      );
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              '<defs><linearGradient id="shared-paint"></linearGradient></defs><path data-external-collision="safe" fill="url(#shared-paint)" d="M0 0L1 1"></path>'
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("[data-external-collision]"))
        )
      );

      const diagram = within(view.container).getByTestId("mermaid-diagram");
      const internalId = diagram.querySelector("linearGradient")?.getAttribute("id");
      expect(internalId).toContain("-fragment-");
      expect(internalId).not.toBe("shared-paint");
      expect(diagram.querySelector("[data-external-collision]")).toHaveAttribute("fill", `url(#${internalId})`);
      expect(view.container.querySelector('svg[aria-hidden="true"] #shared-paint')).toBeInTheDocument();
    })
  );

  it.effect(
    "rejects duplicate internal fragment targets before rewriting",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nFragment-->Duplicate";
      const view = render(<MermaidView renderKey="duplicate-fragment" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              '<defs><linearGradient id="shared-paint"></linearGradient><linearGradient id="shared-paint"></linearGradient></defs><path fill="url(#shared-paint)" d="M0 0L1 1"></path>'
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
        )
      );

      expect(view.container.querySelector("svg, path")).toBeNull();
    })
  );

  it.effect(
    "keeps same-page diagrams with identical internal IDs isolated",
    Effect.fnUntraced(function* () {
      const first = "graph TD\nFirst-->Paint";
      const second = "graph TD\nSecond-->Paint";
      const view = render(<MermaidView renderKey="multi-first" source={first} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(first)).toBe(true)));
      const firstRender = getPendingRender(first);

      yield* Effect.sync(() => {
        act(() =>
          firstRender.resolve({
            svg: mermaidSvg(
              firstRender.id,
              '<defs><linearGradient id="paint"></linearGradient></defs><path data-multi-diagram="first" fill="url(#paint)" d="M0 0L1 1"></path>'
            ),
          })
        );
      });
      yield* Effect.promise(() => waitFor(() => expect(view.container.querySelector("[data-multi-diagram='first']"))));

      view.rerender(
        <>
          <MermaidView renderKey="multi-first" source={first} />
          <MermaidView renderKey="multi-second" source={second} />
        </>
      );
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(second)).toBe(true)));
      const secondRender = getPendingRender(second);

      yield* Effect.sync(() => {
        act(() =>
          secondRender.resolve({
            svg: mermaidSvg(
              secondRender.id,
              '<defs><linearGradient id="paint"></linearGradient></defs><path data-multi-diagram="second" fill="url(#paint)" d="M0 0L1 1"></path>'
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() => expect(view.container.querySelectorAll("[data-multi-diagram]")).toHaveLength(2))
      );

      const paths = view.container.querySelectorAll("[data-multi-diagram]");
      const firstTarget = paths[0]?.getAttribute("fill");
      const secondTarget = paths[1]?.getAttribute("fill");
      expect(firstTarget).toContain("-fragment-");
      expect(secondTarget).toContain("-fragment-");
      expect(firstTarget).not.toBe(secondTarget);
      expect(view.container.querySelectorAll("[id='paint']")).toHaveLength(0);
    })
  );

  it.effect(
    "adds an escaped programmatic text alternative without interpolating diagram source",
    Effect.fnUntraced(function* () {
      const source = `graph TD\nA["</desc><script data-diagram-xss='no'>alert(1)</script>&done"]`;
      const view = render(<MermaidView renderKey="fallback-accessibility-escaping" source={source} />);
      // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag -- Intentional hostile Mermaid fixture; mermaidStub is a local test double and assertions prove the source becomes text only.
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() => pending.resolve({ svg: mermaidSvg(pending.id) }));
      });
      yield* Effect.promise(() =>
        waitFor(() => expect(within(view.container).getByTestId("mermaid-diagram").querySelector("svg")))
      );

      const svg = view.container.querySelector("svg");
      const description = svg?.querySelector("desc");
      expect(svg).toHaveAccessibleName("Mermaid diagram");
      expect(description?.textContent).toBe(`Mermaid diagram source:\n${source}`);
      expect(description).toHaveAttribute("id", svg?.getAttribute("aria-describedby"));
      expect(view.container.querySelector("script, [data-diagram-xss]")).toBeNull();
    })
  );

  it.effect(
    "rejects string URL image functions in inline styles and stylesheets",
    Effect.fnUntraced(function* () {
      const attacks = [
        ["image-set", 'image-set("https://attacker.invalid/image-set")'],
        ["webkit-image-set", '-webkit-image-set("https://attacker.invalid/webkit-image-set")'],
        ["image", 'image("https://attacker.invalid/image")'],
        ["src", 'src("https://attacker.invalid/src")'],
        ["commented-image-set", 'image/**/-set("https://attacker.invalid/commented-image-set")'],
        ["commented-src", 's/**/rc("https://attacker.invalid/commented-src")'],
        ["escaped-image-set", 'im\\61 ge-set("https://attacker.invalid/escaped-image-set")'],
        ["escaped-webkit-image-set", '-webk\\69 t-image-set("https://attacker.invalid/escaped-webkit-image-set")'],
        ["escaped-image", 'im\\61 ge("https://attacker.invalid/escaped-image")'],
        ["escaped-src", 's\\72 c("https://attacker.invalid/escaped-src")'],
      ] as const;

      for (const [key, value] of attacks) {
        for (const placement of ["inline", "stylesheet"] as const) {
          const source = `graph TD\nImageResource-->${placement}-${key}`;
          const view = render(<MermaidView renderKey={`${placement}-${key}`} source={source} />);
          yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
          const pending = getPendingRender(source);

          yield* Effect.sync(() => {
            const contents =
              placement === "inline"
                ? `<g style='background-image: ${value}'></g>`
                : `<style>#${pending.id} .resource { background-image: ${value}; }</style><g class="resource"></g>`;
            act(() => pending.resolve({ svg: mermaidSvg(pending.id, contents) }));
          });
          yield* Effect.promise(() =>
            waitFor(() =>
              expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
            )
          );

          expect(view.container.querySelector("svg, style")).toBeNull();
          view.unmount();
        }
      }
    })
  );

  it.effect(
    "rejects image resource functions hidden behind CSS custom properties",
    Effect.fnUntraced(function* () {
      const resource = 'image-set("https://attacker.invalid/custom-property")';

      for (const placement of ["inline", "stylesheet"] as const) {
        const source = `graph TD\nCustomProperty-->${placement}`;
        const view = render(<MermaidView renderKey={`custom-property-${placement}`} source={source} />);
        yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
        const pending = getPendingRender(source);

        yield* Effect.sync(() => {
          const declaration = `--resource: ${resource}; background-image: var(--resource)`;
          const contents =
            placement === "inline"
              ? `<g style='${declaration}'></g>`
              : `<style>#${pending.id} .resource { ${declaration}; }</style><g class="resource"></g>`;
          act(() => pending.resolve({ svg: mermaidSvg(pending.id, contents) }));
        });
        yield* Effect.promise(() =>
          waitFor(() =>
            expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
          )
        );

        expect(view.container.querySelector("svg, style")).toBeNull();
        view.unmount();
      }
    })
  );

  it.effect(
    "retains fragment paint references and image-free stylesheet rules",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nSafe-->CSS";
      const view = render(<MermaidView renderKey="safe-css-controls" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = getPendingRender(source);

      yield* Effect.sync(() => {
        act(() =>
          pending.resolve({
            svg: mermaidSvg(
              pending.id,
              `<defs><linearGradient id="paint"></linearGradient></defs><style>#${pending.id} .safe-paint { stroke: currentColor; }</style><path class="safe-paint" data-safe-css-control="yes" style='fill: url("#paint")' d="M0 0L1 1"></path>`
            ),
          })
        );
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("[data-safe-css-control]"))
        )
      );

      const path = view.container.querySelector("[data-safe-css-control]");
      const paintId = view.container.querySelector("linearGradient")?.getAttribute("id");
      expect(path).toHaveAttribute("style", `fill: url(#${paintId})`);
      expect(view.container.querySelector("style")).toHaveTextContent("stroke: currentColor");
      expect(view.container.querySelector("svg")).toHaveAccessibleName("Mermaid diagram");
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
        {
          key: "root-layout-escape",
          stylesheet: (renderId: string) =>
            `#${renderId} { position: fixed; inset: 0; z-index: 2147483647; pointer-events: all; }`,
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
    "rejects root stylesheet and inline-style layout escape declarations",
    Effect.fnUntraced(function* () {
      const declarations = [
        ["fixed", "position: fixed"],
        ["inset", "inset: 0"],
        ["z-index", "z-index: 2147483647"],
        ["pointer-events", "pointer-events: all"],
        ["absolute-viewport-default-pointer-capture", "position: absolute; width: 100vw; height: 100vh; z-index: 100"],
        ["transform", "transform: translate(-100vw, -100vh) scale(100)"],
        ["individual-transforms", "translate: -100vw -100vh; scale: 100"],
        ["negative-margin", "margin: -100vh -100vw"],
        ["viewport-sizing", "min-width: 100vw; min-height: 100vh; max-width: none; max-height: none"],
      ] as const;
      const attacks = declarations.flatMap(([key, declaration]) => [
        {
          key: `stylesheet-${key}`,
          svg: (renderId: string) => mermaidSvg(renderId, `<style>#${renderId} { ${declaration}; }</style>`),
        },
        {
          key: `inline-${key}`,
          svg: (renderId: string) =>
            `<svg xmlns="http://www.w3.org/2000/svg" id="${renderId}" role="${mermaidRootRole}" style="${declaration}"><g></g></svg>`,
        },
      ]);

      for (const attack of attacks) {
        const source = `graph TD\nLayout-->${attack.key}`;
        const view = render(<MermaidView renderKey={attack.key} source={source} />);
        yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
        const pending = getPendingRender(source);

        yield* Effect.sync(() => {
          act(() => pending.resolve({ svg: attack.svg(pending.id) }));
        });
        yield* Effect.promise(() =>
          waitFor(() =>
            expect(within(view.container).getByText("Diagram output did not satisfy the desktop safety policy."))
          )
        );

        expect(view.container.querySelector("svg, style")).toBeNull();
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
