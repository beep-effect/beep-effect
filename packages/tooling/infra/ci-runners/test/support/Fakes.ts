/**
 * Recording fake providers for every resource type the CiRunners stack
 * declares, the real `RunnerSweep` provider over stub fleet services, and an
 * `AWSEnvironment` for the account guard. One event log per harness keeps
 * reconciles, deletes and the sweep in the order they happened.
 */

import * as AWS from "@alchemy.run/aws";
import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import * as Test from "@alchemy.run/test/Vitest";
import { RunnerLaunchTemplate } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate";
import { Ec2Fleet } from "@beep/alchemy-github-runners/Ec2Fleet.service";
import { GitHubAppAuth, GitHubRunners } from "@beep/alchemy-github-runners/GitHubApp.service";
import { RunnerSweepProvider } from "@beep/alchemy-github-runners/RunnerSweep";
import { SsmStore } from "@beep/alchemy-github-runners/SsmStore.service";
import * as Provider from "alchemy/Provider";
import { inMemoryState } from "alchemy/State/InMemoryState";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import type { RunnerLaunchTemplate as RunnerLaunchTemplateResource } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate";
import type { Input } from "alchemy/Input";
import type { Plan } from "alchemy/Plan";
import type { ResourceClass } from "alchemy/Resource";

export interface Reconciled {
  readonly bindings: ReadonlyArray<{ readonly sid: string; readonly data: Readonly<Record<string, unknown>> }>;
  readonly fqn: string;
  readonly news: Readonly<Record<string, unknown>>;
  readonly type: string;
}

/** What the fakes saw, in order. */
export class Recorder {
  reconciled: Array<Reconciled> = [];
  events: Array<string> = [];

  at(fqn: string): O.Option<Reconciled> {
    return A.findFirst(this.reconciled, (entry) => entry.fqn === fqn);
  }
}

/** Position of the recorder's first event starting with `prefix`, or -1. */
export const eventIndex =
  (recorder: Recorder) =>
  (prefix: string): number =>
    O.getOrElse(A.findFirstIndex(recorder.events, Str.startsWith(prefix)), () => -1);

type News = Readonly<Record<string, unknown>>;
type Attributes = (fqn: string, news: News) => Readonly<Record<string, unknown>>;

const slug = Str.replaceAll("/", "-");
const arn = (service: string, fqn: string) => `arn:aws:${service}:us-east-1:832907639880:${slug(fqn)}`;

const launchTemplateAsProviderClass = RunnerLaunchTemplate as unknown as ResourceClass<RunnerLaunchTemplateResource>;

