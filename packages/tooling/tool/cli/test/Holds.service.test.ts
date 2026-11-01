import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  HoldLedger,
  HoldProbe,
  HoldProbeRequest,
  HoldsProbeInput,
  holdsCommand,
  holdsPlatformError,
  makeHoldLedger,
  makeHoldProbe,
  runHoldsList,
  runHoldsProbe,
} from "@beep/repo-cli/commands/Holds";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";

// The command resolves the repository root from the working directory, so the in-memory checkout lives there.
const root = process.cwd();
const scratchRoot = "/scratch";
const commitSha = "0123456789abcdef0123456789abcdef01234567";
const encoder = new TextEncoder();

const signals =
  '{"sourceTrust":{"_tag":"Absent","reason":"not-assessed"},"sourceAssertedConfidence":{"_tag":"Absent","reason":"not-assessed"},"extractorConfidence":{"_tag":"Absent","reason":"not-applicable"},"validator":{"_tag":"Absent","reason":"not-assessed"},"reviewer":{"_tag":"Absent","reason":"not-assessed"}}';

const scripted =
  '{"_tag":"Scripted","runtime":"bun","command":["bun","install"],"controlVersion":"0.15.0","candidate":"latest","failureSignature":"@statelyai/model-testing"}';

const judgement = '{"_tag":"Judgement","question":"Is the ADR still right?","rubric":"Compare against main."}';

const claimLine = (options: { readonly id: string; readonly expiredAt: string; readonly falsifier: string }) =>
  `{"id":"${options.id}","logicalKey":"hold:statelyai-model-testing-404","proposition":{"_tag":"Hold","holdId":"statelyai-model-testing-404","kind":"exact-pin","subject":{"packages":["statelyai"],"anchors":[{"file":"package.json","key":"workspaces.catalog.statelyai"}]},"assertion":"statelyai 0.15.0 depends on an unpublished package.","falsifier":${options.falsifier},"watch":[],"exitAction":{"_tag":"Unpin"}},"supportedBy":["manual"],"challengedBy":[],"validTime":{"_tag":"Interval","validFrom":0,"validTo":1000},"knowledge":{"recordedAt":0,"expiredAt":${options.expiredAt}},"supersedes":null,"review":{"_tag":"Proposed"},"signals":${signals}}`;

const runLine = (id: string, holdVersionId: string, candidateVersion = "0.19.0") =>
  `{"schemaVersion":"hold-probe-run/v1","id":"${id}","holdId":"statelyai-model-testing-404","holdVersionId":"${holdVersionId}","ranAt":1,"commitSha":"${commitSha}","runtime":"bun","controlVersion":"0.15.0","control":{"_tag":"Reproduced"},"candidateVersion":"${candidateVersion}","candidate":{"_tag":"Passed"},"verdict":"candidate-passed"}`;

const currentClaim = claimLine({ id: "statelyai-model-testing-404@2", expiredAt: "null", falsifier: scripted });
const expiredClaim = claimLine({ id: "statelyai-model-testing-404@1", expiredAt: "500", falsifier: scripted });

const handle = (output: string, exitCode: number) =>
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

const outputFor = (command: ChildProcess.Command): string =>
  !ChildProcess.isStandardCommand(command)
    ? "80 packages installed\n"
    : command.command === "git"
      ? `${commitSha}\n`
      : Str.endsWith("/control")(command.options.cwd ?? "")
        ? "error: @statelyai/model-testing@0.2.0 failed to resolve\n"
        : "80 packages installed\n";

// git answers HEAD; the control directory reproduces the 404; the candidate installs cleanly.
const statelyaiSpawner = ChildProcessSpawner.make((command) => {
  const output = outputFor(command);
  return Effect.succeed(handle(output, Str.includes("failed to resolve")(output) ? 1 : 0));
});

// git exits 128 (not a repository); everything else would succeed.
const gitFailingSpawner = ChildProcessSpawner.make((command) =>
  Effect.succeed(
    ChildProcess.isStandardCommand(command) && command.command === "git"
      ? handle("fatal: not a git repository\n", 128)
      : handle("80 packages installed\n", 0)
  )
);

const failingSpawner = ChildProcessSpawner.make(() =>
  Effect.fail(
    PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn", description: "no bun" })
  )
);

const terminal = Terminal.make({
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  readInput: Effect.die("holds commands never prompt"),
  readLine: Effect.die("holds commands never prompt"),
  display: () => Effect.void,
});

