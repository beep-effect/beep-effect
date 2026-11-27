import {
  classifyFailure,
  Ec2Fleet,
  ec2FleetLive,
  FleetLaunchRequest,
  FleetOverride,
  LaunchTemplateRef,
  MessageQueue,
  messageQueueLive,
  ParameterWrite,
  ReleaseAsset,
  RunnerBinaries,
  RunnerFilter,
  runnerBinariesLive,
  SsmStore,
  ssmStoreLive,
  toAwsApiError,
} from "@beep/alchemy-github-runners";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as AwsErrors from "@distilled.cloud/aws/Errors";
import * as AwsRetry from "@distilled.cloud/aws/Retry";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeHttp } from "./support/FakeHttp.ts";
import type { FakeAnswer, RecordedRequest } from "./support/FakeHttp.ts";

const json = (body: string): FakeAnswer => ({ body, headers: { "content-type": "application/x-amz-json-1.1" } });
const xml = (body: string): FakeAnswer => ({ body, headers: { "content-type": "text/xml" } });
const target = (request: RecordedRequest) => request.headers["x-amz-target"] ?? "";

const ssmNotFound: FakeAnswer = {
  status: 400,
  body: '{"__type":"ParameterNotFound","message":"nope"}',
  headers: { "content-type": "application/x-amz-json-1.1" },
};

const ssmAnswers: Readonly<Record<string, FakeAnswer>> = {
  "AmazonSSM.GetParameter": json('{"Parameter":{"Name":"/p","Value":"secret-value","Type":"SecureString"}}'),
  "AmazonSSM.PutParameter": json('{"Version":1}'),
  "AmazonSSM.DeleteParameter": json("{}"),
  "AmazonSSM.GetParametersByPath": json('{"Parameters":[{"Name":"/t/i-1","LastModifiedDate":1700000000}]}'),
};

const ssmRoute = (request: RecordedRequest): O.Option<FakeAnswer> =>
  Str.includes("missing")(request.body) ? O.some(ssmNotFound) : O.fromUndefinedOr(ssmAnswers[target(request)]);

const ec2Answers: ReadonlyArray<readonly [string, FakeAnswer]> = [
  [
    "Action=CreateFleet",
    xml(
      '<CreateFleetResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><fleetId>fleet-1</fleetId><fleetInstanceSet><item><instanceIds><item>i-0a</item><item>i-0b</item></instanceIds></item></fleetInstanceSet><errorSet><item><errorCode>InsufficientInstanceCapacity</errorCode></item></errorSet></CreateFleetResponse>'
    ),
  ],
  [
    "Action=DescribeInstances",
    xml(
      '<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><reservationSet><item><instancesSet><item><instanceId>i-0a</instanceId><launchTime>2026-11-13T00:00:00.000Z</launchTime><tagSet><item><key>ghr:Owner</key><value>beep-effect</value></item><item><key>ghr:Type</key><value>Org</value></item><item><key>ghr:orphan</key><value>true</value></item></tagSet></item></instancesSet></item></reservationSet></DescribeInstancesResponse>'
    ),
  ],
];

const ec2Route = (request: RecordedRequest): O.Option<FakeAnswer> =>
  A.findFirst(ec2Answers, ([action]) => Str.includes(action)(request.body)).pipe(
    O.map(([, answer]) => answer),
    O.orElse(() =>
      O.some(xml('<Response xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><return>true</return></Response>'))
    )
  );

const ec2QueryFiltersByName = (body: string): Readonly<Record<string, ReadonlyArray<string>>> => {
  const params = A.fromIterable(new URLSearchParams(body));
  return R.fromEntries(
    A.getSomes(
      A.map(params, ([key, name]) => {
        const valuePrefix = `${Str.slice(0, -"Name".length)(key)}Value.`;
        return Str.startsWith("Filter.")(key) && Str.endsWith(".Name")(key)
          ? O.some([
              name,
              A.map(
                A.filter(params, ([valueKey]) => Str.startsWith(valuePrefix)(valueKey)),
                ([, value]) => value
              ),
            ] as const)
          : O.none();
      })
    )
  );
};

const releaseAnswer: FakeAnswer = {
  body: '{"tag_name":"v2.330.0","assets":[{"name":"actions-runner-linux-x64-2.330.0.tar.gz","browser_download_url":"https://github.com/actions/runner/releases/download/v2.330.0/actions-runner-linux-x64-2.330.0.tar.gz"},{"name":"actions-runner-linux-arm64-2.330.0.tar.gz","browser_download_url":"https://x"}]}',
  headers: { "content-type": "application/json" },
};

