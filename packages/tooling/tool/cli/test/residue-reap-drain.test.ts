import { Git } from "@beep/git/Git";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import {
  ConfiguredFleetRoots,
  FleetRootEntry,
  layerResidueTerminalLaneProbeTest,
  ResidueDrainFleetFacts,
  ResidueDrainJournalEntry,
  ResidueDrainLivenessReadings,
  ResidueDrainProbe,
  runResidueReap,
} from "@beep/repo-cli/test/Worktree";
import { AttemptJournalStore } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  FleetRegistryRow,
  ResidueDrainCheck,
  ResidueDrainProbeShape,
  ResidueReapClass,
  ResidueReapReport,
} from "@beep/repo-cli/test/Worktree";

const NOW = 2_000_000_000_000;
const DAY = Duration.toMillis(Duration.days(1));
const noLiveCwd = () => Effect.succeedSome(false);
const noLivePid = () => Effect.succeedSome(false);
const decodeJournalLine = S.decodeUnknownEffect(S.fromJsonString(ResidueDrainJournalEntry));

const DORMANT = ResidueDrainLivenessReadings.make({
  transcript: { _tag: "absent" },
  worktreeMtime: { _tag: "measured", ageSeconds: 86_400 },
  sessionMatches: 0,
});
const UNREADABLE_MTIME = ResidueDrainLivenessReadings.make({
  transcript: { _tag: "absent" },
  worktreeMtime: { _tag: "failed" },
  sessionMatches: 0,
});

const UNREADABLE_FACTS: ResidueDrainProbeShape = {
  facts: () => Effect.succeedNone,
  livenessReadings: () => Effect.succeed(DORMANT),
  updateRegistry: () => Effect.succeedNone,
};

const DrainTestLayer = Layer.provideMerge(
  Layer.mergeAll(
    layerResidueTerminalLaneProbeTest(() => Effect.succeedNone),
    AttemptJournalStore.layer
  ),
  Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))
);

const makeTempDirectory = FileSystem.FileSystem.use((fs) => fs.makeTempDirectory({ prefix: "residue-drain-test-" }));

const removeTempDirectory = (root: string) =>
  FileSystem.FileSystem.use((fs) => fs.remove(root, { force: true, recursive: true }));

const run = Effect.fn("ResidueDrainTest.run")(function* (cwd: string, command: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture(command, args, cwd);
  expect(result.exitCode, result.output).toBe(0);
  return result.output;
});

const configure = Effect.fn("ResidueDrainTest.configure")(function* (checkout: string) {
  yield* run(checkout, "git", ["config", "user.email", "residue-drain@example.invalid"]);
  yield* run(checkout, "git", ["config", "user.name", "Residue Drain Test"]);
  yield* run(checkout, "git", ["config", "commit.gpgsign", "false"]);
});

const cloneOrigin = Effect.fn("ResidueDrainTest.cloneOrigin")(function* (projects: string, name: string) {
  const path = yield* Path.Path;
  yield* run(projects, "git", ["clone", "--quiet", "origin.git", name]);
  const checkout = path.join(projects, name);
  yield* configure(checkout);
  return checkout;
});

// home/projects holds a bare origin, the invoking clone, a clone with one linked lane, and a
// clone carrying an unpushed branch and a stash.
const makeFleet = Effect.fn("ResidueDrainTest.makeFleet")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = path.join(root, "home");
  const projects = path.join(home, "projects");
  const state = path.join(home, "state", "fleet", "github.com__o__r");
  yield* fs.makeDirectory(projects, { recursive: true });
  yield* fs.makeDirectory(state, { recursive: true });
  yield* run(projects, "git", ["init", "--quiet", "--bare", "-b", "main", "origin.git"]);
  const invoker = yield* cloneOrigin(projects, "beep-effect");
  yield* fs.writeFileString(path.join(invoker, "README.md"), "fleet\n");
  yield* run(invoker, "git", ["add", "README.md"]);
  yield* run(invoker, "git", ["commit", "--quiet", "-m", "seed"]);
  yield* run(invoker, "git", ["push", "--quiet", "origin", "main"]);
  const clone = yield* cloneOrigin(projects, "beep-effect0");
  const lane = path.join(projects, "beep-effect0-lane");
  yield* run(clone, "git", ["worktree", "add", "--quiet", lane, "-b", "feat/lane"]);
  const stray = yield* cloneOrigin(projects, "beep-effect3");
  yield* run(stray, "git", ["checkout", "--quiet", "-b", "unpushed"]);
  yield* fs.writeFileString(path.join(stray, "work.txt"), "local only\n");
  yield* run(stray, "git", ["add", "work.txt"]);
  yield* run(stray, "git", ["commit", "--quiet", "-m", "unpushed work"]);
  yield* fs.writeFileString(path.join(stray, "README.md"), "stashed edit\n");
  yield* run(stray, "git", ["stash", "push", "--quiet", "-m", "stashed edit"]);
  return { home, projects, state, invoker, clone, lane, stray };
});

