import {
  Ec2Fleet,
  ec2FleetLive,
  FleetLaunchRequest,
  FleetOverride,
  LaunchTemplateRef,
  MessageQueue,
  messageQueueLive,
  ReleaseAsset,
  RunnerBinaries,
  RunnerFilter,
  runnerBinariesLive,
  SsmStore,
  ssmStoreLive,
} from "@beep/alchemy-github-runners";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeHttp } from "./support/FakeHttp.ts";
import type { FakeAnswer, RecordedRequest } from "./support/FakeHttp.ts";

const json = (body: string): FakeAnswer => ({ body, headers: { "content-type": "application/x-amz-json-1.1" } });
const xml = (body: string): FakeAnswer => ({ body, headers: { "content-type": "text/xml" } });
const target = (request: RecordedRequest) => request.headers["x-amz-target"] ?? "";

const route = (request: RecordedRequest): O.Option<FakeAnswer> => {
  const host = request.url.hostname;
  if (Str.startsWith("ssm.")(host)) {
    switch (target(request)) {
      case "AmazonSSM.GetParameter":
        return Str.includes("missing")(request.body)
          ? O.some({
              status: 400,
              body: '{"__type":"ParameterNotFound","message":"nope"}',
              headers: { "content-type": "application/x-amz-json-1.1" },
            })
          : O.some(json('{"Parameter":{"Name":"/p","Value":"secret-value","Type":"SecureString"}}'));
      case "AmazonSSM.PutParameter":
        return O.some(json('{"Version":1}'));
      case "AmazonSSM.DeleteParameter":
        return O.some(json("{}"));
      case "AmazonSSM.GetParametersByPath":
        return O.some(json('{"Parameters":[{"Name":"/t/i-1","LastModifiedDate":1700000000}]}'));
    }
  }
  if (Str.startsWith("sqs.")(host)) {
    return O.some({ body: '{"MessageId":"m"}', headers: { "content-type": "application/x-amz-json-1.0" } });
  }
  if (Str.startsWith("ec2.")(host)) {
    if (Str.includes("Action=CreateFleet")(request.body)) {
      return O.some(
        xml(
          '<CreateFleetResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><fleetId>fleet-1</fleetId><fleetInstanceSet><item><instanceIds><item>i-0a</item><item>i-0b</item></instanceIds></item></fleetInstanceSet><errorSet><item><errorCode>InsufficientInstanceCapacity</errorCode></item></errorSet></CreateFleetResponse>'
        )
      );
    }
    if (Str.includes("Action=DescribeInstances")(request.body)) {
      return O.some(
        xml(
          '<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><reservationSet><item><instancesSet><item><instanceId>i-0a</instanceId><launchTime>2026-11-13T00:00:00.000Z</launchTime><tagSet><item><key>ghr:Owner</key><value>beep-effect</value></item><item><key>ghr:Type</key><value>Org</value></item><item><key>ghr:orphan</key><value>true</value></item></tagSet></item></instancesSet></item></reservationSet></DescribeInstancesResponse>'
        )
      );
    }
    return O.some(xml('<Response xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><return>true</return></Response>'));
  }
  if (host === "api.github.com") {
    return O.some({
      body: '{"tag_name":"v2.330.0","assets":[{"name":"actions-runner-linux-x64-2.330.0.tar.gz","browser_download_url":"https://github.com/actions/runner/releases/download/v2.330.0/actions-runner-linux-x64-2.330.0.tar.gz"},{"name":"actions-runner-linux-arm64-2.330.0.tar.gz","browser_download_url":"https://x"}]}',
      headers: { "content-type": "application/json" },
    });
  }
  if (host === "github.com") {
    return O.some({ body: "tarball-bytes", headers: { "content-length": "13" } });
  }
  if (Str.includes("s3")(host)) {
    return request.method === "GET"
      ? O.some(
          xml(
            "<Tagging><TagSet><Tag><Key>name</Key><Value>actions-runner-linux-x64-2.329.0.tar.gz</Value></Tag></TagSet></Tagging>"
          )
        )
      : O.some({ body: "" });
  }
  return O.none();
};

const withLive =
  (http: FakeHttp) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    live(http).pipe(
      Layer.build,
      Effect.flatMap((context) => program.pipe(Effect.provideContext(context))),
      Effect.scoped
    );

const live = (http: FakeHttp) =>
  Layer.mergeAll(ec2FleetLive, ssmStoreLive, messageQueueLive, runnerBinariesLive).pipe(
    Layer.provide(Layer.mergeAll(http.layer, AwsCredentials.mock))
  );

