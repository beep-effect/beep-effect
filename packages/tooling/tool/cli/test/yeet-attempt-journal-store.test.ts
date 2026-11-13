import {
  CLAUDE_WORKTREES_RELATIVE_ROOT,
  renderWorktreeRemovalReceipt,
  WorktreeMergedPullRequestProbe,
  WorktreePreservationError,
  WorktreeRemovalReceipt,
  WorktreeRemovalRequest,
  WorktreeRemovalService,
  WorktreeRemovalServiceLayer,
} from "@beep/repo-cli/commands/Worktree";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import {
  layerResidueTerminalLaneProbeTest,
  ResidueTerminalLaneAuthority,
  ResidueTerminalLaneProbe,
  runResidueReap,
} from "@beep/repo-cli/test/Worktree";
import {
  AttemptJournalExported,
  AttemptJournalExportUnpartitioned,
  AttemptJournalStore,
  AttemptJournalStoreError,
  attemptJournalStoreRunsDirectory,
  buildYeetEconomicsReport,
  EconomicsScope,
  EconomicsScopeRequest,
  PrRepository,
  renderAttemptJournalExport,
  renderRetirement,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetAttemptTerminated,
  YeetEconomicsSource,
  YeetRetirePlan,
} from "@beep/repo-cli/test/Yeet";
import { describe, it } from "@effect/vitest";
import {
  assertInclude,
  assertInstanceOf,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";
import { git } from "./support/YeetHeadMove.ts";
import type { EconomicsJournal } from "@beep/repo-cli/test/Yeet";

// PERIL-11 slice 1: a removal, or a residue-reap directory removal, files the
// Yeet attempt journals it would delete in the workstation store first, and
// `yeet economics --fleet` counts each (runId, attemptId) once across live lanes
// and the store.

const ORIGIN_URL = "https://github.com/beep-effect/attempt-journal-fixture.git";
const REPOSITORY = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "attempt-journal-fixture" });
const RUN_ID = "feat-lane-0123456789ab";
const OTHER_RUN_ID = "feat-other-0123456789ab";

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));

const attemptId = (suffix: string): UUID => UUID.make(`7c9f5b1e-2d4a-4f6b-9a8c-${Str.padStart(12, "0")(suffix)}`);

const started = (id: UUID, runId: string): YeetAttemptStarted =>
  YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId: id,
    runId,
    branch: "feat/lane",
    base: "origin/main",
    head: "HEAD",
    mode: "verify",
    startedAt: "2026-11-13T00:00:00.000Z",
  });

const terminated = (id: UUID): YeetAttemptTerminated =>
  YeetAttemptTerminated.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-terminated",
    attemptId: id,
    recordedAt: "2026-11-13T00:05:00.000Z",
    reason: "interrupted",
  });

const attempt = (id: UUID, runId = RUN_ID): ReadonlyArray<YeetAttemptJournalEvent> => [
  started(id, runId),
  terminated(id),
];

// Appends, so a lane's journal can grow between retirements.
const appendJournal = Effect.fnUntraced(function* (
  checkout: string,
  runId: string,
  events: ReadonlyArray<YeetAttemptJournalEvent>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(checkout, ".beep", "yeet", "runs", runId);
  yield* fs.makeDirectory(directory, { recursive: true });
  const lines = yield* Effect.forEach(events, (event) => encodeEvent(event));
  yield* fs.writeFileString(path.join(directory, "attempts.ndjson"), `${A.join(lines, "\n")}\n`, { flag: "a" });
});

const withHome = (home: string) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { HOME: home } }));

type Fixture = {
  readonly home: string;
  readonly clone: string;
};

