import { RunpodDocsError } from "@beep/runpod";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameRunpodDocsError = S.toEquivalence(RunpodDocsError);

describe("Runpod declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different ones as distinct", () => {
    const a = RunpodDocsError.fromReason("transport", { url: "https://docs.runpod.io" });
    const b = RunpodDocsError.fromReason("transport", { url: "https://docs.runpod.io" });
    const c = RunpodDocsError.fromReason("transport", { url: "https://api.runpod.io" });

    expect(sameRunpodDocsError(a, b)).toBe(true);
    expect(sameRunpodDocsError(a, c)).toBe(false);
  });
});
