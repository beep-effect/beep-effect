import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationHtmlGeometryPreparation } from "../CitationHtmlGeometryPreparation.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete owned HTML geometry preparation",
  (it) => {
    for (const kind of CitationNativeRuntimeKind.literals)
      it.effect(
        `preserves every actual Document observation through ${kind}`,
        () => replayCitationHtmlGeometryPreparation(kind, true),
        { timeout: 600000 }
      );
  }
);
