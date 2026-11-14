/**
 * Resources of the `OipWeb` Alchemy stack: the Vercel project, its
 * environment variables and domains, the Cloudflare DNS records that point
 * the domains at Vercel, and the S3 assets bucket. Replaces the Pulumi
 * program `infra/src/OipWeb.ts` (stacks `production` and `staging`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as AWS from "@alchemy.run/aws";
import { AwsAuth } from "@alchemy.run/aws/AuthProvider";
import * as AwsCredentials from "@alchemy.run/aws/Credentials";
import * as AwsEndpoint from "@alchemy.run/aws/Endpoint";
import { providedOrDefault } from "@alchemy.run/aws/Environment";
import * as AwsRegion from "@alchemy.run/aws/Region";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Vercel from "@beep/alchemy-vercel";
import * as O from "@beep/utils/Option";
import { adopt } from "alchemy/AdoptPolicy";
import { CredentialsStoreLive } from "alchemy/Auth/Credentials";
import * as Provider from "alchemy/Provider";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LiveStage, OipRecordType, vercelTeamId, zoneIdOf } from "./OipWebConfig.ts";
import type { Input } from "alchemy/Input";
import type { OipDomain, OipWebStackConfig } from "./OipWebConfig.ts";

/**
 * Vercel's anycast address for an apex `A` record.
 *
 * @category constants
 * @since 0.0.0
 */
export const vercelApexTarget = "76.76.21.21";

/**
 * Vercel's DNS name for a subdomain `CNAME` record.
 *
 * @category constants
 * @since 0.0.0
 */
export const vercelCnameTarget = "cname.vercel-dns.com";

/**
 * Comment on every DNS record this stack owns: the live records' comment, kept so
 * adoption is a pure read.
 *
 * **Details**
 *
 * The Cloudflare provider rewrites a record when any declared field differs,
 * and an undeclared comment defaults to `Managed by Alchemy (<fqn>)`, which
 * differs too. Keeping the live text means the first deploys only list the
 * records (DNS Read). Rewording it later is its own deploy and needs DNS Edit.
 *
 * @category constants
 * @category constants
 * @since 0.0.0
 */
export const dnsRecordComment = "Managed by Pulumi for oip.law Vercel routing.";

/**
 * Logical-id suffix of a hostname: `www.oip.law` becomes `www-oip-law`.
 *
 * @param domain - The hostname.
 * @returns The suffix.
 */
const slugOf = (domain: OipDomain): string => Str.replaceAll(".", "-")(domain.name);

/** Logical id of a domain's `Vercel.Domain` resource: `Domain-oip-law` for `oip.law`. */
const domainId = (domain: OipDomain): string => `Domain-${slugOf(domain)}`;

/** Logical id of a domain's `Cloudflare.DNS.Record` resource: `Dns-oip-law` for `oip.law`. */
const dnsRecordId = (domain: OipDomain): string => `Dns-${slugOf(domain)}`;

/** Logical id of the Vercel project (the plan guard classifies it by this id). */
const projectId = "Project";

/** Logical id of the assets bucket (the plan guard classifies it by this id). */
const assetsBucketId = "AssetsBucket";

/**
 * Applied to every object a live stage owns: adopt the live object per
 * object (D20) and refuse any plan that would replace or delete it. A
 * personal stage adopts nothing and protects nothing.
 *
 * @param live - Whether the stage owns live objects.
 * @returns The decoration for a live object's declaration.
 */
