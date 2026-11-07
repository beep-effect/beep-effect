import { it } from "@beep/test-runner";
import {
  assertCitationHtmlCaseNameLifetime,
  assertCitationHtmlCaseNameRefusal,
  replayCitationHtmlCaseName,
} from "./CitationHtmlCaseName.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original HTML case names", (it) => {
  it.effect("refuses invalid and over-budget work before child execution", assertCitationHtmlCaseNameRefusal, {
    timeout: 120000,
  });
  it.effect("captures its owner lifetime", assertCitationHtmlCaseNameLifetime, { timeout: 120000 });
  it.effect(
    "connects all five source branches to owned geometry and cleanup on Bun",
    () => replayCitationHtmlCaseName("bun", false),
    { timeout: 180000 }
  );
  it.effect(
    "connects the same source branches and retirement on Node",
    () => replayCitationHtmlCaseName("node", false),
    { timeout: 180000 }
  );
});
