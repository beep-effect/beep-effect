/**
 * Typed configuration of the `OipWeb` Alchemy stack (`apps/oip-web/alchemy.run.ts`):
 * which Vercel project, environment variables, domains, DNS records and assets
 * bucket each stage owns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EnvVarValueSource } from "@beep/alchemy-vercel/EnvVar";
import { $OipWebId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $OipWebId.create("stack/OipWebConfig");

/**
 * The two stages that own live oip.law objects. Every other stage is a
 * personal stage (`dev_$USER`, `live_$USER`) that owns only new,
 * stage-named objects.
 *
 * **Example** (Recognise a live stage)
 *
 * ```ts
 * import { LiveStage } from "./OipWebConfig.ts"
 *
 * console.log(LiveStage.is.prod("prod")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LiveStage = LiteralKit(["prod", "staging"]).pipe(
  $I.annoteSchema("LiveStage", {
    description: "Alchemy stage that owns live oip.law objects; replaces the Pulumi stacks production and staging.",
  })
);

/**
 * Type-level member of {@link LiveStage}.
 *
 * @category models
 * @since 0.0.0
 */
export type LiveStage = typeof LiveStage.Type;

/** Every hostname the stack may attach to a Vercel project. */
const OipHostname = LiteralKit([
  "oip.law",
  "www.oip.law",
  "opip.law",
  "www.opip.law",
  "staging.oip.law",
  "staging.opip.law",
]).pipe(
  $I.annoteSchema("OipHostname", {
    description: "Hostname served by an oip.law Vercel project.",
  })
);

type OipHostname = typeof OipHostname.Type;

/**
 * Cloudflare zones that carry the oip.law DNS records.
 *
 * **Example** (Guard a zone)
 *
 * ```ts
 * import { OipZone } from "./OipWebConfig.ts"
 *
 * console.log(OipZone.is["opip.law"]("opip.law")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OipZone = LiteralKit(["oip.law", "opip.law"]).pipe(
  $I.annoteSchema("OipZone", {
    description: "Cloudflare zone holding an oip.law DNS record.",
  })
);

/**
 * Type-level member of {@link OipZone}.
 *
 * @category models
 * @since 0.0.0
 */
export type OipZone = typeof OipZone.Type;

/**
 * DNS record types the stack writes: an apex `A` record to Vercel's anycast
 * address and a `CNAME` to Vercel's DNS name for every subdomain.
 *
 * **Example** (Guard a record type)
 *
 * ```ts
 * import { OipRecordType } from "./OipWebConfig.ts"
 *
 * console.log(OipRecordType.is.CNAME("CNAME")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OipRecordType = LiteralKit(["A", "CNAME"]).pipe(
  $I.annoteSchema("OipRecordType", {
    description: "DNS record type pointing an oip.law hostname at Vercel.",
  })
);

/** Redirect status codes the live domains use: 308 for production, 307 for staging. */
const OipRedirectStatus = LiteralKit([307, 308]).pipe(
  $I.annoteSchema("OipRedirectStatus", {
    description: "HTTP status of a Vercel domain redirect.",
  })
);

type OipRedirectStatus = typeof OipRedirectStatus.Type;

/**
 * Vercel project names that hold live deployments. Only a live stage may name one.
 *
 * **Example** (Guard a live project name)
 *
 * ```ts
 * import { LiveProjectName } from "./OipWebConfig.ts"
 *
 * console.log(LiveProjectName.is["oip-web"]("oip-web")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LiveProjectName = LiteralKit(["oip-web", "oip-web-staging"]).pipe(
  $I.annoteSchema("LiveProjectName", {
    description: "Name of a Vercel project that serves oip.law today.",
  })
);

/**
 * Bucket names that belong to a live stage, today's Pulumi buckets included.
 * A personal stage may name none of them.
 *
 * **Example** (Guard a reserved bucket name)
 *
 * ```ts
 * import { ReservedBucketName } from "./OipWebConfig.ts"
 *
 * console.log(ReservedBucketName.is["assets.oip.law"]("assets.oip.law")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReservedBucketName = LiteralKit([
  "oip-law-web-assets-prod",
  "oip-law-web-assets-staging",
  "assets.oip.law",
  "staging-assets.oip.law",
]).pipe(
  $I.annoteSchema("ReservedBucketName", {
    description: "S3 bucket name owned by a live oip.law stage or by the retiring Pulumi stacks.",
  })
);

/**
 * Vercel team that owns the oip.law projects (`kriegclouds-projects`). The id
 * is not secret; the deploy workflow names it too.
 *
 * @category constants
 * @since 0.0.0
 */
