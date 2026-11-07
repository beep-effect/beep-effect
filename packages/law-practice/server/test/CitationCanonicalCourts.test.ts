import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalCourtExtraction } from "./CitationCanonicalParserOperations.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original court extraction assertions",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `replays original state bankruptcy panel and dated Westlaw court entries on ${kind}`,
        () => replayCitationCanonicalCourtExtraction(kind, 0, 1, true),
        { timeout: 180000 }
      );
    }
  }
);
