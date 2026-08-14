import {
  BakeCheckReport,
  BakeConfig,
  BakeLocalInputs,
  BakePlan,
  BakePlanJson,
  BakePlanStep,
  BakeReport,
  BakeReportJson,
  DEFAULT_RUNNER_BASE_AMI_PARAMETER,
  makeBakeScriptForTesting,
  RunnersService,
  RunnersServiceLive,
  resolveBakeMode,
  runAwsForTesting,
  runBakeCommandForTesting,
  writeBakeReportForTesting,
} from "@beep/repo-cli/commands/Runners";
import { Sha256Hex } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Match, Path, pipe, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const digest = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const bunArchiveDigest = Sha256Hex.make("951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f");
const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const encoder = new TextEncoder();

const stubHandle = (output: string, exitCode = 0) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

const report = (priorPin: O.Option<string>) =>
  BakeReport.make({
    amiId: "ami-0123456789abcdef0",
    lockfileSha256: digest,
    bunArchiveSha256: bunArchiveDigest,
    bunVersion: "1.3.14",
    baseAmiId: "ami-0fedcba9876543210",
    priorPin,
    pulumiPinCommand:
      "cd infra/ci-runners && pulumi config set ciFleetController:amiId ami-0123456789abcdef0 --stack production",
    startedAt: "2026-08-13T12:00:00.000Z",
    completedAt: "2026-08-13T12:10:00.000Z",
  });

const makePlan = () =>
  BakePlan.make({
    lockfileSha256: digest,
    bunArchiveSha256: bunArchiveDigest,
    bunVersion: "1.3.14",
    gitRevision: "0123456789abcdef0123456789abcdef01234567",
    requiredFlags: ["--subnet", "--security-group", "--instance-profile"],
    invariants: ["beep-ci=runner"],
    steps: [BakePlanStep.make({ name: "resolve-base-ami", argv: ["aws", "ssm", "get-parameter"] })],
  });

const checkReport = (fresh: boolean) =>
  BakeCheckReport.make({
    amiId: "ami-0123456789abcdef0",
    expectedLockfileSha256: digest,
    actualLockfileSha256: fresh ? O.some(digest) : O.none(),
    expectedBunArchiveSha256: bunArchiveDigest,
    actualBunArchiveSha256: fresh ? O.some(bunArchiveDigest) : O.none(),
    expectedBunVersion: "1.3.14",
    actualBunVersion: fresh ? O.some("1.3.14") : O.some("1.3.13"),
    lockfileMatches: fresh,
    bunArchiveMatches: fresh,
    bunVersionMatches: fresh,
    fresh,
  });

const bakeOptions = () => ({
  plan: false,
  check: false,
  json: false,
  region: "us-east-1",
  subnet: O.some("subnet-0123456789abcdef0"),
  securityGroup: O.some("sg-0123456789abcdef0"),
  instanceProfile: O.some("beep-runners-bake"),
  baseAmiParameter: DEFAULT_RUNNER_BASE_AMI_PARAMETER,
  instanceType: "r7a.2xlarge",
  tags: O.none<Record<string, string>>(),
  report: O.none<string>(),
});

const bakeConfig = () =>
  BakeConfig.make({
    region: "us-east-1",
    subnetId: "subnet-0123456789abcdef0",
    securityGroupId: "sg-0123456789abcdef0",
    instanceProfile: "beep-runners-bake",
    bakeTimestamp: 1786640400000,
  });

const argumentAfter = (argv: ReadonlyArray<string>, flag: string): O.Option<string> =>
  pipe(
    argv,
    A.dropWhile((value) => !Str.Equivalence(value, flag)),
    A.drop(1),
    A.head
  );

