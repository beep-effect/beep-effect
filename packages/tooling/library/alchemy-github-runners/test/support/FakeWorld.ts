/**
 * In-memory fakes of every fleet service, backed by one mutable world the
 * tests seed and inspect.
 */

import {
  AwsApiError,
  Ec2Fleet,
  FleetLaunchResult,
  GitHubApiError,
  GitHubAppAuth,
  GitHubRunners,
  InstallationToken,
  JitRunnerConfig,
  MessageQueue,
  ParameterEntry,
  RunnerBinaries,
  RunnerInstance,
  RunnerTag,
  SelfHostedRunner,
  SsmStore,
  TaggedInstance,
} from "@beep/alchemy-github-runners";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  FleetLaunchRequest,
  JitConfigRequest,
  ParameterWrite,
  ReleaseAsset,
  RunnerFilter,
} from "@beep/alchemy-github-runners";

const isAwsApiError = S.is(AwsApiError);

export interface WorldInstance {
  readonly instanceId: string;
  readonly launchTime: number;
  state: string;
  tags: Record<string, string>;
}

export interface SentMessage {
  readonly body: string;
  readonly delaySeconds: O.Option<number>;
  readonly queueUrl: string;
}

export class World {
  instances: Array<WorldInstance> = [];
  fleetRequests: Array<FleetLaunchRequest> = [];
  /** Scripted CreateFleet answers, consumed in order; default launches everything. */
  fleetAnswers: Array<FleetLaunchResult | AwsApiError> = [];
  terminated: Array<string> = [];
  /** Instance ids passed to `tag` and `untag`, in call order. */
  tagged: Array<string> = [];
  untagged: Array<string> = [];
  ssm: Record<string, { value: string; modified: number; tags: Record<string, string> }> = {};
  /** Every SSM write, as the program asked for it (tier included). */
  puts: Array<ParameterWrite> = [];
  /** Scripted SSM write failures by parameter-name prefix. */
  putFailures: Array<readonly [string, AwsApiError]> = [];
  /** Name prefixes whose put stores the value and then fails: the response was lost. */
  landedPutFailures: Array<readonly [string, AwsApiError]> = [];
  /** Scripted instance-tag failure for every tag call. */
  tagFailure: O.Option<AwsApiError> = O.none();
  /** Scripted terminate failure for every terminate call. */
  terminateFailure: O.Option<AwsApiError> = O.none();
  /** Scripted JIT failure error; default a 500. */
  /** Scripted runner-group lookup failure for every lookup. */
  runnerGroupError: O.Option<GitHubApiError> = O.none();
  /** Scripted registration-token failure for every request. */
  registrationError: O.Option<GitHubApiError> = O.none();
  jitError: GitHubApiError = GitHubApiError.make({ operation: "jit", status: O.some(500), message: "boom" });
  sent: Array<SentMessage> = [];
  /** Cleanup calls in order: `deleteToken:<name>`, `deleteRunner:<id>`, `terminate:<instance>`. */
  cleanupCalls: Array<string> = [];
  /** Scripted SSM delete failure for every delete call. */
  deleteFailure: O.Option<AwsApiError> = O.none();
  /** Queue URLs whose sends fail with a 503. */
  sendFailures: Array<string> = [];
  githubRunners: Array<SelfHostedRunner> = [];
  deletedRunners: Array<number> = [];
  busyOnDelete: Array<number> = [];
  busyDeletesLeft: Record<number, number> = {};
  failOnDelete: Array<number> = [];
  onTerminate: (instanceId: string) => void = () => undefined;
  jobQueued = true;
  startedJobs: Array<number> = [];
  jitFailures: Array<string> = [];
  jitRequests: Array<JitConfigRequest> = [];
  runnerGroups: Record<string, number> = { "beep-ec2-heavy": 7 };
  installationLookups = 0;
  nextInstance = 0;
  latestAsset: O.Option<ReleaseAsset> = O.none();
  cachedName: O.Option<string> = O.none();
  mirrored: Array<string> = [];

  launch(count: number, tags: Readonly<Record<string, string>>, launchTime = 0): ReadonlyArray<string> {
    if (count <= 0) {
      return [];
    }
    return A.makeBy(count, () => {
      this.nextInstance += 1;
      const instanceId = `i-${Str.padStart(4, "0")(String(this.nextInstance))}`;
      this.instances.push({ instanceId, launchTime, state: "running", tags: { ...tags } });
      return instanceId;
    });
  }

  instance(instanceId: string): O.Option<WorldInstance> {
    return A.findFirst(this.instances, (candidate) => candidate.instanceId === instanceId);
  }
}

