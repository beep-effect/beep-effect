import * as AWS from "@alchemy.run/aws";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { hostedUrl, PublicOrigin, SiteRoute } from "@beep/public-site";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

/**
 * Stage that owns the public `/storybook` route. Every other stage
 * (`live_$USER`, `dev_$USER`) serves from workers.dev only.
 */
const productionStage = "prod";

/**
 * Physical name of the `prod` Worker. Alchemy generates a Worker name from an
 * instance id it keeps in state, so a stage whose state is lost or moved mints
 * a new name and cannot take the route from the live Worker (the
 * `BeepEffectWeb` state move did exactly that, #3133). A pinned name makes a
 * prod deploy find this Worker whatever the state holds.
 */
const productionWorkerName = "beep-storybook-prod";

/**
 * Reserved route this site is served under on the public origin
 * (`@beep/public-site`): Storybook is a projection of the single origin, not a
 * subdomain.
 */
const storybookRoute = SiteRoute.Enum.storybook;

/** Hostname of the public origin; its Cloudflare zone carries the route. */
const apexHost = new URL(PublicOrigin.literal).hostname;

/**
 * Directory the build stages for upload, relative to this app. The static
 * build lands in `site/storybook`, so the asset path of every file already
 * carries the `/storybook` prefix the route keeps on the request.
 */
const siteDir = "site";

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

export default Alchemy.Stack(
  "Storybook",
  {
    providers: Cloudflare.providers(),
    state,
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;
    // Every `prod` deploy runs in CI under the `alchemy-storybook-prod`
    // concurrency group; the S3 store's stage lease is the second guard. A
    // local `prod` plan/deploy fails here with a ConfigError on `CI`.
    if (stack.stage === productionStage) {
      yield* Config.Literal("true", "CI");
      yield* Storybook;
      return { url: hostedUrl(storybookRoute) };
    }
    const site = yield* Storybook;

    // The Worker origin serves nothing at its root: the site lives under the
    // same path prefix on every stage.
    return {
      url: Output.interpolate`${site.url}/${storybookRoute}/`,
    };
  })
);
