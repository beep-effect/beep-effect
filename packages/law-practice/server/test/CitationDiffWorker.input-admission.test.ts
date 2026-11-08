import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeCitationDiffWorkerFixture } from "./CitationDiffWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("diff input admission", (it) => {
  it.effect("refuses malformed requests and quota escalation before starting a native process", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const { worker, observed, admission } = yield* makeCitationDiffWorkerFixture("bun", limits);
      const before = { width: 1, bytes: new Uint8Array([97]) };
      const after = { width: 1, bytes: new Uint8Array([98]) };
      for (const quota of [-1, "1", null]) {
        const rejected = yield* worker.evaluate(before, after, quota).pipe(Effect.flip);
        assert.match(rejected._tag, /CitationDiffWorkerFailure/);
        assert.propertyVal(rejected, "reason", "invalid-runtime");
      }
      const escalated = yield* worker.evaluate(before, after, limits.diffSteps + 1).pipe(Effect.flip);
      assert.propertyVal(escalated, "_tag", "CitationSafetyLimitExceeded");
      assert.propertyVal(escalated, "limit", "diffSteps");
      for (const request of [
        { before: {}, after },
        { before, after: {} },
        { before: { width: 2, bytes: new Uint8Array([97]) }, after },
        { before, after: { width: 3, bytes: new Uint8Array([98]) } },
      ]) {
        const rejected = yield* worker.evaluate(request.before, request.after).pipe(Effect.flip);
        assert.propertyVal(rejected, "_tag", "CitationDiffKernelFailure");
        assert.propertyVal(rejected, "reason", "invalid-input");
      }
      const counts = yield* observed.snapshot;
      assert.propertyVal(counts, "spawned", 0);
      assert.propertyVal(counts, "confirmed", 0);
      const owned = yield* admission.snapshot;
      assert.propertyVal(owned, "active", 0);
      assert.propertyVal(owned, "queued", 0);
      assert.propertyVal(owned, "quarantined", 0);
    })
  );
});
