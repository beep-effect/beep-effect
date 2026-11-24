import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  citationCanonicalParsedEqualityCohorts,
  replayCitationCanonicalParsedEquality,
} from "./CitationCanonicalParsedEquality.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original parsed model equality and hash",
  (it) => {
    it.effect(
      "recomputes all four original parsed equality and hash assertions on bun",
      () => replayCitationCanonicalParsedEquality("bun", 0, citationCanonicalParsedEqualityCohorts),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original equality cohort on node, the one node parity scene of this family",
      () => replayCitationCanonicalParsedEquality("node", 0, 1),
      { timeout: 180000 }
    );
  }
);