export const vercelTeamId = "team_0UZv1AlMu4u7ClZIEX4tpwy2";

/**
 * Cloudflare zone id of each {@link OipZone}. Zone ids are not secret.
 *
 * @category constants
 * @since 0.0.0
 */
export const zoneIds: HashMap.HashMap<OipZone, string> = HashMap.make(
  [OipZone.Enum["oip.law"], "144f81bdbe12b3a7530cdcc8d56b13cc"],
  [OipZone.Enum["opip.law"], "0d26e874202f4579081926dc38b3bf80"]
);

/**
 * One hostname a stage attaches to its project, with the DNS record that
 * points it at Vercel.
 *
 * **Example** (A redirecting hostname)
 *
 * ```ts
 * import { OipDomain } from "./OipWebConfig.ts"
 * import * as S from "effect/Schema"
 *
 * const www = S.decodeUnknownOption(OipDomain)({
 *   name: "www.oip.law",
 *   zone: "oip.law",
 *   record: "CNAME",
 *   redirect: "oip.law",
 *   redirectStatusCode: 308
 * })
 * console.log(www._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OipDomain extends S.Opaque<OipDomain, { readonly brand: unique symbol }>()(
  S.Struct({
    name: OipHostname,
    zone: OipZone,
    record: OipRecordType,
    redirect: S.optionalKey(OipHostname),
    redirectStatusCode: S.optionalKey(OipRedirectStatus),
  })
    .check(
      S.makeFilter(
        (domain) =>
          (domain.redirect === undefined) === (domain.redirectStatusCode === undefined) ||
          "redirect and redirectStatusCode are set together"
      ),
      S.makeFilter(
        (domain) =>
          domain.name === domain.zone || Str.endsWith(`.${domain.zone}`)(domain.name) || "the hostname is in its zone"
      ),
      S.makeFilter(
        (domain) =>
          OipRecordType.is.A(domain.record) === (domain.name === domain.zone) ||
          "the apex uses an A record and a subdomain a CNAME"
      )
    )
    .pipe(
      $I.annoteSchema("OipDomain", {
        description: "Hostname attached to a stage's Vercel project, with its Cloudflare DNS record.",
      })
    )
) {}

const NameSegment = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
    identifier: "OipPhysicalName",
    title: "Physical name",
    description: "3 to 63 lowercase letters, digits and hyphens, starting and ending with a letter or digit.",
  })
);

const isLive = (config: { readonly live: boolean }) => config.live;

/**
 * Everything one stage of the stack owns.
 *
 * **Details**
 *
 * `live` marks the two stages that own today's objects: their project and
 * domains are adopted per object (D20) and every project, domain, DNS record
 * and bucket is protected from replacement and deletion. The checks keep a
 * personal stage away from every live object: it may not name a live
 * project or a reserved bucket, attach a domain, or read the HubSpot secret.
 * A live stage must name a live project and the HubSpot secret source.
 * Physical names are pinned here, never derived from a state-held instance id.
 *
 * **Example** (A personal stage)
 *
 * ```ts
 * import { OipWebStackConfig } from "./OipWebConfig.ts"
 * import * as S from "effect/Schema"
 *
 * const dev = S.decodeUnknownOption(OipWebStackConfig)({
 *   live: false,
 *   projectName: "oip-web-dev-alice",
 *   assetsBucketName: "oip-law-web-assets-dev-alice",
 *   domains: [],
 *   hubSpotAccountId: "246203876"
 * })
 * console.log(dev._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OipWebStackConfig extends S.Opaque<OipWebStackConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    live: S.Boolean.annotateKey({ description: "Whether the stage owns live oip.law objects." }),
    projectName: NameSegment.annotateKey({ description: "Pinned Vercel project name." }),
    assetsBucketName: NameSegment.annotateKey({ description: "Pinned S3 assets bucket name." }),
    domains: S.Array(OipDomain).annotateKey({ description: "Hostnames the project serves, with their DNS records." }),
    hubSpotAccountId: S.NonEmptyString.annotateKey({ description: "HubSpot portal id; public, not a secret." }),
    hubSpotServiceKey: S.optionalKey(
      EnvVarValueSource.annotateKey({ description: "Deploy-time source of the HubSpot private-app token." })
    ),
  })
    .check(
      S.makeFilter(
        (config) =>
          isLive(config) === S.is(LiveProjectName)(config.projectName) ||
          "only a live stage names a live project, and a live stage names one"
      ),
      S.makeFilter(
        (config) =>
          isLive(config) ||
          !S.is(ReservedBucketName)(config.assetsBucketName) ||
          "a personal stage never names a live or retiring bucket"
      ),
      S.makeFilter(
        (config) => isLive(config) || A.isReadonlyArrayEmpty(config.domains) || "a personal stage attaches no domain"
      ),
      S.makeFilter(
        (config) =>
          isLive(config) === (config.hubSpotServiceKey !== undefined) ||
          "a live stage, and only a live stage, reads the HubSpot secret"
      ),
      S.makeFilter((config) => {
        const names = HashSet.fromIterable(A.map(config.domains, (domain) => domain.name));
        return (
          (HashSet.size(names) === A.length(config.domains) &&
            A.every(config.domains, (domain) =>
              pipe(
                O.fromUndefinedOr(domain.redirect),
                O.match({
                  onNone: () => true,
                  onSome: (target) =>
                    A.some(config.domains, (other) => other.name === target && other.redirect === undefined),
                })
              )
            )) ||
          "domains are unique and redirect only to a served, non-redirecting domain of the same stage"
        );
      })
    )
    .pipe(
      $I.annoteSchema("OipWebStackConfig", {
        description: "Vercel project, environment variables, domains, DNS records and assets bucket of one stage.",
      })
    )
) {}

/**
 * Config key the live stages read the HubSpot private-app token from. `op run`
 * resolves it from 1Password on a workstation; CI sets it from the deploy
 * environment's secret. It reaches Vercel only; Alchemy state keeps the key
 * name and a digest.
 */