describe("live AWS layers over distilled", () => {
  it.effect("SSM: decrypted get, missing parameter as None, tagged create and untagged overwrite", () =>
    Effect.gen(function* () {
      const http = new FakeHttp(route);
      const { found, missing, entries } = yield* Effect.gen(function* () {
        const ssm = yield* SsmStore;
        const found = yield* ssm.get("/p");
        const missing = yield* ssm.get("/missing");
        yield* ssm.put({ name: "/t/i-1", value: Redacted.make("jit"), secure: true, tags: { InstanceId: "i-1" } });
        yield* ssm.put({ name: "/c/group", value: Redacted.make("7"), secure: false, tags: {} });
        yield* ssm.delete("/t/i-1");
        const entries = yield* ssm.listByPath("/t");
        return { found, missing, entries };
      }).pipe(withLive(http));
      expect([O.map(found, Redacted.value), O.isNone(missing)]).toStrictEqual([O.some("secret-value"), true]);
      expect(A.map(entries, (entry) => entry.name)).toStrictEqual(["/t/i-1"]);
      const puts = A.map(
        http.matching((request) => target(request) === "AmazonSSM.PutParameter"),
        (request) => request.body
      );
      expect([Str.includes('"Tags"')(puts[0] ?? ""), Str.includes('"Overwrite":true')(puts[1] ?? "")]).toStrictEqual([
        true,
        true,
      ]);
    })
  );

  it.effect("EC2: CreateFleet wire request and partial result, inventory filters, tag and terminate", () =>
    Effect.gen(function* () {
      const http = new FakeHttp(route);
      const { launched, runners, described } = yield* Effect.gen(function* () {
        const ec2 = yield* Ec2Fleet;
        const launched = yield* ec2.createFleet(
          FleetLaunchRequest.make({
            launchTemplate: LaunchTemplateRef.make({ launchTemplateId: "lt-1", version: "$Default" }),
            overrides: [
              FleetOverride.make({
                subnetId: "subnet-a",
                instanceType: "m7i.4xlarge",
                imageId: O.some("ami-1"),
                priority: O.some(0),
              }),
            ],
            capacityType: "spot",
            allocationStrategy: "capacity-optimized",
            targetCapacity: 2,
            tags: { "ghr:Application": "github-action-runner" },
          })
        );
        const runners = yield* ec2.listRunners(
          RunnerFilter.make({ environment: O.some("beep-ci-heavy"), orphan: true })
        );
        const described = yield* ec2.describeInstances(["i-0a"]);
        yield* ec2.tag("i-0a", { "ghr:orphan": "true" });
        yield* ec2.untag("i-0a", ["ghr:orphan"]);
        yield* ec2.terminate("i-0a");
        return { launched, runners, described };
      }).pipe(withLive(http));
      expect([launched.instanceIds, launched.errorCodes]).toStrictEqual([
        ["i-0a", "i-0b"],
        ["InsufficientInstanceCapacity"],
      ]);
      expect(A.map(runners, (runner) => [runner.instanceId, runner.orphan])).toStrictEqual([["i-0a", true]]);
      expect(A.map(described, (instance) => instance.tags["ghr:Owner"])).toStrictEqual(["beep-effect"]);
      const fleet = http.matching((request) => Str.includes("Action=CreateFleet")(request.body))[0]?.body ?? "";
      const decodedFleet = decodeURIComponent(fleet);
      expect(
        A.map(
          [
            "Type=instant",
            "SpotOptions.AllocationStrategy=capacity-optimized",
            "LaunchTemplateId=lt-1",
            "TotalTargetCapacity=2",
          ],
          (fragment) => Str.includes(fragment)(decodedFleet)
        )
      ).toStrictEqual([true, true, true, true]);
      const describe =
        http.matching((request) => Str.includes("Action=DescribeInstances")(request.body))[0]?.body ?? "";
      expect(Str.includes("tag:ghr:environment")(decodeURIComponent(describe))).toBe(true);
      expect(http.matching((request) => Str.includes("Action=TerminateInstances")(request.body))).toHaveLength(1);
    })
  );

  it.effect("SQS: send with and without delay", () =>
    Effect.gen(function* () {
      const http = new FakeHttp(route);
      yield* Effect.gen(function* () {
        const queue = yield* MessageQueue;
        yield* queue.send({
          queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
          body: "{}",
          delaySeconds: O.some(120),
        });
        yield* queue.send({ queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q", body: "{}", delaySeconds: O.none() });
      }).pipe(withLive(http));
      const bodies = A.map(
        http.matching((request) => Str.startsWith("sqs.")(request.url.hostname)),
        (request) => request.body
      );
      expect([
        Str.includes('"DelaySeconds":120')(bodies[0] ?? ""),
        Str.includes("DelaySeconds")(bodies[1] ?? ""),
      ]).toStrictEqual([true, false]);
    })
  );

  it.effect("runner binaries: latest asset, cached tag, streamed mirror", () =>
    Effect.gen(function* () {
      const http = new FakeHttp(route);
      const { asset, cached } = yield* Effect.gen(function* () {
        const binaries = yield* RunnerBinaries;
        const asset = yield* binaries.latestAsset({ os: "linux", architecture: "x64" });
        const cached = yield* binaries.cachedName({ bucket: "binaries", key: "actions-runner-linux.tar.gz" });
        yield* binaries.mirror({
          bucket: "binaries",
          key: "actions-runner-linux.tar.gz",
          asset: ReleaseAsset.make({
            name: "actions-runner-linux-x64-2.330.0.tar.gz",
            downloadUrl: "https://github.com/a.tar.gz",
          }),
        });
        return { asset, cached };
      }).pipe(withLive(http));
      expect([O.map(asset, (value) => value.name), cached]).toStrictEqual([
        O.some("actions-runner-linux-x64-2.330.0.tar.gz"),
        O.some("actions-runner-linux-x64-2.329.0.tar.gz"),
      ]);
      const put = http.matching((request) => request.method === "PUT")[0];
      expect(put?.headers["x-amz-tagging"]).toBe("name=actions-runner-linux-x64-2.330.0.tar.gz");
    })
  );
});
