import { it } from "@beep/test-runner";
import { replayCitationCaseName } from "../CitationCaseName.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original plain case name", (it) => {
  it.effect("replays all 256 original calls on Bun", () => replayCitationCaseName("bun", true), { timeout: 1200000 });
  it.effect("replays all 256 original calls on Node", () => replayCitationCaseName("node", true), { timeout: 1200000 });
});
