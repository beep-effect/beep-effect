import { normalizePath, PosixPath } from "@beep/schema/PosixPath";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("PosixPath", () => {
  it("normalizes native separators during decode", () => {
    expect(normalizePath("packages\\foundation\\modeling\\schema")).toBe("packages/foundation/modeling/schema");
  });

  it("accepts already normalized paths", () => {
    expect(S.decodeSync(PosixPath)("packages/foundation/modeling/schema")).toBe("packages/foundation/modeling/schema");
  });

  it("rejects paths that still contain backslashes", () => {
    expect(() => S.decodeSync(PosixPath)("packages\\common\\schema")).toThrow("Expected a string matching");
  });
});
