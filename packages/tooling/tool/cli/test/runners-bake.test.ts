import {
  BakeConfig,
  BakeLocalInputs,
  BakePlan,
  BakePlanJson,
  BakeReport,
  BakeReportJson,
  DEFAULT_RUNNER_BASE_AMI_PARAMETER,
  makeBakeScriptForTesting,
  resolveBakeMode,
  runAwsForTesting,
  writeBakeReportForTesting,
} from "@beep/repo-cli/commands/Runners";
import { Sha256Hex } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const digest = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const encoder = new TextEncoder();

const stubHandle = (output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
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
    bunVersion: "1.3.14",
    baseAmiId: "ami-0fedcba9876543210",
    priorPin,
    pulumiPinCommand:
      "cd infra/ci-runners && pulumi config set ciFleetController:amiId ami-0123456789abcdef0 --stack production",
    startedAt: "2026-08-13T12:00:00.000Z",
    completedAt: "2026-08-13T12:10:00.000Z",
  });

describe("runner bake schemas", () => {
  it.effect("round-trips configuration defaults and plan JSON", () =>
    Effect.gen(function* () {
      const config = yield* S.decodeUnknownEffect(BakeConfig)({
        region: "us-east-1",
        subnetId: "subnet-0123456789abcdef0",
        securityGroupId: "sg-0123456789abcdef0",
        instanceProfile: "beep-runners-bake",
      });
      expect(config.baseAmiSsmParameter).toBe(DEFAULT_RUNNER_BASE_AMI_PARAMETER);
      expect(config.instanceType).toBe("r7a.2xlarge");

      const plan = BakePlan.make({
        lockfileSha256: digest,
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
});

describe("runner bake planning and argv", () => {
  it.effect("parses plan, check, and default bake modes", () =>
    Effect.gen(function* () {
      expect(yield* resolveBakeMode(true, false)).toBe("plan");
      expect(yield* resolveBakeMode(false, true)).toBe("check");
      expect(yield* resolveBakeMode(false, false)).toBe("bake");
      expect(O.isSome(yield* Effect.option(resolveBakeMode(true, true)))).toBe(false);
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

  it("renders a strict, secret-free user-data script", () => {
    const script = makeBakeScriptForTesting(
      BakeLocalInputs.make({
        repoRoot: "/repo",
        lockfileSha256: digest,
        bunVersion: "1.3.14",
        gitRevision: "0123456789abcdef0123456789abcdef01234567",
      })
    );
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("shutdown -P +350");
    expect(script).toContain("dnf install -y git unzip zip jq docker libicu");
    expect(script).toContain("bun install --cwd /tmp/beep-effect --frozen-lockfile");
    expect(script).toContain("cloud-init clean --logs --machine-id");
    expect(script).toContain("BEEP_RUNNERS_BAKE_COMPLETE");
    expect(script).not.toContain("AWS_SECRET_ACCESS_KEY");
  });
});
