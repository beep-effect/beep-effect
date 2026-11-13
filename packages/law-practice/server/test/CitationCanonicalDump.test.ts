import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalDump } from "./CitationCanonicalDump.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original debug output",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes the original complete debug output on ${kind}`,
        () => withCitationTestInvocation(replayCitationCanonicalDump(kind)),
        {
          timeout: 180000,
        }
      );
    }
  }
);
