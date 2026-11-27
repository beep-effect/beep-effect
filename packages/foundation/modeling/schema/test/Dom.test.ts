import { DOMCssProperties, isCSSProperties } from "@beep/schema/DomCssProperties";
import { createDOMRefSchema, DOMReactNode, isReactNode, isReactRef } from "@beep/schema/DomReactNode";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";

const isDOMCssProperties = S.is(DOMCssProperties);
const isDOMReactNode = S.is(DOMReactNode);

class DomlessHTMLElementDouble {}

describe("DOM React and CSS guards", () => {
  it("accepts plain CSS properties and rejects other values", () => {
    expect(isCSSProperties({ color: "red", opacity: 0.5 })).toBe(true);
    expect(isDOMCssProperties({ display: "grid" })).toBe(true);

    expect(isCSSProperties(null)).toBe(false);
    expect(isCSSProperties("color: red")).toBe(false);
    expect(isCSSProperties(["color"])).toBe(false);
    expect(isCSSProperties(DateTime.toDateUtc(DateTime.makeUnsafe(0)))).toBe(false);
  });

  it("recognizes React node shapes", () => {
    expect(isReactNode(null)).toBe(true);
    expect(isReactNode(undefined)).toBe(true);
    expect(isReactNode("text")).toBe(true);
    expect(isReactNode(1)).toBe(true);
    expect(isReactNode(false)).toBe(true);
    expect(isReactNode(["text", 1, { $$typeof: Symbol.for("react.element") }])).toBe(true);
    expect(isReactNode(["text", Symbol("not-a-node")])).toBe(false);
    expect(isReactNode({ $$typeof: Symbol.for("react.portal") })).toBe(true);
    expect(isReactNode(Symbol("not-a-node"))).toBe(false);
    expect(isDOMReactNode(["child"])).toBe(true);
  });

  it("recognizes callback, legacy string, nullable, and object refs", () => {
    expect(isReactRef(null)).toBe(true);
    expect(isReactRef(undefined)).toBe(true);
    expect(isReactRef(() => undefined)).toBe(true);
    expect(isReactRef("legacy")).toBe(true);
    expect(
      isReactRef({ current: new DomlessHTMLElementDouble() }),
      "the schema package compiles without the dom lib, so the ref target is a test double"
    ).toBe(true);
    expect(isReactRef({ value: new DomlessHTMLElementDouble() })).toBe(false);
    expect(isReactRef(1)).toBe(false);
    expect(S.is(createDOMRefSchema())({ current: null })).toBe(true);
  });
});
