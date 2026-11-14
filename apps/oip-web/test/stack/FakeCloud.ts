/**
 * In-memory Vercel, Cloudflare and AWS providers for the `OipWeb` stack tests.
 *
 * Each fake keeps its objects in a `MutableHashMap` keyed by the object's
 * natural identity and follows the real provider's ownership contract:
 * Vercel projects, variables and domains and Cloudflare DNS records read as
 * `Unowned` without prior state (adoption needs `adopt(true)`), while S3
 * buckets read as owned (the real `AWS.S3.Bucket` adopts silently by name).
 * `seedLive` loads the census of the live oip.law objects.
 */

import * as AWS from "@alchemy.run/aws";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Vercel from "@beep/alchemy-vercel";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Struct from "effect/Struct";
import { liveStageConfig, vercelTeamId, zoneIdOf } from "../../stack/OipWebConfig.ts";
import { vercelApexTarget, vercelCnameTarget } from "../../stack/OipWebStack.ts";

interface ProjectRecord {
  readonly name: string;
  readonly projectId: string;
  readonly props: Vercel.ProjectProps;
}

interface EnvRecord {
  readonly envId: string;
  readonly key: string;
  readonly projectId: string;
  readonly targets: ReadonlyArray<string>;
  readonly type: string;
  readonly value: string;
}

interface DomainRecord {
  readonly name: string;
  readonly projectId: string;
  readonly redirect?: string;
  readonly redirectStatusCode?: number;
}

interface DnsRecord {
  readonly comment: string;
  readonly content: string;
  readonly name: string;
  readonly recordId: string;
  readonly type: string;
  readonly zoneId: string;
}

interface BucketRecord {
  readonly bucketName: string;
  readonly tags: Readonly<Record<string, string>>;
}

const projects = MutableHashMap.empty<string, ProjectRecord>();
const envs = MutableHashMap.empty<string, EnvRecord>();
const domains = MutableHashMap.empty<string, DomainRecord>();
const records = MutableHashMap.empty<string, DnsRecord>();
const buckets = MutableHashMap.empty<string, BucketRecord>();
let writes: ReadonlyArray<string> = [];
let declaredProjectKeys: ReadonlyArray<string> = [];
let sequence = 0;

const nextId = (prefix: string): string => {
  sequence += 1;
  return `${prefix}_${sequence}`;
};

const envKey = (projectId: string, key: string): string => `${projectId}|${key}`;
const dnsKey = (zoneId: string, name: string, type: string): string => `${zoneId}|${name}|${type}`;
const log = (entry: string) =>
  Effect.sync(() => {
    writes = A.append(writes, entry);
  });

const projectAttributes = (project: ProjectRecord): Vercel.ProjectAttributes =>
  Vercel.ProjectAttributes.make({
    projectId: project.projectId,
    name: project.name,
    accountId: vercelTeamId,
    nodeVersion: project.props.nodeVersion ?? "24.x",
    deploymentProtection: project.props.deploymentProtection ?? "none",
    link: Vercel.ProjectLink.make({
      type: "github",
      repo: project.props.gitRepository?.repo ?? "",
      productionBranch: "main",
    }),
  });

const envAttributes = (env: EnvRecord): Vercel.EnvVarAttributes =>
  Vercel.EnvVarAttributes.make({
    envId: env.envId,
    projectId: env.projectId,
    key: env.key,
    type: env.type,
    targets: env.targets,
  });

const domainAttributes = (domain: DomainRecord): Vercel.DomainAttributes =>
  Vercel.DomainAttributes.make({
    name: domain.name,
    apexName: domain.name,
    projectId: domain.projectId,
    verified: true,
    verification: [],
    ...(domain.redirect === undefined ? {} : { redirect: domain.redirect }),
    ...(domain.redirectStatusCode === undefined ? {} : { redirectStatusCode: domain.redirectStatusCode }),
  });

const dnsAttributes = (record: DnsRecord): Cloudflare.DNS.RecordAttributes => ({
  recordId: record.recordId,
  zoneId: record.zoneId,
  name: record.name,
  type: record.type,
  content: record.content,
  ttl: 1,
  proxied: false,
  createdOn: undefined,
  modifiedOn: undefined,
});

