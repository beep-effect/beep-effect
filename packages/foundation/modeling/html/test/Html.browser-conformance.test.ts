// @vitest-environment jsdom

import { conform, inspectConformance, serialize, untrustedHtmlValue } from "@beep/html";
import { ForeignElementName } from "@beep/html/Html.attributes";
import { Div, ForeignElement, P } from "@beep/html/Html.model";
import { Text } from "@beep/html/Html.nodes";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("@beep/html browser conformance", () => {
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
    const serialized = pipe(root, serialize, Effect.runSync, untrustedHtmlValue);
    const container = document.createElement("div");
    container.innerHTML = serialized;

    expect(serialized).toBe("<svg><p>html</p></svg>");
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
