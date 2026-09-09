import { normalizePath, PosixPath } from "@beep/schema/PosixPath";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodePosixPathSync = S.decodeSync(PosixPath);

describe("PosixPath", () => {
  it("normalizes native separators during decode", () => {
    expect(normalizePath("packages\\foundation\\modeling\\schema")).toBe("packages/foundation/modeling/schema");
  });

  it("accepts already normalized paths", () => {
    expect(decodePosixPathSync("packages/foundation/modeling/schema")).toBe("packages/foundation/modeling/schema");
  });

  it("rejects paths that still contain backslashes", () => {
    expect(() => decodePosixPathSync("packages\\common\\schema")).toThrow("Expected a string matching");
  });
});
