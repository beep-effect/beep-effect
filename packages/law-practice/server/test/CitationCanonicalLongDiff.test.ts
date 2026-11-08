import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalLongDiff } from "./CitationCanonicalLongDiff.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original full-opinion long diff",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes original full-opinion cleaning and annotation on ${kind}`,
        () => replayCitationCanonicalLongDiff(kind),
        { timeout: 180000 }
      );
    }
  }
);
