import { FirecrawlError } from "@beep/firecrawl";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

const sameFirecrawlError = S.toEquivalence(FirecrawlError);

describe("Firecrawl declared-field equivalence", () => {
  it("treats field-equal FirecrawlError instances as equivalent and field-different ones as distinct", () => {
    const a = FirecrawlError.fromReason("transport", { method: "scrape" });
    const b = FirecrawlError.fromReason("transport", { method: "scrape" });
    const c = FirecrawlError.fromReason("response status", { method: "scrape" });

    expect(sameFirecrawlError(a, b)).toBe(true);
    expect(sameFirecrawlError(a, c)).toBe(false);
  });
});
