import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalParsedEquality } from "./CitationCanonicalParsedEquality.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original parsed model equality and hash",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes all four original parsed equality and hash assertions on ${kind}`,
        () => replayCitationCanonicalParsedEquality(kind),
        { timeout: 180000 }
      );
    }
  }
);