const table: ReadonlyArray<readonly [ResourceClass<never>, string, Attributes]> = [
  [AWS.EC2.Vpc as never, "EC2.Vpc", (fqn) => ({ vpcId: `vpc-${slug(fqn)}` })],
  [AWS.EC2.Subnet as never, "EC2.Subnet", (fqn) => ({ subnetId: `subnet-${slug(fqn)}` })],
  [AWS.EC2.InternetGateway as never, "EC2.InternetGateway", (fqn) => ({ internetGatewayId: `igw-${slug(fqn)}` })],
  [AWS.EC2.RouteTable as never, "EC2.RouteTable", (fqn) => ({ routeTableId: `rtb-${slug(fqn)}` })],
  [AWS.EC2.Route as never, "EC2.Route", () => ({})],
  [AWS.EC2.RouteTableAssociation as never, "EC2.RouteTableAssociation", (fqn) => ({ associationId: slug(fqn) })],
  [AWS.EC2.SecurityGroup as never, "EC2.SecurityGroup", (fqn) => ({ groupId: `sg-${slug(fqn)}` })],
  [AWS.EC2.DefaultSecurityGroup as never, "EC2.DefaultSecurityGroup", (fqn) => ({ groupId: `sg-${slug(fqn)}` })],
  [AWS.EC2.FlowLog as never, "EC2.FlowLog", (fqn) => ({ flowLogId: `fl-${slug(fqn)}` })],
  [
    AWS.Logs.LogGroup as never,
    "Logs.LogGroup",
    (fqn, news) => ({ logGroupName: news.logGroupName, logGroupArn: arn("logs", `log-group/${fqn}`) }),
  ],
  [
    AWS.IAM.Role as never,
    "IAM.Role",
    (fqn, news) => {
      const roleName = P.isString(news.roleName) ? news.roleName : slug(fqn);
      return { roleArn: `arn:aws:iam::832907639880:role/${roleName}`, roleName };
    },
  ],
  [AWS.IAM.Policy as never, "IAM.Policy", (fqn) => ({ policyArn: arn("iam", `policy/${fqn}`) })],
  [
    AWS.IAM.InstanceProfile as never,
    "IAM.InstanceProfile",
    (fqn) => ({ instanceProfileArn: arn("iam", `instance-profile/${fqn}`) }),
  ],
  [AWS.KMS.Key as never, "KMS.Key", (fqn) => ({ keyId: slug(fqn), keyArn: arn("kms", `key/${fqn}`) })],
  [AWS.KMS.Alias as never, "KMS.Alias", (_fqn, news) => ({ aliasName: news.aliasName })],
  [
    AWS.SSM.Parameter as never,
    "SSM.Parameter",
    (_fqn, news) => ({ parameterArn: `arn:aws:ssm:us-east-1:832907639880:parameter${String(news.name)}` }),
  ],
  [
    AWS.S3.Bucket as never,
    "S3.Bucket",
    (fqn, news) => {
      const bucketName = P.isString(news.bucketName) ? news.bucketName : Str.toLowerCase(slug(fqn));
      return { bucketName, bucketArn: `arn:aws:s3:::${bucketName}` };
    },
  ],
  [
    AWS.SQS.Queue as never,
    "SQS.Queue",
    (fqn) => ({ queueUrl: `https://sqs.us-east-1.amazonaws.com/832907639880/${slug(fqn)}`, queueArn: arn("sqs", fqn) }),
  ],
  [
    AWS.Lambda.Function as never,
    "Lambda.Function",
    (fqn, news) => ({
      functionArn: arn("lambda", `function/${fqn}`),
      functionName: news.functionName ?? slug(fqn),
      functionUrl: news.functionUrl === true ? `https://${Str.toLowerCase(slug(fqn))}.lambda-url.on.aws/` : undefined,
    }),
  ],
  [AWS.Lambda.EventSourceMapping as never, "Lambda.EventSourceMapping", (fqn) => ({ uuid: fqn })],
  [AWS.Lambda.Permission as never, "Lambda.Permission", (fqn) => ({ statementId: slug(fqn) })],
  [AWS.EventBridge.Rule as never, "EventBridge.Rule", (fqn) => ({ ruleArn: arn("events", `rule/${fqn}`) })],
  [
    launchTemplateAsProviderClass as never,
    "RunnerLaunchTemplate",
    (fqn) => ({ launchTemplateId: `lt-${slug(fqn)}`, defaultVersionNumber: 1, latestVersionNumber: 1 }),
  ],
];

const readsAwsMadeDefaultGroup = {
  read: Effect.fn("Fake.readDefaultGroup")(function* (input: { readonly olds?: News }) {
    const vpcId = input.olds?.vpcId;
    return P.isString(vpcId) ? { vpcId, groupId: `sg-default-${vpcId}`, ingress: [], egress: [] } : undefined;
  }),
};

const fakeProvider = (
  recorder: Recorder,
  [resource, type, attributes]: (typeof table)[number],
  adoptDefaultGroup: boolean
) =>
  Provider.succeed(resource, {
    ...(adoptDefaultGroup && type === "EC2.DefaultSecurityGroup" ? readsAwsMadeDefaultGroup : {}),
    reconcile: Effect.fn("Fake.reconcile")(function* (input: {
      readonly fqn: string;
      readonly news: News;
      readonly bindings?: Reconciled["bindings"];
    }) {
      recorder.reconciled = A.append(
        A.filter(recorder.reconciled, (entry) => entry.fqn !== input.fqn),
        { type, fqn: input.fqn, news: input.news, bindings: input.bindings ?? [] }
      );
      recorder.events.push(`reconcile:${type}:${input.fqn}`);
      return { ...input.news, ...attributes(input.fqn, input.news) };
    }),
    delete: Effect.fn("Fake.delete")(function* (input: { readonly fqn: string }) {
      recorder.events.push(`delete:${type}:${input.fqn}`);
    }),
    list: Effect.fn("Fake.list")(function* () {
      return [];
    }),
  } as never);

const unused = (operation: string) => () => Effect.die(`unexpected ${operation} in the stack tests`);

