import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalAnnotationWorkflows } from "./CitationCanonicalAnnotationWorkflow.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original raw annotation workflows",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes seven original annotation workflows from raw input on ${kind}`,
        () => replayCitationCanonicalAnnotationWorkflows(kind, 0, 1, true),
        { timeout: 180000 }
      );
    }
  }
);
