import { it } from "@beep/test-runner";
import { replayCitationHtmlCaseName } from "../CitationHtmlCaseName.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original HTML case names", (it) => {
  it.effect("replays all 128 original HTML name mutations on Bun", () => replayCitationHtmlCaseName("bun", true), {
    timeout: 900000,
  });
  it.effect("replays all 128 original HTML name mutations on Node", () => replayCitationHtmlCaseName("node", true), {
    timeout: 900000,
  });
});
