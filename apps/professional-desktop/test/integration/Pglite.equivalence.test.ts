import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { IncompatiblePgliteDataDir } from "@/runtime/Pglite";

const sameIncompatiblePgliteDataDir = S.toEquivalence(IncompatiblePgliteDataDir);

describe("PGlite tagged-error declared equivalence", () => {
  it("excludes IncompatiblePgliteDataDir cause from diagnostic identity", () => {
    const a = IncompatiblePgliteDataDir.make({
      cause: new Error("first"),
      dataDir: "/data/chat-db",
      recovery: "Export with the prior desktop build.",
    });
    const b = IncompatiblePgliteDataDir.make({
      cause: new Error("second"),
      dataDir: "/data/chat-db",
      recovery: "Export with the prior desktop build.",
    });
    const c = IncompatiblePgliteDataDir.make({
      cause: new Error("first"),
      dataDir: "/data/other-chat-db",
      recovery: "Export with the prior desktop build.",
    });

    expect(sameIncompatiblePgliteDataDir(a, b)).toBe(true);
    expect(sameIncompatiblePgliteDataDir(a, c)).toBe(false);
  });
});
