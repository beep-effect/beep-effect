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

// decision: encrypted-shared-stack-state
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
 * **Gotchas**
 *
 * Production deploys run in CI under alchemy-storybook-prod concurrency, with the S3 stage lease as the second guard. Local production plans or deploys fail on CI configuration.
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
