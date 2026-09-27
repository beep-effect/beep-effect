import { inspectPandocConformance } from "@beep/pandoc-ast/Pandoc.conformance";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { vi } from "vitest";

vi.mock("@beep/pandoc-ast/Pandoc.codec", (importOriginal) =>
  Promise.all([importOriginal<typeof import("@beep/pandoc-ast/Pandoc.codec")>(), import("effect/Effect")]).then(
    ([codec, EffectModule]) => ({
      ...codec,
      decodePandocJsonStrict: () =>
        EffectModule.fail({
          _tag: "ForcedStrictProjectionFailure",
          message: "forced strict projection failure",
        }),
    })
  )
);

describe("Pandoc conformance strict projection failure", () => {
  it.effect(
    "retains a losslessly valid wire when its strict projection fails",
    Effect.fnUntraced(function* () {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [],
        meta: {},
      };
      const result = yield* inspectPandocConformance(wire);

      expect(result._tag).toBe("invalid");
      if (result._tag === "invalid") {
        expect(result.message).toBe("forced strict projection failure");
        expect(result.issues).toEqual([]);
        assertSome(result.wire, wire);
      }
    })
  );
});