type Fleet = Effect.Success<ReturnType<typeof makeFleet>>;

// A probe over a Ref-backed registry with every fleet-wide list readable and empty.
const fleetProbe = (
  fleet: Fleet,
  registry: Ref.Ref<ReadonlyArray<FleetRegistryRow>>,
  readings: (checkout: string) => ResidueDrainLivenessReadings = () => DORMANT
): ResidueDrainProbeShape => ({
  facts: () =>
    Effect.map(Ref.get(registry), (rows) =>
      O.some(
        ResidueDrainFleetFacts.make({
          roots: ConfiguredFleetRoots.make({
            source: "derived",
            roots: [FleetRootEntry.make({ path: fleet.projects })],
          }),
          registry: rows,
          openPullRequestHeads: [],
          proofUnitCheckouts: [],
          timerDirectories: [],
          openSessionCheckouts: [],
          stateDirectory: fleet.state,
        })
      )
    ),
  livenessReadings: (checkout) => Effect.succeed(readings(checkout)),
  updateRegistry: (_, transform) => Effect.asSome(Ref.updateAndGet(registry, transform)),
});

const reap = (
  fleet: Fleet,
  probe: ResidueDrainProbeShape,
  options: {
    readonly nowMillis: number;
    readonly apply?: boolean;
    readonly classes?: ReadonlyArray<ResidueReapClass>;
  }
) =>
  runResidueReap({
    homeRoot: fleet.home,
    repoRoot: fleet.invoker,
    checkoutRoots: [fleet.invoker, fleet.clone, fleet.lane, fleet.stray],
    fleet: true,
    nowMillis: options.nowMillis,
    probeLiveCwd: noLiveCwd,
    probePidAlive: noLivePid,
    ...(options.apply === undefined ? {} : { apply: options.apply }),
    ...(options.classes === undefined ? {} : { classes: options.classes }),
  }).pipe(Effect.provideService(ResidueDrainProbe, probe));

const expectExists = Effect.fn("ResidueDrainTest.expectExists")(function* (target: string, expected: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(target);
  expect(exists).toBe(expected);
});

const drainRow = (report: ResidueReapReport, checkout: string) =>
  O.getOrThrow(
    A.findFirst(
      report.candidates,
      (candidate) => candidate.reapClass === "drainable" && Str.Equivalence(candidate.path, checkout)
    )
  );

const outcomeOf = (row: ResidueReapReport["candidates"][number], check: ResidueDrainCheck) =>
  O.getOrThrow(
    O.flatMap(O.fromUndefinedOr(row.drain), (drain) =>
      O.map(
        A.findFirst(drain.checks, (result) => result.check === check),
        (result) => result.outcome
      )
    )
  );

const rowFor = (rows: ReadonlyArray<FleetRegistryRow>, checkout: string) =>
  O.getOrThrow(A.findFirst(rows, (row) => Str.Equivalence(row.checkout, checkout)));

const journal = Effect.fn("ResidueDrainTest.journal")(function* (fleet: Fleet) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(fleet.state, "drain-journal.jsonl"));
  return yield* Effect.forEach(A.filter(Str.split("\n")(text), Str.isNonEmpty), (line) => decodeJournalLine(line));
});