const listOnlySweepServices = (recorder: Recorder) =>
  Layer.mergeAll(
    Layer.succeed(
      Ec2Fleet,
      Ec2Fleet.of({
        createFleet: unused("createFleet"),
        listRunners: Effect.fn("FakeEc2Fleet.listRunners")(function* () {
          recorder.events.push("sweep:listRunners");
          return [];
        }),
        describeInstances: unused("describeInstances"),
        terminate: unused("terminate"),
        tag: unused("tag"),
        untag: unused("untag"),
      })
    ),
    Layer.succeed(
      SsmStore,
      SsmStore.of({
        get: unused("get"),
        put: unused("put"),
        delete: unused("delete"),
        listByPath: Effect.fn("FakeSsmStore.listByPath")(function* () {
          return [];
        }),
      })
    ),
    Layer.succeed(
      GitHubAppAuth,
      GitHubAppAuth.of({
        installationFor: unused("installationFor"),
        installationToken: unused("installationToken"),
      } as never)
    ),
    Layer.succeed(GitHubRunners, {} as never)
  );

/** The account the guard expects, and one it refuses. */
export const accounts = { expected: "832907639880", other: "111111111111" } as const;

const environment = (accountId: string, region: string) =>
  Layer.succeed(
    AWSEnvironment,
    Effect.succeed({
      accountId,
      region,
      credentials: Effect.succeed({
        accessKeyId: Redacted.make("test"),
        secretAccessKey: Redacted.make("test"),
        sessionToken: undefined,
        region,
      }),
    }) as never
  );

const providers = (recorder: Recorder, accountId: string, region: string, adoptDefaultGroup: boolean) =>
  A.reduce(
    table,
    RunnerSweepProvider.pipe(Layer.provide(listOnlySweepServices(recorder))) as Layer.Layer<never>,
    (layer, row) => Layer.merge(layer, fakeProvider(recorder, row, adoptDefaultGroup) as Layer.Layer<never>)
  ).pipe(Layer.provideMerge(environment(accountId, region)));

/** A failure surfaced by a scratch deploy or destroy. */
export interface StackFailure {
  readonly _tag: string;
}

/** Typed view of the scratch stack: the harness provides every requirement. */
export interface TypedStack {
  readonly deploy: <A, E, R>(definition: Effect.Effect<A, E, R>) => Effect.Effect<Input.Resolve<A>, StackFailure>;
  readonly destroy: (options?: {
    readonly include?: never;
    readonly exclude?: never;
  }) => Effect.Effect<void, StackFailure>;
  readonly plan: <A, E, R>(definition: Effect.Effect<A, E, R>) => Effect.Effect<Plan, StackFailure>;
}

/** One isolated recorder plus the `@alchemy.run/test` API at `stage`. */
export const harness = (options: {
  readonly stage: string;
  readonly accountId?: string | undefined;
  readonly region?: string | undefined;
  readonly adoptDefaultGroup?: boolean | undefined;
}) => {
  const recorder = new Recorder();
  const { test } = Test.make({
    providers: providers(
      recorder,
      options.accountId ?? accounts.expected,
      options.region ?? "us-east-1",
      options.adoptDefaultGroup ?? false
    ),
    state: inMemoryState(),
    stage: options.stage,
  });
  return {
    recorder,
    provider: (name: string, body: (stack: TypedStack) => Effect.Effect<void, StackFailure>) =>
      test.provider(name, (stack: Test.ScratchStack) => body(stack as unknown as TypedStack)),
  };
};

/** Deploy a program that must be refused; a deploy that succeeds fails the test. */
export const refusal =
  (stack: TypedStack) =>
  <A, E, R>(definition: Effect.Effect<A, E, R>) =>
    stack.deploy(definition).pipe(
      Effect.asVoid,
      Effect.flip,
      Effect.mapError(() => "the deploy was not refused"),
      Effect.orDie
    );

const nested = (failure: unknown): O.Option<unknown> =>
  P.hasProperty(failure, "cause") ? O.some(failure.cause) : O.none();

/** Every `_tag` along a failure's `cause` chain, outermost first. */
export const tagChain = (failure: unknown): ReadonlyArray<string> =>
  A.appendAll(
    P.hasProperty(failure, "_tag") && P.isString(failure._tag) ? [failure._tag] : [],
    O.match(nested(failure), { onNone: () => [], onSome: tagChain })
  );
