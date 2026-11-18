/**
 * Recording fake providers for every Alchemy resource the fleet composite
 * declares, plus the real RunnerSweep provider over the in-memory world.
 */

import * as EventBridge from "@alchemy.run/aws/EventBridge";
import * as IAM from "@alchemy.run/aws/IAM";
import * as KMS from "@alchemy.run/aws/KMS";
import * as Lambda from "@alchemy.run/aws/Lambda";
import * as S3 from "@alchemy.run/aws/S3";
import * as SQS from "@alchemy.run/aws/SQS";
import * as SSM from "@alchemy.run/aws/SSM";
import { RunnerLaunchTemplate } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate";
import { RunnerSweepProvider } from "@beep/alchemy-github-runners";
import * as Provider from "alchemy/Provider";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import { worldContext } from "./FakeWorld.ts";
import type { RunnerLaunchTemplate as RunnerLaunchTemplateResource } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate";
import type { ResourceClass } from "alchemy/Resource";
import type * as O from "effect/Option";
import type { World } from "./FakeWorld.ts";

export interface Reconciled {
  readonly bindings: ReadonlyArray<{
    readonly sid: string;
    readonly data: { readonly policyStatements?: ReadonlyArray<Readonly<Record<string, unknown>>> };
  }>;
  readonly fqn: string;
  readonly news: Readonly<Record<string, unknown>>;
  readonly type: string;
}

export class Recorder {
  reconciled: Array<Reconciled> = [];
  deleted: Array<string> = [];

  ofType(type: string): ReadonlyArray<Reconciled> {
    return A.filter(this.reconciled, (entry) => entry.type === type);
  }

  byFqn(fqn: string): O.Option<Reconciled> {
    return A.findFirst(this.reconciled, (entry) => entry.fqn === fqn);
  }
}

// aws-extras exports its resources through a narrowed call surface; the runtime value is the
// Resource class itself, which Provider.succeed needs to register a fake.
const launchTemplateClass = RunnerLaunchTemplate as unknown as ResourceClass<RunnerLaunchTemplateResource>;

const slug = (fqn: string) => Str.replaceAll("/", "-")(fqn);
const arn = (service: string, path: string) => `arn:aws:${service}:us-east-1:123456789012:${slug(path)}`;

interface LifecycleInput {
  readonly bindings?: unknown;
  readonly fqn: string;
  readonly news: unknown;
}

const record = (recorder: Recorder, type: string, input: LifecycleInput) => {
  recorder.reconciled = A.append(
    A.filter(recorder.reconciled, (entry) => entry.fqn !== input.fqn),
    {
      type,
      fqn: input.fqn,
      news: input.news as Reconciled["news"],
      bindings: (input.bindings ?? []) as Reconciled["bindings"],
    }
  );
  return input.news as Readonly<Record<string, unknown>>;
};

const lifecycle = <Attributes>(
  recorder: Recorder,
  type: string,
  attributes: (fqn: string, news: Readonly<Record<string, unknown>>) => Attributes
) => ({
  reconcile: Effect.fn(`Fake.reconcile`)(function* (input: LifecycleInput) {
    return attributes(input.fqn, record(recorder, type, input));
  }),
  delete: Effect.fn(`Fake.delete`)(function* (input: { readonly fqn: string }) {
    recorder.deleted.push(`${type}:${input.fqn}`);
  }),
  list: Effect.fn(`Fake.list`)(function* () {
    return [];
  }),
});

export const fakeProviders = ({ recorder, world }: { readonly recorder: Recorder; readonly world: World }) =>
  Layer.mergeAll(
    Provider.succeed(
      KMS.Key,
      lifecycle(recorder, "KMS.Key", (fqn) => ({
        keyId: `key-${slug(fqn)}`,
        keyArn: arn("kms", `key/${fqn}`),
      })) as never
    ),
    Provider.succeed(
      KMS.Alias,
      lifecycle(recorder, "KMS.Alias", (_fqn, news) => ({
        aliasName: news.aliasName,
        targetKeyId: news.targetKeyId,
      })) as never
    ),
    Provider.succeed(
      SSM.Parameter,
      lifecycle(recorder, "SSM.Parameter", (_fqn, news) => ({
        parameterName: news.name,
        parameterArn: `arn:aws:ssm:us-east-1:123456789012:parameter${String(news.name)}`,
        type: news.type,
        version: 1,
        keyArn: news.keyId,
      })) as never
    ),
    Provider.succeed(
      S3.Bucket,
      lifecycle(recorder, "S3.Bucket", (fqn) => ({
        bucketName: `bucket-${Str.toLowerCase(slug(fqn))}`,
        bucketArn: `arn:aws:s3:::bucket-${Str.toLowerCase(slug(fqn))}`,
      })) as never
    ),
    Provider.succeed(
      IAM.Role,
      lifecycle(recorder, "IAM.Role", (fqn) => ({ roleArn: arn("iam", `role/${fqn}`), roleName: slug(fqn) })) as never
    ),
    Provider.succeed(
      IAM.InstanceProfile,
      lifecycle(recorder, "IAM.InstanceProfile", (fqn) => ({
        instanceProfileArn: arn("iam", `instance-profile/${fqn}`),
        instanceProfileName: slug(fqn),
      })) as never
    ),
    Provider.succeed(
      SQS.Queue,
      lifecycle(recorder, "SQS.Queue", (fqn) => ({
        queueUrl: `https://sqs.us-east-1.amazonaws.com/123456789012/${slug(fqn)}`,
        queueArn: arn("sqs", fqn),
        queueName: slug(fqn),
      })) as never
    ),
    Provider.succeed(
      Lambda.Function,
      lifecycle(recorder, "Lambda.Function", (fqn, news) => ({
        functionArn: arn("lambda", `function/${fqn}`),
        functionName: slug(fqn),
        qualifiedArn: arn("lambda", `function/${fqn}`),
        functionUrl: news.functionUrl === true ? `https://${Str.toLowerCase(slug(fqn))}.lambda-url.on.aws/` : undefined,
        roleName: `${slug(fqn)}-role`,
        roleArn: arn("iam", `role/${fqn}-role`),
        code: { hash: "fake" },
      })) as never
    ),
    Provider.succeed(
      Lambda.EventSourceMapping,
      lifecycle(recorder, "Lambda.EventSourceMapping", (fqn) => ({
        uuid: fqn,
        eventSourceMappingArn: fqn,
        functionArn: fqn,
      })) as never
    ),
    Provider.succeed(
      Lambda.Permission,
      lifecycle(recorder, "Lambda.Permission", (fqn, news) => ({
        statementId: slug(fqn),
        functionName: news.functionName,
      })) as never
    ),
    Provider.succeed(
      EventBridge.Rule,
      lifecycle(recorder, "EventBridge.Rule", (fqn) => ({
        ruleName: slug(fqn),
        ruleArn: arn("events", `rule/${fqn}`),
        eventBusName: "default",
      })) as never
    ),
    Provider.succeed(
      launchTemplateClass,
      lifecycle(recorder, "BeepAWS.EC2.RunnerLaunchTemplate", (fqn, news) => ({
        launchTemplateId: `lt-${slug(fqn)}`,
        launchTemplateArn: arn("ec2", `launch-template/${fqn}`),
        launchTemplateName: slug(fqn),
        defaultVersionNumber: 1,
        latestVersionNumber: 1,
        tags: news.tags ?? {},
      })) as never
    ),
    RunnerSweepProvider.pipe(Layer.provide(Layer.succeedContext(worldContext(world))))
  );