const matchesFilter = (filter: RunnerFilter) => (instance: WorldInstance) =>
  A.contains(filter.states, instance.state) &&
  instance.tags[RunnerTag.application] === "github-action-runner" &&
  O.getOrElse(
    O.map(filter.environment, (value) => instance.tags[RunnerTag.environment] === value),
    () => true
  ) &&
  O.getOrElse(
    O.map(filter.type, (value) => instance.tags[RunnerTag.type] === value),
    () => true
  ) &&
  O.getOrElse(
    O.map(filter.owner, (value) => instance.tags[RunnerTag.owner] === value),
    () => true
  ) &&
  (!filter.orphan || instance.tags[RunnerTag.orphan] === "true");

const toRunnerInstance = (instance: WorldInstance) =>
  RunnerInstance.make({
    instanceId: instance.instanceId,
    launchTime: O.some(instance.launchTime),
    owner: O.fromUndefinedOr(instance.tags[RunnerTag.owner]),
    type: O.fromUndefinedOr(instance.tags[RunnerTag.type]),
    githubRunnerId: O.fromUndefinedOr(instance.tags[RunnerTag.githubRunnerId]),
    orphan: instance.tags[RunnerTag.orphan] === "true",
    bypassRemoval: instance.tags[RunnerTag.bypassRemoval] === "true",
  });

