import * as NodeURL from "node:url";
import { makeCitationXmlBalanceKernel } from "@beep/law-practice-server/internal/Citation/XmlBalanceKernel";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { assertFalse, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const loadKernel = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const asset = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../assets/citation-xml/kernel.wasm", import.meta.url))
  );
  return yield* makeCitationXmlBalanceKernel(asset);
});
const latin = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("XML balance kernel refusals", (it) => {
  it.effect("answers balanced and unbalanced markup through one fresh native instance per query", () =>
    Effect.gen(function* () {
      const kernel = yield* loadKernel;
      const balanced = yield* kernel.balance(latin("<a><b>x</b></a>"));
      assertTrue(balanced);
      const unbalanced = yield* kernel.balance(latin("<a><b>x</a>"));
      assertFalse(unbalanced);
    })
  );
  it.effect("refuses non-storage input and storage wider than its largest point", () =>
    Effect.gen(function* () {
      const kernel = yield* loadKernel;
      const malformed = yield* kernel.balance({ width: 3, bytes: "x" }).pipe(Effect.flip);
      deepStrictEqual(refusal(malformed), { _tag: "CitationXmlKernelFailure", detail: "invalid-input" });
      // Width 2 storage whose only point fits Latin-1 is not Python's canonical layout.
      const widened = yield* kernel
        .balance(CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x41, 0]) }))
        .pipe(Effect.flip);
      deepStrictEqual(refusal(widened), { _tag: "CitationXmlKernelFailure", detail: "invalid-input" });
    })
  );
  it.effect("refuses sources beyond the absolute point count or UTF-16 ceiling before native evaluation", () =>
    Effect.gen(function* () {
      const kernel = yield* loadKernel;
      const points = yield* kernel
        .balance(CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(1_000_001).fill(0x61) }))
        .pipe(Effect.flip);
      deepStrictEqual(refusal(points), { _tag: "CitationSafetyLimitExceeded", detail: "sourceUtf16" });
      // 600000 astral points stay under the point ceiling but need 1.2M UTF-16 units.
      const astral = new Uint8Array(4 * 600_000);
      const view = new DataView(astral.buffer);
      for (let index = 0; index < 600_000; index++) view.setUint32(index * 4, 0x1f600, true);
      const units = yield* kernel
        .balance(CitationPythonUnicodeStorage.make({ width: 4, bytes: astral }))
        .pipe(Effect.flip);
      deepStrictEqual(refusal(units), { _tag: "CitationSafetyLimitExceeded", detail: "sourceUtf16" });
    })
  );
});
