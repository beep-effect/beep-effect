import { packCitationDiffSteps, unpackCitationDiffSteps } from "@beep/law-practice-server/internal/Citation/DiffSteps";
import { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { it } from "@beep/test-runner";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

// Cycle DELETE/INSERT/EQUAL so every native code is packed, and exceed one
// 256-step cooperative yield window in both directions.
const cycle = (count: number) =>
  A.makeBy(count, (index) =>
    CitationSpanDiffStep.make({ operation: A.getUnsafe(["-", "+", "="] as const, index % 3), amount: 1 })
  );
const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});

it.effect("packs every native operation code across a yield window and round-trips the complete steps", () =>
  Effect.gen(function* () {
    const steps = cycle(300);
    const packed = yield* packCitationDiffSteps(steps, 4096);
    strictEqual(packed.byteLength, 2400);
    deepStrictEqual(
      A.fromIterable(packed.subarray(0, 24)),
      [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0]
    );
    const unpacked = yield* unpackCitationDiffSteps(packed, 300, 200, 200);
    deepStrictEqual(unpacked, steps);
  })
);

it.effect("refuses packing more steps than the complete success frame can carry", () =>
  Effect.gen(function* () {
    const failure = yield* packCitationDiffSteps(cycle(1000), 4096).pipe(Effect.flip);
    deepStrictEqual(refusal(failure), { _tag: "CitationSafetyLimitExceeded", detail: "processMessageBytes" });
  })
);

it.effect("refuses truncated step frames and step counts beyond the effective ceiling before decoding", () =>
  Effect.gen(function* () {
    const truncated = yield* unpackCitationDiffSteps(new Uint8Array(7), 10, 0, 0).pipe(Effect.flip);
    deepStrictEqual(refusal(truncated), { _tag: "CitationDiffWorkerFailure", detail: "invalid-frame" });
    const packed = yield* packCitationDiffSteps(cycle(2), 4096);
    const excess = yield* unpackCitationDiffSteps(packed, 1, 1, 1).pipe(Effect.flip);
    deepStrictEqual(refusal(excess), { _tag: "CitationSafetyLimitExceeded", detail: "diffSteps" });
  })
);