const s3Answers: ReadonlyArray<readonly [(request: RecordedRequest) => boolean, FakeAnswer]> = [
  [
    (request) => request.method === "GET",
    xml(
      "<Tagging><TagSet><Tag><Key>name</Key><Value>actions-runner-linux-x64-2.329.0.tar.gz</Value></Tag></TagSet></Tagging>"
    ),
  ],
  [
    (request) => request.method === "POST" && request.url.searchParams.has("uploads"),
    xml("<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>"),
  ],
  [(request) => request.method === "PUT", { body: "", headers: { etag: '"etag-1"' } }],
  [
    (request) => request.method === "POST",
    xml('<CompleteMultipartUploadResult><ETag>"etag-all"</ETag></CompleteMultipartUploadResult>'),
  ],
];

const s3Route = (request: RecordedRequest): O.Option<FakeAnswer> =>
  A.findFirst(s3Answers, ([matches]) => matches(request)).pipe(
    O.map(([, answer]) => answer),
    O.orElse(() => O.some({ body: "" }))
  );

const hosts: ReadonlyArray<readonly [(host: string) => boolean, (request: RecordedRequest) => O.Option<FakeAnswer>]> = [
  [Str.startsWith("ssm."), ssmRoute],
  [
    Str.startsWith("sqs."),
    () => O.some({ body: '{"MessageId":"m"}', headers: { "content-type": "application/x-amz-json-1.0" } }),
  ],
  [Str.startsWith("ec2."), ec2Route],
  [(host) => host === "api.github.com", () => O.some(releaseAnswer)],
  [(host) => host === "github.com", () => O.some({ body: "tarball-bytes", headers: { "content-length": "13" } })],
  [Str.includes("s3"), s3Route],
];

const route = (request: RecordedRequest): O.Option<FakeAnswer> =>
  A.findFirst(hosts, ([matches]) => matches(request.url.hostname)).pipe(O.flatMap(([, answer]) => answer(request)));

