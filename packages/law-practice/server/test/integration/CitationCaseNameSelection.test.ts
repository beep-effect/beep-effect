import { it } from "@beep/test-runner";
import { replayCitationCaseNameSelection } from "../CitationCaseNameSelection.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original name selection", (it) => {
  it.effect("replays all 272 original callers on Bun", () => replayCitationCaseNameSelection("bun", true), {
    timeout: 1200000,
  });
  it.effect("replays all 272 original callers on Node", () => replayCitationCaseNameSelection("node", true), {
    timeout: 1200000,
  });
});
