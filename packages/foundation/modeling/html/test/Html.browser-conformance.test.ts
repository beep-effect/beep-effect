// @vitest-environment jsdom

import { conform, inspectConformance, serialize, untrustedHtmlValue } from "@beep/html";
import { ForeignElement, P } from "@beep/html/Html.model";
import { Text } from "@beep/html/Html.nodes";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe } from "effect";

describe("@beep/html browser conformance", () => {
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
});
