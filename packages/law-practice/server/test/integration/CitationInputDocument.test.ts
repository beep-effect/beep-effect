import { it } from "@beep/test-runner";
import { replayCitationInputDocument } from "../CitationInputDocument.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original input Document", (it) => {
  it.effect(
    "replays all original constructor traces through owned cleaning and geometry",
    () => replayCitationInputDocument(true),
    { timeout: 600000 }
  );
});
