import { it } from "@beep/test-runner";
import { replayCitationCaseNameSelection } from "./CitationCaseNameSelection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original HTML/plain name selection", (it) => {
  it.effect("preserves source fallback and empty fields on Bun", () => replayCitationCaseNameSelection("bun", false), {
    timeout: 180000,
  });
  it.effect(
    "preserves the same selection and confirmed retirement on Node",
    () => replayCitationCaseNameSelection("node", false),
    { timeout: 180000 }
  );
});
