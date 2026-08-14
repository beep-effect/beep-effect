import { AiSyncError } from "@beep/ai-sync";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameAiSyncError = S.toEquivalence(AiSyncError);

describe("AI Sync declared-field equivalence", () => {
  it("treats field-equal AiSyncError instances as equivalent and field-different ones as distinct", () => {
    const a = AiSyncError.make({ cause: O.some(new Error("sync failed")), message: "validation failed" });
    const b = AiSyncError.make({ cause: O.some(new Error("sync failed")), message: "validation failed" });
    const c = AiSyncError.make({ cause: O.some(new Error("other failure")), message: "validation failed" });

    expect(sameAiSyncError(a, b)).toBe(true);
    expect(sameAiSyncError(a, c)).toBe(false);
  });
});