// A clone named like a fleet checkout, so its nested lanes are fleet candidates.
// Its origin names a GitHub repository (the store's partition key) while git
// itself is sent to a local bare repository; `.beep/` is ignored, as in the repo.
const scratchClone = Effect.fnUntraced(function* (originUrl: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "attempt-journal-store-" });
  const origin = path.join(home, "origin.git");
  const clone = path.join(home, "beep-effect");
  yield* fs.makeDirectory(origin);
  yield* fs.makeDirectory(clone);
  yield* git(origin, ["init", "--bare", "-b", "main"]);
  yield* git(clone, ["init", "-b", "main"]);
  yield* git(clone, ["config", "user.email", "attempt-journal-store@example.invalid"]);
  yield* git(clone, ["config", "user.name", "Attempt Journal Store Test"]);
  yield* git(clone, ["config", "commit.gpgsign", "false"]);
  yield* fs.writeFileString(path.join(clone, ".gitignore"), ".beep/\n");
  yield* git(clone, ["add", ".gitignore"]);
  yield* git(clone, ["commit", "-m", "init"]);
  const url = O.getOrElse(originUrl, () => origin);
  yield* git(clone, ["remote", "add", "origin", url]);
  yield* git(clone, ["config", `url.${origin}.insteadOf`, url]);
  yield* git(clone, ["push", "--set-upstream", "origin", "main"]);
  return { home, clone } satisfies Fixture;
});

const lanePath = Effect.fnUntraced(function* (clone: string) {
  const path = yield* Path.Path;
  return path.join(clone, CLAUDE_WORKTREES_RELATIVE_ROOT, "lane");
});

const addLane = Effect.fnUntraced(function* (clone: string, start = "main") {
  const lane = yield* lanePath(clone);
  yield* git(clone, ["worktree", "add", "-b", "feat/lane", lane, start]);
  return lane;
});

const remove = Effect.fnUntraced(function* (clone: string, archive: boolean) {
  const service = yield* WorktreeRemovalService;
  const lane = yield* lanePath(clone);
  return yield* service.remove(
    WorktreeRemovalRequest.make({
      name: "lane",
      targetPath: lane,
      mainCheckout: clone,
      branch: O.some("feat/lane"),
      archive,
      deleteBranch: archive,
      expectedHead: O.none(),
    })
  );
});

const fleetCensus = Effect.fnUntraced(function* (clone: string) {
  const source = yield* YeetEconomicsSource;
  return yield* source.read(EconomicsScopeRequest.make({ repoRoot: clone, branch: O.none(), fleet: true }));
});

const attemptKeys = (journals: ReadonlyArray<EconomicsJournal>): ReadonlyArray<string> =>
  A.sort(
    A.flatMap(journals, (journal) => A.map(journal.attempts, (entry) => `${entry.runId}/${entry.attemptId}`)),
    Order.String
  );

const keysOf = (runId: string, ...ids: ReadonlyArray<UUID>): ReadonlyArray<string> =>
  A.map(ids, (id) => `${runId}/${id}`);

const REPORT_SCOPE = EconomicsScope.make({ kind: "fleet", checkouts: [], branch: O.none() });

// The report's attempt classes (MEAS-03): retained rows fold through the same
// attempt path as live rows, so an interrupted attempt is terminated, never red.
const classMixOf = (journals: ReadonlyArray<EconomicsJournal>): ReadonlyArray<readonly [string, number]> =>
  A.map(
    buildYeetEconomicsReport(journals, REPORT_SCOPE, DateTime.makeUnsafe(0), []).attempts.all.classMix,
    (row) => [row.key, row.count] as const
  );

const duplicatesOf = (journals: ReadonlyArray<EconomicsJournal>) => ({
  starts: A.reduce(journals, 0, (total, journal) => total + journal.diagnostics.duplicateStartedRowsDeduplicated),
  terminals: A.reduce(journals, 0, (total, journal) => total + journal.diagnostics.duplicateFinishedRowsDeduplicated),
});

const storedJournal = Effect.fnUntraced(function* (runId: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
  return yield* fs.readFileString(path.join(runs, runId, "attempts.ndjson"));
});

const storeRootOf = Effect.fnUntraced(function* (home: string) {
  const path = yield* Path.Path;
  return path.join(home, ".local", "state", "beep", "yeet", "attempts");
});

