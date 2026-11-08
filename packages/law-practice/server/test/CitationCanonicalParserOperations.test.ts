import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalParserOperations } from "./CitationCanonicalParserOperations.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original resolver parser fragments",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `replays the first original fragment of all seven citation kinds on ${kind}`,
        () => replayCitationCanonicalParserOperations(kind, 0, 1, true),
        { timeout: 180000 }
      );
    }
  }
);