const liveObject =
  (live: boolean) =>
  <A, E, R>(declaration: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    declaration.pipe(adopt(live), RemovalPolicy.protect(live));

/**
 * Declare one hostname: the project domain and the DNS record pointing it at Vercel.
 *
 * @param config - The stage's configuration.
 * @param project - The Vercel project id.
 * @returns The effect declaring both resources.
 */
const declareDomain = (config: OipWebStackConfig, project: Input<string>) =>
  Effect.fn("OipWeb.declareDomain")(function* (domain: OipDomain) {
    const vercelDomain = yield* Vercel.Domain(domainId(domain), {
      project,
      teamId: vercelTeamId,
      name: domain.name,
      ...O.getSomesStruct({
        redirect: O.fromUndefinedOr(domain.redirect),
        redirectStatusCode: O.fromUndefinedOr(domain.redirectStatusCode),
      }),
    }).pipe(liveObject(config.live));
    yield* Cloudflare.DNS.Record(dnsRecordId(domain), {
      zoneId: zoneIdOf(domain),
      name: domain.name,
      type: domain.record,
      content: OipRecordType.is.A(domain.record) ? vercelApexTarget : vercelCnameTarget,
      proxied: false,
      ttl: 1,
      comment: dnsRecordComment,
    }).pipe(liveObject(config.live));
    return vercelDomain.name;
  });

/**
 * Declare every resource one stage owns.
 *
 * **Details**
 *
 * The project declares its name and team only; variables, domains and records
 * restate the live census, so the first `prod` and `staging` deploys adopt the
 * live objects without changing a project setting, a domain or a DNS record
 * (the variables are rewritten with their current values). The assets bucket is new
 * (`oip-law-web-assets-<stage>`): the Pulumi buckets hold no objects and have
 * no reader. Vercel deployments stay with `.github/workflows/vercel-deploy.yml`;
 * this stack owns configuration, not builds.
 *
 * **Example** (Declare a personal stage)
 *
 * ```ts
 * import { configForStage } from "./OipWebConfig.ts"
 * import { oipWebResources } from "./OipWebStack.ts"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(configForStage("dev_alice"), oipWebResources)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param config - The decoded configuration of the stage.
 * @returns The stack outputs: project id, served domains and bucket name.
 * @category resources
 * @since 0.0.0
 */
export const oipWebResources = Effect.fn("OipWeb.resources")(function* (config: OipWebStackConfig) {
  // Only the project's identity is declared. Every field that shapes a build or a pull-request
  // check (git link, framework, commands, root directory, Node version, system variables,
  // deployment protection) is left out, so adopting the live project can never send one;
  // `git.deploymentEnabled` lives in vercel.json, which no resource touches.
  const project = yield* Vercel.Project(projectId, {
    name: config.projectName,
    teamId: vercelTeamId,
  }).pipe(liveObject(config.live));

  // Public values: written as literals (Alchemy keeps a Redacted prop's text in state), equal
  // to the live values. Like every adopted object they are protected on live stages.
  yield* Vercel.EnvVar("EnvNextDisablePwa", {
    project: project.projectId,
    teamId: vercelTeamId,
    key: "NEXT_DISABLE_PWA",
    value: Redacted.make("0"),
    targets: ["production", "preview"],
    type: "encrypted",
  }).pipe(liveObject(config.live));
  yield* Vercel.EnvVar("EnvHubSpotAccountId", {
    project: project.projectId,
    teamId: vercelTeamId,
    key: "CRM_HUBSPOT_ACCOUNT_ID",
    value: Redacted.make(config.hubSpotAccountId),
    targets: ["production", "preview"],
    type: "encrypted",
  }).pipe(liveObject(config.live));
  // The secret is read at deploy time and never reaches state.
  yield* pipe(
    O.fromUndefinedOr(config.hubSpotServiceKey),
    O.match({
      onNone: () => Effect.void,
      onSome: (valueFrom) =>
        Vercel.EnvVar("EnvHubSpotServiceKey", {
          project: project.projectId,
          teamId: vercelTeamId,
          key: "CRM_HUBSPOT_SERVICE_KEY",
          valueFrom,
          targets: ["production"],
          type: "sensitive",
        }).pipe(liveObject(config.live), Effect.asVoid),
    })
  );

  const domains = yield* Effect.forEach(config.domains, declareDomain(config, project.projectId));

  const bucket = yield* AWS.S3.Bucket(assetsBucketId, {
    bucketName: config.assetsBucketName,
    forceDestroy: false,
    versioning: "Enabled",
    encryption: { sseAlgorithm: "AES256", blockedEncryptionTypes: ["SSE-C"] },
    publicAccessBlock: {
      blockPublicAcls: true,
      ignorePublicAcls: true,
      blockPublicPolicy: true,
      restrictPublicBuckets: true,
    },
    objectOwnership: "BucketOwnerEnforced",
    policy: [
      {
        Sid: "DenyInsecureTransport",
        Effect: "Deny",
        Principal: "*",
        Action: ["s3:*"],
        Resource: [`arn:aws:s3:::${config.assetsBucketName}`, `arn:aws:s3:::${config.assetsBucketName}/*`],
        Condition: { Bool: { "aws:SecureTransport": "false" } },
      },
    ],
    tags: { App: "oip-web", Project: "oip-law", DataClass: "public-assets-origin" },
  }).pipe(RemovalPolicy.protect(config.live));

  return {
    projectId: project.projectId,
    domains,
    assetsBucketName: bucket.bucketName,
  };
});

/**
 * AWS providers for the one AWS resource this stack declares, `AWS.S3.Bucket`.
 *
 * **Details**
 *
 * `AWS.providers()` registers every AWS resource and dies at build without
 * the Lambda assets bucket that `alchemy provider aws bootstrap` creates
 * (D18, deferred to the runner fleet). This collection registers the bucket
 * provider alone over the same environment, credential and region chain, as
 * `@beep/alchemy-aws-extras` does for its resources.
 */
const awsBucketProviders = Layer.effect(AWS.Providers, Provider.collection([AWS.S3.Bucket])).pipe(
  Layer.provide(AWS.S3.BucketProvider()),
  Layer.provideMerge(Layer.fresh(AwsRegion.fromEnvironment)),
  Layer.provideMerge(Layer.fresh(AwsCredentials.fromEnvironment)),
  Layer.provideMerge(Layer.fresh(AwsEndpoint.fromEnvironment)),
  Layer.provideMerge(providedOrDefault()),
  Layer.provideMerge(AwsAuth),
  Layer.provideMerge(CredentialsStoreLive),
  Layer.orDie
);

/**
 * Every provider the stack needs: Vercel, Cloudflare and the AWS bucket collection.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { oipWebProviders } from "./OipWebStack.ts"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(oipWebProviders)) // true
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const oipWebProviders = Vercel.providers.pipe(
  Layer.provideMerge(awsBucketProviders),
  Layer.provideMerge(Cloudflare.providers())
);

/**
 * Hostnames a stage serves directly (domains that do not redirect).
 *
 * **Example** (The production apex)
 *
 * ```ts
 * import { configForStage } from "./OipWebConfig.ts"
 * import { servedHostnames } from "./OipWebStack.ts"
 * import * as Effect from "effect/Effect"
 *
 * const hostnames = Effect.map(configForStage("prod"), servedHostnames) // ["oip.law"]
 * console.log(Effect.isEffect(hostnames)) // true
 * ```
 *
 * @param config - The stage's configuration.
 * @returns The hostnames that answer with the site.
 * @category constructors
 * @since 0.0.0
 */
export const servedHostnames: (config: Pick<OipWebStackConfig, "domains">) => ReadonlyArray<string> = flow(
  (config) => config.domains,
  A.filter((domain) => domain.redirect === undefined),
  A.map((domain) => domain.name)
);

/**
 * Refuse a live stage outside CI.
 *
 * **Details**
 *
 * `prod` and `staging` own the live oip.law objects and deploy only from
 * `.github/workflows/deploy-oip-web-infra.yml`, under the
 * `alchemy-oip-web-infra` concurrency group; the S3 store's stage lease is
 * the second guard. Outside CI a plan or deploy of either stage fails here
 * with a `ConfigError` on `CI`. A personal stage passes.
 *
 * **Example** (Guard the production stage)
 *
 * ```ts
 * import { requireCiForLiveStage } from "./OipWebStack.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(requireCiForLiveStage("prod"))) // true
 * ```
 *
 * @param stage - The Alchemy stage being planned or deployed.
 * @returns An effect that fails on a live stage unless `CI` is `"true"`.
 * @category constructors
 * @since 0.0.0
 */
export const requireCiForLiveStage = Effect.fn("OipWeb.requireCiForLiveStage")(function* (stage: string) {
  if (S.is(LiveStage)(stage)) {
    yield* Config.Literal("true", "CI");
  }
});
