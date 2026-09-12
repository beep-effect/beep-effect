import {
  readTurboLaneDigest,
  TurboRunSummary,
  TurboSummaryTask,
  turboLaneDigestFromSummary,
} from "@beep/repo-cli/test/Quality";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const providePlatform = provideScopedLayer(NodeServices.layer);
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
      expect(forward.value.summaryId).toBe("run");
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
      expect(O.map(digest, (value) => value.summaryId)).toEqual(O.some("fresh"));
      expect(O.map(digest, (value) => value.tasks[0]?.hash)).toEqual(O.some("new"));

      const beforeAny = yield* readTurboLaneDigest(root, "2026-09-12T05:00:00.000Z", ["lint:allowlist"]);
      expect(beforeAny).toEqual(O.none());

      const noRuns = yield* readTurboLaneDigest(path.join(root, "elsewhere"), "2026-09-12T04:00:00.000Z", []);
      expect(noRuns).toEqual(O.none());
    }, providePlatform)
  );
});