const platformFor = (
  files: Readonly<Record<string, string>>,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]
) =>
  Layer.mergeAll(
    MemoryFileSystem.layer.pipe(
      Layer.tap((context) =>
        Effect.gen(function* () {
          const fs = Context.get(context, FileSystem.FileSystem);
          const path = yield* Path.Path;
          yield* fs.makeDirectory(scratchRoot, { recursive: true });
          yield* fs.makeDirectory(root, { recursive: true });
          yield* fs.writeFileString(path.join(root, "bun.lock"), "");
          yield* Effect.forEach(
            R.toEntries(files),
            ([name, content]) =>
              fs
                .makeDirectory(path.dirname(path.join(root, name)), { recursive: true })
                .pipe(Effect.andThen(fs.writeFileString(path.join(root, name), content))),
            { discard: true }
          );
        })
      ),
      Layer.provide(Path.layer)
    ),
    Path.layer,
    BunCrypto.layer,
    Stdio.layerTest({}),
    Layer.succeed(Terminal.Terminal, terminal),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)
  );

const layerFor = (
  files: Readonly<Record<string, string>>,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"] = statelyaiSpawner
) =>
  Layer.mergeAll(
    Layer.effect(HoldLedger, makeHoldLedger(root)),
    Layer.effect(HoldProbe, makeHoldProbe(scratchRoot))
  ).pipe(Layer.provideMerge(platformFor(files, spawner)));

const probeInput = (holdId: string, dryRun: boolean) => HoldsProbeInput.make({ holdId, dryRun, commitSha });

const lastLine = (lines: ReadonlyArray<string>): string => O.getOrElse(A.last(lines), () => "");

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output = A.empty<string>();
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(
          output,
          A.map(values, (value) => `${value}`)
        );
      },
    })
  );
  return A.join(output, "\n");
});

const runHolds = Command.runWith(holdsCommand, { version: "test" });

const ledgerFiles = { "hold-ledger/claims.jsonl": `${currentClaim}\n` };

layer(layerFor({}), { timeout: "30 seconds" })("an empty hold ledger", (it) => {
  it.effect("reports that there are no records", () =>
    Effect.map(runHoldsList, (lines) => expect(lines).toEqual(["[holds] no hold records yet."]))
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${expiredClaim}\n${currentClaim}\n`,
    "hold-ledger/runs.jsonl": A.join(
      [
        runLine("old", "statelyai-model-testing-404@1"),
        runLine("a", "statelyai-model-testing-404@2"),
        runLine("b", "statelyai-model-testing-404@2"),
      ],
      "\n"
    ),
  }),
  { timeout: "30 seconds" }
)("a ledger with an expired and a current version", (it) => {
  it.effect("confirms only the runs recorded against the current version", () =>
    Effect.map(runHoldsList, (lines) =>
      expect(lines).toEqual(["[holds] statelyai-model-testing-404 (exact-pin, statelyai): Flipped after 2 run(s)"])
    )
  );

  it.effect("prints the same report through `beep holds list`", () =>
    Effect.map(captureOutput(runHolds(["list"])), (output) =>
      expect(output).toBe("[holds] statelyai-model-testing-404 (exact-pin, statelyai): Flipped after 2 run(s)")
    )
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${currentClaim}\n`,
    "hold-ledger/runs.jsonl": `${runLine("a", "statelyai-model-testing-404@2")}\n{"truncated":`,
  }),
  { timeout: "30 seconds" }
)("a ledger with an undecodable run", (it) => {
  it.effect("fails instead of reading a short history", () =>
    Effect.map(Effect.flip(runHoldsList), (error) => expect(error.reason).toBe("decode"))
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${currentClaim}\n`,
    "hold-ledger/runs.jsonl": A.join(
      [
        runLine("a", "statelyai-model-testing-404@2", "0.19.0"),
        runLine("b", "statelyai-model-testing-404@2", "0.20.0"),
      ],
      "\n"
    ),
  }),
  { timeout: "30 seconds" }
)("two passes on different candidate releases", (it) => {
  it.effect("do not confirm a flip", () =>
    Effect.map(runHoldsList, (lines) =>
      expect(lines).toEqual(["[holds] statelyai-model-testing-404 (exact-pin, statelyai): Unconfirmed after 2 run(s)"])
    )
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${currentClaim}\n`,
    "hold-ledger/runs.jsonl": runLine("a", "statelyai-model-testing-404@2", "latest"),
  }),
  { timeout: "30 seconds" }
)("a runs file without a trailing newline", (it) => {
  it.effect("keeps both rows readable after an append", () =>
    Effect.gen(function* () {
      expect(lastLine(yield* runHoldsProbe(probeInput("statelyai-model-testing-404", false)))).toContain(
        "confirmed verdict: Flipped"
      );
      expect(yield* runHoldsList).toEqual([
        "[holds] statelyai-model-testing-404 (exact-pin, statelyai): Flipped after 2 run(s)",
      ]);
    })
  );
});