const makeBakeSpawner = (
  commands: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>,
  consoleOutput: string
): ChildProcessSpawner.ChildProcessSpawner["Service"] =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) {
      return Effect.die("runner bake never spawns a piped command");
    }
    const argv = [command.command, ...command.args];
    const output = Match.value(command.command).pipe(
      Match.when("git", () =>
        Effect.succeed(stubHandle(A.contains(command.args, "status") ? "" : "0123456789abcdef0123456789abcdef01234567"))
      ),
      Match.when("aws", () =>
        Match.value(command.args).pipe(
          Match.when(A.contains("get-parameter"), () =>
            Effect.succeed(stubHandle('{"Parameter":{"Value":"ami-base"}}'))
          ),
          Match.when(A.contains("run-instances"), () =>
            Effect.succeed(stubHandle('{"Instances":[{"InstanceId":"i-bake"}]}'))
          ),
          Match.when(A.contains("describe-instances"), () => Effect.succeed(stubHandle('["stopped"]'))),
          Match.when(A.contains("get-console-output"), () =>
            Effect.succeed(stubHandle(`{"Output":"${consoleOutput}"}`))
          ),
          Match.when(A.contains("create-image"), () => Effect.succeed(stubHandle('{"ImageId":"ami-baked"}'))),
          Match.when(A.contains("describe-images"), () => Effect.succeed(stubHandle('["available"]'))),
          Match.when(A.contains("terminate-instances"), () => Effect.succeed(stubHandle("{}"))),
          Match.orElse(() => Effect.die(`unexpected aws command: ${A.join(command.args, " ")}`))
        )
      ),
      Match.orElse(() => Effect.die(`unexpected command: ${command.command}`))
    );
    return Ref.update(commands, A.append(argv)).pipe(Effect.andThen(output));
  });

const stubService = (fresh: boolean) => ({
  plan: Effect.succeed(makePlan()),
  check: () => Effect.succeed(checkReport(fresh)),
  bake: () => Effect.succeed(report(O.none())),
});

const runWithStubService = (fresh: boolean, options: ReturnType<typeof bakeOptions>) =>
  runBakeCommandForTesting(options, stubService(fresh));

describe("runner bake schemas", () => {
  it.effect("round-trips configuration defaults and plan JSON", () =>
    Effect.gen(function* () {
      const config = yield* S.decodeEffect(BakeConfig)({
        region: "us-east-1",
        subnetId: "subnet-0123456789abcdef0",
        securityGroupId: "sg-0123456789abcdef0",
        instanceProfile: "beep-runners-bake",
        bakeTimestamp: 1786640400000,
      });
      expect(config.baseAmiSsmParameter).toBe(DEFAULT_RUNNER_BASE_AMI_PARAMETER);
      expect(config.instanceType).toBe("r7a.2xlarge");

      const plan = BakePlan.make({
        lockfileSha256: digest,
        bunArchiveSha256: bunArchiveDigest,
        bunVersion: "1.3.14",
        gitRevision: "0123456789abcdef0123456789abcdef01234567",
        requiredFlags: ["--subnet"],
        invariants: ["beep-ci=runner"],
        steps: [],
      });
      const encoded = yield* BakePlanJson.encode(plan);
      expect(yield* BakePlanJson.decode(encoded)).toStrictEqual(plan);
    })
  );

  it.effect("round-trips a report with an optional prior pin", () =>
    Effect.gen(function* () {
      const original = report(O.some("ami-00112233445566778"));
      const encoded = yield* BakeReportJson.encode(original);
      expect(yield* BakeReportJson.decode(encoded)).toStrictEqual(original);
    })
  );

  it("round-trips arbitrary reports through the JSON codec", () =>
    fc.assert(
      fc.property(S.toArbitrary(BakeReport)(fc), (original) => {
        const encoded = Effect.runSync(BakeReportJson.encode(original));
        expect(Effect.runSync(BakeReportJson.decode(encoded))).toStrictEqual(original);
      })
    ));
});

describe("runner bake report writer", () => {
  it.effect("writes schema-encoded bytes without leaking a raw Option", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const reportPath = path.join(tmpDir, "nested", "bake-report.json");
        yield* writeBakeReportForTesting(reportPath, report(O.some("ami-00112233445566778")));
        const bytes = yield* fs.readFileString(reportPath);
        expect(bytes).not.toContain('"_id":"Option"');
        expect(bytes).toContain('"priorPin":"ami-00112233445566778"');
        expect((yield* BakeReportJson.decode(bytes)).priorPin).toStrictEqual(O.some("ami-00112233445566778"));
      })
    )
  );

  it.effect("maps report-directory creation failures", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const blockerPath = path.join(tmpDir, "blocker");
        const reportPath = path.join(blockerPath, "bake-report.json");
        yield* fs.writeFileString(blockerPath, "not a directory");
        const error = yield* Effect.flip(writeBakeReportForTesting(reportPath, report(O.none())));
        expect(error.message).toBe(`Failed to create the report directory for ${reportPath}.`);
      })
    )
  );
});

