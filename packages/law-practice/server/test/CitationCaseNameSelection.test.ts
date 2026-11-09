import { it } from "@beep/test-runner";
import { replayCitationCaseNameSelection } from "./CitationCaseNameSelection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original HTML/plain name selection", (it) => {
  it.effect("preserves source fallback and empty fields on Bun", () => replayCitationCaseNameSelection("bun", false), {
    timeout: 180000,
  });
});