const hubSpotServiceKeyConfig = "CRM_HUBSPOT_SERVICE_KEY";

const hubSpotAccountId = "246203876";

/** Raw (encoded) form of a domain, as the recorded stage configurations write it. */
type OipDomainInput = typeof OipDomain.Encoded;

const apex = (zone: OipZone): OipDomainInput => ({ name: zone, zone, record: OipRecordType.Enum.A });

const subdomain = (name: OipHostname, zone: OipZone): OipDomainInput => ({
  name,
  zone,
  record: OipRecordType.Enum.CNAME,
});

const redirecting = (domain: OipDomainInput, to: OipHostname, status: OipRedirectStatus): OipDomainInput => ({
  ...domain,
  redirect: to,
  redirectStatusCode: status,
});

/**
 * Raw configuration of each live stage, as recorded in the Pulumi stacks it
 * replaces and confirmed against the live census of 2026-11-14.
 *
 * @category constants
 * @since 0.0.0
 */
export const liveStageConfig = {
  prod: {
    live: true,
    projectName: LiveProjectName.Enum["oip-web"],
    assetsBucketName: ReservedBucketName.Enum["oip-law-web-assets-prod"],
    domains: [
      apex(OipZone.Enum["oip.law"]),
      redirecting(
        subdomain(OipHostname.Enum["www.oip.law"], OipZone.Enum["oip.law"]),
        OipHostname.Enum["oip.law"],
        308
      ),
      redirecting(apex(OipZone.Enum["opip.law"]), OipHostname.Enum["oip.law"], 308),
      redirecting(
        subdomain(OipHostname.Enum["www.opip.law"], OipZone.Enum["opip.law"]),
        OipHostname.Enum["oip.law"],
        308
      ),
    ],
    hubSpotAccountId,
    hubSpotServiceKey: { config: hubSpotServiceKeyConfig },
  },
  staging: {
    live: true,
    projectName: LiveProjectName.Enum["oip-web-staging"],
    assetsBucketName: ReservedBucketName.Enum["oip-law-web-assets-staging"],
    domains: [
      subdomain(OipHostname.Enum["staging.oip.law"], OipZone.Enum["oip.law"]),
      redirecting(
        subdomain(OipHostname.Enum["staging.opip.law"], OipZone.Enum["opip.law"]),
        OipHostname.Enum["staging.oip.law"],
        307
      ),
    ],
    hubSpotAccountId,
    hubSpotServiceKey: { config: hubSpotServiceKeyConfig },
  },
} as const satisfies Record<LiveStage, typeof OipWebStackConfig.Encoded>;

