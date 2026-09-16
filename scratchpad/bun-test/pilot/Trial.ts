import { $ScratchpadId } from "@beep/identity/packages";
import {
  AdmissionRequest,
  MemoryStatsLive,
  noAdmissionOriginGate,
  withQualityAdmission,
} from "@beep/repo-cli/test/RepoRun";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

const $I = $ScratchpadId.create("bun-test/pilot/Trial");
const Natural = S.Int.check(S.isGreaterThanOrEqualTo(0));
const TrialId = S.String.check(S.isPattern(/^[a-zA-Z0-9_-]+$/u));

class Request extends S.Class<Request>($I`Request`)(
  {
    id: TrialId,
    root: S.NonEmptyString,
    cwd: S.NonEmptyString,
    executable: S.NonEmptyString,
    args: S.Array(S.String),
    env: S.Record(S.String, S.String),
    expectedExit: Natural,
    maxSeconds: S.Int.check(S.isBetween({ minimum: 1, maximum: 600 })),
  },
  $I.annote("Request", { description: "Explicit nonsecret command and expected exit for one bounded local trial." })
) {}

class Receipt extends S.Class<Receipt>($I`Receipt`)(
  {
    request: Request,
    startedAtMillis: Natural,
    elapsedMillis: Natural,
    exitCode: Natural,
    expected: S.Boolean,
    scope: S.NonEmptyString,
    limits: S.String,
    memoryPeak: S.String,
    memoryEvents: S.String,
    cpuBefore: S.String,
    cpuAfter: S.String,
  },
  $I.annote("Receipt", { description: "Executed trial result with live cgroup accounting captured before collection." })
) {}

class TrialFailure extends S.TaggedError<TrialFailure>($I`TrialFailure`)(
  "TrialFailure",
  { message: S.String },
  $I.annote("TrialFailure", { description: "A qualification, accounting, budget, or command result failed." })
) {}

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const requestPath = yield* Effect.fromOption(A.get(process.argv, 2)).pipe(
    Effect.mapError(() => TrialFailure.make({ message: "Usage: bun Trial.ts <request.json>" }))
  );
  const request = yield* S.decodeEffect(S.fromJsonString(Request))(yield* fs.readFileString(requestPath));
  const artifacts = path.join(request.root, ".beep", "bun-test-pilot");
  yield* fs.makeDirectory(artifacts, { recursive: true });
  const lock = path.join(artifacts, "active-trial.lock");
  yield* Effect.acquireRelease(
    fs.writeFileString(lock, request.id, { flag: "wx" }),
    () => fs.remove(lock).pipe(Effect.orDie)
  );
  const output = path.join(artifacts, `${request.id}.receipt.json`);
  const pending = path.join(artifacts, `${request.id}.pending.json`);
  if ((yield* fs.exists(output)) || (yield* fs.exists(pending))) {
    return yield* TrialFailure.make({ message: "Trial ids are immutable; choose a new id." });
  }
  const names = yield* fs.readDirectory(artifacts);
  let consumedMillis = 0;
  for (const name of names) {
    if (Str.endsWith(".pending.json")(name)) {
      return yield* TrialFailure.make({ message: `Unaccounted interrupted attempt: ${name}` });
    }
    if (Str.endsWith(".receipt.json")(name)) {
      const prior = yield* S.decodeEffect(S.fromJsonString(Receipt))(
        yield* fs.readFileString(path.join(artifacts, name))
      );
      consumedMillis += prior.elapsedMillis;
    }
  }
  const remainingSeconds = Math.floor((3_600_000 - consumedMillis) / 1000);
  if (remainingSeconds < request.maxSeconds) {
    return yield* TrialFailure.make({ message: "Requested attempt ceiling exceeds the remaining shared execution budget." });
  }

  const use = Effect.gen(function* () {
    const cgroupLine = yield* Effect.fromOption(
      A.findFirst(Str.split(yield* fs.readFileString("/proc/self/cgroup"), "\n"), Str.startsWith("0::/"))
    ).pipe(Effect.mapError(() => TrialFailure.make({ message: "Unified cgroup membership is unavailable." })));
    const relative = Str.slice(3)(cgroupLine);
    const scope = path.basename(relative);
    if (!Str.startsWith("agent-run-")(scope) || !Str.endsWith(".scope")(scope)) {
      return yield* TrialFailure.make({ message: "Admission did not attach this trial to its own agent-run scope." });
    }
    const setExit = yield* spawner.exitCode(
      ChildProcess.make("systemctl", ["--user", "set-property", "--runtime", scope,
        "CPUQuota=400%", "MemoryMax=4G", "MemorySwapMax=0"], { stdout: "inherit", stderr: "inherit" })
    );
    if (setExit !== 0) return yield* TrialFailure.make({ message: "Could not enforce trial resource limits." });
    const limits = yield* spawner.string(ChildProcess.make("systemctl", ["--user", "show", scope,
      "-p", "CPUQuotaPerSecUSec", "-p", "MemoryMax", "-p", "MemorySwapMax"]));
    if (!Str.includes("CPUQuotaPerSecUSec=4s")(limits) ||
      !Str.includes("MemoryMax=4294967296")(limits) || !Str.includes("MemorySwapMax=0")(limits)) {
      return yield* TrialFailure.make({ message: "Effective trial limits differ from the requested resource envelope." });
    }
    const cgroup = path.join("/sys/fs/cgroup", relative);
    const cpuBefore = yield* fs.readFileString(path.join(cgroup, "cpu.stat"));
    const startedAtMillis = yield* Clock.currentTimeMillis;
    yield* fs.writeFileString(pending, yield* S.encodeEffect(S.fromJsonString(Request))(request));
    const exitCode = yield* spawner.exitCode(ChildProcess.make("timeout", [
      "--signal=TERM", "--kill-after=5s", `${request.maxSeconds}s`, request.executable, ...request.args,
    ], {
      cwd: request.cwd,
      env: request.env,
      extendEnv: true,
      stdout: "inherit",
      stderr: "inherit",
    }));
    const elapsedMillis = (yield* Clock.currentTimeMillis) - startedAtMillis;
    const receipt = Receipt.make({
      request, startedAtMillis, elapsedMillis, exitCode, expected: exitCode === request.expectedExit,
      scope, limits, cpuBefore,
      cpuAfter: yield* fs.readFileString(path.join(cgroup, "cpu.stat")),
      memoryPeak: yield* fs.readFileString(path.join(cgroup, "memory.peak")),
      memoryEvents: yield* fs.readFileString(path.join(cgroup, "memory.events")),
    });
    yield* fs.writeFileString(output, yield* S.encodeEffect(S.fromJsonString(Receipt))(receipt));
    yield* fs.remove(pending);
    yield* Console.log(`TRIAL ${request.id}: exit=${exitCode}, expected=${receipt.expected}, elapsedMs=${elapsedMillis}, budgetMs=${consumedMillis + elapsedMillis}`);
    if (!receipt.expected) return yield* TrialFailure.make({ message: `Unexpected child exit for ${request.id}; receipt retained.` });
  });

  yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix", weightTokens: 1, priority: "verify", originKey: "",
      checkoutRoot: request.root, branch: "@experiment/bun-test", command: `bun-test pilot ${request.id}`,
    }),
    noAdmissionOriginGate,
    use
  );
});

const services = Layer.provideMerge(MemoryStatsLive, BunServices.layer);
// @effect-diagnostics-next-line strictEffectProvide:off
main.pipe(Effect.scoped, Effect.provide(services), BunRuntime.runMain);
