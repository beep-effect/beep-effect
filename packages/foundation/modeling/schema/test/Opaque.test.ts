import { $SchemaId } from "@beep/identity";
import { Defect } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("DefectTest");

class ProbeError extends S.TaggedError<ProbeError>($I`ProbeError`)(
  "ProbeError",
  { reason: S.String, cause: S.optionalKey(Defect({ includeStack: true })) },
  $I.annoteError<ProbeError>("ProbeError", { description: "Probe failure." })
) {}

describe("Defect", () => {
  it("declares two defects equivalent so a cause never takes part in diagnostic identity", () => {
    const same = S.toEquivalence(ProbeError);
    const a = ProbeError.make({ reason: "x", cause: new Error("first") });
    const b = ProbeError.make({ reason: "x", cause: new Error("second") });
    const c = ProbeError.make({ reason: "y", cause: new Error("first") });

    expect(same(a, b)).toBe(true);
    expect(same(a, c)).toBe(false);
  });

  it.effect(
    "keeps Effect's defect decoding intact",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(Defect())({ message: "boom", name: "Error" });

      expect(decoded).toBeInstanceOf(Error);
    })
  );
});