const bucketAttributes = (bucket: BucketRecord) => ({
  bucketName: bucket.bucketName,
  bucketArn: `arn:aws:s3:::${bucket.bucketName}` as const,
  bucketDomainName: `${bucket.bucketName}.s3.amazonaws.com` as const,
  bucketRegionalDomainName: `${bucket.bucketName}.s3.us-east-1.amazonaws.com` as const,
  region: "us-east-1",
  accountId: "000000000000",
  tags: bucket.tags,
});

/** Mark an object read without prior state as foreign, like the real Vercel and Cloudflare providers. */
const ownership = <T extends object>(attrs: T, owned: boolean): T => (owned ? attrs : Unowned(attrs));

const ProjectFake = Provider.effect(
  Vercel.Project,
  Effect.succeed({
    stables: ["projectId", "accountId"],
    read: ({ olds, output }) =>
      Effect.sync(() =>
        MutableHashMap.get(projects, output?.name ?? olds?.name ?? "").pipe(
          O.map((project) => ownership(projectAttributes(project), output !== undefined)),
          O.getOrUndefined
        )
      ),
    reconcile: Effect.fn("Fake.reconcile")(function* ({ news, output }) {
      const name = news.name ?? "";
      const project: ProjectRecord = {
        projectId:
          output?.projectId ??
          O.getOrElse(
            O.map(MutableHashMap.get(projects, name), (p) => p.projectId),
            () => nextId("prj")
          ),
        name,
        // Like the real provider's `projectPatch`: only declared fields are sent, the rest stay.
        props: { ...O.getOrUndefined(O.map(MutableHashMap.get(projects, name), (p) => p.props)), ...news },
      };
      declaredProjectKeys = A.appendAll(declaredProjectKeys, Struct.keys(news));
      MutableHashMap.set(projects, name, project);
      yield* log(`Vercel.Project ${name} reconcile`);
      return projectAttributes(project);
    }),
    delete: Effect.fn("Fake.delete")(function* ({ output }) {
      MutableHashMap.remove(projects, output.name);
      yield* log(`Vercel.Project ${output.name} delete`);
    }),
  })
);

const EnvVarFake = Provider.effect(
  Vercel.EnvVar,
  Effect.succeed({
    stables: ["envId", "projectId"],
    read: ({ olds, output }) =>
      Effect.sync(() =>
        MutableHashMap.get(envs, envKey(output?.projectId ?? olds.project, olds.key)).pipe(
          O.map((env) => ownership(envAttributes(env), output !== undefined)),
          O.getOrUndefined
        )
      ),
    reconcile: Effect.fn("Fake.reconcile")(function* ({ news, output }) {
      // Like the real provider: a `valueFrom` value is read now and only sent to Vercel.
      const value =
        news.valueFrom === undefined
          ? O.getOrElse(O.map(O.fromUndefinedOr(news.value), Redacted.value), () => "")
          : yield* Config.Redacted(news.valueFrom.config).pipe(Effect.map(Redacted.value));
      const key = envKey(news.project, news.key);
      const env: EnvRecord = {
        envId:
          output?.envId ??
          O.getOrElse(
            O.map(MutableHashMap.get(envs, key), (e) => e.envId),
            () => nextId("env")
          ),
        projectId: news.project,
        key: news.key,
        type: news.type ?? "encrypted",
        targets: news.targets,
        value,
      };
      MutableHashMap.set(envs, key, env);
      yield* log(`Vercel.EnvVar ${news.key} reconcile`);
      return envAttributes(env);
    }),
    delete: Effect.fn("Fake.delete")(function* ({ output }) {
      MutableHashMap.remove(envs, envKey(output.projectId, output.key));
      yield* log(`Vercel.EnvVar ${output.key} delete`);
    }),
  })
);

const DomainFake = Provider.effect(
  Vercel.Domain,
  Effect.succeed({
    read: ({ olds, output }) =>
      Effect.sync(() =>
        MutableHashMap.get(domains, output?.name ?? olds.name).pipe(
          O.map((domain) => ownership(domainAttributes(domain), output !== undefined)),
          O.getOrUndefined
        )
      ),
    reconcile: Effect.fn("Fake.reconcile")(function* ({ news }) {
      const domain: DomainRecord = {
        name: news.name,
        projectId: news.project,
        ...(news.redirect === undefined ? {} : { redirect: news.redirect }),
        ...(news.redirectStatusCode === undefined ? {} : { redirectStatusCode: news.redirectStatusCode }),
      };
      MutableHashMap.set(domains, news.name, domain);
      yield* log(`Vercel.Domain ${news.name} reconcile`);
      return domainAttributes(domain);
    }),
    delete: Effect.fn("Fake.delete")(function* ({ output }) {
      MutableHashMap.remove(domains, output.name);
      yield* log(`Vercel.Domain ${output.name} delete`);
    }),
  })
);