// A file where the store's directory belongs: every export to it fails.
const plantCopyFailure = Effect.fnUntraced(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const storeRoot = yield* storeRootOf(home);
  yield* fs.makeDirectory(path.dirname(storeRoot), { recursive: true });
  yield* fs.writeFileString(storeRoot, "not a directory\n");
  return storeRoot;
});

// The reaper ages entries against an instant thirty days after a fixture file was
// written, past its seven-day live-write fence (the test clock stands at the epoch).
const reapInstantAfter = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(file);
  return O.getOrElse(O.map(info.mtime, DateTime.makeUnsafe), () => DateTime.makeUnsafe(0)).pipe(
    DateTime.add({ days: 30 }),
    DateTime.toEpochMillis
  );
});
const noLiveCwd = () => Effect.succeedSome(false);
const noLivePid = () => Effect.succeedSome(false);

const noMergedPullRequest = Layer.succeed(
  WorktreeMergedPullRequestProbe,
  WorktreeMergedPullRequestProbe.of({
    mergedAtHead: Effect.fn("WorktreeMergedPullRequestProbe.mergedAtHead")(() => Effect.succeedNone),
  })
);

const TestLayer = Layer.provideMerge(
  Layer.mergeAll(
    WorktreeRemovalServiceLayer.pipe(Layer.provide(Layer.mergeAll(noMergedPullRequest, AttemptJournalStore.layer))),
    AttemptJournalStore.layer,
    YeetEconomicsSource.layer,
    layerResidueTerminalLaneProbeTest(() => Effect.succeedNone),
    TestConsole.layer
  ),
  NodeCommandTestLayer
);

