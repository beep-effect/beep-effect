import { it } from "@beep/test-runner";
import { replayCitationExtractionSelection } from "./CitationExtractionSelection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original final citation selection", (it) => {
  it.effect(
    "preserves all retained identities, order, ambiguity decisions and warning pairs",
    replayCitationExtractionSelection
  );
});
