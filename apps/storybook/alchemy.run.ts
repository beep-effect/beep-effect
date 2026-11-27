import * as AWS from "@alchemy.run/aws";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { hostedUrl, PublicOrigin, SiteRoute } from "@beep/public-site";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const productionStage = "prod";

// decision: pinned-production-worker
const productionWorkerName = "beep-storybook-prod";

const storybookRoute = SiteRoute.Enum.storybook;

const apexHost = new URL(PublicOrigin.literal).hostname;

const siteDir = "site";

const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The static Storybook build as an assets-only Worker. `cwd` is anchored to
 * this file because the Alchemy CLI resolves relative paths from where it is
 * invoked. Stories live in sibling workspace packages, outside the default
 * memo scope, so the build runs on every deploy; the Worker only changes when
 * the built output does.
 *
 * In `prod` the Worker has no workers.dev URL and no custom domain: one zone
 * route, `<apex>/storybook*`, puts it in front of the apex Worker. A route
 * pattern is matched against the whole URL, query string included, and may
 * not contain one, so the exact pattern `<apex>/storybook` would miss
 * `/storybook?path=...`; the trailing wildcard covers the bare slug, the
 * slug with a query and everything below it. It also takes any other path
 * that starts with the reserved slug, which the public route map already
 * denies the apex app. A request for a file the build did not produce is a
 * 404 from the asset layer and never falls through to the apex app.
 */
export const Storybook = Cloudflare.Website.StaticSite(
  "Storybook",
  Alchemy.Stack.useSync((stack) => ({
    cwd: import.meta.dirname,
    command: "bun run storybook:build:site",
    outdir: siteDir,
    memo: false,
    ...(stack.stage === productionStage
      ? {
          name: productionWorkerName,
          workersDev: false,
          routes: [{ pattern: `${apexHost}/${storybookRoute}*`, zoneName: apexHost }],
        }
      : {}),
  }))
);

/**
 * The Storybook deployment stack.
 *
 * **Details**
 *
 * Supply account, region and credentials through the environment: an aws-vault
 * export on a workstation or the GitHub OIDC state role in CI. This stack uses
 * the shared account-regional S3 backend governed by the
 * [shared-state bootstrap decision](../../goals/infra-alchemy-rebuild/decisions/2026-11-09-shared-s3-state-store-bootstrap.md).
 * Follow that authority for the AWS-managed versus customer-managed KMS
 * bootstrap choice and for state teardown after every stack is destroyed.
 *
 * **Gotchas**
 *
 * Run production plans and deploys in CI under the alchemy-storybook-prod
 * concurrency group; the shared S3 store’s stage lease is the second guard.
 * Local production plans and deploys fail with a ConfigError on CI.
 */
export default Alchemy.Stack(
  "Storybook",
  {
    providers: Cloudflare.providers(),
    state,
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;

    if (stack.stage === productionStage) {
      yield* Config.Literal("true", "CI");
      yield* Storybook;
      return { url: hostedUrl(storybookRoute) };
    }
    const site = yield* Storybook;

    return {
      url: Output.interpolate`${site.url}/${storybookRoute}/`,
    };
  })
);
