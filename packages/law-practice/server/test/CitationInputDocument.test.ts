import { it } from "@beep/test-runner";
import { replayCitationInputDocument } from "./CitationInputDocument.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original input Document", (it) => {
  it.effect(
    "preserves modes, step protocols, identities and real owned cleaner/geometry composition",
    () => replayCitationInputDocument(false),
    { timeout: 120000 }
  );
  it.effect(
    "preserves the same source constructor and physical retirement on Node",
    () => replayCitationInputDocument(false, "node"),
    { timeout: 120000 }
  );
});
