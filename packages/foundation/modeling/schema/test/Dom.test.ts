import { DOMCssProperties, isCSSProperties } from "@beep/schema/DomCssProperties";
import { DOMDragEvent, isDragEvent } from "@beep/schema/DomDragEvent";
import { DOMEvent } from "@beep/schema/DomEvent";
import { DOMHtmlElement, isHTMLElement } from "@beep/schema/DomHtmlElement";
import { DOMMouseEvent } from "@beep/schema/DomMouseEvent";
import { createDOMRefSchema, DOMReactNode, isReactNode, isReactRef } from "@beep/schema/DomReactNode";
import { it } from "@beep/test-runner";
import { afterAll, beforeAll, describe, expect } from "@effect/vitest";
import { DateTime } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const isDOMCssProperties = S.is(DOMCssProperties);
const isDOMDragEvent = S.is(DOMDragEvent);
const isDOMEvent = S.is(DOMEvent);
const isDOMHtmlElement = S.is(DOMHtmlElement);
const isDOMMouseEvent = S.is(DOMMouseEvent);
const isDOMReactNode = S.is(DOMReactNode);

class TestHTMLElement {}
class TestDragEvent {}
class TestMouseEvent {}

type DomConstructor = new (type?: string) => object;

// The schema package compiles without the dom lib, so the constructors are read from
// globalThis and fall back to test doubles when the runtime has no DOM.
const domGlobals = globalThis as Record<string, unknown>;
const domConstructorOr = (name: string, fallback: DomConstructor): DomConstructor => {
  const constructor = domGlobals[name];
  return P.isFunction(constructor) ? (constructor as DomConstructor) : fallback;
};
const DragEventConstructor = domConstructorOr("DragEvent", TestDragEvent);
const HTMLElementConstructor = domConstructorOr("HTMLElement", TestHTMLElement);
const MouseEventConstructor = domConstructorOr("MouseEvent", TestMouseEvent);

describe("DOM element and event guards", { concurrent: false }, () => {
  const constructors = {
    DragEvent: DragEventConstructor,
    HTMLElement: HTMLElementConstructor,
    MouseEvent: MouseEventConstructor,
  };
  let originalDescriptors: ReadonlyArray<readonly [string, PropertyDescriptor | undefined]> = [];

  beforeAll(() => {
    originalDescriptors = Object.keys(constructors).map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]);
    Object.assign(globalThis, constructors);
  });

  afterAll(() => {
    for (const [name, descriptor] of originalDescriptors) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, name);
      } else {
        Object.defineProperty(globalThis, name, descriptor);
      }
    }
  });

  it("recognizes DOM class-backed values", () => {
    const element = new HTMLElementConstructor();
    const dragEvent = new DragEventConstructor("dragstart");
    const mouseEvent = new MouseEventConstructor("click");
    const event = new Event("change");

    expect(isHTMLElement(element)).toBe(true);
    expect(isHTMLElement({})).toBe(false);
    expect(isDOMHtmlElement(element)).toBe(true);

    expect(isDragEvent(dragEvent)).toBe(true);
    expect(isDragEvent(event)).toBe(false);
    expect(isDOMDragEvent(dragEvent)).toBe(true);

    expect(isDOMEvent(event)).toBe(true);
    expect(isDOMMouseEvent(mouseEvent)).toBe(true);
  });

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
    expect(isReactRef({ current: new HTMLElementConstructor() })).toBe(true);
    expect(isReactRef({ value: new HTMLElementConstructor() })).toBe(false);
    expect(isReactRef(1)).toBe(false);
    expect(S.is(createDOMRefSchema())({ current: null })).toBe(true);
  });
});
