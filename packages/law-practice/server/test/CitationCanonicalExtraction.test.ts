import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalExtraction } from "./CitationCanonicalExtraction.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "canonical public extraction entry",
  (it) => {
    for (const kind of ["bun"] as const) {
      it.effect(
        `replays original basic and whitespace cases on ${kind}`,
        () => withCitationTestInvocation(replayCitationCanonicalExtraction(kind, 0, 2)),
        { timeout: 180000 }
      );
      for (const family of ["law", "journal", "tax", "ambiguous", "markup"] as const) {
        it.effect(
          `replays the original ${family} entry on ${kind}`,
          () => withCitationTestInvocation(replayCitationCanonicalExtraction(kind, 0, 1, family)),
          { timeout: 180000 }
        );
      }
      it.effect(
        `removes the original unresolved Johnson ambiguity on ${kind}`,
        () => withCitationTestInvocation(replayCitationCanonicalExtraction(kind, 10, 1, "ambiguous")),
        { timeout: 180000 }
      );
    }
  }
);
