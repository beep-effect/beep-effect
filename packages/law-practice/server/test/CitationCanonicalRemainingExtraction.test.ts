import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalRemainingExtraction } from "./CitationCanonicalRemainingExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original remaining cleaner profiles",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `replays all five original cleaner and argument profiles on ${kind}`,
        () => replayCitationCanonicalRemainingExtraction(kind, 0, 1, true),
        { timeout: 180000 }
      );
    }
  }
);