const withLive =
  (http: FakeHttp) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    live(http).pipe(
      Layer.build,
      Effect.flatMap((context) => program.pipe(Effect.provideContext(context)))
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
        yield* ssm.put(
          ParameterWrite.make({
            name: "/t/i-1",
            value: Redacted.make("jit"),
            secure: true,
            tier: "Advanced",
            tags: { InstanceId: "i-1" },
          })
        );
        yield* ssm.put(
          ParameterWrite.make({
            name: "/c/group",
            value: Redacted.make("7"),
            secure: false,
            tier: "Standard",
            tags: {},
          })
        );
        yield* ssm.delete("/t/i-1");
        const entries = yield* ssm.listByPath("/t");
        return { found, missing, entries };
      }).pipe(withLive(http));
      deepStrictEqual([O.map(found, Redacted.value), O.isNone(missing)], [O.some("secret-value"), true]);
      expect(A.map(entries, (entry) => entry.name)).toStrictEqual(["/t/i-1"]);
      const puts = A.map(
        http.matching((request) => target(request) === "AmazonSSM.PutParameter"),
        (request) => request.body
      );
      expect([Str.includes('"Tags"')(puts[0] ?? ""), Str.includes('"Overwrite":true')(puts[1] ?? "")]).toStrictEqual([
        true,
        true,
      ]);
      expect([
        Str.includes('"Tier":"Advanced"')(puts[0] ?? ""),
        Str.includes('"Tier":"Standard"')(puts[1] ?? ""),
      ]).toStrictEqual([true, true]);
    })
  );

  it.effect(
    "SSM: maps the SDK's tagged errors to a client or transient fault, with the status when the SDK has one",
    () =>
      Effect.gen(function* () {
        const answers: Readonly<Record<string, FakeAnswer>> = {
          "/validation": {
            status: 400,
            body: '{"__type":"ValidationException","message":"1 validation error detected: Value at value failed to satisfy constraint"}',
            headers: { "content-type": "application/x-amz-json-1.1" },
          },
          "/throttled-declared-class": {
            status: 400,
            body: '{"__type":"ThrottlingException","message":"Rate exceeded"}',
            headers: { "content-type": "application/x-amz-json-1.1" },
          },
          "/throttled-bare-code": {
            status: 400,
            body: '{"__type":"Throttling","message":"Rate exceeded"}',
            headers: { "content-type": "application/x-amz-json-1.1" },
          },
          "/throttled-code-ssm-never-declares": {
            status: 400,
            body: '{"__type":"RequestThrottled","message":"Rate exceeded"}',
            headers: { "content-type": "application/x-amz-json-1.1" },
          },
          "/exists-after-lost-response": {
            status: 400,
            body: '{"__type":"ParameterAlreadyExists","message":"The parameter already exists."}',
            headers: { "content-type": "application/x-amz-json-1.1" },
          },
          "/undeclared": {
            status: 409,
            body: '{"__type":"SomethingNew","message":"conflict"}',
            headers: { "content-type": "application/x-amz-json-1.1" },
          },
        };
        const http = new FakeHttp((request) =>
          A.findFirst(R.toEntries(answers), ([name]) => Str.includes(`"Name":"${name}"`)(request.body)).pipe(
            O.map(([, answer]) => answer)
          )
        );
        const errors = yield* Effect.gen(function* () {
          const ssm = yield* SsmStore;
          return yield* Effect.forEach(
            R.keys(answers),
            (name) =>
              ssm
                .put(ParameterWrite.make({ name, value: Redacted.make("v"), secure: true, tier: "Advanced", tags: {} }))
                .pipe(Effect.flip),
            { concurrency: 1 }
          );
        }).pipe(AwsRetry.none, withLive(http));
        deepStrictEqual(
          A.map(errors, (error) => [error.code, error.status, error.fault] as const),
          [
            [O.some("ValidationException"), O.none(), "client"],
            [O.some("ThrottlingException"), O.none(), "transient"],
            [O.some("ThrottlingException"), O.none(), "transient"],
            [O.some("RequestThrottled"), O.some(400), "transient"],
            [O.some("ParameterAlreadyExists"), O.none(), "client"],
            [O.some("SomethingNew"), O.some(409), "client"],
          ],
          "the SDK reads a bare Throttling code as ThrottlingException; an undeclared code arrives unknown with status 400"
        );
        const exists = A.filter(errors, (error) => O.contains(error.code, "ParameterAlreadyExists"));
        expect(
          [A.map(exists, classifyFailure("putToken")), A.map(exists, classifyFailure("resolveRunnerGroup"))],
          "the conflict means it landed only for the token put, which creates under the instance's own name"
        ).toStrictEqual([["transient"], ["deterministic"]]);
      })
  );

  it("maps an unknown-class 400 with a throttling code to transient, a declared validation error to client", () => {
    const map = toAwsApiError("ssm")("putParameter");
    const noStatusNoCategoryFailure = { _tag: "SomethingElse", message: "unreadable" };
    expect(
      A.map(
        [
          new AwsErrors.UnknownAwsError({
            status: 400,
            code: "ThrottlingException",
            message: "Rate exceeded",
            body: {},
          }),
          new AwsErrors.UnknownAwsError({ status: 400, code: "Throttling", message: "Rate exceeded", body: {} }),
          new AwsErrors.ThrottlingException({ message: "Rate exceeded" }),
          new AwsErrors.ValidationException({ message: "Value too long" }),
          new AwsErrors.UnknownAwsError({ status: 400, code: "InvalidKeyId", message: "bad key", body: {} }),
          noStatusNoCategoryFailure,
        ],
        (error) => {
          const mapped = map(error);
          return [mapped.fault, classifyFailure("putToken")(mapped)];
        }
      )
    ).toStrictEqual([
      ["transient", "transient"],
      ["transient", "transient"],
      ["transient", "transient"],
      ["client", "deterministic"],
      ["client", "deterministic"],
      ["unknown", "transient"],
    ]);
  });

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
          RunnerFilter.make({ environment: O.some("beep-fleet-prod-heavy"), orphan: true })
        );
        yield* ec2.listRunners(RunnerFilter.make({ environment: O.some("beep-fleet-prod-overflow") }));
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
      const describes = A.map(
        http.matching((request) => Str.includes("Action=DescribeInstances")(request.body)),
        (request) => ec2QueryFiltersByName(request.body)
      );
      const listings = A.filter(describes, (filters) => R.has(filters, "tag:ghr:environment"));
      expect(
        A.map(listings, (filters) => [
          filters["tag:ghr:environment"],
          filters["tag:ghr:Application"],
          filters["tag:ghr:orphan"],
        ]),
        "each pool environment filters exactly, with no EC2 `*` or `?` wildcard: the fleet boundary on the wire"
      ).toStrictEqual([
        [["beep-fleet-prod-heavy"], ["github-action-runner"], ["true"]],
        [["beep-fleet-prod-overflow"], ["github-action-runner"], undefined],
      ]);
      expect(describes).toHaveLength(3);
      expect(
        A.filter(
          A.flatMap(describes, (filters) => A.flatten(R.values(filters))),
          (value) => Str.includes("*")(value) || Str.includes("?")(value)
        )
      ).toStrictEqual([]);
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

  it.effect("runner binaries: latest asset, cached tag, multipart mirror", () =>
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
      deepStrictEqual(
        [O.map(asset, (value) => value.name), cached],
        [O.some("actions-runner-linux-x64-2.330.0.tar.gz"), O.some("actions-runner-linux-x64-2.329.0.tar.gz")]
      );
      const s3 = http.matching((request) => request.url.hostname !== "github.com" && request.method !== "GET");
      expect(A.map(s3, (request) => [request.method, A.fromIterable(request.url.searchParams.keys())])).toStrictEqual([
        ["POST", ["uploads"]],
        ["PUT", ["partNumber", "uploadId", "x-id"]],
        ["POST", ["uploadId"]],
      ]);
      expect([s3[0]?.headers["x-amz-tagging"], s3[1]?.body]).toStrictEqual([
        "name=actions-runner-linux-x64-2.330.0.tar.gz",
        "tarball-bytes",
      ]);
    })
  );
});
