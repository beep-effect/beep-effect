import { it } from "@beep/test-runner";
import { sanitizeAnchorHref } from "@beep/ui/lib/url";
import { describe, expect } from "@effect/vitest";

describe("sanitizeAnchorHref", () => {
  it("preserves safe absolute and relative navigation", () => {
    expect(sanitizeAnchorHref("https://example.com/docs")).toBe("https://example.com/docs");
    expect(sanitizeAnchorHref("/workspace/notes")).toBe("/workspace/notes");
    expect(sanitizeAnchorHref("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("blocks active script protocols", () => {
    expect(sanitizeAnchorHref("javascript:alert(1)")).toBe("#");
    expect(sanitizeAnchorHref("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(sanitizeAnchorHref("vbscript:msgbox(1)")).toBe("#");
  });

  it("blocks obfuscated active script protocols", () => {
    expect(sanitizeAnchorHref(" \n JaVaScRiPt:alert(1)")).toBe("#");
    expect(sanitizeAnchorHref("javascript&#x3a;alert(1)")).toBe("#");
    expect(sanitizeAnchorHref("javascript%3Aalert(1)")).toBe("#");
    expect(sanitizeAnchorHref("javascript%26colon;alert(1)")).toBe("#");
    expect(sanitizeAnchorHref("javascript%26%2358%3balert(1)")).toBe("#");
    expect(sanitizeAnchorHref("java&tab;script&colon;alert(1)")).toBe("#");
    expect(sanitizeAnchorHref("java&newline;script:alert(1)")).toBe("#");
    expect(sanitizeAnchorHref("%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574%253aalert(1)")).toBe("#");
  });

  it("leaves over-nested percent encoding unchanged after bounded decode passes", () => {
    const href = "%25252525256a%252525252561%252525252576%252525252561%252525252573cript%25252525253aalert(1)";

    expect(sanitizeAnchorHref(href)).toBe(href);
  });

  it("preserves invalid numeric character references", () => {
    const href = "javascript&#999999999999999999999999999;alert(1)";

    expect(sanitizeAnchorHref(href)).toBe(href);
  });
});
