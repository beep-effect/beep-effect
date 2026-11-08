import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCapturedCleanerPlan } from "./CitationCapturedCleanerPlan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "captured custom extraction cleaner",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `replays original quote cleaning and refuses forged or failing plans on ${kind}`,
        () => replayCitationCapturedCleanerPlan(kind),
        { timeout: 180000 }
      );
    }
  }
);
