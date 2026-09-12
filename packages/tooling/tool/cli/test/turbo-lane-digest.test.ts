import {
  appendTurboLaneLedger,
  foldTurboLaneDigests,
  QualityTaskStep,
  readTurboLaneDigest,
  readTurboLaneLedger,
  recordTurboLaneLedgerRowForTesting,
  resolveLaneInputDigestForTesting,
  TURBO_LANE_LEDGER_ENV,
  TurboLaneDigest,
  TurboRunSummary,
  TurboSummaryTask,
  turboLaneDigestFromSummary,
} from "@beep/repo-cli/test/Quality";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const providePlatform = provideScopedLayer(NodeServices.layer);
type StreamingStepOutcome = Parameters<typeof resolveLaneInputDigestForTesting>[0];
const encodeSummary = S.encodeEffect(S.fromJsonString(TurboRunSummary));
const decodeSummary = S.decodeEffect(S.fromJsonString(TurboRunSummary));
const summaryEquivalent = S.toEquivalence(TurboRunSummary);

const task = (taskId: string, hash: string, status: "HIT" | "MISS", exitCode: number | null = 0) =>
  TurboSummaryTask.make({
    taskId,
    task: taskId.slice(taskId.indexOf("#") + 1),
    hash,
    cache: { status },
    ...(status === "HIT" ? {} : { execution: { exitCode } }),
  });

const summary = (id: string, startTime: number, tasks: ReadonlyArray<TurboSummaryTask>) =>
  TurboRunSummary.make({ id, execution: { startTime, endTime: startTime + 10, exitCode: 0 }, tasks });

