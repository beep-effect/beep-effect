/**
 * Alchemy stack for oip.law web hosting: the Vercel project, its environment
 * variables and domains, the Cloudflare DNS records and the S3 assets bucket
 * (goals/infra-alchemy-rebuild, P4). Replaces the Pulumi project `opip-web`
 * (stacks `production` and `staging`). Runbook: docs/runbooks/alchemy-infra.md.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as AWS from "@alchemy.run/aws";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { configForStage } from "./stack/OipWebConfig.ts";
import { oipWebProviders, oipWebResources, requireCiForLiveStage } from "./stack/OipWebStack.ts";

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment: exported from aws-vault on a workstation, set by the GitHub
 * OIDC state role in CI. Runbook: docs/runbooks/alchemy-infra.md.
 */
const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The `OipWeb` stack. `prod` and `staging` own the live oip.law objects and
 * deploy only from CI (`.github/workflows/deploy-oip-web-infra.yml`); a
 * personal stage (`dev_$USER`) owns a new, stage-named project and bucket
 * and nothing live.
 *
 * **Example** (Plan a personal stage)
 *
 * ```ts
 * import OipWeb from "./alchemy.run.ts"
 * import * as Effect from "effect/Effect"
 *
 * // bunx alchemy plan --stage "dev_$USER" --env-file /dev/null
 * console.log(Effect.isEffect(OipWeb)) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export default Alchemy.Stack(
  "OipWeb",
  {
    providers: oipWebProviders,
    state,
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;
    // `prod` and `staging` deploy only from CI; a local plan of either fails here.
    yield* requireCiForLiveStage(stack.stage);
    const config = yield* configForStage(stack.stage).pipe(Effect.orDie);
    return yield* oipWebResources(config);
  })
);
