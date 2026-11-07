import { it } from "@beep/test-runner";
import { replayCitationCaseMetadata } from "../CitationCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original full-case metadata", (it) => {
  it.effect("replays all 80 original full-model transitions on Bun", () => replayCitationCaseMetadata("bun", true), {
    timeout: 1200000,
  });
  it.effect("replays all 80 original full-model transitions on Node", () => replayCitationCaseMetadata("node", true), {
    timeout: 1200000,
  });
});
