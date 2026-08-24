import { DatasetLoadError } from "@beep/nlp-mcp/Streaming/DatasetLoader";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameDatasetLoadError = S.toEquivalence(DatasetLoadError);

describe("NLP MCP declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = DatasetLoadError.make({ location: "/tmp/data.json", message: "decode failed" });
    const b = DatasetLoadError.make({ location: "/tmp/data.json", message: "decode failed" });
    const c = DatasetLoadError.make({ location: "/tmp/other.json", message: "decode failed" });

    expect(sameDatasetLoadError(a, b)).toBe(true);
    expect(sameDatasetLoadError(a, c)).toBe(false);
  });

  it("ignores the opaque defect cause", () => {
    const a = DatasetLoadError.make({
      cause: O.some(new Error("first cause")),
      location: "/tmp/data.json",
      message: "decode failed",
    });
    const b = DatasetLoadError.make({
      cause: O.some(new Error("second cause")),
      location: "/tmp/data.json",
      message: "decode failed",
    });

    expect(sameDatasetLoadError(a, b)).toBe(true);
  });
});