/** The store key of a record from its attributes or props: zone, name and type, when all are known. */
const recordKeyOf = (
  identity: { readonly zoneId?: unknown; readonly name?: string; readonly type?: string } | undefined
): O.Option<string> =>
  P.isString(identity?.zoneId) && identity.name !== undefined && identity.type !== undefined
    ? O.some(dnsKey(identity.zoneId, identity.name, identity.type))
    : O.none();

const RecordFake = Provider.effect(
  Cloudflare.DNS.Record,
  Effect.succeed({
    stables: ["recordId", "zoneId"],
    read: ({ olds, output }) =>
      Effect.sync(() =>
        recordKeyOf(output ?? olds).pipe(
          O.flatMap((key) => MutableHashMap.get(records, key)),
          O.map((record) => ownership(dnsAttributes(record), output !== undefined)),
          O.getOrUndefined
        )
      ),
    reconcile: Effect.fn("Fake.reconcile")(function* ({ news, output }) {
      const zoneId = String(news.zoneId);
      const key = dnsKey(zoneId, news.name, news.type);
      const record: DnsRecord = {
        recordId:
          output?.recordId ??
          O.getOrElse(
            O.map(MutableHashMap.get(records, key), (r) => r.recordId),
            () => nextId("rec")
          ),
        zoneId,
        name: news.name,
        type: news.type,
        content: "content" in news && typeof news.content === "string" ? news.content : "",
        comment: news.comment ?? "",
      };
      // Like the real provider: a record whose declared fields all match is not written.
      const unchanged = O.exists(
        MutableHashMap.get(records, key),
        (live) => live.content === record.content && live.comment === record.comment
      );
      MutableHashMap.set(records, key, record);
      yield* log(`Cloudflare.DNS.Record ${news.name} ${unchanged ? "unchanged" : "write"}`);
      return dnsAttributes(record);
    }),
    delete: Effect.fn("Fake.delete")(function* ({ output }) {
      MutableHashMap.remove(records, dnsKey(output.zoneId, output.name, output.type));
      yield* log(`Cloudflare.DNS.Record ${output.name} delete`);
    }),
  })
);

const BucketFake = Provider.effect(
  AWS.S3.Bucket,
  Effect.succeed({
    // Like the real provider: a new bucket name is a new bucket.
    diff: ({ news, olds }) =>
      Effect.sync(() =>
        isResolved(news) && news.bucketName !== olds.bucketName ? ({ action: "replace" } as const) : undefined
      ),
    read: ({ olds, output }) =>
      Effect.sync(() =>
        MutableHashMap.get(buckets, output?.bucketName ?? olds?.bucketName ?? "").pipe(
          O.map(bucketAttributes),
          O.getOrUndefined
        )
      ),
    reconcile: Effect.fn("Fake.reconcile")(function* ({ news }) {
      const bucket: BucketRecord = { bucketName: news.bucketName ?? "", tags: news.tags ?? {} };
      MutableHashMap.set(buckets, bucket.bucketName, bucket);
      yield* log(`AWS.S3.Bucket ${bucket.bucketName} reconcile`);
      return bucketAttributes(bucket);
    }),
    delete: Effect.fn("Fake.delete")(function* ({ output }) {
      MutableHashMap.remove(buckets, output.bucketName);
      yield* log(`AWS.S3.Bucket ${output.bucketName} delete`);
    }),
  })
);

/** The three provider collections the stack requires, over the in-memory fakes. */
export const FakeCloudProviders = Layer.mergeAll(
  Layer.effect(Vercel.Providers, Provider.collection([Vercel.Project, Vercel.EnvVar, Vercel.Domain])).pipe(
    Layer.provide(Layer.mergeAll(ProjectFake, EnvVarFake, DomainFake))
  ),
  Layer.effect(Cloudflare.Providers, Provider.collection([Cloudflare.DNS.Record])).pipe(Layer.provide(RecordFake)),
  Layer.effect(AWS.Providers, Provider.collection([AWS.S3.Bucket])).pipe(Layer.provide(BucketFake))
);

