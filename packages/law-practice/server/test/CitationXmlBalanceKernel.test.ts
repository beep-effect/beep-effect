import * as NodeURL from "node:url";
import { makeCitationXmlBalanceKernel } from "@beep/law-practice-server/internal/Citation/XmlBalanceKernel";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { readCitationXmlCorpus } from "./CitationXmlBalanceKernel.fixtures.ts";
import type { CitationXmlKernelFailure } from "@beep/law-practice-server/internal/Citation/XmlBalanceKernel";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

const loadAsset = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFile(NodeURL.fileURLToPath(new URL("../assets/citation-xml/kernel.wasm", import.meta.url)));
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original XML balance kernel", (it) => {
  it.effect("matches original valid, malformed, namespace, depth and native Unicode outcomes", () =>
    Effect.gen(function* () {
      const corpus = yield* readCitationXmlCorpus;
      const asset = yield* loadAsset;
      const kernel = yield* makeCitationXmlBalanceKernel(asset);
      let fast = 0;
      for (const row of corpus.cases) {
        const invocation: Effect.Effect<boolean, CitationXmlKernelFailure | CitationSafetyLimitExceeded> =
          kernel.balance(row.source);
        const result = yield* invocation;
        expect(result, `source case ${row.id}`).toBe(row.value);
        if (row.fast) fast++;
      }
      expect(fast).toBe(57);
    })
  );
  it.effect("authenticates the whole binary and rejects malformed native layouts without parsing", () =>
    Effect.gen(function* () {
      const asset = yield* loadAsset;
      const changed = new Uint8Array(asset);
      changed[0] = 1;
      const rejected = yield* makeCitationXmlBalanceKernel(changed).pipe(Effect.flip);
      expect(rejected).toMatchObject({ _tag: "CitationXmlKernelFailure", reason: "invalid-asset" });
      const kernel = yield* makeCitationXmlBalanceKernel(asset);
      for (const value of [
        CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([1]) }),
        CitationPythonUnicodeStorage.make({ width: 4, bytes: new Uint8Array([0, 0, 17, 0]) }),
      ]) {
        const failure = yield* kernel.balance(value).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationXmlKernelFailure", reason: "invalid-input" });
      }
    })
  );
});
