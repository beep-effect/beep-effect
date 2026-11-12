import * as AWS from "@alchemy.run/aws";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { apexHost, wwwHost } from "./src/PublicHosts.ts";

/**
 * Stage that owns the public apex. Every other stage (`live_$USER`,
 * `dev_$USER`) serves from workers.dev only.
 */
const productionStage = "prod";

/**
 * Physical name of the `prod` Worker, the one that serves {@link apexHost}.
 *
 * Alchemy generates a Worker name from an instance id it keeps in state, so a
 * stage whose state is lost or moved mints a new name. Moving this stack to the
 * S3 store (#3021) did exactly that: every prod deploy planned a new Worker
 * that could not take the apex from this one. Pinning the name makes a prod
 * deploy find this Worker by name and adopt it (it carries this stack, stage
 * and id's Alchemy tags) whatever the state holds.
 */
const productionWorkerName = "beepeffectweb-website-prod-lu7dco5dnf2llcs2";

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment (`AWS_ACCESS_KEY_ID` and friends): exported from aws-vault on a
 * workstation, set by the GitHub OIDC state role in CI. The bucket is
 * bootstrapped once with `alchemy state bootstrap`; CI never creates it.
 */
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

export default Alchemy.Stack(
  "BeepEffectWeb",
  {
    providers: Cloudflare.providers(),
    state,
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;
    // Every `prod` deploy runs in CI under the `alchemy-beep-effect-web-prod`
    // concurrency group; the S3 store's stage lease is the second guard. A
    // local `prod` plan/deploy fails here with a ConfigError on `CI`.
    if (stack.stage === productionStage) {
      yield* Config.Literal("true", "CI");
    }
    const website = yield* Website;

    return {
      url: website.url.as<string>(),
    };
  })
);
