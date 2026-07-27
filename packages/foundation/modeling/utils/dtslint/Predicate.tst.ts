import { P } from "@beep/utils";
import { describe, expect, it } from "tstyche";

describe("chainRefinements", () => {
  it("narrows through the flat tuple form", () => {
    const hasMessage = P.chainRefinements([
      P.isNotNullish,
      P.isObject,
      P.hasProperty("message"),
      P.Struct({ message: P.isString }),
    ]);

    expect(hasMessage).type.toBe<P.Refinement<unknown, { readonly message: string }>>();

    const input: unknown = { message: "hello" };

    if (hasMessage(input)) {
      expect(input.message).type.toBe<string>();
    }
  });

  it("narrows through the explicit input builder form", () => {
    const hasMessage = P.chainRefinements<unknown>()([
      P.isNotNullish,
      P.isObject,
      P.hasProperty("message"),
      P.Struct({ message: P.isString }),
    ]);

    expect(hasMessage).type.toBe<P.Refinement<unknown, { readonly message: string }>>();
  });

  it("accepts readonly refinement tuples", () => {
    const messageRefinements = [
      P.isNotNullish,
      P.isObject,
      P.hasProperty("message"),
      P.Struct({ message: P.isString }),
    ] as const;

    const hasMessage = P.chainRefinements(messageRefinements);

    expect(hasMessage).type.toBe<P.Refinement<unknown, { readonly message: string }>>();
  });

  it("rejects invalid refinement ordering", () => {
    expect(P.chainRefinements).type.not.toBeCallableWith([P.isString, P.Struct({ message: P.isString })]);
    expect(P.chainRefinements<unknown>()).type.not.toBeCallableWith([P.isString, P.Struct({ message: P.isString })]);
  });

  it("rejects empty refinement arrays", () => {
    expect(P.chainRefinements).type.not.toBeCallableWith([]);
    expect(P.chainRefinements<unknown>()).type.not.toBeCallableWith([]);
  });
});
