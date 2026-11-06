import { it } from "@beep/test-runner";
import { replayCitationGeneratedReferences } from "./CitationGeneratedReferences.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original generated pincited references", (it) => {
  it.effect("constructs every original reference state on Bun", () => replayCitationGeneratedReferences("bun"), {
    timeout: 180000,
  });
  it.effect(
    "preserves the same state and independent retirement on Node",
    () => replayCitationGeneratedReferences("node"),
    { timeout: 180000 }
  );
});