/**
 * Lowercase, hyphenated form of a stage name for physical names
 * (`dev_alice` becomes `dev-alice`).
 *
 * @param stage - The Alchemy stage.
 * @returns The stage as a name segment.
 */
const stageSegment: (stage: string) => string = flow(
  Str.toLowerCase,
  Str.replaceAll("_", "-"),
  Str.replace(/[^a-z0-9-]/g, "")
);

/**
 * Raw configuration of a personal stage: a new project and bucket named after
 * the stage, the two public variables, no domain, no DNS and no secret.
 *
 * @param stage - A stage other than `prod` and `staging`.
 * @returns The undecoded configuration.
 */
const personalStageConfig = (stage: string) => ({
  live: false,
  projectName: `oip-web-${stageSegment(stage)}`,
  assetsBucketName: `oip-law-web-assets-${stageSegment(stage)}`,
  domains: [],
  hubSpotAccountId,
});

/**
 * Decode the configuration of a stage: the recorded live configuration for
 * `prod` and `staging`, a stage-named personal configuration otherwise.
 *
 * **Example** (Decode the production stage)
 *
 * ```ts
 * import { configForStage } from "./OipWebConfig.ts"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(configForStage("prod"), (config) => config.projectName)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param stage - The Alchemy stage.
 * @returns The decoded configuration, or a schema error naming the broken rule.
 * @category constructors
 * @since 0.0.0
 */
export const configForStage = Effect.fn("OipWeb.configForStage")(function* (stage: string) {
  const raw = S.is(LiveStage)(stage) ? liveStageConfig[stage] : personalStageConfig(stage);
  return yield* S.decodeEffect(OipWebStackConfig)(raw);
});

/**
 * Zone id of a domain's Cloudflare zone.
 *
 * **Example** (Look up the apex zone)
 *
 * ```ts
 * import { zoneIdOf } from "./OipWebConfig.ts"
 *
 * console.log(zoneIdOf({ name: "oip.law", zone: "oip.law", record: "A" }))
 * ```
 *
 * @param domain - The domain whose record is written.
 * @returns The zone id.
 * @category constructors
 * @since 0.0.0
 */
export const zoneIdOf = (domain: Pick<OipDomain, "zone">): string =>
  pipe(
    HashMap.get(zoneIds, domain.zone),
    O.getOrElse(() => "")
  );
