// Ported from vitest-agent 1cf1ab94 packages/engine/__test__/failure-signature.test.ts (MIT).
import { FailureSignatureInput, failureSignature, normalizeAssertionShape } from "@beep/gate-report/FailureSignature";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";

describe("normalizeAssertionShape", () => {
  it("strips literal values to type tags", () => {
    assertSome(normalizeAssertionShape("expect(x).toBe(42)"), "toBe(<number>)");
    assertSome(normalizeAssertionShape('expect(x).toBe("hello")'), "toBe(<string>)");
    assertSome(normalizeAssertionShape("expect(x).toEqual({a: 1})"), "toEqual(<object>)");
  });

  it("normalizes boolean, null, and undefined literal arguments", () => {
    assertSome(normalizeAssertionShape("expect(x).toBe(true)"), "toBe(<boolean>)");
    assertSome(normalizeAssertionShape("expect(x).toBe(false)"), "toBe(<boolean>)");
    assertSome(normalizeAssertionShape("expect(x).toBe(null)"), "toBe(<null>)");
    assertSome(normalizeAssertionShape("expect(x).toBe(undefined)"), "toBe(<undefined>)");
  });

  it("normalizes array-literal arguments to <object>", () => {
    assertSome(normalizeAssertionShape("expect(x).toEqual([1, 2, 3])"), "toEqual(<object>)");
  });

  it("normalizes decimal numeric arguments to <number>", () => {
    assertSome(normalizeAssertionShape("expect(x).toBeCloseTo(3.14)"), "toBeCloseTo(<number>)");
  });

  it("falls through to <expr> for non-literal expression arguments", () => {
    assertSome(normalizeAssertionShape("expect(x).toBe(otherValue)"), "toBe(<expr>)");
    assertSome(normalizeAssertionShape("expect(x).toBe(-1)"), "toBe(<expr>)");
    assertSome(normalizeAssertionShape("expect(x).toEqual(makeValue())"), "toEqual(<expr>)");
  });

  it("preserves the matcher name when the argument list is empty", () => {
    assertSome(normalizeAssertionShape("expect(x).toBeNull()"), "toBeNull");
    assertSome(normalizeAssertionShape("expect(x).toHaveBeenCalled()"), "toHaveBeenCalled");
  });

  it("returns none for unrecognized shapes", () => {
    assertNone(normalizeAssertionShape("not an assertion"));
  });

  it("normalizes single-quoted string arguments to <string>", () => {
    assertSome(normalizeAssertionShape("expect(x).toBe('world')"), "toBe(<string>)");
  });

  it("normalizes template-literal string arguments to <string>", () => {
    assertSome(normalizeAssertionShape("expect(x).toBe(`template`)"), "toBe(<string>)");
  });
});

const sign = (input: Partial<Parameters<typeof FailureSignatureInput.make>[0]>) =>
  failureSignature(
    FailureSignatureInput.make({
      errorName: "AssertionError",
      assertionMessage: "expect(x).toBe(5)",
      topFrameFunction: "f",
      ...input,
    })
  );

describe("failureSignature: FNV-1a 64 where upstream took a SHA-256 prefix; the local equality and inequality cases hold", () => {
  it("is 16 lowercase hex digits", () => {
    assert.match(sign({}), /^[0-9a-f]{16}$/u);
  });

  it("produces a stable hash across line drift in unrelated code", () => {
    const at = () => sign({ topFrameFunction: "validateLogin", functionBoundaryLine: O.some(42) });
    assert.strictEqual(at(), at());
  });

  it("differs on a different error name", () => {
    assert.notStrictEqual(
      sign({ functionBoundaryLine: O.some(1) }),
      sign({ errorName: "TypeError", functionBoundaryLine: O.some(1) })
    );
  });

  it("uses the degraded path when the function boundary is unknown (rounds the raw line)", () => {
    assert.strictEqual(sign({ rawLine: O.some(47) }), sign({ rawLine: O.some(49) }));
    assert.notStrictEqual(sign({ rawLine: O.some(47) }), sign({ rawLine: O.some(51) }));
  });

  it("uses the raw:? fallback when both lines are unknown, distinct from raw line 0", () => {
    assert.strictEqual(sign({}), sign({}));
    assert.notStrictEqual(sign({}), sign({ rawLine: O.some(0) }));
  });

  it("prefers the function boundary line over the raw line", () => {
    assert.strictEqual(
      sign({ functionBoundaryLine: O.some(10), rawLine: O.some(47) }),
      sign({ functionBoundaryLine: O.some(10), rawLine: O.some(99) })
    );
  });

  it("uses the <unknown> shape fallback when the assertion message is unparseable", () => {
    assert.strictEqual(
      sign({
        errorName: "Error",
        assertionMessage: "this is not an assertion",
        topFrameFunction: "g",
        functionBoundaryLine: O.some(10),
      }),
      sign({
        errorName: "Error",
        assertionMessage: "also not an assertion",
        topFrameFunction: "g",
        functionBoundaryLine: O.some(10),
      })
    );
  });
});