export const worldContext = (world: World) =>
  Context.mergeAll(
    Context.make(
      Ec2Fleet,
      Ec2Fleet.of({
        createFleet: Effect.fn("FakeEc2.createFleet")(function* (request) {
          world.fleetRequests.push(request);
          const scripted = world.fleetAnswers.shift();
          if (isAwsApiError(scripted)) {
            return yield* scripted;
          }
          const count = scripted === undefined ? request.targetCapacity : scripted.instanceIds.length;
          const instanceIds = world.launch(count, request.tags);
          return FleetLaunchResult.make({ instanceIds, errorCodes: scripted?.errorCodes ?? [] });
        }),
        listRunners: Effect.fn("FakeEc2.listRunners")(function* (filter) {
          return A.map(A.filter(world.instances, matchesFilter(filter)), toRunnerInstance);
        }),
        describeInstances: Effect.fn("FakeEc2.describeInstances")(function* (instanceIds) {
          return A.map(
            A.filter(world.instances, (instance) => A.contains(instanceIds, instance.instanceId)),
            (instance) => TaggedInstance.make({ instanceId: instance.instanceId, tags: { ...instance.tags } })
          );
        }),
        terminate: Effect.fn("FakeEc2.terminate")(function* (instanceId) {
          world.cleanupCalls.push(`terminate:${instanceId}`);
          world.onTerminate(instanceId);
          world.terminated.push(instanceId);
          if (O.isSome(world.terminateFailure)) {
            return yield* world.terminateFailure.value;
          }
          for (const instance of O.toArray(world.instance(instanceId))) {
            instance.state = "terminated";
          }
        }),
        tag: Effect.fn("FakeEc2.tag")(function* (instanceId, tags) {
          world.tagged.push(instanceId);
          if (O.isSome(world.tagFailure)) {
            return yield* world.tagFailure.value;
          }
          for (const instance of O.toArray(world.instance(instanceId))) {
            instance.tags = { ...instance.tags, ...tags };
          }
        }),
        untag: Effect.fn("FakeEc2.untag")(function* (instanceId, keys) {
          world.untagged.push(instanceId);
          for (const instance of O.toArray(world.instance(instanceId))) {
            instance.tags = R.filter(instance.tags, (_value, key) => !A.contains(keys, key));
          }
        }),
      })
    ),
    Context.make(
      SsmStore,
      SsmStore.of({
        get: Effect.fn("FakeSsm.get")(function* (name) {
          return O.map(O.fromUndefinedOr(world.ssm[name]), (entry) => Redacted.make(entry.value));
        }),
        put: Effect.fn("FakeSsm.put")(function* (input) {
          world.puts.push(input);
          const failure = A.findFirst(world.putFailures, ([prefix]) => Str.startsWith(prefix)(input.name));
          if (O.isSome(failure)) {
            return yield* failure.value[1];
          }
          world.ssm[input.name] = { value: Redacted.value(input.value), modified: 0, tags: { ...input.tags } };
          const lost = A.findFirst(world.landedPutFailures, ([prefix]) => Str.startsWith(prefix)(input.name));
          if (O.isSome(lost)) {
            return yield* lost.value[1];
          }
        }),
        delete: Effect.fn("FakeSsm.delete")(function* (name) {
          world.cleanupCalls.push(`deleteToken:${name}`);
          if (O.isSome(world.deleteFailure)) {
            return yield* world.deleteFailure.value;
          }
          world.ssm = R.remove(world.ssm, name);
        }),
        listByPath: Effect.fn("FakeSsm.listByPath")(function* (path) {
          return A.map(
            A.filter(R.toEntries(world.ssm), ([name]) => Str.startsWith(`${path}/`)(name)),
            ([name, entry]) => ParameterEntry.make({ name, lastModified: O.some(entry.modified) })
          );
        }),
      })
    ),
    Context.make(
      MessageQueue,
      MessageQueue.of({
        send: Effect.fn("FakeSqs.send")(function* (input) {
          if (A.contains(world.sendFailures, input.queueUrl)) {
            return yield* AwsApiError.make({
              service: "sqs",
              operation: "sendMessage",
              code: O.some("ServiceUnavailable"),
              status: O.some(503),
              retryable: true,
              fault: "transient",
              message: "unavailable",
            });
          }
          world.sent.push(input);
        }),
      })
    ),
    Context.make(
      GitHubAppAuth,
      GitHubAppAuth.of({
        installationFor: Effect.fn("FakeApp.installationFor")(function* () {
          world.installationLookups += 1;
          return 99;
        }),
        installationToken: Effect.fn("FakeApp.installationToken")(function* (installationId) {
          return InstallationToken.make({ installationId, token: Redacted.make("ghs_fake") });
        }),
      })
    ),
    Context.make(
      GitHubRunners,
      GitHubRunners.of({
        isJobQueued: Effect.fn("FakeGitHub.isJobQueued")(function* (_token, job) {
          return world.jobQueued && !A.contains(world.startedJobs, job.jobId);
        }),
        runnerGroupId: Effect.fn("FakeGitHub.runnerGroupId")(function* (_token, _org, groupName) {
          if (O.isSome(world.runnerGroupError)) {
            return yield* world.runnerGroupError.value;
          }
          return yield* Effect.fromOption(O.fromUndefinedOr(world.runnerGroups[groupName])).pipe(
            Effect.mapError(() => GitHubApiError.make({ operation: "runnerGroupId", message: "missing" }))
          );
        }),
        generateJitConfig: Effect.fn("FakeGitHub.generateJitConfig")(function* (_token, request) {
          world.jitRequests.push(request);
          if (A.some(world.jitFailures, (name) => Str.endsWith(name)(request.name))) {
            return yield* world.jitError;
          }
          const runnerId = 1000 + world.jitRequests.length;
          world.githubRunners.push(
            SelfHostedRunner.make({ id: runnerId, name: request.name, status: "online", busy: false })
          );
          return JitRunnerConfig.make({ runnerId, encodedJitConfig: Redacted.make(`jit-${request.name}`) });
        }),
        registrationToken: Effect.fn("FakeGitHub.registrationToken")(function* () {
          if (O.isSome(world.registrationError)) {
            return yield* world.registrationError.value;
          }
          return Redacted.make("reg-token");
        }),
        getRunner: Effect.fn("FakeGitHub.getRunner")(function* (_token, _owner, runnerId) {
          return A.findFirst(world.githubRunners, (runner) => runner.id === runnerId);
        }),
        listRunners: Effect.fn("FakeGitHub.listRunners")(function* () {
          return world.githubRunners;
        }),
        deleteRunner: Effect.fn("FakeGitHub.deleteRunner")(function* (_token, _owner, runnerId) {
          world.cleanupCalls.push(`deleteRunner:${runnerId}`);
          if (A.contains(world.failOnDelete, runnerId)) {
            return yield* GitHubApiError.make({ operation: "delete", status: O.some(502), message: "bad gateway" });
          }
          const busyLeft = world.busyDeletesLeft[runnerId] ?? 0;
          if (busyLeft > 0) {
            world.busyDeletesLeft[runnerId] = busyLeft - 1;
            return yield* GitHubApiError.make({ operation: "delete", status: O.some(422), message: "busy" });
          }
          if (A.contains(world.busyOnDelete, runnerId)) {
            return yield* GitHubApiError.make({ operation: "delete", status: O.some(422), message: "busy" });
          }
          world.deletedRunners.push(runnerId);
          world.githubRunners = A.filter(world.githubRunners, (runner) => runner.id !== runnerId);
        }),
      })
    ),
    Context.make(
      RunnerBinaries,
      RunnerBinaries.of({
        latestAsset: Effect.fn("FakeBinaries.latestAsset")(function* () {
          return world.latestAsset;
        }),
        cachedName: Effect.fn("FakeBinaries.cachedName")(function* () {
          return world.cachedName;
        }),
        mirror: Effect.fn("FakeBinaries.mirror")(function* (input) {
          world.mirrored.push(input.asset.name);
        }),
      })
    )
  );
