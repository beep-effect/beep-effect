import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationHtmlGeometryPreparationRefusal,
  replayCitationHtmlGeometryPreparation,
} from "./CitationHtmlGeometryPreparation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("owned HTML geometry preparation", (it) => {
  it.effect(
    "retires children and refuses complete geometry when the forward diff exceeds its quota",
    assertCitationHtmlGeometryPreparationRefusal,
    { timeout: 60000 }
  );
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `preserves actual Document maps and downstream queries through ${kind}`,
      () => replayCitationHtmlGeometryPreparation(kind, false),
      { timeout: 120000 }
    );
});
