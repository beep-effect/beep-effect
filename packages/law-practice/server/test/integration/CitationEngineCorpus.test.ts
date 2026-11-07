import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationEngineCorpus } from "../CitationEngineCorpus.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "complete public engine original corpus",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `replays all 36 pinned source documents through the public Layer on ${kind}`,
        () => replayCitationEngineCorpus(kind, true),
        { timeout: 600000 }
      );
    }
  }
);
