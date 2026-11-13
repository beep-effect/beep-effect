import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  citationCanonicalFullSpanCalls,
  replayCitationCanonicalFullSpan,
} from "./CitationCanonicalFullSpan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// Bun replays the whole cohort; node replays the first call so the node parity
// scene stays while the full family runs once (deletion addendum U2, 2026-11-09).
// The bun cohort runs as two slices. As one test it took 101-178 s on hosted
// runners against the 180 s watchdog and timed out in about one run in six.
// Each slice pays the replay setup once (about 20 s), and the two slices
// together still recompute every call and all thirteen equalities.
const firstSlice = Math.ceil(citationCanonicalFullSpanCalls / 2);

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original full-span assertions",
  (it) => {
    it.effect(
      "recomputes the first half of the original full-span calls on bun",
      () => replayCitationCanonicalFullSpan("bun", 0, firstSlice),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the second half of the original full-span calls on bun",
      () => replayCitationCanonicalFullSpan("bun", firstSlice, citationCanonicalFullSpanCalls - firstSlice),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original full-span call on node",
      () => replayCitationCanonicalFullSpan("node", 0, 1),
      { timeout: 180000 }
    );
  }
);
