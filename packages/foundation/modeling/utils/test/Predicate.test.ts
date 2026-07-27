import { P } from "@beep/utils";
import { describe, expect, it } from "vitest";

describe("Predicate utilities", () => {
  it("chains refinements in order", () => {
    const hasMessage = P.chainRefinements([
      P.isNotNullish,
      P.isObject,
      P.hasProperty("message"),
      P.Struct({ message: P.isString }),
    ]);

    expect(hasMessage({ message: "hello" })).toBe(true);
    expect(hasMessage(null)).toBe(false);
    expect(hasMessage("hello")).toBe(false);
    expect(hasMessage({})).toBe(false);
    expect(hasMessage({ message: 1 })).toBe(false);
  });

  it("supports explicit input types with the builder form", () => {
    const hasMessage = P.chainRefinements<unknown>()([
      P.isNotNullish,
      P.isObject,
      P.hasProperty("message"),
      P.Struct({ message: P.isString }),
    ]);

    expect(hasMessage({ message: "hello" })).toBe(true);
    expect(hasMessage({ message: false })).toBe(false);
  });

  it("short-circuits before later refinements", () => {
    let calls = 0;
    const isStringMessage: P.Refinement<{ readonly message: unknown }, { readonly message: string }> = (
      value
    ): value is { readonly message: string } => {
      calls += 1;
      return P.isString(value.message);
    };

    const hasMessage = P.chainRefinements([P.isObject, P.hasProperty("message"), isStringMessage]);

    expect(hasMessage({})).toBe(false);
    expect(calls).toBe(0);

    expect(hasMessage({ message: "hello" })).toBe(true);
    expect(calls).toBe(1);
  });

  it("checks required properties in data-first and data-last forms", () => {
    expect(P.hasProperties({ foo: 1, bar: 2 }, ["foo", "bar"] as const)).toBe(true);
    expect(P.hasProperties("foo", "bar")({ foo: 1, bar: 2 })).toBe(true);
    expect(P.hasProperties({ foo: 1 }, ["foo", "bar"] as const)).toBe(false);
    expect(P.hasProperties(null, ["foo"] as const)).toBe(false);
  });

  it("detects objects that cannot be safely reflected", () => {
    const blocked = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("blocked");
        },
      }
    );

    expect(P.hasInspectableObjectShape({ ok: true })).toBe(true);
    expect(P.hasInspectableObjectShape("value")).toBe(true);
    expect(P.hasInspectableObjectShape(blocked)).toBe(false);
  });
});
