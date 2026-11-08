import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalResourceComparison } from "./CitationCanonicalResourceComparison.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original retained Resource comparison",
  (it) => {
    it.effect("recomputes original Resource equality, exact hash and persistent hash assertions", () =>
      replayCitationCanonicalResourceComparison()
    );
  }
);
