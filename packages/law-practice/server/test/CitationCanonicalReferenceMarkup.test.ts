import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalReferenceMarkup } from "./CitationCanonicalReferenceMarkup.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original HTML reference criteria",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      for (const family of ["references", "filtering"] as const) {
        it.effect(
          `replays the original ${family} entry on ${kind}`,
          () => replayCitationCanonicalReferenceMarkup(kind, family, true),
          { timeout: 180000 }
        );
      }
    }
  }
);