describe("runner bake planning and argv", () => {
  it.effect("parses plan, check, and default bake modes", () =>
    Effect.gen(function* () {
      expect(yield* resolveBakeMode(true, false)).toBe("plan");
      expect(yield* resolveBakeMode(false, true)).toBe("check");
      expect(yield* resolveBakeMode(false, false)).toBe("bake");
      const error = yield* Effect.flip(resolveBakeMode(true, true));
      expect(error.message).toBe("runners bake: --plan and --check are mutually exclusive.");
    })
  );

  it.effect("renders plan, fresh check, and bake reports through the command handler", () =>
    Effect.gen(function* () {
      yield* runWithStubService(true, { ...bakeOptions(), plan: true });
      yield* runWithStubService(true, { ...bakeOptions(), check: true });
      yield* runWithStubService(true, bakeOptions());
      expect(yield* TestConsole.logLines).toStrictEqual([
        "lockfile sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nbun version: 1.3.14\ngit revision: 0123456789abcdef0123456789abcdef01234567\nrequired flags: --subnet, --security-group, --instance-profile\nresolve-base-ami: aws ssm get-parameter",
        "AMI: ami-0123456789abcdef0\nlockfile: fresh\nbun version: fresh\nfresh: yes",
        "baked AMI: ami-0123456789abcdef0\nbase AMI: ami-0fedcba9876543210\nlockfile sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nbun version: 1.3.14\npin: cd infra/ci-runners && pulumi config set ciFleetController:amiId ami-0123456789abcdef0 --stack production",
      ]);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("fails a stale check after rendering its report", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(runWithStubService(false, { ...bakeOptions(), check: true }));
      expect(error.message).toBe("runners bake --check: live AMI is stale.");
      expect(yield* TestConsole.logLines).toStrictEqual([
        "AMI: ami-0123456789abcdef0\nlockfile: stale\nbun version: stale\nfresh: no",
      ]);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("reports each missing required bake flag", () =>
    Effect.gen(function* () {
      const missingSubnet = yield* Effect.flip(runWithStubService(true, { ...bakeOptions(), subnet: O.none() }));
      expect(missingSubnet.message).toBe("runners bake: --subnet is required.");

      const missingSecurityGroup = yield* Effect.flip(
        runWithStubService(true, { ...bakeOptions(), securityGroup: O.none() })
      );
      expect(missingSecurityGroup.message).toBe("runners bake: --security-group is required.");

      const missingInstanceProfile = yield* Effect.flip(
        runWithStubService(true, { ...bakeOptions(), instanceProfile: O.none() })
      );
      expect(missingInstanceProfile.message).toBe("runners bake: --instance-profile is required.");
    })
  );

  it.effect("passes AWS an explicit global-region argv without a shell", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
      const spawner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("runner bake never spawns a piped command");
        }
        return Ref.update(commands, A.append([command.command, ...command.args])).pipe(
          Effect.as(stubHandle('{"Images":[]}'))
        );
      });
      const output = yield* runAwsForTesting("us-east-1", ["ec2", "describe-images", "--image-ids", "ami-123"]).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
      expect(output).toBe('{"Images":[]}');
      expect(yield* Ref.get(commands)).toStrictEqual([
        ["aws", "--no-cli-pager", "--region", "us-east-1", "ec2", "describe-images", "--image-ids", "ami-123"],
      ]);
    })
  );

  it.effect("plans and checks freshness through the live service with a scripted spawner", () =>
    Effect.gen(function* () {
      const localPlan = yield* Ref.make(O.none<BakePlan>());
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
      const spawner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("runner bake never spawns a piped command");
        }
        const argv = [command.command, ...command.args];
        return Ref.update(commands, A.append(argv)).pipe(
          Effect.andThen(
            Match.value(command.command).pipe(
              Match.when("git", () =>
                Effect.succeed(
                  stubHandle(A.contains(command.args, "status") ? "" : "0123456789abcdef0123456789abcdef01234567")
                )
              ),
              Match.when("aws", () =>
                pipe(
                  A.contains(command.args, "get-parameter"),
                  Match.value,
                  Match.when(true, () => Effect.succeed(stubHandle('{"Parameter":{"Value":"ami-live"}}'))),
                  Match.orElse(() =>
                    Ref.get(localPlan).pipe(
                      Effect.map(
                        O.match({
                          onNone: () => stubHandle('{"Images":[]}'),
                          onSome: (currentPlan) =>
                            stubHandle(
                              `{"Images":[{"Tags":[{"Key":"beep-ci:lockfile-sha256","Value":"${currentPlan.lockfileSha256}"},{"Key":"beep-ci:bun-archive-sha256","Value":"${currentPlan.bunArchiveSha256}"},{"Key":"beep-ci:bun-version","Value":"${currentPlan.bunVersion}"}]}]}`
                            ),
                        })
                      )
                    )
                  )
                )
              ),
              Match.orElse(() => Effect.die(`unexpected command: ${command.command}`))
            )
          )
        );
      });
      const testLayer = RunnersServiceLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
            NodeFileSystem.layer,
            NodePath.layer,
            NodeCrypto.layer
          )
        )
      );
      const { check, currentPlan } = yield* Effect.gen(function* () {
        const service = yield* RunnersService;
        const currentPlan = yield* service.plan;
        yield* Ref.set(localPlan, O.some(currentPlan));
        const check = yield* service.check("us-west-2");
        return { check, currentPlan };
      }).pipe(provideScopedLayer(testLayer));

      expect(currentPlan.requiredFlags).toStrictEqual([
        "--region",
        "--subnet",
        "--security-group",
        "--instance-profile",
      ]);
      expect(A.map(currentPlan.steps, (step) => step.name)).toStrictEqual([
        "resolve-base-ami",
        "launch-bake-instance",
        "wait-for-bake",
        "verify-console-marker",
        "create-image",
        "wait-for-image",
        "terminate-instance",
      ]);
      expect(check.fresh).toBe(true);
      expect(check.amiId).toBe("ami-live");
      expect(
        A.some(yield* Ref.get(commands), (argv) => A.contains(argv, "describe-images") && A.contains(argv, "us-west-2"))
      ).toBe(true);
    })
  );

  it.effect("bakes with safe JSON launch arguments, a unique AMI name, and bounded state polling", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const consoleOutput = yield* S.encodeEffect(S.StringFromBase64)("BEEP_RUNNERS_BAKE_COMPLETE\n");
        const spawner = makeBakeSpawner(commands, consoleOutput);
        const testLayer = RunnersServiceLive.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
              NodeFileSystem.layer,
              NodePath.layer,
              NodeCrypto.layer
            )
          )
        );
        const reportPath = path.join(tmpDir, "bake-report.json");
        const baked = yield* Effect.gen(function* () {
          const service = yield* RunnersService;
          return yield* service.bake(bakeConfig(), O.some(reportPath));
        }).pipe(provideScopedLayer(testLayer));
        const captured = yield* Ref.get(commands);
        const runInstances = yield* A.findFirst(captured, A.contains("run-instances")).pipe(
          O.match({ onNone: () => Effect.die("missing run-instances"), onSome: Effect.succeed })
        );
        const createImage = yield* A.findFirst(captured, A.contains("create-image")).pipe(
          O.match({ onNone: () => Effect.die("missing create-image"), onSome: Effect.succeed })
        );

        expect(baked.amiId).toBe("ami-baked");
        expect(
          pipe(
            argumentAfter(runInstances, "--tag-specifications"),
            O.exists(Str.startsWith('{"ResourceType":"instance","Tags":['))
          )
        ).toBe(true);
        expect(argumentAfter(runInstances, "--block-device-mappings")).toStrictEqual(
          O.some(
            '[{"DeviceName":"/dev/xvda","Ebs":{"DeleteOnTermination":true,"Encrypted":true,"Iops":3000,"Throughput":250,"VolumeSize":100,"VolumeType":"gp3"}}]'
          )
        );
        expect(argumentAfter(createImage, "--name")).toStrictEqual(
          O.some(`beep-ci-runners-${Str.slice(0, 12)(baked.lockfileSha256)}-1786640400000`)
        );
        expect(
          pipe(
            argumentAfter(createImage, "--tag-specifications"),
            O.exists(Str.includes('{"Key":"beep-ci","Value":"runner"}'))
          )
        ).toBe(true);
        expect(A.some(captured, A.contains("describe-instances"))).toBe(true);
        expect(A.some(captured, A.contains("describe-images"))).toBe(true);
        expect(A.some(captured, A.contains("wait"))).toBe(false);
      })
    )
  );

  it.effect("terminates the temporary instance when bake verification fails", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const consoleOutput = yield* S.encodeEffect(S.StringFromBase64)("bake failed\n");
        const spawner = makeBakeSpawner(commands, consoleOutput);
        const testLayer = RunnersServiceLive.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
              NodeFileSystem.layer,
              NodePath.layer,
              NodeCrypto.layer
            )
          )
        );
        const error = yield* Effect.gen(function* () {
          const service = yield* RunnersService;
          return yield* Effect.flip(service.bake(bakeConfig(), O.some(path.join(tmpDir, "bake-report.json"))));
        }).pipe(provideScopedLayer(testLayer));

        expect(error.message).toContain("stopped without the BEEP_RUNNERS_BAKE_COMPLETE success marker");
        expect(A.some(yield* Ref.get(commands), A.contains("terminate-instances"))).toBe(true);
      })
    )
  );

  it.effect("refuses dirty lockfile inputs before making an AWS call", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
      const spawner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("runner bake never spawns a piped command");
        }
        const argv = [command.command, ...command.args];
        return Ref.update(commands, A.append(argv)).pipe(Effect.as(stubHandle(" M bun.lock")));
      });
      const testLayer = RunnersServiceLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
            NodeFileSystem.layer,
            NodePath.layer,
            NodeCrypto.layer
          )
        )
      );
      const error = yield* Effect.gen(function* () {
        const service = yield* RunnersService;
        return yield* Effect.flip(service.plan);
      }).pipe(provideScopedLayer(testLayer));

      expect(error.message).toBe(
        "Refusing to bake while bun.lock, .bun-version, or .bun-linux-x64.sha256 has uncommitted changes."
      );
      expect(A.some(yield* Ref.get(commands), A.contains("aws"))).toBe(false);
    })
  );

  it("renders a strict, secret-free user-data script", () => {
    const script = makeBakeScriptForTesting(
      BakeLocalInputs.make({
        repoRoot: "/repo",
        lockfileSha256: digest,
        bunArchiveSha256: bunArchiveDigest,
        bunVersion: "1.3.14",
        gitRevision: "0123456789abcdef0123456789abcdef01234567",
      })
    );
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("shutdown -P +350");
    expect(script).toContain("dnf install -y git unzip zip jq docker libicu");
    expect(script).toContain("https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64.zip");
    expect(script).toContain(
      "951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f' /tmp/bun-linux-x64.zip"
    );
    expect(script).toContain("sha256sum --check --strict -");
    expect(script.indexOf("sha256sum --check --strict -")).toBeLessThan(
      script.indexOf("install -o ec2-user -g ec2-user -m 0755")
    );
    expect(script).not.toContain("bun.sh/install");
    expect(script).toContain("bun install --cwd /tmp/beep-effect --frozen-lockfile");
    expect(script).toContain("git -C /tmp/beep-effect checkout --detach 0123456789abcdef0123456789abcdef01234567");
    expect(script).toContain(`= "${digest}"`);
    expect(script).toContain(`'1.3.14' > /etc/beep-ci/bun-version`);
    expect(script).toContain("touch /etc/beep-ci/baked-runner");
    expect(script).toContain("rm -rf /tmp/beep-effect /root/.cache /home/ec2-user/.cache");
    expect(script).toContain("cloud-init clean --logs --machine-id");
    expect(script).toContain("rm -rf /var/lib/cloud/instances/* /var/log/cloud-init*.log");
    expect(script).toContain("BEEP_RUNNERS_BAKE_COMPLETE");
    expect(script).toContain("trap - EXIT");
    expect(script).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(script).not.toContain("AWS_SESSION_TOKEN");
  });
});
