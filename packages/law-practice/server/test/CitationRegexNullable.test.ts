import { it } from "@beep/test-runner";
import {
  refuseCitationEmptyMetadataSubstitution,
  replayCitationRegexNullable,
} from "./CitationRegexNullable.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("nullable single native regex", (it) => {
  for (const kind of ["bun"] as const) {
    it.effect(
      `matches nullable empty/nonempty captures and quotas under actual ${kind}`,
      () => replayCitationRegexNullable(kind, false),
      { timeout: 60000 }
    );
  }
  it.effect("refuses an empty match in metadata substitution", () => refuseCitationEmptyMetadataSubstitution("bun"), {
    timeout: 60000,
  });
});
