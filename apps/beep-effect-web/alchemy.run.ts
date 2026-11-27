import * as AWS from "@alchemy.run/aws";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { apexHost, wwwHost } from "./src/PublicHosts.ts";

const productionStage = "prod";

// decision: pinned-prod-worker-name
const productionWorkerName = "beepeffectweb-website-prod-lu7dco5dnf2llcs2";

// decision: shared-s3-state-store
const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The TanStack Start site. `rootDir` is anchored to this file because the
 * Alchemy CLI resolves relative paths from where it is invoked.
 */
export const Website = Cloudflare.Website.Vite(
  "Website",
  Alchemy.Stack.useSync((stack) => ({
    rootDir: import.meta.dirname,
    ...(stack.stage === productionStage
      ? { name: productionWorkerName, domain: { name: apexHost, redirects: [wwwHost] }, workersDev: false }
      : {}),
  }))
);

const requireCiForProduction = Config.Literal("true", "CI");

export default Alchemy.Stack(
  "BeepEffectWeb",
  {
    providers: Cloudflare.providers(),
    state,
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;
    if (stack.stage === productionStage) {
      yield* requireCiForProduction;
    }
    const website = yield* Website;

    return {
      url: website.url.as<string>(),
    };
  })
);