const withFleet = <A, E, R>(body: (fleet: Fleet) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(makeTempDirectory, (root) => Effect.flatMap(makeFleet(root), body), removeTempDirectory);

describe("residue reap drainable class", () => {
  it.layer(DrainTestLayer, { timeout: "60 seconds" })("drain predicate", (it) => {
    it.effect("reports per-checkout drain reasons on a dry run and starts the grace window", () =>
      withFleet((fleet) =>
        Effect.gen(function* () {
          const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
          const report = yield* reap(fleet, fleetProbe(fleet, registry), { nowMillis: NOW, classes: ["drainable"] });
          expect(report.applied).toBe(false);
          expect(report.drainGraceDays).toBe(7);
          expect(report.drainDiskBefore?.legacyClones).toBe(3);

          const lane = drainRow(report, fleet.lane);
          expect(lane.action).toBe("skip");
          expect(lane.skipReason).toBe("drain-grace");
          expect(lane.drain?.drainable).toBe(true);
          expect(lane.drain?.seatRole).toBe("adopted");
          expect(outcomeOf(lane, "liveness")).toBe("pass");
          expect(outcomeOf(lane, "clean-tree")).toBe("pass");
          expect(outcomeOf(lane, "grace-window")).toBe("fail");

          const clone = drainRow(report, fleet.clone);
          expect(clone.skipReason).toBe("drain-blocked");
          expect(clone.drain?.seatRole).toBe("legacy");
          expect(outcomeOf(clone, "owned-worktrees")).toBe("fail");
          expect(outcomeOf(clone, "clean-tree")).toBe("not-evaluated");

          expect(outcomeOf(drainRow(report, fleet.invoker), "invoking-checkout")).toBe("fail");
          expect(outcomeOf(drainRow(report, fleet.stray), "local-only-work")).toBe("bundle-required");

          const rows = yield* Ref.get(registry);
          expect(rowFor(rows, fleet.lane).drainStatus).toBe("draining");
          expect(rowFor(rows, fleet.clone).drainStatus).toBe("active");
          yield* expectExists(fleet.lane, true);
        })
      )
    );

    it.effect("removes a lane only after its grace window and only when drainable is named", () =>
      withFleet((fleet) =>
        Effect.gen(function* () {
          const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
          const probe = fleetProbe(fleet, registry);
          yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });

          const early = yield* reap(fleet, probe, { nowMillis: NOW + 3 * DAY, apply: true, classes: ["drainable"] });
          expect(drainRow(early, fleet.lane).skipReason).toBe("drain-grace");

          const unnamed = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true });
          expect(drainRow(unnamed, fleet.lane).skipReason).toBe("drain-opt-in");
          yield* expectExists(fleet.lane, true);

          const wave = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
          // The stray clone met the predicate over the same window, so the wave bundles and drains it too.
          expect(drainRow(wave, fleet.lane).action).toBe("worktree-remove");
          expect(drainRow(wave, fleet.stray).action).toBe("remove-dir");
          expect(wave.reapedCount).toBe(2);
          yield* expectExists(fleet.lane, false);
          expect(wave.drainDiskBefore?.legacyClones).toBe(3);
          expect(wave.drainDiskAfter?.legacyClones).toBe(2);
          const worktrees = yield* run(fleet.clone, "git", ["worktree", "list", "--porcelain"]);
          expect(Str.includes(fleet.lane)(worktrees)).toBe(false);

          const entries = yield* journal(fleet);
          const entry = O.getOrUndefined(A.findFirst(entries, (line) => line.checkout === fleet.lane));
          expect(entry?.outcome).toBe("removed");
          const passed = A.map(
            A.filter(entry?.checks ?? [], (result) => result.outcome === "pass"),
            (result) => result.check
          );
          expect(passed).toEqual(
            expect.arrayContaining([
              "open-pr",
              "proof-unit",
              "liveness",
              "clean-tree",
              "local-only-work",
              "owned-worktrees",
              "grace-window",
            ])
          );
          const retired = yield* Ref.get(registry);
          expect(rowFor(retired, fleet.lane).drainStatus).toBe("retired");

          // With its lane gone the clone starts its own grace window.
          const next = yield* reap(fleet, probe, { nowMillis: NOW + 9 * DAY, classes: ["drainable"] });
          expect(outcomeOf(drainRow(next, fleet.clone), "owned-worktrees")).toBe("pass");
          expect(drainRow(next, fleet.clone).skipReason).toBe("drain-grace");
        })
      )
    );

    it.effect("bundles an unpushed branch and a stash before removing a clone, never without a bundle", () =>
      withFleet((fleet) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
          const probe = fleetProbe(fleet, registry);
          yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });

          // A file where the bundle directory belongs makes the bundle unwritable.
          const bundles = path.join(fleet.state, "drain-bundles");
          yield* fs.writeFileString(bundles, "not a directory\n");
          const refused = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
          expect(drainRow(refused, fleet.stray).skipReason).toBe("drain-bundle-failed");
          yield* expectExists(fleet.stray, true);

          yield* fs.remove(bundles);
          const wave = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
          const removed = drainRow(wave, fleet.stray);
          expect(removed.action).toBe("remove-dir");
          yield* expectExists(fleet.stray, false);
          const bundle = O.getOrThrow(O.fromNullishOr(removed.drain?.bundle));
          yield* expectExists(bundle, true);
          yield* run(fleet.clone, "git", ["bundle", "verify", bundle]);
          const heads = yield* run(fleet.clone, "git", ["bundle", "list-heads", bundle]);
          expect(Str.includes("refs/heads/unpushed")(heads)).toBe(true);
          expect(Str.includes("refs/beep-drain/stash-0")(heads)).toBe(true);

          const entries = yield* journal(fleet);
          const outcomes = A.map(
            A.filter(entries, (entry) => entry.checkout === fleet.stray),
            (entry) => [entry.outcome, entry.reason, entry.bundle] as const
          );
          expect(outcomes).toEqual([
            ["refused", "drain-bundle-failed", null],
            ["removed", null, bundle],
          ]);
        })
      )
    );

    it.effect("refuses unknown liveness and a clone whose objects another clone borrows", () =>
      withFleet((fleet) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(
            path.join(fleet.invoker, ".git", "objects", "info", "alternates"),
            `${path.join(fleet.stray, ".git", "objects")}\n`
          );
          const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
          const probe = fleetProbe(fleet, registry, (checkout) =>
            Str.Equivalence(checkout, fleet.lane) ? UNREADABLE_MTIME : DORMANT
          );
          yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
          const report = yield* reap(fleet, probe, { nowMillis: NOW + 30 * DAY, apply: true, classes: ["drainable"] });

          const lane = drainRow(report, fleet.lane);
          expect(lane.skipReason).toBe("drain-blocked");
          expect(outcomeOf(lane, "liveness")).toBe("probe-failed");
          const stray = drainRow(report, fleet.stray);
          expect(stray.skipReason).toBe("drain-blocked");
          expect(outcomeOf(stray, "object-borrowers")).toBe("fail");
          expect(report.reapedCount).toBe(0);
          yield* expectExists(fleet.lane, true);
          yield* expectExists(fleet.stray, true);
          const observed = yield* Ref.get(registry);
          expect(rowFor(observed, fleet.lane).drainingSince).toBeNull();
        })
      )
    );

    it.effect("restarts the grace window when HEAD moves", () =>
      withFleet((fleet) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
          const probe = fleetProbe(fleet, registry);
          yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
          yield* configure(fleet.lane);
          yield* fs.writeFileString(path.join(fleet.lane, "lane.txt"), "moved\n");
          yield* run(fleet.lane, "git", ["add", "lane.txt"]);
          yield* run(fleet.lane, "git", ["commit", "--quiet", "-m", "lane work"]);

          const report = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
          expect(drainRow(report, fleet.lane).skipReason).toBe("drain-grace");
          yield* expectExists(fleet.lane, true);
        })
      )
    );

    it.effect("assesses nothing and warns when the fleet facts are unreadable", () =>
      withFleet((fleet) =>
        Effect.gen(function* () {
          const report = yield* reap(fleet, UNREADABLE_FACTS, { nowMillis: NOW, classes: ["drainable"] });
          expect(A.filter(report.candidates, (candidate) => candidate.reapClass === "drainable")).toEqual([]);
          expect(A.some(report.warnings, Str.includes("drainable was not assessed"))).toBe(true);
        })
      )
    );
  });
});
