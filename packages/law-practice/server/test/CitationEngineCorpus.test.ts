import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationEngineCorpus } from "./CitationEngineCorpus.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "public engine original source corpus",
  (it) => {
    for (const kind of ["bun"] as const) {
      it.effect(
        `retains all eight families, exact Unicode/HTML spans and completed documents on ${kind}`,
        () => replayCitationEngineCorpus(kind, false),
        { timeout: 180000 }
      );
    }
  }
);
