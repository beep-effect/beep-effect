import { it } from "@beep/test-runner";
import * as A from "effect/Array";
import {
  assertCitationExtractionLoopBoundary,
  citationExtractionLoopCases,
  replayCitationExtractionLoop,
} from "./CitationExtractionLoop.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const sliceCases = 3;
const kinds = ["bun", "node"] as const;

it.layer(citationTokenizerTestLayer, { excludeTestServices: true, concurrent: false, timeout: "5 seconds" })(
  "original connected extraction loop",
  (it) => {
    for (const kind of kinds) {
      it.effect(`pins the corpus size and refuses malformed input on ${kind}`, () =>
        assertCitationExtractionLoopBoundary(kind)
      );
    }
    for (const slice of A.range(0, Math.ceil(citationExtractionLoopCases / sliceCases) - 1)) {
      const from = slice * sliceCases;
      it.effect(
        `replays bun cases ${from}-${from + sliceCases - 1} with original pre-filter and state, sliced per runner budget`,
        () => replayCitationExtractionLoop("bun", from, sliceCases)
      );
    }
    it.effect(
      `keeps original identities and state on node for cases 0-${sliceCases - 1}, holding the case 2 producedTextUtf16 refusal`,
      () => replayCitationExtractionLoop("node", 0, sliceCases)
    );
  }
);
