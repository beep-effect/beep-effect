// @vitest-environment jsdom

import { conform, inspectConformance, serialize, untrustedHtmlValue } from "@beep/html";
import { ForeignElementName } from "@beep/html/Html.attributes";
import { Div, ForeignElement, P } from "@beep/html/Html.model";
import { Text } from "@beep/html/Html.nodes";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

const foreignBreakoutTags: ReadonlyArray<string> = [
  "b",
  "big",
  "blockquote",
  "body",
  "br",
  "center",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "hr",
  "i",
  "img",
  "li",
  "listing",
  "menu",
  "meta",
  "nobr",
  "ol",
  "p",
  "pre",
  "ruby",
  "s",
  "small",
  "span",
  "strong",
  "strike",
  "sub",
  "sup",
  "table",
  "tt",
  "u",
  "ul",
  "var",
];

describe("@beep/html browser conformance", () => {
  it("matches browser relList token boundaries for opener protections", () => {
    const anchor = document.createElement("a");
    anchor.rel = "opener noopener noreferrer";
    expect([...anchor.relList]).toStrictEqual(["opener", "noopener", "noreferrer"]);

    anchor.rel = "opener noopener\u00a0noreferrer";
    expect([...anchor.relList]).toStrictEqual(["opener", "noopener\u00a0noreferrer"]);
    expect(anchor.relList.contains("noopener")).toBe(false);
    expect(anchor.relList.contains("noreferrer")).toBe(false);
  });

  it("keeps every admitted data-* suffix distinct after browser parsing", () => {
    const root = Div.make({
      children: [],
      dataset: O.some({
        "-x": "hyphen",
        "1": "digit",
        "foo.bar": "dot",
        méta: "unicode",
      }),
    });
    const serialized = pipe(root, serialize, Effect.runSync, untrustedHtmlValue);
    const container = document.createElement("div");
    container.innerHTML = serialized;
    const element = container.firstElementChild;

    expect(element?.getAttributeNames()).toStrictEqual(["data--x", "data-1", "data-foo.bar", "data-méta"]);
    expect(element?.getAttribute("data--x")).toBe("hyphen");
    expect(element?.getAttribute("data-1")).toBe("digit");
    expect(element?.getAttribute("data-foo.bar")).toBe("dot");
    expect(element?.getAttribute("data-méta")).toBe("unicode");
  });

  it("rejects opaque foreign trees that an HTML parser restructures", () => {
    const root = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [
        P.make({
          children: [Text.make({ value: "html" })],
        }),
      ],
    });
    const container = document.createElement("div");
    container.innerHTML = "<svg><p>html</p></svg>";

    expect(
      Array.from(container.children, (element) => ({
        childElementCount: element.childElementCount,
        namespace: element.namespaceURI,
        tag: element.localName,
      }))
    ).toStrictEqual([
      {
        childElementCount: 0,
        namespace: "http://www.w3.org/2000/svg",
        tag: "svg",
      },
      {
        childElementCount: 0,
        namespace: "http://www.w3.org/1999/xhtml",
        tag: "p",
      },
    ]);
    expect(inspectConformance(root)).toContainEqual(
      expect.objectContaining({
        path: ["children.0"],
        rule: "foreignIntegration",
      })
    );
    expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(serialize(root)))).toBe(true);
  });

  it("rejects every foreign-content breakout start tag", () => {
    for (const name of foreignBreakoutTags) {
      const root = ForeignElement.make({
        namespace: "svg",
        name: "svg",
        children: [
          ForeignElement.make({
            namespace: "svg",
            name: "g",
            children: [
              ForeignElement.make({
                namespace: "svg",
                name,
                children: [Text.make({ value: "html" })],
              }),
            ],
          }),
        ],
      });
      const container = document.createElement("div");
      container.innerHTML = `<svg><g><${name}>html</${name}></g></svg>`;

      expect(inspectConformance(root)).toContainEqual(
        expect.objectContaining({
          path: ["children.0", "children.0"],
          rule: "foreignIntegration",
        })
      );
      expect(Exit.isFailure(Effect.runSyncExit(serialize(root)))).toBe(true);
      expect(container.firstElementChild?.firstElementChild?.childElementCount).toBe(0);
    }
  });

  it("applies the attribute-dependent foreign-content font breakout", () => {
    const stable = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [
        ForeignElement.make({
          namespace: "svg",
          name: "g",
          children: [ForeignElement.make({ namespace: "svg", name: "font", children: [] })],
        }),
      ],
    });
    const stableHtml = pipe(stable, serialize, Effect.runSync, untrustedHtmlValue);
    const stableContainer = document.createElement("div");
    stableContainer.innerHTML = stableHtml;

    expect(inspectConformance(stable)).toStrictEqual([]);
    expect(stableContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(SVG_NAMESPACE);

    for (const attribute of ["color", "face", "size"]) {
      const root = ForeignElement.make({
        namespace: "svg",
        name: "svg",
        children: [
          ForeignElement.make({
            namespace: "svg",
            name: "g",
            children: [
              ForeignElement.make({
                namespace: "svg",
                name: "font",
                attributes: O.some({ [attribute]: "value" }),
                children: [],
              }),
            ],
          }),
        ],
      });
      const container = document.createElement("div");
      container.innerHTML = `<svg><g><font ${attribute}="value"></font></g></svg>`;

      expect(inspectConformance(root)).toContainEqual(
        expect.objectContaining({
          path: ["children.0", "children.0"],
          rule: "foreignIntegration",
        })
      );
      expect(Exit.isFailure(Effect.runSyncExit(serialize(root)))).toBe(true);
      expect(container.firstElementChild?.firstElementChild?.childElementCount).toBe(0);
    }
  });

  it("models every SVG HTML integration point", () => {
    for (const name of ["foreignObject", "desc", "title"]) {
      const valid = ForeignElement.make({
        namespace: "svg",
        name: "svg",
        children: [
          ForeignElement.make({
            namespace: "svg",
            name,
            children: [Div.make({ children: [Text.make({ value: "html" })] })],
          }),
        ],
      });
      const validHtml = pipe(valid, serialize, Effect.runSync, untrustedHtmlValue);
      const validContainer = document.createElement("div");
      validContainer.innerHTML = validHtml;

      expect(inspectConformance(valid)).toStrictEqual([]);
      expect(validContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
        XHTML_NAMESPACE
      );

      const invalid = ForeignElement.make({
        namespace: "svg",
        name: "svg",
        children: [
          ForeignElement.make({
            namespace: "svg",
            name,
            children: [ForeignElement.make({ namespace: "svg", name: "path", children: [] })],
          }),
        ],
      });
      const invalidContainer = document.createElement("div");
      invalidContainer.innerHTML = `<svg><${name}><path></path></${name}></svg>`;

      expect(inspectConformance(invalid)).toContainEqual(
        expect.objectContaining({
          path: ["children.0", "children.0"],
          rule: "foreignIntegration",
        })
      );
      expect(Exit.isFailure(Effect.runSyncExit(serialize(invalid)))).toBe(true);
      expect(invalidContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
        XHTML_NAMESPACE
      );
    }
  });

  it("admits exact SVG and MathML re-entry from HTML integration mode", () => {
    const cases: ReadonlyArray<readonly [ForeignElement, string]> = [
      [
        ForeignElement.make({
          namespace: "svg",
          name: "svg",
          children: [
            ForeignElement.make({
              namespace: "svg",
              name: "foreignObject",
              children: [ForeignElement.make({ namespace: "svg", name: "svg", children: [] })],
            }),
          ],
        }),
        SVG_NAMESPACE,
      ],
      [
        ForeignElement.make({
          namespace: "svg",
          name: "svg",
          children: [
            ForeignElement.make({
              namespace: "svg",
              name: "desc",
              children: [ForeignElement.make({ namespace: "mathml", name: "math", children: [] })],
            }),
          ],
        }),
        MATHML_NAMESPACE,
      ],
      [
        ForeignElement.make({
          namespace: "mathml",
          name: "math",
          children: [
            ForeignElement.make({
              namespace: "mathml",
              name: "mtext",
              children: [ForeignElement.make({ namespace: "svg", name: "svg", children: [] })],
            }),
          ],
        }),
        SVG_NAMESPACE,
      ],
      [
        ForeignElement.make({
          namespace: "mathml",
          name: "math",
          children: [
            ForeignElement.make({
              namespace: "mathml",
              name: "mtext",
              children: [ForeignElement.make({ namespace: "mathml", name: "math", children: [] })],
            }),
          ],
        }),
        MATHML_NAMESPACE,
      ],
      [
        ForeignElement.make({
          namespace: "mathml",
          name: "math",
          children: [
            ForeignElement.make({
              namespace: "mathml",
              name: "annotation-xml",
              attributes: O.some({ encoding: "application/xhtml+xml" }),
              children: [ForeignElement.make({ namespace: "mathml", name: "math", children: [] })],
            }),
          ],
        }),
        MATHML_NAMESPACE,
      ],
    ];

    for (const [root, namespace] of cases) {
      const serialized = pipe(root, serialize, Effect.runSync, untrustedHtmlValue);
      const container = document.createElement("div");
      container.innerHTML = serialized;

      expect(inspectConformance(root)).toStrictEqual([]);
      expect(container.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(namespace);
    }
  });

  it("models every MathML text integration point and its foreign exceptions", () => {
    for (const name of ["mi", "mo", "mn", "ms", "mtext"]) {
      const validHtml = ForeignElement.make({
        namespace: "mathml",
        name: "math",
        children: [
          ForeignElement.make({
            namespace: "mathml",
            name,
            children: [Div.make({ children: [Text.make({ value: "html" })] })],
          }),
        ],
      });
      const serialized = pipe(validHtml, serialize, Effect.runSync, untrustedHtmlValue);
      const container = document.createElement("div");
      container.innerHTML = serialized;

      expect(inspectConformance(validHtml)).toStrictEqual([]);
      expect(container.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(XHTML_NAMESPACE);

      const invalidForeign = ForeignElement.make({
        namespace: "mathml",
        name: "math",
        children: [
          ForeignElement.make({
            namespace: "mathml",
            name,
            children: [ForeignElement.make({ namespace: "mathml", name: "mi", children: [] })],
          }),
        ],
      });
      const invalidContainer = document.createElement("div");
      invalidContainer.innerHTML = `<math><${name}><mi></mi></${name}></math>`;

      expect(inspectConformance(invalidForeign)).toContainEqual(
        expect.objectContaining({
          path: ["children.0", "children.0"],
          rule: "foreignIntegration",
        })
      );
      expect(Exit.isFailure(Effect.runSyncExit(serialize(invalidForeign)))).toBe(true);
      expect(invalidContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
        XHTML_NAMESPACE
      );

      for (const exception of ["mglyph", "malignmark"]) {
        const validForeign = ForeignElement.make({
          namespace: "mathml",
          name: "math",
          children: [
            ForeignElement.make({
              namespace: "mathml",
              name,
              children: [ForeignElement.make({ namespace: "mathml", name: exception, children: [] })],
            }),
          ],
        });
        const validForeignHtml = pipe(validForeign, serialize, Effect.runSync, untrustedHtmlValue);
        const validForeignContainer = document.createElement("div");
        validForeignContainer.innerHTML = validForeignHtml;

        expect(inspectConformance(validForeign)).toStrictEqual([]);
        expect(validForeignContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
          MATHML_NAMESPACE
        );
      }
    }
  });

  it("models annotation-xml HTML integration and SVG re-entry", () => {
    const htmlIntegration = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      children: [
        ForeignElement.make({
          namespace: "mathml",
          name: "annotation-xml",
          attributes: O.some({ encoding: "TEXT/HTML" }),
          children: [Div.make({ children: [Text.make({ value: "html" })] })],
        }),
      ],
    });
    const htmlIntegrationMarkup = pipe(htmlIntegration, serialize, Effect.runSync, untrustedHtmlValue);
    const htmlIntegrationContainer = document.createElement("div");
    htmlIntegrationContainer.innerHTML = htmlIntegrationMarkup;

    expect(inspectConformance(htmlIntegration)).toStrictEqual([]);
    expect(htmlIntegrationContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
      XHTML_NAMESPACE
    );

    const encodedMathChild = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      children: [
        ForeignElement.make({
          namespace: "mathml",
          name: "annotation-xml",
          attributes: O.some({ encoding: "application/xhtml+xml" }),
          children: [ForeignElement.make({ namespace: "mathml", name: "mi", children: [] })],
        }),
      ],
    });
    const encodedMathChildContainer = document.createElement("div");
    encodedMathChildContainer.innerHTML =
      '<math><annotation-xml encoding="application/xhtml+xml"><mi></mi></annotation-xml></math>';

    expect(inspectConformance(encodedMathChild)).toContainEqual(
      expect.objectContaining({
        path: ["children.0", "children.0"],
        rule: "foreignIntegration",
      })
    );
    expect(Exit.isFailure(Effect.runSyncExit(serialize(encodedMathChild)))).toBe(true);
    expect(encodedMathChildContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
      XHTML_NAMESPACE
    );

    const mathChild = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      children: [
        ForeignElement.make({
          namespace: "mathml",
          name: "annotation-xml",
          children: [ForeignElement.make({ namespace: "mathml", name: "mi", children: [] })],
        }),
      ],
    });
    const mathChildMarkup = pipe(mathChild, serialize, Effect.runSync, untrustedHtmlValue);
    const mathChildContainer = document.createElement("div");
    mathChildContainer.innerHTML = mathChildMarkup;

    expect(inspectConformance(mathChild)).toStrictEqual([]);
    expect(mathChildContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
      MATHML_NAMESPACE
    );

    const svgReentry = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      children: [
        ForeignElement.make({
          namespace: "mathml",
          name: "annotation-xml",
          children: [ForeignElement.make({ namespace: "svg", name: "svg", children: [] })],
        }),
      ],
    });
    const svgReentryMarkup = pipe(svgReentry, serialize, Effect.runSync, untrustedHtmlValue);
    const svgReentryContainer = document.createElement("div");
    svgReentryContainer.innerHTML = svgReentryMarkup;

    expect(inspectConformance(svgReentry)).toStrictEqual([]);
    expect(svgReentryContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(
      SVG_NAMESPACE
    );

    const wrongSvgNamespace = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      children: [
        ForeignElement.make({
          namespace: "mathml",
          name: "annotation-xml",
          children: [ForeignElement.make({ namespace: "mathml", name: "svg", children: [] })],
        }),
      ],
    });
    const wrongSvgContainer = document.createElement("div");
    wrongSvgContainer.innerHTML = "<math><annotation-xml><svg></svg></annotation-xml></math>";

    expect(inspectConformance(wrongSvgNamespace)).toContainEqual(
      expect.objectContaining({
        path: ["children.0", "children.0"],
        rule: "foreignIntegration",
      })
    );
    expect(Exit.isFailure(Effect.runSyncExit(serialize(wrongSvgNamespace)))).toBe(true);
    expect(wrongSvgContainer.firstElementChild?.firstElementChild?.firstElementChild?.namespaceURI).toBe(SVG_NAMESPACE);
  });

  it("serializes canonical SVG names and attributes to browser fixed points", () => {
    const root = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [
        ForeignElement.make({
          namespace: "svg",
          name: "linearGradient",
          attributes: O.some({ viewBox: "0 0 1 1" }),
          children: [],
        }),
      ],
    });
    const serialized = pipe(root, serialize, Effect.runSync, untrustedHtmlValue);
    const container = document.createElement("div");
    container.innerHTML = serialized;
    const gradient = container.firstElementChild?.firstElementChild;

    expect(serialized).toBe('<svg><linearGradient viewBox="0 0 1 1"></linearGradient></svg>');
    expect(gradient?.localName).toBe("linearGradient");
    expect(gradient?.getAttributeNames()).toContain("viewBox");

    const drifting = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [
        ForeignElement.make({
          namespace: "svg",
          name: "lineargradient",
          attributes: O.some({ viewbox: "0 0 1 1" }),
          children: [],
        }),
      ],
    });
    expect(Exit.isFailure(Effect.runSyncExit(serialize(drifting)))).toBe(true);
  });

  it("admits exactly the foreign-name representatives preserved by HTML parsing", () => {
    expect(S.is(ForeignElementName)("_x")).toBe(false);
    expect(S.is(ForeignElementName)("é")).toBe(false);
    expect(S.is(ForeignElementName)("svg:é")).toBe(true);

    const root = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [
        ForeignElement.make({
          namespace: "svg",
          name: "customÉ",
          children: [],
        }),
      ],
    });
    const serialized = pipe(root, serialize, Effect.runSync, untrustedHtmlValue);
    const container = document.createElement("div");
    container.innerHTML = serialized;
    const custom = container.firstElementChild?.firstElementChild;

    expect(inspectConformance(root)).toStrictEqual([]);
    expect(serialized).toBe("<svg><customÉ></customÉ></svg>");
    expect(custom?.localName).toBe("customÉ");
    expect(custom?.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });
});
