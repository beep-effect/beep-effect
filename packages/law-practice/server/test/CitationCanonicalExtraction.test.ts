import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalExtraction } from "./CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "canonical public extraction entry",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `replays original basic and whitespace cases on ${kind}`,
        () => replayCitationCanonicalExtraction(kind, 0, 2),
        { timeout: 180000 }
      );
    }
  }
);
