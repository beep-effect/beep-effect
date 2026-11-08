import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalAnnotationWorkflows } from "../CitationCanonicalAnnotationWorkflow.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all original raw annotation workflows",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      for (let shard = 0; shard < 4; shard++) {
        it.effect(
          `recomputes original annotation workflow group ${shard} on ${kind}`,
          () => replayCitationCanonicalAnnotationWorkflows(kind, shard, 6),
          { timeout: 600000 }
        );
      }
    }
  }
);