layer(layerFor(ledgerFiles), { timeout: "30 seconds" })("probing the statelyai hold", (it) => {
  it.effect("reports a dry run without recording it", () =>
    Effect.gen(function* () {
      const lines = yield* runHoldsProbe(probeInput("statelyai-model-testing-404", true));
      expect(lines).toEqual([
        "[holds] statelyai-model-testing-404",
        "  control   0.15.0: Reproduced",
        "  candidate latest: Passed",
        "  run verdict: candidate-passed",
        "[holds] dry run: nothing recorded.",
      ]);
      const fs = yield* FileSystem.FileSystem;
      expect(yield* fs.exists(`${root}/hold-ledger/runs.jsonl`)).toBe(false);
    })
  );

  it.effect("prints the dry run through `beep holds probe`", () =>
    Effect.map(captureOutput(runHolds(["probe", "statelyai-model-testing-404", "--dry-run"])), (output) =>
      expect(output).toContain("  run verdict: candidate-passed")
    )
  );

  it.effect("rejects an unknown or malformed hold id", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.flip(runHoldsProbe(probeInput("no-such-hold", true)));
      expect(missing.reason).toBe("not-found");
      const malformed = yield* Effect.flip(runHoldsProbe(probeInput("Not_Kebab", true)));
      expect(malformed.reason).toBe("usage");
    })
  );

  it.effect("records runs and flips only after two passes", () =>
    Effect.gen(function* () {
      expect(lastLine(yield* runHoldsProbe(probeInput("statelyai-model-testing-404", false)))).toContain(
        "confirmed verdict: Unconfirmed"
      );
      expect(lastLine(yield* runHoldsProbe(probeInput("statelyai-model-testing-404", false)))).toContain(
        "confirmed verdict: Flipped"
      );
      const ledger = yield* HoldLedger;
      const versions = yield* ledger.currentVersions;
      const runs = yield* Effect.forEach(versions, ledger.runsFor);
      expect(A.map(runs, A.length)).toEqual([2]);
    })
  );
});

layer(layerFor({}), { timeout: "30 seconds" })("the bare holds command", (it) => {
  it.effect("lists its subcommands", () =>
    Effect.map(captureOutput(runHolds([])), (output) => expect(output).toContain("beep holds probe <hold-id>"))
  );
});

layer(layerFor(ledgerFiles, gitFailingSpawner), { timeout: "30 seconds" })(
  "a checkout without a readable HEAD",
  (it) => {
    it.effect("fails the probe command with an io error", () =>
      Effect.map(Effect.flip(runHolds(["probe", "statelyai-model-testing-404", "--dry-run"])), (error) =>
        expect(error).toEqual(expect.objectContaining({ _tag: "HoldsError", reason: "io" }))
      )
    );
  }
);

layer(layerFor(ledgerFiles, failingSpawner), { timeout: "30 seconds" })("a probe command that cannot start", (it) => {
  it.effect("fails `beep holds probe` when git cannot run", () =>
    Effect.map(Effect.flip(runHolds(["probe", "statelyai-model-testing-404"])), (error) =>
      expect(error).toEqual(expect.objectContaining({ _tag: "HoldsError", reason: "io" }))
    )
  );

  it.effect("records an inconclusive run instead of a pass", () =>
    Effect.map(runHoldsProbe(probeInput("statelyai-model-testing-404", true)), (lines) =>
      expect(lines).toContain("  control   0.15.0: Inconclusive (the probe command could not run)")
    )
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${claimLine({ id: "statelyai-model-testing-404@2", expiredAt: "null", falsifier: judgement })}\n`,
  }),
  { timeout: "30 seconds" }
)("a Judgement hold", (it) => {
  it.effect("is refused by the scripted probe", () =>
    Effect.gen(function* () {
      const ledger = yield* HoldLedger;
      const probe = yield* HoldProbe;
      const versions = yield* ledger.currentVersions;
      const errors = yield* Effect.forEach(versions, (version) =>
        Effect.flip(
          probe.probe(HoldProbeRequest.make({ proposition: version.proposition, holdVersionId: version.id, commitSha }))
        )
      );
      expect(A.map(errors, (error) => error.reason)).toEqual(["usage"]);
    })
  );
});

describe("holdsPlatformError", () => {
  it("keeps the platform message after the context", () => {
    const error = holdsPlatformError("Could not read the ledger")(
      PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method: "readFile", description: "gone" })
    );
    expect(error.reason).toBe("io");
    expect(Str.startsWith("Could not read the ledger: ")(error.message)).toBe(true);
  });
});