/**
 * The live settings of both projects (census 2026-11-14): every field that shapes a build or a
 * pull-request check. The stack must leave all of them as they are.
 */
export const liveProjectSettings = {
  framework: "nextjs",
  buildCommand: "cd ../.. && bun run --cwd apps/oip-web build:pwa",
  installCommand: "cd ../.. && bun install",
  rootDirectory: "apps/oip-web",
  gitRepository: { type: "github", repo: "beep-effect/beep-effect" },
  deploymentProtection: "none",
  nodeVersion: "24.x",
  autoExposeSystemEnvs: true,
} as const satisfies Vercel.ProjectProps;

/** Ids of the live objects as the 2026-11-14 census recorded them. */
export const liveIds = {
  prodProjectId: "prj_J5xqp5jg7POGvoIwOj7e1axpoPxb",
  stagingProjectId: "prj_orJn2nvxflBiJqPF0VWLOD0RFAzE",
} as const;

/** The value the live HubSpot secret holds in the fake, standing in for the real one. */
export const liveHubSpotSecret = "live-hubspot-secret-from-census";

/** Inspect and seed the fake. */
export const FakeCloud = {
  reset: (): void => {
    MutableHashMap.clear(projects);
    MutableHashMap.clear(envs);
    MutableHashMap.clear(domains);
    MutableHashMap.clear(records);
    MutableHashMap.clear(buckets);
    writes = [];
    declaredProjectKeys = [];
    sequence = 0;
  },
  /**
   * Load the live objects of both stages: projects, their three variables,
   * domains, DNS records and the two Pulumi buckets.
   */
  seedLive: (): void => {
    const seedStage = (stage: keyof typeof liveStageConfig, projectId: string) => {
      const config = liveStageConfig[stage];
      MutableHashMap.set(projects, config.projectName, {
        projectId,
        name: config.projectName,
        props: { name: config.projectName, ...liveProjectSettings },
      });
      const env = (key: string, type: string, targets: ReadonlyArray<string>, value: string) =>
        MutableHashMap.set(envs, envKey(projectId, key), {
          envId: nextId("env_live"),
          projectId,
          key,
          type,
          targets,
          value,
        });
      env("NEXT_DISABLE_PWA", "encrypted", ["preview", "production"], "0");
      env("CRM_HUBSPOT_ACCOUNT_ID", "encrypted", ["preview", "production"], config.hubSpotAccountId);
      env("CRM_HUBSPOT_SERVICE_KEY", "sensitive", ["production"], liveHubSpotSecret);
      for (const domain of config.domains) {
        MutableHashMap.set(domains, domain.name, {
          name: domain.name,
          projectId,
          ...("redirect" in domain ? { redirect: domain.redirect, redirectStatusCode: domain.redirectStatusCode } : {}),
        });
        const zoneId = zoneIdOf(domain);
        MutableHashMap.set(records, dnsKey(zoneId, domain.name, domain.record), {
          recordId: nextId("rec_live"),
          zoneId,
          name: domain.name,
          type: domain.record,
          content: domain.record === "A" ? vercelApexTarget : vercelCnameTarget,
          // The live comment, verbatim from the census.
          comment: "Managed by Pulumi for oip.law Vercel routing.",
        });
      }
    };
    seedStage("prod", liveIds.prodProjectId);
    seedStage("staging", liveIds.stagingProjectId);
    for (const bucketName of ["assets.oip.law", "staging-assets.oip.law"]) {
      MutableHashMap.set(buckets, bucketName, { bucketName, tags: { ManagedBy: "pulumi" } });
    }
  },
  project: (name: string) => MutableHashMap.get(projects, name),
  env: (projectId: string, key: string) => MutableHashMap.get(envs, envKey(projectId, key)),
  domain: (name: string) => MutableHashMap.get(domains, name),
  record: (zoneId: string, name: string, type: string) => MutableHashMap.get(records, dnsKey(zoneId, name, type)),
  bucket: (name: string) => MutableHashMap.get(buckets, name),
  projectCount: (): number => MutableHashMap.size(projects),
  writes: (): ReadonlyArray<string> => writes,
  /** Every project prop key the stack declared, over all project reconciles since the reset. */
  declaredProjectKeys: (): ReadonlyArray<string> => declaredProjectKeys,
};
