import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  HoldLedger,
  HoldProbe,
  HoldProbeRequest,
  HoldsError,
  HoldsProbeInput,
  HoldsUpdateInput,
  holdsCommand,
  holdsPlatformError,
  makeHoldLedger,
  makeHoldProbe,
  runHoldsList,
  runHoldsProbe,
  runHoldsUpdate,
  runHoldsWhy,
} from "@beep/repo-cli/commands/Holds";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
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
import * as TestClock from "effect/testing/TestClock";

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
  `{"id":"${options.id}","logicalKey":"hold:statelyai-model-testing-404","proposition":{"_tag":"Hold","holdId":"statelyai-model-testing-404","kind":"exact-pin","subject":{"packages":["statelyai"],"anchors":[{"_tag":"CatalogEntry","packageName":"statelyai"}]},"assertion":"statelyai 0.15.0 depends on an unpublished package.","falsifier":${options.falsifier},"watch":[],"exitAction":{"_tag":"Unpin"}},"supportedBy":["manual"],"challengedBy":[],"validTime":{"_tag":"Interval","validFrom":0,"validTo":1000},"knowledge":{"recordedAt":0,"expiredAt":${options.expiredAt}},"supersedes":null,"review":{"_tag":"Proposed"},"signals":${signals}}`;

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
  size: Effect.die("holds commands never prompt"),
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

// One encoded ledger row for a hold other than statelyai.
const holdLine = (options: {
  readonly holdId: string;
  readonly packageName: string;
  readonly anchors: string;
  readonly falsifier: string;
  readonly version?: number;
  readonly supersedes?: string;
  readonly review?: string;
  readonly exitAction?: string;
}) =>
  `{"id":"${options.holdId}@${options.version ?? 1}","logicalKey":"hold:${options.holdId}","proposition":{"_tag":"Hold","holdId":"${options.holdId}","kind":"override","subject":{"packages":["${options.packageName}"],"anchors":${options.anchors}},"assertion":"Held for a reason.","falsifier":${options.falsifier},"watch":[],"exitAction":${options.exitAction ?? '{"_tag":"Unpin"}'}},"supportedBy":["manual"],"challengedBy":[],"validTime":{"_tag":"Interval","validFrom":0,"validTo":1000},"knowledge":{"recordedAt":0,"expiredAt":null},"supersedes":${options.supersedes === undefined ? "null" : `"${options.supersedes}"`},"review":${options.review ?? '{"_tag":"Proposed"}'},"signals":${signals}}`;

const jsdomHold = holdLine({
  holdId: "jsdom-hold",
  packageName: "jsdom",
  anchors: '[{"_tag":"CatalogEntry","packageName":"jsdom"},{"_tag":"SyncpackHeld","dependency":"jsdom"}]',
  falsifier: judgement,
});
const globHold = holdLine({
  holdId: "glob-hold",
  packageName: "glob",
  anchors: '[{"_tag":"RootOverride","packageName":"glob"}]',
  falsifier: scripted,
});

// statelyai@2 and glob-hold@1 each passed twice on the candidate the fake probe installs; jsdom-hold has no runs.
// Neither flipped hold is due at time 0, but both are probed again before retirement.
const sweepLedger = {
  "hold-ledger/claims.jsonl": `${A.join([currentClaim, jsdomHold, globHold], "\n")}\n`,
  "hold-ledger/runs.jsonl": `${A.join(
    [
      runLine("s1", "statelyai-model-testing-404@2", "latest"),
      runLine("s2", "statelyai-model-testing-404@2", "latest"),
      runLine("g1", "glob-hold@1", "latest"),
      runLine("g2", "glob-hold@1", "latest"),
    ],
    "\n"
  )}\n`,
};

// An open-ended lease is always due.
const dueClaim = pipe(
  claimLine({ id: "statelyai-model-testing-404@2", expiredAt: "null", falsifier: scripted }),
  Str.replace('"validTo":1000', '"validTo":null')
);

const updateInput = (dryRun: boolean) => HoldsUpdateInput.make({ dryRun, commitSha });

