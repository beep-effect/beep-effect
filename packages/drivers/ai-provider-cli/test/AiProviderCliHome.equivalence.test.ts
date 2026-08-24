import { AiProviderCliHomeFileSystemError, AiProviderCliHomePathConflictError } from "@beep/ai-provider-cli";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameAiProviderCliHomeFileSystemError = S.toEquivalence(AiProviderCliHomeFileSystemError);
const sameAiProviderCliHomePathConflictError = S.toEquivalence(AiProviderCliHomePathConflictError);

describe("AI provider CLI home declared-field equivalence", () => {
  it("treats field-equal path conflicts as equivalent and field-different ones as distinct", () => {
    const a = AiProviderCliHomePathConflictError.make({
      effectiveHomePath: "/home/dev/.codex",
      sharedHomePath: "/home/dev/.codex",
    });
    const b = AiProviderCliHomePathConflictError.make({
      effectiveHomePath: "/home/dev/.codex",
      sharedHomePath: "/home/dev/.codex",
    });
    const c = AiProviderCliHomePathConflictError.make({
      effectiveHomePath: "/tmp/shadow-codex",
      sharedHomePath: "/home/dev/.codex",
    });

    expect(sameAiProviderCliHomePathConflictError(a, b)).toBe(true);
    expect(sameAiProviderCliHomePathConflictError(a, c)).toBe(false);
  });

  it("excludes the optional opaque defect cause from diagnostic identity", () => {
    const a = AiProviderCliHomeFileSystemError.make({
      cause: O.some("first"),
      effectiveHomePath: "/tmp/shadow-codex",
      entryName: O.some("sessions"),
      operation: "symlink",
      path: "/tmp/shadow-codex/sessions",
      sharedHomePath: "/home/dev/.codex",
      targetPath: O.some("/home/dev/.codex/sessions"),
    });
    const b = AiProviderCliHomeFileSystemError.make({
      cause: O.some("second"),
      effectiveHomePath: "/tmp/shadow-codex",
      entryName: O.some("sessions"),
      operation: "symlink",
      path: "/tmp/shadow-codex/sessions",
      sharedHomePath: "/home/dev/.codex",
      targetPath: O.some("/home/dev/.codex/sessions"),
    });

    expect(sameAiProviderCliHomeFileSystemError(a, b)).toBe(true);
  });
});
