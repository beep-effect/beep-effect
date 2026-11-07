import { it } from "@beep/test-runner";
import * as A from "effect/Array";
import {
  assertCitationExtractionLoopBoundary,
  citationExtractionLoopCases,
  replayCitationExtractionLoop,
} from "./CitationExtractionLoop.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// The 36-case corpus replays in bounded slices per runtime so one slow runner
// cannot push a single case past its budget; the package default timeout applies.
const sliceCases = 3;
const kinds = [
  ["bun", "pre-filter and returned state on Bun"],
  ["node", "identities and state on Node"],
] as const;

it.layer(citationTokenizerTestLayer, { excludeTestServices: true, concurrent: false, timeout: "5 seconds" })(
  "original connected extraction loop",
  (it) => {
    for (const [kind, label] of kinds) {
      it.effect(`pins the corpus size and refuses malformed input on ${kind}`, () =>
        assertCitationExtractionLoopBoundary(kind)
      );
      for (const slice of A.range(0, Math.ceil(citationExtractionLoopCases / sliceCases) - 1)) {
        const from = slice * sliceCases;
        it.effect(`preserves original ${label} for cases ${from}-${from + sliceCases - 1}`, () =>
          replayCitationExtractionLoop(kind, from, sliceCases)
        );
      }
    }
  }
);