layer(layerFor(sweepLedger), { timeout: "30 seconds" })("deps:update over flipped and held holds", (it) => {
  it.effect("plans without recording on a dry run", () =>
    Effect.gen(function* () {
      expect(yield* runHoldsUpdate(updateInput(true))).toEqual([
        "[holds] probed glob-hold: candidate-passed (candidate latest)",
        "[holds] probed statelyai-model-testing-404: candidate-passed (candidate latest)",
        "[holds] flipped glob-hold: its exit (Unpin) needs a reviewed change",
        "[holds] would unpin statelyai-model-testing-404: flipped; dropped from the held list for this catalog bump",
        "[holds] update planned (dry run): 2 probed, 1 unpinned.",
      ]);
      const ledger = yield* HoldLedger;
      expect(A.length(yield* ledger.allVersions)).toBe(3);
      const fs = yield* FileSystem.FileSystem;
      expect(yield* fs.exists(`${root}/hold-ledger/syncpack-held.generated.json`)).toBe(false);
      expect(Str.split(Str.trim(yield* fs.readFileString(`${root}/hold-ledger/runs.jsonl`)), "\n")).toHaveLength(4);
    })
  );

  it.effect("tombstones the flipped catalog hold, keeps the rest and regenerates the held list", () =>
    Effect.gen(function* () {
      expect(lastLine(yield* runHoldsUpdate(updateInput(false)))).toBe("[holds] update done: 2 probed, 1 unpinned.");
      const ledger = yield* HoldLedger;
      expect(A.map(yield* ledger.currentVersions, (version) => version.id)).toEqual(["glob-hold@1", "jsdom-hold@1"]);
      const all = yield* ledger.allVersions;
      expect(A.map(all, (version) => version.id)).toContain("statelyai-model-testing-404@3");
      const fs = yield* FileSystem.FileSystem;
      expect(yield* fs.readFileString(`${root}/hold-ledger/syncpack-held.generated.json`)).toBe('[\n  "jsdom"\n]\n');
      const why = yield* runHoldsWhy("statelyai");
      expect(why[0]).toBe(
        "[holds] statelyai-model-testing-404 (exact-pin, statelyai): tombstoned 1970-01-01: Flipped: the candidate passed twice, the newest run today; unpinned by deps:update."
      );
      expect(why).toContain("  evidence: manual; 2 version(s)");
    })
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${dueClaim}\n`,
  }),
  { timeout: "30 seconds" }
)("deps:update with a due scripted hold", (it) => {
  it.effect("probes it and records the run before deciding", () =>
    Effect.gen(function* () {
      const lines = yield* runHoldsUpdate(updateInput(false));
      expect(lines).toEqual([
        "[holds] probed statelyai-model-testing-404: candidate-passed (candidate latest)",
        "[holds] update done: 1 probed, 0 unpinned.",
      ]);
      const ledger = yield* HoldLedger;
      const [version] = yield* ledger.currentVersions;
      expect(A.length(yield* ledger.runsFor(version!))).toBe(1);
    })
  );
});

layer(
  layerFor(
    {
      "hold-ledger/claims.jsonl": `${dueClaim}\n`,
    },
    failingSpawner
  ),
  { timeout: "30 seconds" }
)("deps:update when a due probe cannot start", (it) => {
  it.effect("reports the probe and leaves the hold in place", () =>
    Effect.map(runHoldsUpdate(updateInput(false)), (lines) =>
      expect(lines).toEqual([
        "[holds] probed statelyai-model-testing-404: inconclusive (candidate latest)",
        "[holds] update done: 1 probed, 0 unpinned.",
      ])
    )
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${A.join(
      [
        jsdomHold,
        holdLine({
          holdId: "lexical-hold",
          packageName: "@lexical/**",
          anchors: '[{"_tag":"SyncpackHeld","dependency":"@lexical/**"}]',
          falsifier: judgement,
        }),
      ],
      "\n"
    )}\n`,
  }),
  { timeout: "30 seconds" }
)("explaining holds", (it) => {
  it.effect("matches a package through a group pattern and reports a live hold", () =>
    Effect.gen(function* () {
      const lexical = yield* runHoldsWhy("@lexical/react");
      expect(lexical[0]).toBe(
        "[holds] lexical-hold (override, @lexical/**): live, lease to 1970-01-01, confirmed Inconclusive"
      );
      expect(lexical).toContain("  probe: judgement: Is the ADR still right?");
      expect(lexical).toContain("  exit: Unpin; anchors: syncpack-held:@lexical/**");
      expect(yield* runHoldsWhy("left-pad")).toEqual(["[holds] no hold record governs left-pad."]);
    })
  );

  it.effect("prints through `beep holds why`", () =>
    Effect.map(captureOutput(runHolds(["why", "jsdom"])), (output) =>
      expect(output).toContain("[holds] jsdom-hold (override, jsdom): live")
    )
  );
});

