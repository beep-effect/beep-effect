import { shellQuote } from "@beep/repo-utils/Shell";
import { describe, expect, it } from "@effect/vitest";

describe("shellQuote", () => {
  it("wraps a plain value in single quotes", () => {
    expect(shellQuote("op://vault/item/field")).toBe("'op://vault/item/field'");
  });

  it("keeps spaces and shell metacharacters inside one token", () => {
    expect(shellQuote("a b $HOME `x`")).toBe("'a b $HOME `x`'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  it("quotes the empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
});
