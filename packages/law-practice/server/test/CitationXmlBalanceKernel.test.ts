import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationXmlBalanceKernel } from "@beep/law-practice-server/internal/Citation/XmlBalanceKernel";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationXmlKernelFailure } from "@beep/law-practice-server/internal/Citation/XmlBalanceKernel";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationXmlBalanceKernel");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-xml/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("23df3d5dc7445e1ac9f46616ce8919eb450846b034596cc2c4072ec9160ae97a"),
    lxml: S.tag("5.1.0"),
    libxml: S.tag("2.12.3"),
    cases: S.Array(
      S.Struct({ id: S.Natural, source: CitationNativeUnicodeHex, fast: S.Boolean, value: S.Boolean, error: S.Null })
    ).check(S.isBetweenLength(300, 300)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original XML wrapper and no-angle fast-path outcomes under exact parser versions.",
  })
);
const loadAsset = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFile(NodeURL.fileURLToPath(new URL("../assets/citation-xml/kernel.wasm", import.meta.url)));
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original XML balance kernel", (it) => {
  it.effect("matches original valid, malformed, namespace, depth and native Unicode outcomes", () =>
    Effect.gen(function* () {
      const corpus = yield* readCitationOracleFixture(
        "annotation-xml",
        "8ecdd67731000b801254535338eca46e3329baa901cd16d6c49e285cf4c5bc99"
      ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
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
