import * as NodeURL from "node:url";
import { makeCitationDiffKernel } from "@beep/law-practice-server/internal/Citation/DiffKernel";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

const loadKernel = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const asset = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../assets/citation-diff/kernel.wasm", import.meta.url))
  );
  return yield* makeCitationDiffKernel(asset);
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("default diff host request boundary", (it) => {
  it.effect("refuses requests outside the captured kernel request schema before native work", () =>
    Effect.gen(function* () {
      const kernel = yield* loadKernel;
      for (const raw of [
        null,
        { before: { width: 1, bytes: new Uint8Array() }, after: { width: 1, bytes: new Uint8Array() } },
        {
          before: { width: 1, bytes: new Uint8Array() },
          after: { width: 1, bytes: new Uint8Array() },
          maximumSteps: -1,
          maximumInputUtf16: 1,
          maximumOutputBytes: 8,
        },
      ]) {
        const failure = yield* kernel.run(raw).pipe(Effect.flip);
        deepStrictEqual(
          { _tag: failure._tag, reason: "reason" in failure ? failure.reason : undefined },
          { _tag: "CitationDiffKernelFailure", reason: "invalid-input" }
        );
      }
    })
  );
});
