import { it } from "@beep/test-runner";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";
import { replayCitationXmlWorker } from "../CitationXmlWorker.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original XML worker corpus", (it) => {
  it.effect("replays every original XML outcome through Bun children", () => replayCitationXmlWorker("bun", true), {
    timeout: 180000,
  });
  it.effect("replays every original XML outcome through Node children", () => replayCitationXmlWorker("node", true), {
    timeout: 180000,
  });
});
