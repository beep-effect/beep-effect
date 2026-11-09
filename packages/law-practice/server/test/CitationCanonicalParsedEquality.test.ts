import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  citationCanonicalParsedEqualityCohorts,
  replayCitationCanonicalParsedEquality,
} from "./CitationCanonicalParsedEquality.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// Bun replays the whole cohort; node replays the first call so the node parity
// scene stays while the full family runs once (deletion addendum U2, 2026-11-09).
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original parsed model equality and hash",
  (it) => {
    it.effect(
      "recomputes all four original parsed equality and hash assertions on bun",
      () => replayCitationCanonicalParsedEquality("bun", 0, citationCanonicalParsedEqualityCohorts),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original equality cohort on node",
      () => replayCitationCanonicalParsedEquality("node", 0, 1),
      { timeout: 180000 }
    );
  }
);