describe("attempt journal store", () => {
  it.layer(TestLayer, { timeout: "180 seconds" })("retire fixture", (it) => {
    it.effect(
      "retire, copy failure, restore, duplicate import and residue reap count each (runId, attemptId) once",
      Effect.fnUntraced(function* () {
        const fixture = yield* scratchClone(O.some(ORIGIN_URL));
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const a1 = attemptId("1");
          const a2 = attemptId("2");
          const a3 = attemptId("3");
          const lane = yield* addLane(fixture.clone);
          yield* appendJournal(lane, RUN_ID, [...attempt(a1), ...attempt(a2)]);
          // `.beep/notes` is retained material, so the retirement leaves a residue archive.
          yield* fs.makeDirectory(path.join(lane, ".beep", "notes"), { recursive: true });
          yield* fs.writeFileString(path.join(lane, ".beep", "notes", "keep.md"), "kept\n");
          const live = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(live), keysOf(RUN_ID, a1, a2));

          // Copy failure: a file where the store's directory belongs. The removal refuses
          // before any capture, and the lane, its journal and its branch stay where they were.
          const storeRoot = yield* plantCopyFailure(fixture.home);
          const refused = yield* remove(fixture.clone, true).pipe(Effect.flip);
          assertInstanceOf(refused, WorktreePreservationError);
          deepStrictEqual(refused.step, "export-attempt-journals");
          const laneKept = yield* fs.exists(path.join(lane, ".beep", "yeet", "runs", RUN_ID, "attempts.ndjson"));
          assertTrue(laneKept);
          const materialKept = yield* fs.exists(path.join(lane, ".beep", "notes", "keep.md"));
          assertTrue(materialKept);
          const branch = yield* git(fixture.clone, ["rev-parse", "--verify", "refs/heads/feat/lane"]);
          assertTrue(Str.isNonEmpty(branch));
          const afterRefusal = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(afterRefusal), keysOf(RUN_ID, a1, a2));

          // Retire: the journal is filed in the store, then the checkout is deleted.
          yield* fs.remove(storeRoot);
          const retired = yield* remove(fixture.clone, true);
          const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
          assertSome(
            retired.attemptJournals,
            AttemptJournalExported.make({ runsDirectory: runs, journals: 1, appendedRows: 4, retainedRows: 0 })
          );
          const laneGone = yield* fs.exists(lane);
          assertTrue(!laneGone);
          const archived = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(archived), keysOf(RUN_ID, a1, a2));
          deepStrictEqual(A.dedupe(A.map(archived, (journal) => journal.checkout)), ["(retained)"]);

          // Restore the archived lane, its old journal rows copied back, and run one more
          // attempt: live rows win and the retained copies count as duplicates only.
          const manifest = O.getOrThrow(retired.manifest);
          yield* addLane(fixture.clone, manifest.archiveRef);
          yield* appendJournal(lane, RUN_ID, [...attempt(a1), ...attempt(a2), ...attempt(a3)]);
          const restored = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(restored), keysOf(RUN_ID, a1, a2, a3));
          deepStrictEqual(duplicatesOf(restored), { starts: 2, terminals: 2 });
          deepStrictEqual(classMixOf(restored), [["terminated", 3]]);

          // Duplicate import: retiring the restored lane appends only the new attempt's rows.
          const again = yield* remove(fixture.clone, true);
          assertSome(
            again.attemptJournals,
            AttemptJournalExported.make({ runsDirectory: runs, journals: 1, appendedRows: 2, retainedRows: 4 })
          );
          const stored = yield* storedJournal(RUN_ID);
          deepStrictEqual(A.length(A.filter(Str.split(stored, "\n"), Str.isNonEmpty)), 6);
          const reimported = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(reimported), keysOf(RUN_ID, a1, a2, a3));

          // The residue reaper at maxAgeDays=0 never reaches the store.
          const reap = yield* runResidueReap({
            apply: true,
            homeRoot: fixture.home,
            maxAgeDays: 0,
            probeLiveCwd: noLiveCwd,
            repoRoot: fixture.clone,
          });
          assertTrue(reap.applied);
          const reaped = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(reaped), keysOf(RUN_ID, a1, a2, a3));
          deepStrictEqual(duplicatesOf(reaped), { starts: 0, terminals: 0 });
          // Every attempt is now read from the store only, still terminated and counted once.
          deepStrictEqual(A.dedupe(A.map(reaped, (journal) => journal.checkout)), ["(retained)"]);
          deepStrictEqual(classMixOf(reaped), [["terminated", 3]]);
        }).pipe(withHome(fixture.home));
      })
    );

    it.effect(
      "residue-reap before the retirement archives only the lane's yeet jobs, so the journals are filed once",
      Effect.fnUntraced(function* () {
        const fixture = yield* scratchClone(O.some(ORIGIN_URL));
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const a6 = attemptId("6");
          const lane = yield* addLane(fixture.clone);
          yield* appendJournal(lane, RUN_ID, attempt(a6));
          const journal = path.join(lane, ".beep", "yeet", "runs", RUN_ID, "attempts.ndjson");
          const job = path.join(lane, ".beep", "yeet", "jobs", "7c1aa8c8-e336-4970-9e98-ec7898ff6fa2.json");
          yield* fs.makeDirectory(path.dirname(job), { recursive: true });
          yield* fs.writeFileString(job, "{}\n");
          const head = yield* git(lane, ["rev-parse", "HEAD"]);
          const authority = ResidueTerminalLaneAuthority.make({
            checkoutRoot: yield* fs.realPath(lane),
            commonDir: yield* git(lane, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
            branch: "feat/lane",
            pullRequest: 1,
            pullRequestHead: head,
            head,
            headRelation: "equal",
            verifiedAt: DateTime.makeUnsafe(0),
          });
          // A merged lane's checkout residue is the janitor's to archive, but the `yeet`
          // entry contributes only `.beep/yeet/jobs/*`: its runs are never a candidate.
          const reap = yield* runResidueReap({
            apply: true,
            classes: ["checkout-jobs"],
            homeRoot: fixture.home,
            maxAgeDays: 0,
            nowMillis: yield* reapInstantAfter(job),
            probeLiveCwd: noLiveCwd,
            probePidAlive: noLivePid,
            repoRoot: lane,
          }).pipe(
            Effect.provideService(
              ResidueTerminalLaneProbe,
              ResidueTerminalLaneProbe.of({
                verify: Effect.fn("ResidueTerminalLaneProbe.verify")(() => Effect.succeedSome(authority)),
              })
            )
          );
          deepStrictEqual(reap.reapedCount, 1);
          deepStrictEqual(
            A.map(reap.candidates, (candidate) => path.basename(candidate.path)),
            [path.basename(job)]
          );
          const jobArchived = yield* fs.exists(job);
          assertTrue(!jobArchived);
          const journalKept = yield* fs.exists(journal);
          assertTrue(journalKept);
          const reaped = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(reaped), keysOf(RUN_ID, a6));

          const retired = yield* remove(fixture.clone, true);
          const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
          assertSome(
            retired.attemptJournals,
            AttemptJournalExported.make({ runsDirectory: runs, journals: 1, appendedRows: 2, retainedRows: 0 })
          );
          const census = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(census), keysOf(RUN_ID, a6));
          deepStrictEqual(duplicatesOf(census), { starts: 0, terminals: 0 });
        }).pipe(withHome(fixture.home));
      })
    );

    it.effect(
      "a residue-reap directory removal files embedded checkouts' journals first and keeps the directory when it cannot",
      Effect.fnUntraced(function* () {
        const fixture = yield* scratchClone(O.some(ORIGIN_URL));
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const a7 = attemptId("7");
          // A Codex worktree: a linked worktree of the clone, one level inside the container.
          const container = path.join(fixture.home, ".codex", "worktrees", "abcd");
          const codexLane = path.join(container, "beep-effect");
          yield* fs.makeDirectory(container, { recursive: true });
          yield* git(fixture.clone, ["worktree", "add", "-b", "feat/codex", codexLane]);
          yield* appendJournal(codexLane, OTHER_RUN_ID, attempt(a7, OTHER_RUN_ID));
          const journal = path.join(codexLane, ".beep", "yeet", "runs", OTHER_RUN_ID, "attempts.ndjson");
          const reapCodex = Effect.flatMap(reapInstantAfter(journal), (nowMillis) =>
            runResidueReap({
              apply: true,
              classes: ["codex-worktrees"],
              homeRoot: fixture.home,
              maxAgeDays: 0,
              nowMillis,
              probeLiveCwd: noLiveCwd,
              repoRoot: fixture.clone,
            })
          );

          const storeRoot = yield* plantCopyFailure(fixture.home);
          const kept = yield* reapCodex;
          deepStrictEqual(kept.reapedCount, 0);
          deepStrictEqual(
            A.map(kept.candidates, (candidate) => candidate.skipReason),
            ["journal-export-failed"]
          );
          assertTrue(A.some(kept.warnings, Str.includes("left in place")));
          const containerKept = yield* fs.exists(path.join(codexLane, ".beep", "yeet", "runs", OTHER_RUN_ID));
          assertTrue(containerKept);

          yield* fs.remove(storeRoot);
          const reaped = yield* reapCodex;
          deepStrictEqual(reaped.reapedCount, 1);
          const containerGone = yield* fs.exists(container);
          assertTrue(!containerGone);
          const census = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(census), keysOf(OTHER_RUN_ID, a7));
        }).pipe(withHome(fixture.home));
      })
    );

    it.effect(
      "a plain removal files the journals before git removes the checkout",
      Effect.fnUntraced(function* () {
        const fixture = yield* scratchClone(O.some(ORIGIN_URL));
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const lane = yield* addLane(fixture.clone);
          const a4 = attemptId("4");
          yield* appendJournal(lane, OTHER_RUN_ID, attempt(a4, OTHER_RUN_ID));
          const removed = yield* remove(fixture.clone, false);
          const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
          assertSome(
            removed.attemptJournals,
            AttemptJournalExported.make({ runsDirectory: runs, journals: 1, appendedRows: 2, retainedRows: 0 })
          );
          const laneGone = yield* fs.exists(lane);
          assertTrue(!laneGone);
          const census = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(census), keysOf(OTHER_RUN_ID, a4));
        }).pipe(withHome(fixture.home));
      })
    );

    it.effect(
      "a clone whose origin names no GitHub repository keeps its journals unpartitioned",
      Effect.fnUntraced(function* () {
        const fixture = yield* scratchClone(O.none());
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const lane = yield* addLane(fixture.clone);
          yield* appendJournal(lane, RUN_ID, attempt(attemptId("5")));
          const retired = yield* remove(fixture.clone, true);
          assertSome(retired.attemptJournals, AttemptJournalExportUnpartitioned.make({ journals: 1 }));
          const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
          const storeCreated = yield* fs.exists(runs);
          assertTrue(!storeCreated);
          const census = yield* fleetCensus(fixture.clone);
          deepStrictEqual(attemptKeys(census), []);
        }).pipe(withHome(fixture.home));
      })
    );
  });

  it.layer(TestLayer, { timeout: "60 seconds" })("store", (it) => {
    // A checkout without git: the store reads `<clone>/.git/config` for the origin only.
    const checkoutWithOrigin = Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "attempt-journal-store-unit-" });
      const clone = path.join(home, "clone");
      yield* fs.makeDirectory(path.join(clone, ".git"), { recursive: true });
      yield* fs.writeFileString(
        path.join(clone, ".git", "config"),
        `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${ORIGIN_URL}\n`
      );
      return { home, clone };
    });

    const retain = Effect.fnUntraced(function* (checkout: string) {
      const store = yield* AttemptJournalStore;
      return yield* store.retain(checkout);
    });

    it.effect(
      "skips links and stray entries, keeps a torn tail verbatim and imports the same journal once",
      Effect.fnUntraced(function* () {
        const { home, clone } = yield* checkoutWithOrigin();
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const none = yield* retain(clone);
          assertNone(none);
          // A directory with no git metadata names no clone and no partition.
          const bare = path.join(home, "bare");
          yield* appendJournal(bare, RUN_ID, attempt(attemptId("a")));
          const unpartitioned = yield* retain(bare);
          assertSome(unpartitioned, AttemptJournalExportUnpartitioned.make({ journals: 1 }));
          const runsRoot = path.join(clone, ".beep", "yeet", "runs");
          yield* appendJournal(clone, RUN_ID, attempt(attemptId("6")));
          yield* fs.writeFileString(path.join(runsRoot, RUN_ID, "attempts.ndjson"), '{"_tag":"attempt-sta', {
            flag: "a",
          });
          yield* fs.writeFileString(path.join(runsRoot, "stray.lock"), "");
          yield* fs.makeDirectory(path.join(runsRoot, "no-journal"));
          const elsewhere = path.join(home, "elsewhere");
          yield* appendJournal(elsewhere, "linked", attempt(attemptId("7"), "linked"));
          yield* fs.symlink(path.join(elsewhere, ".beep", "yeet", "runs", "linked"), path.join(runsRoot, "linked"));
          const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
          const first = yield* retain(clone);
          assertSome(
            first,
            AttemptJournalExported.make({ runsDirectory: runs, journals: 1, appendedRows: 3, retainedRows: 0 })
          );
          const second = yield* retain(clone);
          assertSome(
            second,
            AttemptJournalExported.make({ runsDirectory: runs, journals: 1, appendedRows: 0, retainedRows: 3 })
          );
          const stored = yield* storedJournal(RUN_ID);
          assertTrue(Str.endsWith('{"_tag":"attempt-sta\n')(stored));
          const linkedStored = yield* fs.exists(path.join(runs, "linked"));
          assertTrue(!linkedStored);
        }).pipe(withHome(home));
      })
    );

    it.effect(
      "fails on an unreadable runs directory, journal or store journal",
      Effect.fnUntraced(function* () {
        const { home, clone } = yield* checkoutWithOrigin();
        yield* Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          // `.beep` written as a file holds no journal: nothing to export.
          yield* fs.writeFileString(path.join(clone, ".beep"), "not a directory\n");
          const crossed = yield* retain(clone);
          assertNone(crossed);
          yield* fs.remove(path.join(clone, ".beep"));

          const runsRoot = path.join(clone, ".beep", "yeet", "runs");
          yield* fs.makeDirectory(runsRoot, { recursive: true });
          yield* fs.chmod(runsRoot, 0o000);
          const unlisted = yield* retain(clone).pipe(
            Effect.flip,
            Effect.ensuring(Effect.orDie(fs.chmod(runsRoot, 0o700)))
          );
          assertInstanceOf(unlisted, AttemptJournalStoreError);
          assertInclude(unlisted.message, "Could not list the attempt journals");

          yield* fs.makeDirectory(path.join(runsRoot, RUN_ID, "attempts.ndjson"), { recursive: true });
          const unread = yield* retain(clone).pipe(Effect.flip);
          assertInclude(unread.message, "Could not read the attempt journal");

          yield* fs.remove(runsRoot, { recursive: true });
          yield* appendJournal(clone, RUN_ID, attempt(attemptId("8")));
          const runs = yield* attemptJournalStoreRunsDirectory(REPOSITORY);
          yield* fs.makeDirectory(path.join(runs, RUN_ID, "attempts.ndjson"), { recursive: true });
          const unstored = yield* retain(clone).pipe(Effect.flip);
          assertInclude(unstored.message, "Could not read the retained journal");
        }).pipe(withHome(home));
      })
    );

    it.effect(
      "needs an absolute state root, and a fleet census without one still reads the live journals",
      Effect.fnUntraced(function* () {
        const { clone } = yield* checkoutWithOrigin();
        yield* appendJournal(clone, RUN_ID, attempt(attemptId("9")));
        yield* Effect.gen(function* () {
          const unresolved = yield* attemptJournalStoreRunsDirectory(REPOSITORY).pipe(Effect.flip);
          assertInclude(unresolved.message, "Could not resolve the yeet state root");
          const census = yield* fleetCensus(clone);
          deepStrictEqual(attemptKeys(census), keysOf(RUN_ID, attemptId("9")));
        }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} })));
      })
    );

    it.effect(
      "receipts print one summary line",
      Effect.fnUntraced(function* () {
        const exported = AttemptJournalExported.make({
          runsDirectory: "/state/runs",
          journals: 2,
          appendedRows: 5,
          retainedRows: 1,
        });
        const receipt = WorktreeRemovalReceipt.make({
          targetPath: "/repo/.claude/worktrees/lane",
          branch: O.some("feat/lane"),
          reason: "clean",
          manifest: O.none(),
          branchDeleted: true,
          attemptJournals: O.some(exported),
        });
        const line = "attempt journals: 2 exported to /state/runs (5 new rows, 1 already retained)";
        deepStrictEqual(renderAttemptJournalExport(exported), line);
        yield* renderWorktreeRemovalReceipt(receipt, true);
        yield* renderWorktreeRemovalReceipt(receipt, false);
        const logged = yield* TestConsole.logLines;
        assertTrue(A.contains(logged, `  ${line}`));
        assertTrue(A.contains(logged, line));
        const plan = YeetRetirePlan.make({
          worktreePath: "/repo/.claude/worktrees/lane",
          owningClone: "/repo",
          name: "lane",
          branch: "feat/lane",
        });
        assertInclude(renderRetirement(plan, receipt), `\n  ${line}`);
        assertInclude(
          renderAttemptJournalExport(AttemptJournalExportUnpartitioned.make({ journals: 1 })),
          "1 not exported"
        );
      })
    );
  });
});
