import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalDefaultFactory } from "./CitationCanonicalDefaultFactory.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original default factory hashes",
  (it) => {
    it.effect("recomputes all ten default model equality and persistent-hash assertions", () =>
      replayCitationCanonicalDefaultFactory()
    );
  }
);
