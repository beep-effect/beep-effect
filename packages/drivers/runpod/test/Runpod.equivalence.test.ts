import {
  RunpodDocsError,
  RunpodDocsErrorOptionsInput,
  RunpodHttpMethod,
  RunpodOperationId,
  RunpodRequestBodyKind,
  RunpodResponseBodyKind,
} from "@beep/runpod";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const sameRunpodDocsError = S.toEquivalence(RunpodDocsError);

describe("Runpod declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different ones as distinct", () => {
    const a = RunpodDocsError.fromReason(
      "transport",
      RunpodDocsErrorOptionsInput.make({ url: "https://docs.runpod.io" })
    );
    const b = RunpodDocsError.fromReason(
      "transport",
      RunpodDocsErrorOptionsInput.make({ url: "https://docs.runpod.io" })
    );
    const c = RunpodDocsError.fromReason(
      "transport",
      RunpodDocsErrorOptionsInput.make({ url: "https://api.runpod.io" })
    );

    expect(sameRunpodDocsError(a, b)).toBe(true);
    expect(sameRunpodDocsError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const a = RunpodDocsError.fromReason(
      "transport",
      RunpodDocsErrorOptionsInput.make({
        cause: new Error("first failure"),
        url: "https://docs.runpod.io",
      })
    );
    const b = RunpodDocsError.fromReason(
      "transport",
      RunpodDocsErrorOptionsInput.make({
        cause: new Error("second failure"),
        url: "https://docs.runpod.io",
      })
    );

    expect(sameRunpodDocsError(a, b), "the defect cause is payload, never identity").toBe(true);
  });
});

describe("generated literal schemas carry no codec statics", () => {
  const schemas = {
    RunpodHttpMethod,
    RunpodOperationId,
    RunpodRequestBodyKind,
    RunpodResponseBodyKind,
  };

  it("keeps the LiteralKit keyed helpers and attaches no decode facade", () => {
    for (const [name, schema] of R.toEntries(schemas)) {
      expect(Reflect.has(schema, "decodeOption"), name).toBe(false);
      expect(Reflect.has(schema, "fromUnknown"), name).toBe(false);
      expect(Reflect.has(schema, "Enum"), name).toBe(true);
    }
    expect(S.is(RunpodHttpMethod)("GET")).toBe(true);
  });
});
