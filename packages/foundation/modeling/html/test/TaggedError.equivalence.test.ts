import { makeAsciiCaseInsensitiveEnumerated, makeSpaceSeparatedTokenList } from "@beep/html/Html.attributes";
import { HtmlConformanceError, HtmlConformanceIssue } from "@beep/html/Html.conformance";
import { HtmlPolicyError, HtmlPolicyIssue } from "@beep/html/Html.policy";
import { HtmlSerializeError } from "@beep/html/Html.serialize";
import { describe, expect, it } from "@effect/vitest";
import { identity } from "effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { assertReviewedCurrentAttributeGap } from "../scripts/generate.ts";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  first: Schema["Type"],
  second: Schema["Type"],
  different: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

const capture = (evaluate: () => unknown): unknown =>
  Result.match(Result.try(evaluate), {
    onFailure: identity,
    onSuccess: identity,
  });

const expectPrivateEquivalence = (first: unknown, second: unknown, different: unknown): void => {
  const schema = P.isObject(first) ? Reflect.get(first, "constructor") : first;
  expect(S.isSchema(schema)).toBe(true);

  if (S.isSchema(schema)) {
    const same = S.toEquivalence(schema);
    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  }
};

describe("@beep/html tagged-error declared equivalence", () => {
  it("compares conformance, policy, and serialization errors by declared fields", () => {
    expectDeclaredEquivalence(
      HtmlConformanceError,
      HtmlConformanceError.make({
        issues: [
          HtmlConformanceIssue.make({ message: "Invalid child", path: ["children", "0"], rule: "contentModel" }),
        ],
      }),
      HtmlConformanceError.make({
        issues: [
          HtmlConformanceIssue.make({ message: "Invalid child", path: ["children", "0"], rule: "contentModel" }),
        ],
      }),
      HtmlConformanceError.make({
        issues: [
          HtmlConformanceIssue.make({ message: "Invalid order", path: ["children", "0"], rule: "elementOrder" }),
        ],
      })
    );
    expectDeclaredEquivalence(
      HtmlPolicyError,
      HtmlPolicyError.make({
        issues: [HtmlPolicyIssue.make({ message: "Element denied", path: ["children.0"], rule: "deniedElement" })],
      }),
      HtmlPolicyError.make({
        issues: [HtmlPolicyIssue.make({ message: "Element denied", path: ["children.0"], rule: "deniedElement" })],
      }),
      HtmlPolicyError.make({
        issues: [HtmlPolicyIssue.make({ message: "URL denied", path: ["children.0"], rule: "unsafeUrl" })],
      })
    );
    expectDeclaredEquivalence(
      HtmlSerializeError,
      HtmlSerializeError.make({ message: "Invalid node", path: [], rule: "invalidNode" }),
      HtmlSerializeError.make({ message: "Invalid node", path: [], rule: "invalidNode" }),
      HtmlSerializeError.make({ message: "Invalid attribute", path: [], rule: "invalidAttribute" })
    );
  });

  it("compares the private attribute-domain error by its declared message", () => {
    const first = capture(() => makeAsciiCaseInsensitiveEnumerated(["foo", "FOO"]));
    const second = capture(() => makeAsciiCaseInsensitiveEnumerated(["foo", "FOO"]));
    const different = capture(() => makeSpaceSeparatedTokenList(["bar", "BAR"]));

    expectPrivateEquivalence(first, second, different);
  });

  it("compares the import-safe generator error by its declared message", () => {
    const first = capture(() =>
      assertReviewedCurrentAttributeGap({ pinned: ["href"], reviewed: [], tag: "a", webref: [] })
    );
    const second = capture(() =>
      assertReviewedCurrentAttributeGap({ pinned: ["href"], reviewed: [], tag: "a", webref: [] })
    );
    const different = capture(() =>
      assertReviewedCurrentAttributeGap({ pinned: ["src"], reviewed: [], tag: "img", webref: [] })
    );

    expectPrivateEquivalence(first, second, different);
  });
});
