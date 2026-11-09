import { it } from "@beep/test-runner";
import * as A from "effect/Array";
import {
  assertCitationExtractionLoopBoundary,
  citationExtractionLoopCases,
  replayCitationExtractionLoop,
} from "./CitationExtractionLoop.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// The 36-case corpus replays in bounded slices so one slow runner cannot push a
// single case past its budget; the package default timeout applies. Bun replays
// the whole corpus; node replays the boundary plus the first slice, which holds
// case 2 (the producedTextUtf16 refusal) so the node refusal path stays proven.
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
        `preserves original pre-filter and returned state on bun for cases ${from}-${from + sliceCases - 1}`,
        () => replayCitationExtractionLoop("bun", from, sliceCases)
      );
    }
    it.effect(`preserves original identities and state on node for cases 0-${sliceCases - 1}`, () =>
      replayCitationExtractionLoop("node", 0, sliceCases)
    );
  }
);