describe("Turbo lane digests", () => {
  it("round-trips run summaries through JSON", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.schema(TurboRunSummary),
          (value) => {
            const encoded = Effect.runSync(encodeSummary(value));
            const decoded = Effect.runSync(decodeSummary(encoded));
            expect(summaryEquivalent(decoded, value)).toBe(true);
            expect(Effect.runSync(encodeSummary(decoded))).toBe(encoded);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed"));

  it("folds selected task hashes by bare name, independent of row order", () => {
    const rows = [
      task("//#lint:allowlist", "a1", "MISS"),
      task("@beep/schema#lint:laws", "b2", "HIT"),
      task("//#lint:typos", "c3", "MISS"),
    ];
    const forward = turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:allowlist", "lint:laws"]);
    const reversed = turboLaneDigestFromSummary(summary("run", 100, A.reverse(rows)), ["lint:laws", "lint:allowlist"]);
    expect(O.isSome(forward)).toBe(true);
    if (O.isSome(forward) && O.isSome(reversed)) {
      expect(forward.value.digest).toBe(reversed.value.digest);
      expect(A.map(forward.value.tasks, (row) => row.taskId)).toEqual(["//#lint:allowlist", "@beep/schema#lint:laws"]);
      expect(forward.value.summaryIds).toEqual(["run"]);
    }
    const everything = turboLaneDigestFromSummary(summary("run", 100, rows), []);
    expect(O.map(everything, (digest) => A.length(digest.tasks))).toEqual(O.some(3));
    expect(O.map(everything, (digest) => digest.digest)).not.toEqual(O.map(forward, (digest) => digest.digest));
  });

  it("refuses a digest when a selected task failed or none matched", () => {
    const rows = [task("//#lint:allowlist", "a1", "MISS", 1), task("//#lint:typos", "c3", "MISS")];
    expect(turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:allowlist", "lint:typos"])).toEqual(O.none());
    expect(turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:typos"])).not.toEqual(O.none());
    expect(turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:missing"])).toEqual(O.none());
  });

  it.effect(
    "reads only summaries the attempt wrote and skips unreadable files",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "turbo-lane-digest-" });
      const runs = path.join(root, ".turbo", "runs");
      yield* fs.makeDirectory(runs, { recursive: true });
      const startedAt = Date.parse("2026-09-12T04:00:00.000Z");
      const write = (name: string, value: TurboRunSummary) =>
        Effect.flatMap(encodeSummary(value), (text) => fs.writeFileString(path.join(runs, name), text));
      yield* write("stale.json", summary("stale", startedAt - 5_000, [task("//#lint:allowlist", "old", "MISS")]));
      yield* write("fresh.json", summary("fresh", startedAt + 1_000, [task("//#lint:allowlist", "new", "MISS")]));
      yield* write("newest-red.json", summary("red", startedAt + 2_000, [task("//#lint:allowlist", "bad", "MISS", 2)]));
      yield* fs.writeFileString(path.join(runs, "broken.json"), "{not json");

      const digest = yield* readTurboLaneDigest(root, "2026-09-12T04:00:00.000Z", ["lint:allowlist"]);
      expect(digest).toEqual(O.none());
      yield* fs.remove(path.join(runs, "newest-red.json"));
      const folded = yield* readTurboLaneDigest(root, "2026-09-12T04:00:00.000Z", ["lint:allowlist"]);
      expect(O.map(folded, (value) => value.summaryIds)).toEqual(O.some(["fresh"]));
      expect(O.map(folded, (value) => value.tasks[0]?.hash)).toEqual(O.some("new"));

      const beforeAny = yield* readTurboLaneDigest(root, "2026-09-12T05:00:00.000Z", ["lint:allowlist"]);
      expect(beforeAny).toEqual(O.none());
      const unparseable = yield* readTurboLaneDigest(root, "not-a-timestamp", ["lint:allowlist"]);
      expect(unparseable).toEqual(O.none());

      const noRuns = yield* readTurboLaneDigest(path.join(root, "elsewhere"), "2026-09-12T04:00:00.000Z", []);
      expect(noRuns).toEqual(O.none());

      yield* write(
        "second.json",
        summary("second", startedAt + 3_000, [
          task("//#lint:allowlist", "newer", "HIT"),
          task("//#lint:typos", "t1", "MISS"),
        ])
      );
      const every = yield* readTurboLaneDigest(root, "2026-09-12T04:00:00.000Z", []);
      expect(O.map(every, (value) => value.summaryIds)).toEqual(O.some(["fresh", "second"]));
      expect(O.map(every, (value) => A.map(value.tasks, (row) => `${row.taskId}=${row.hash}`))).toEqual(
        O.some(["//#lint:allowlist=newer", "//#lint:typos=t1"])
      );
    }, providePlatform)
  );

  it.effect(
    "folds declared digests newest-per-task and round-trips the wrapper lane ledger",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "turbo-lane-ledger-" });
      const ledger = path.join(root, "nested", "lane.jsonl");
      expect(yield* readTurboLaneLedger(ledger)).toEqual(O.none());
      expect(foldTurboLaneDigests([])).toEqual(O.none());

      const row = (taskId: string, hash: string, cacheStatus: "HIT" | "MISS") => ({ taskId, hash, cacheStatus });
      const first = TurboLaneDigest.make({
        digest: "a",
        summaryIds: ["run-1"],
        tasks: [row("//#lint:allowlist", "h1", "MISS")],
      });
      const second = TurboLaneDigest.make({
        digest: "b",
        summaryIds: ["run-2"],
        tasks: [row("//#lint:allowlist", "h2", "HIT"), row("//#lint:typos", "t1", "MISS")],
      });
      yield* appendTurboLaneLedger(ledger, first);
      yield* appendTurboLaneLedger(ledger, second);
      const folded = yield* readTurboLaneLedger(ledger);
      expect(O.map(folded, (value) => value.summaryIds)).toEqual(O.some(["run-1", "run-2"]));
      expect(O.map(folded, (value) => A.map(value.tasks, (task) => `${task.taskId}=${task.hash}`))).toEqual(
        O.some(["//#lint:allowlist=h2", "//#lint:typos=t1"])
      );
      expect(folded).toEqual(foldTurboLaneDigests([first, second]));

      yield* fs.writeFileString(ledger, "{not json\n", { flag: "a" });
      expect(Exit.isFailure(yield* Effect.exit(readTurboLaneLedger(ledger)))).toBe(true);
    }, providePlatform)
  );

  it.effect(
    "hands a wrapper lane its ledger and folds only what the child declared",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "turbo-lane-handoff-" });
      const runs = path.join(root, ".turbo", "runs");
      yield* fs.makeDirectory(runs, { recursive: true });
      const startedAtIso = "2026-09-12T04:00:00.000Z";
      const startedAt = Date.parse(startedAtIso);
      const write = (name: string, value: TurboRunSummary) =>
        Effect.flatMap(encodeSummary(value), (text) => fs.writeFileString(path.join(runs, name), text));
      // The child's own direct step shares `.turbo/runs` with a concurrent lane whose task failed.
      yield* write("own.json", summary("own", startedAt + 1_000, [task("//#lint:typos", "mine", "MISS")]));
      yield* write("other.json", summary("other", startedAt + 1_500, [task("//#lint:allowlist", "theirs", "MISS", 1)]));

      const ledger = path.join(root, "lane.jsonl");
      const outcome = (step: QualityTaskStep): StreamingStepOutcome => ({
        durationMs: 1,
        startedAt: startedAtIso,
        endedAt: "2026-09-12T04:00:05.000Z",
        failure: O.none(),
        step,
      });
      const child = QualityTaskStep.make({
        label: "ci:lint",
        command: "bunx",
        args: ["turbo", "run", "lint:typos", "--summarize"],
        cwd: root,
      });
      yield* recordTurboLaneLedgerRowForTesting(O.none(), outcome(child));
      expect(yield* fs.exists(ledger)).toBe(false);
      const unmatched = QualityTaskStep.make({
        label: "ci:lint",
        command: "bunx",
        args: ["turbo", "run", "lint:nothing-ran", "--summarize"],
        cwd: root,
      });
      yield* recordTurboLaneLedgerRowForTesting(O.some(ledger), outcome(unmatched));
      expect(yield* fs.exists(ledger)).toBe(false);
      yield* recordTurboLaneLedgerRowForTesting(O.some(ledger), outcome(child));
      const declared = yield* readTurboLaneLedger(ledger);
      expect(O.map(declared, (value) => A.map(value.tasks, (row) => `${row.taskId}=${row.hash}`))).toEqual(
        O.some(["//#lint:typos=mine"])
      );

      const wrapperArgs = ["run", "beep", "ci", "lane", "lint"];
      const wrapper = QualityTaskStep.make({
        label: "quality:lint",
        command: "bun",
        args: wrapperArgs,
        cwd: root,
        env: { [TURBO_LANE_LEDGER_ENV]: ledger },
      });
      const resolved = yield* resolveLaneInputDigestForTesting(outcome(wrapper), O.none());
      expect(resolved).toEqual(O.map(declared, (value) => value.digest));
      // The ledger is consumed once read; a wrapper without one reports no digest at all.
      expect(yield* fs.exists(ledger)).toBe(false);
      const bare = QualityTaskStep.make({ label: "quality:lint", command: "bun", args: wrapperArgs, cwd: root });
      expect(yield* resolveLaneInputDigestForTesting(outcome(bare), O.none())).toEqual(O.none());
      expect(yield* resolveLaneInputDigestForTesting(outcome(wrapper), O.some("declared"))).toEqual(O.some("declared"));
      // A direct step still selects only its own task rows from the shared runs directory.
      expect(yield* resolveLaneInputDigestForTesting(outcome(child), O.none())).toEqual(
        O.map(declared, (value) => value.digest)
      );
    }, providePlatform)
  );
});
