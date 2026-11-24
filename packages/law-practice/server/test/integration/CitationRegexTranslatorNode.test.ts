import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { qualifyCitationRegexTranslator } from "../CitationRegexTranslator.fixtures.ts";

// decision: citation-integration-replay-files
const kind = "node";

it.layer(BunServices.layer, { excludeTestServices: true })(`native regex translation on ${kind}`, (it) => {
  for (const smoke of [false, true]) {
    it.effect(
      smoke
        ? `smoke checks three source witnesses under ${kind}`
        : `compiles every extractor and checks every scalar against source classes plus controlled captures under ${kind}`,
      () => qualifyCitationRegexTranslator(kind, smoke).pipe(Effect.timeout(Duration.minutes(14))),
      { timeout: smoke ? 30_000 : 900_000 }
    );
  }
});
