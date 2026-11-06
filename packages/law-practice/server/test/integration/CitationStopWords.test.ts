import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationStopWords } from "../CitationStopWords.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source stop-word cleanup", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`replays every original cleanup through ${kind}`, () => replayCitationStopWords(kind, true), {
      timeout: 600000,
    });
});
