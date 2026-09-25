import { CiLaneRunOptions, ciLaneStepsForTesting } from "@beep/repo-cli/commands/Ci";
import { QualityTaskFailed } from "@beep/repo-cli/commands/Quality";
import {
  appendTurboLaneLedger,
  closeTurboLaneLedger,
  foldTurboLaneDigests,
  QualityTaskStep,
  readTurboLaneDigest,
  readTurboLaneLedger,
  recordTurboLaneLedgerRowForTesting,
  resolveLaneInputDigestForTesting,
  TURBO_LANE_LEDGER_ENV,
  TurboLaneDigest,
  TurboLaneTaskHash,
  TurboRunSummary,
  TurboSummaryTask,
  turboLaneDigestFromSummary,
  turboLaneDigestPackages,
} from "@beep/repo-cli/test/Quality";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, Exit, FileSystem, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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

const labsLaneOptions = CiLaneRunOptions.make({
  affected: false,
  base: "origin/main",
  head: "HEAD",
  summarize: true,
  mode: "affected",
  to: "HEAD",
  last: false,
  changesetStatus: false,
  validateEnvelopes: false,
});

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

  it.effect(
    "folds selected task hashes by bare name, independent of row order",
    Effect.fnUntraced(function* () {
      const rows = [
        task("//#lint:allowlist", "a1", "MISS"),
        task("@beep/schema#lint:laws", "b2", "HIT"),
        task("//#lint:typos", "c3", "MISS"),
      ];
      const forward = yield* turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:allowlist", "lint:laws"]);
      const reversed = yield* turboLaneDigestFromSummary(summary("run", 100, A.reverse(rows)), [
        "lint:laws",
        "lint:allowlist",
      ]);
      expect(O.isSome(forward)).toBe(true);
      if (O.isSome(forward) && O.isSome(reversed)) {
        expect(forward.value.digest).toBe(reversed.value.digest);
        expect(A.map(forward.value.tasks, (row) => row.taskId)).toEqual([
          "//#lint:allowlist",
          "@beep/schema#lint:laws",
        ]);
        expect(forward.value.summaryIds).toEqual(["run"]);
      }
      const everything = yield* turboLaneDigestFromSummary(summary("run", 100, rows), []);
      expect(O.map(everything, (digest) => A.length(digest.tasks))).toEqual(O.some(3));
      expect(O.map(everything, (digest) => digest.digest)).not.toEqual(O.map(forward, (digest) => digest.digest));
    }, providePlatform)
  );

  it.effect(
    "refuses a digest when a selected task failed or none matched",
    Effect.fnUntraced(function* () {
      const rows = [task("//#lint:allowlist", "a1", "MISS", 1), task("//#lint:typos", "c3", "MISS")];
      expect(yield* turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:allowlist", "lint:typos"])).toEqual(
        O.none()
      );
      expect(yield* turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:typos"])).not.toEqual(O.none());
      expect(yield* turboLaneDigestFromSummary(summary("run", 100, rows), ["lint:missing"])).toEqual(O.none());
    }, providePlatform)
  );

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
    "does not read historical summaries when collecting a new lane digest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "turbo-lane-history-" });
      const runs = path.join(root, ".turbo", "runs");
      yield* fs.makeDirectory(runs, { recursive: true });
      const stalePath = path.join(runs, "stale.json");
      const freshPath = path.join(runs, "fresh.json");
      yield* fs.writeFileString(stalePath, "historical output must not be read");
      yield* fs.utimes(stalePath, 1, 1);
      yield* encodeSummary(summary("fresh", 1_789_185_601_000, [task("//#lint:allowlist", "new", "MISS")])).pipe(
        Effect.flatMap((text) => fs.writeFileString(freshPath, text))
      );
      // Include a same-second write even when the filesystem rounds its mtime.
      yield* fs.utimes(freshPath, 1_789_185_600, 1_789_185_600);
      const reads = yield* Ref.make(A.empty<string>());
      const digest = yield* readTurboLaneDigest(root, "2026-09-12T04:00:00.500Z", ["lint:allowlist"]).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (file, ...args) =>
            fs.readFileString(file, ...args).pipe(Effect.tap(() => Ref.update(reads, A.append(file)))),
        })
      );
      expect(yield* Ref.get(reads)).toEqual([freshPath]);
      expect(O.map(digest, (value) => value.summaryIds)).toEqual(O.some(["fresh"]));
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
      expect(yield* foldTurboLaneDigests([])).toEqual(O.none());

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
      // Unclosed ledgers read as none: the child may still be declaring, or it died mid-way.
      expect(yield* readTurboLaneLedger(ledger)).toEqual(O.none());
      yield* closeTurboLaneLedger(ledger, 2);
      const folded = yield* readTurboLaneLedger(ledger);
      expect(O.map(folded, (value) => value.summaryIds)).toEqual(O.some(["run-1", "run-2"]));
      expect(O.map(folded, (value) => A.map(value.tasks, (task) => `${task.taskId}=${task.hash}`))).toEqual(
        O.some(["//#lint:allowlist=h2", "//#lint:typos=t1"])
      );
      expect(folded).toEqual(yield* foldTurboLaneDigests([first, second]));
      // A close record naming more attempts than declarations marks a lost declaration.
      yield* closeTurboLaneLedger(ledger, 1);
      expect(yield* readTurboLaneLedger(ledger)).toEqual(O.none());

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

      const ledger = path.join(root, "lane-a", "ledger.jsonl");
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
      expect(yield* recordTurboLaneLedgerRowForTesting(O.none(), outcome(child))).toEqual(O.none());
      expect(yield* fs.exists(ledger)).toBe(false);
      const unmatched = QualityTaskStep.make({
        label: "ci:lint",
        command: "bunx",
        args: ["turbo", "run", "lint:nothing-ran", "--summarize"],
        cwd: root,
      });
      // An attempted declaration with no matching summary is reported, not silently skipped.
      expect(yield* recordTurboLaneLedgerRowForTesting(O.some(ledger), outcome(unmatched))).toEqual(O.some(false));
      expect(yield* fs.exists(ledger)).toBe(false);
      expect(yield* recordTurboLaneLedgerRowForTesting(O.some(ledger), outcome(child))).toEqual(O.some(true));
      // A digest that cannot be appended (the ledger directory is a file) is an attempt that did not land.
      const unwritable = path.join(runs, "own.json", "nested", "ledger.jsonl");
      assertSome(yield* recordTurboLaneLedgerRowForTesting(O.some(unwritable), outcome(child)), false);
      yield* closeTurboLaneLedger(ledger, 1);
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
      const declaredDigest = pipe(
        declared,
        O.map((value) => value.digest),
        O.getOrThrow
      );
      const resolved = yield* resolveLaneInputDigestForTesting(outcome(wrapper), O.none());
      assertSome(resolved.inputDigest, declaredDigest);
      // TTC ruling 68: a root-task-only lane folds `//#lint:typos`, which names no workspace.
      expect(resolved.inputPackages).toStrictEqual([]);
      // The ledger directory is consumed once read; a wrapper without one reports no digest at all.
      expect(yield* fs.exists(path.dirname(ledger))).toBe(false);
      const bare = QualityTaskStep.make({ label: "quality:lint", command: "bun", args: wrapperArgs, cwd: root });
      const bareResolved = yield* resolveLaneInputDigestForTesting(outcome(bare), O.none());
      assertNone(bareResolved.inputDigest);
      expect(bareResolved.inputPackages).toStrictEqual([]);
      // A declared digest is taken as given, so it carries no package scope of its own.
      const declaredResolved = yield* resolveLaneInputDigestForTesting(outcome(wrapper), O.some("declared"));
      assertSome(declaredResolved.inputDigest, "declared");
      expect(declaredResolved.inputPackages).toStrictEqual([]);
      // A direct step still selects only its own task rows from the shared runs directory.
      const directResolved = yield* resolveLaneInputDigestForTesting(outcome(child), O.none());
      assertSome(directResolved.inputDigest, declaredDigest);
      expect(directResolved.inputPackages).toStrictEqual([]);
    }, providePlatform)
  );

  // TTC ruling 68 (C5): a lane run carries the workspace packages of the Turbo tasks its
  // digest folds, by both the wrapper-ledger path and the direct `turbo run --summarize`
  // path, with root tasks contributing nothing. The proof ledger's changed-package
  // tripwire intersects that scope with the attempt's changed packages.
  it.effect(
    "resolves a lane's package scope from its folded Turbo task ids by both digest paths",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "turbo-lane-scope-" });
      const runs = path.join(root, ".turbo", "runs");
      yield* fs.makeDirectory(runs, { recursive: true });
      const startedAtIso = "2026-09-24T04:00:00.000Z";
      const startedAt = Date.parse(startedAtIso);
      yield* Effect.flatMap(
        encodeSummary(
          summary("scope", startedAt + 1_000, [
            task("@beep/x#check", "hx1", "HIT"),
            task("@beep/x#test", "hx2", "MISS"),
            task("@beep/y#check", "hy1", "MISS"),
            task("//#lint:policy", "hr1", "HIT"),
          ])
        ),
        (text) => fs.writeFileString(path.join(runs, "scope.json"), text)
      );
      const outcome = (step: QualityTaskStep): StreamingStepOutcome => ({
        durationMs: 1,
        startedAt: startedAtIso,
        endedAt: "2026-09-24T04:00:05.000Z",
        failure: O.none(),
        step,
      });
      const child = QualityTaskStep.make({
        label: "ci:check",
        command: "bunx",
        args: ["turbo", "run", "check", "test", "lint:policy", "--summarize"],
        cwd: root,
      });

      // The direct path reads its own summaries and carries the same scope.
      const direct = yield* resolveLaneInputDigestForTesting(outcome(child), O.none());
      assertSome(O.map(direct.inputDigest, Str.isNonEmpty), true);
      expect(direct.inputPackages).toStrictEqual(["@beep/x", "@beep/y"]);

      // The wrapper path reads the same digest back out of the lane ledger its child wrote.
      const ledger = path.join(root, "lane-scope", "ledger.jsonl");
      assertSome(yield* recordTurboLaneLedgerRowForTesting(O.some(ledger), outcome(child)), true);
      yield* closeTurboLaneLedger(ledger, 1);
      const wrapper = QualityTaskStep.make({
        label: "quality:check",
        command: "bun",
        args: ["run", "beep", "ci", "lane", "check"],
        cwd: root,
        env: { [TURBO_LANE_LEDGER_ENV]: ledger },
      });
      const wrapped = yield* resolveLaneInputDigestForTesting(outcome(wrapper), O.none());
      expect(wrapped.inputDigest).toEqual(direct.inputDigest);
      expect(wrapped.inputPackages).toStrictEqual(["@beep/x", "@beep/y"]);

      // The scope is derived from the digest's own rows, so it reads the same off the digest.
      const folded = yield* readTurboLaneDigest(root, startedAtIso, ["check", "test", "lint:policy"]);
      assertSome(O.map(folded, turboLaneDigestPackages), ["@beep/x", "@beep/y"]);

      // Review round 1: the root node spells itself `//`, which is not a workspace, so a
      // digest folding only root tasks names no package at all.
      expect(
        turboLaneDigestPackages(
          TurboLaneDigest.make({
            digest: "root-only",
            summaryIds: ["run"],
            tasks: [
              TurboLaneTaskHash.make({ taskId: "//#lint:policy", hash: "h1", cacheStatus: "HIT" }),
              TurboLaneTaskHash.make({ taskId: "//#lint:typos", hash: "h2", cacheStatus: "MISS" }),
            ],
          })
        )
      ).toStrictEqual([]);

      // Review round 1, kriegcloud P2: a failed step short-circuits before any Turbo
      // digest is read, so it resolves neither a digest nor a scope.
      const failed = yield* resolveLaneInputDigestForTesting(
        {
          ...outcome(child),
          failure: O.some(QualityTaskFailed.make({ label: "ci:check", command: "bunx turbo run check", exitCode: 1 })),
        },
        O.none()
      );
      assertNone(failed.inputDigest);
      expect(failed.inputPackages).toStrictEqual([]);
    }, providePlatform)
  );

  // TTC ruling 58: the labs lane digest folds every check/lint/test task hash its own summary ran,
  // which the labs filter makes exactly the lab tasks today. Upstream build/transit work reaches it
  // only through Turbo's dependency hashing, and a run with zero labs declares nothing, so the lane
  // stays green but non-reusable.
  it.effect(
    "folds the labs lane digest from lab task rows and leaves zero labs undeclared",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const startedAtIso = "2026-09-16T14:00:00.000Z";
      // One fixture clock for the summary's start time and its file mtime, so the fresh-summary
      // filter never depends on the host's wall clock being later than the fixed start.
      const writtenAtMillis = Date.parse(startedAtIso) + 1_000;
      const labsRun = Effect.fnUntraced(function* (prefix: string, tasks: ReadonlyArray<TurboSummaryTask>) {
        const root = yield* fs.makeTempDirectoryScoped({ prefix });
        const runs = path.join(root, ".turbo", "runs");
        const summaryPath = path.join(runs, "labs.json");
        yield* fs.makeDirectory(runs, { recursive: true });
        yield* encodeSummary(summary("labs", writtenAtMillis, tasks)).pipe(
          Effect.flatMap((text) => fs.writeFileString(summaryPath, text))
        );
        // `utimes` takes epoch seconds, as in the historical-summary case above.
        yield* fs.utimes(summaryPath, writtenAtMillis / 1_000, writtenAtMillis / 1_000);
        const step = pipe(ciLaneStepsForTesting(root, "labs", labsLaneOptions), A.head, O.getOrThrow);
        const ledger = path.join(root, "lane-labs", "ledger.jsonl");
        const declared = yield* recordTurboLaneLedgerRowForTesting(O.some(ledger), {
          durationMs: 1,
          startedAt: startedAtIso,
          endedAt: "2026-09-16T14:05:00.000Z",
          failure: O.none(),
          step,
        });
        yield* closeTurboLaneLedger(ledger, 1);
        return { declared, digest: yield* readTurboLaneLedger(ledger) };
      });
      // Lab names in lexical order, so the rows are already in the digest's task-id order.
      const labRows = A.flatMap(["api-docs", "ciops", "semantica"], (lab) =>
        A.map(["check", "lint", "test"], (name) => task(`@beep/${lab}#${name}`, `${lab}:${name}`, "MISS"))
      );
      const upstream = [
        task("@beep/schema#build", "schema:build", "HIT"),
        task("@beep/schema#transit", "schema:transit", "MISS"),
      ];

      const populated = yield* labsRun("turbo-lane-labs-", [...upstream, ...labRows]);
      assertSome(populated.declared, true);
      assertSome(
        O.map(populated.digest, (value) => A.map(value.tasks, (row) => row.taskId)),
        A.map(labRows, (row) => row.taskId)
      );

      // The fold keys on what the invocation ran, not on package identity: a foreign check task the
      // filter pulled in would gate the lane, so its hash must key the digest rather than be dropped.
      const foreignCheck = task("@beep/schema#check", "schema:check", "MISS");
      const widened = yield* labsRun("turbo-lane-labs-widened-", [...upstream, foreignCheck, ...labRows]);
      assertSome(
        O.map(widened.digest, (value) => A.map(value.tasks, (row) => row.taskId)),
        pipe(
          [...labRows, foreignCheck],
          A.map((row) => row.taskId),
          A.sort(Str.Order)
        )
      );

      const zero = yield* labsRun("turbo-lane-zero-labs-", []);
      assertSome(zero.declared, false);
      assertNone(zero.digest);
    }, providePlatform)
  );
});
