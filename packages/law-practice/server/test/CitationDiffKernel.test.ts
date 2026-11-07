import * as NodeURL from "node:url";
import { makeCitationDiffKernel } from "@beep/law-practice-server/internal/Citation/DiffKernel";
import { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { readCitationDiffCorpus } from "./CitationDiffCorpus.fixtures.ts";

const loadAsset = Effect.fn("DiffKernelTest.loadAsset")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFile(NodeURL.fileURLToPath(new URL("../assets/citation-diff/kernel.wasm", import.meta.url)));
});
const request = (before: { readonly width: 1; readonly bytes: Uint8Array }, maximumInputUtf16 = 8) => ({
  before,
  after: { width: 1, bytes: new Uint8Array() },
  maximumInputUtf16,
  maximumSteps: 10,
  maximumOutputBytes: 80,
});
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("private pinned default diff host", (it) => {
  it.effect(
    "preserves every exact source edit sequence through fresh scoped native instances",
    () =>
      Effect.gen(function* () {
        const corpus = yield* readCitationDiffCorpus();
        const kernel = yield* loadAsset().pipe(Effect.flatMap(makeCitationDiffKernel));
        let steps = 0;
        for (const row of corpus.maps) {
          const actual = yield* kernel.run({
            before: row.before,
            after: row.after,
            maximumSteps: 2000000,
            maximumInputUtf16: 4000000,
            maximumOutputBytes: 16000000,
          });
          expect(actual).toEqual(row.steps);
          steps += actual.length;
        }
        expect(steps).toBe(9775);
      }),
    30000
  );
  it.effect("authenticates the copied asset and refuses malformed native input and effective ceilings", () =>
    Effect.gen(function* () {
      const asset = yield* loadAsset();
      const kernel = yield* makeCitationDiffKernel(asset);
      asset.fill(0);
      const invalidAsset = yield* makeCitationDiffKernel(asset).pipe(Effect.flip);
      expect(invalidAsset).toMatchObject({ reason: "invalid-asset" });
      const deletion = yield* kernel.run(request({ width: 1, bytes: new Uint8Array([97]) }));
      expect(deletion).toEqual([CitationSpanDiffStep.make({ operation: "-", amount: 1 })]);
      const inputRefusal = yield* kernel.run(request({ width: 1, bytes: new Uint8Array([97]) }, 0)).pipe(Effect.flip);
      expect(inputRefusal).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "diffInputUtf16",
      });
      const stepRefusal = yield* kernel
        .run({ ...request({ width: 1, bytes: new Uint8Array([97]) }), maximumSteps: 0 })
        .pipe(Effect.flip);
      expect(stepRefusal).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "diffSteps",
      });
      const messageRefusal = yield* kernel
        .run({ ...request({ width: 1, bytes: new Uint8Array([97]) }), maximumOutputBytes: 0 })
        .pipe(Effect.flip);
      expect(messageRefusal).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
      const nonBmp = {
        ...request({ width: 1, bytes: new Uint8Array() }, 1),
        before: { width: 4, bytes: new Uint8Array([0, 246, 1, 0]) },
      };
      const nonBmpRefusal = yield* kernel.run(nonBmp).pipe(Effect.flip);
      expect(nonBmpRefusal).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "diffInputUtf16",
      });
      for (const before of [
        { width: 2, bytes: new Uint8Array([97]) },
        { width: 2, bytes: new Uint8Array([97, 0]) },
        { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
      ]) {
        const invalidInput = yield* kernel
          .run({ ...request({ width: 1, bytes: new Uint8Array() }), before })
          .pipe(Effect.flip);
        expect(invalidInput).toMatchObject({ reason: "invalid-input" });
      }
      const empty = yield* kernel.run(request({ width: 1, bytes: new Uint8Array() }, 0));
      expect(empty).toEqual([]);
    })
  );
});