layer(layerFor({ "hold-ledger/claims.jsonl": `${jsdomHold}\n` }), { timeout: "30 seconds" })(
  "deps:update with an expired hold",
  (it) => {
    it.effect("escalates a hold past its lease, then past 180 days", () =>
      Effect.gen(function* () {
        yield* TestClock.adjust("2 seconds");
        expect(yield* runHoldsUpdate(updateInput(true))).toContain(
          "[holds] escalate jsdom-hold: lease ended; exit Unpin, or renew with fresh evidence"
        );
        yield* TestClock.adjust("181 days");
        expect(yield* runHoldsUpdate(updateInput(true))).toContain(
          "[holds] escalate jsdom-hold: older than 180 days; exit Unpin, or renew with fresh evidence"
        );
      })
    );
  }
);

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${currentClaim}\n`,
    "hold-ledger/runs.jsonl": `${A.join([runLine("s1", "statelyai-model-testing-404@2"), runLine("s2", "statelyai-model-testing-404@2")], "\n")}\n`,
  }),
  { timeout: "30 seconds" }
)("deps:update after latest moved past the tested release", (it) => {
  it.effect("keeps the hold until the new release passes twice", () =>
    Effect.map(runHoldsUpdate(updateInput(true)), (lines) =>
      expect(lines).toEqual([
        "[holds] probed statelyai-model-testing-404: candidate-passed (candidate latest)",
        "[holds] update planned (dry run): 1 probed, 0 unpinned.",
      ])
    )
  );
});

const unwritableProbe = Layer.succeed(
  HoldProbe,
  HoldProbe.of({
    probe: Effect.fn("UnwritableProbe.probe")(function* () {
      return yield* HoldsError.make({ reason: "io", message: "scratch directory is not writable" });
    }),
  })
);

layer(
  Layer.mergeAll(Layer.effect(HoldLedger, makeHoldLedger(root)), unwritableProbe).pipe(
    Layer.provideMerge(
      platformFor(
        {
          "hold-ledger/claims.jsonl": `${currentClaim}\n`,
          "hold-ledger/runs.jsonl": `${A.join([runLine("s1", "statelyai-model-testing-404@2", "latest"), runLine("s2", "statelyai-model-testing-404@2", "latest")], "\n")}\n`,
        },
        statelyaiSpawner
      )
    )
  ),
  { timeout: "30 seconds" }
)("deps:update when a flipped hold cannot be probed again", (it) => {
  it.effect("keeps the hold whatever its earlier runs said", () =>
    Effect.gen(function* () {
      expect(yield* runHoldsUpdate(updateInput(false))).toEqual([
        "[holds] probe of statelyai-model-testing-404 did not run; the hold stays: scratch directory is not writable",
        "[holds] update done: 1 probed, 0 unpinned.",
      ]);
      const ledger = yield* HoldLedger;
      expect(A.map(yield* ledger.currentVersions, (version) => version.id)).toEqual(["statelyai-model-testing-404@2"]);
    })
  );
});

layer(
  layerFor({
    "hold-ledger/claims.jsonl": `${holdLine({
      holdId: "tstyche-hold",
      packageName: "tstyche",
      anchors:
        '[{"_tag":"ManifestDependency","manifest":"pkgs/drizzle/package.json","packageName":"tstyche"},{"_tag":"SyncpackHeld","dependency":"tstyche"}]',
      falsifier: scripted,
      exitAction: '{"_tag":"EscalateToGoal","slug":"tsrs-gates"}',
    })}\n`,
    "hold-ledger/runs.jsonl": `${A.join([runLine("t1", "tstyche-hold@1", "latest"), runLine("t2", "tstyche-hold@1", "latest")], "\n")}\n`,
  }),
  { timeout: "30 seconds" }
)("deps:update with a flipped hold pinned in a workspace manifest", (it) => {
  it.effect("reports it for a reviewed change instead of unpinning it", () =>
    Effect.gen(function* () {
      expect(yield* runHoldsUpdate(updateInput(true))).toContain(
        "[holds] flipped tstyche-hold: its exit (EscalateToGoal goals/tsrs-gates) needs a reviewed change"
      );
      expect(yield* runHoldsWhy("tstyche")).toContain(
        "  exit: EscalateToGoal goals/tsrs-gates; anchors: manifest:pkgs/drizzle/package.json#tstyche, syncpack-held:tstyche"
      );
    })
  );
});

layer(layerFor(sweepLedger), { timeout: "30 seconds" })("deps:update past the 180-day lifetime", (it) => {
  it.effect("escalates a flipped hold instead of retiring it", () =>
    Effect.gen(function* () {
      yield* TestClock.adjust("181 days");
      const lines = yield* runHoldsUpdate(updateInput(true));
      expect(lines).not.toContain(
        "[holds] would unpin statelyai-model-testing-404: flipped; dropped from the held list for this catalog bump"
      );
      expect(lines).toContain(
        "[holds] escalate statelyai-model-testing-404: older than 180 days; exit Unpin, or renew with fresh evidence"
      );
      expect(lastLine(lines)).toBe("[holds] update planned (dry run): 2 probed, 0 unpinned.");
    })
  );
});

layer(layerFor({ "hold-ledger/claims.jsonl": `${expiredClaim}\n` }), { timeout: "30 seconds" })(
  "explaining an expired hold",
  (it) => {
    it.effect("does not call it live", () =>
      Effect.map(runHoldsWhy("statelyai"), (lines) =>
        expect(lines[0]).toBe(
          "[holds] statelyai-model-testing-404 (exact-pin, statelyai): expired 1970-01-01, not live"
        )
      )
    );
  }
);

describe("holdsPlatformError", () => {
  it("keeps the platform message after the context", () => {
    const error = holdsPlatformError("Could not read the ledger")(
      PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method: "readFile", description: "gone" })
    );
    expect(error.reason).toBe("io");
    expect(Str.startsWith("Could not read the ledger: ")(error.message)).toBe(true);
  });
});
