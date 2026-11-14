import { Git } from "@beep/git/Git";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import {
  ConfiguredFleetRoots,
  FleetRegistryRow,
  FleetRootEntry,
  layerResidueTerminalLaneProbeTest,
  ResidueDrainFleetFacts,
  ResidueDrainJournalEntry,
  ResidueDrainLivenessReadings,
  ResidueDrainProbe,
  renderResidueReportLinesForTesting,
  runResidueReap,
} from "@beep/repo-cli/test/Worktree";
import { AttemptJournalStore } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
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
  ResidueDrainCheck,
  ResidueDrainProbeShape,
  ResidueReapClass,
  ResidueReapReport,
} from "@beep/repo-cli/test/Worktree";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

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
const makeFleet = Effect.fn("ResidueDrainTest.makeFleet")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "residue-drain-test-" });
  const home = path.join(root, "home");
  const projects = path.join(home, "projects");
  const state = path.join(home, "state", "fleet", "github.com__o__r");
  yield* fs.makeDirectory(projects, { recursive: true });
  yield* fs.makeDirectory(state, { recursive: true });
  yield* run(projects, "git", ["init", "--quiet", "--bare", "-b", "main", "origin.git"]);
  const invoker = yield* cloneOrigin(projects, "beep-effect");
  yield* fs.writeFileString(path.join(invoker, "README.md"), "fleet\n");
  yield* fs.writeFileString(
    path.join(invoker, ".gitignore"),
    ".env\n.env.local\nsecrets/\nnode_modules/\n*.key\ncredentials.json\n*.bin\n*.link\n"
  );
  yield* run(invoker, "git", ["add", "README.md", ".gitignore"]);
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
  // Ignored local-only file: clean to git status, carried by no bundle.
  yield* fs.writeFileString(path.join(stray, ".env"), "API_KEY=op://vault/item/field\n");
  yield* fs.writeFileString(path.join(stray, ".env.local"), "LOCAL_ONLY=1\n");
  yield* fs.writeFileString(path.join(stray, "id.key"), "private key\n");
  yield* fs.writeFileString(path.join(stray, "credentials.json"), "{}\n");
  yield* fs.makeDirectory(path.join(stray, "secrets"), { recursive: true });
  yield* fs.writeFileString(path.join(stray, "secrets", "token.txt"), "token\n");
  // Regenerable ignored residue is removed, never copied.
  yield* fs.makeDirectory(path.join(stray, "node_modules", "dep"), { recursive: true });
  yield* fs.writeFileString(path.join(stray, "node_modules", "dep", "index.js"), "module.exports = 1\n");
  yield* fs.writeFileString(path.join(stray, "README.md"), "stashed edit\n");
  yield* run(stray, "git", ["stash", "push", "--quiet", "-m", "stashed edit"]);
  return { home, projects, state, invoker, clone, lane, stray };
});

type Fleet = Effect.Success<ReturnType<typeof makeFleet>>;

type FleetLists = Pick<
  ResidueDrainFleetFacts,
  "openPullRequestHeads" | "proofUnitCheckouts" | "timerDirectories" | "openSessionCheckouts"
>;

const EMPTY_LISTS: FleetLists = {
  openPullRequestHeads: [],
  proofUnitCheckouts: [],
  timerDirectories: [],
  openSessionCheckouts: [],
};

// A probe over a Ref-backed registry; every fleet-wide list is readable and empty unless overridden.
const fleetProbe = (
  fleet: Fleet,
  registry: Ref.Ref<ReadonlyArray<FleetRegistryRow>>,
  options: {
    readonly readings?: (checkout: string) => Effect.Effect<ResidueDrainLivenessReadings>;
    readonly lists?: Partial<FleetLists>;
    readonly registryWritable?: boolean;
  } = {}
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
          ...EMPTY_LISTS,
          ...options.lists,
          stateDirectory: fleet.state,
        })
      )
    ),
  livenessReadings: (checkout) =>
    options.readings === undefined ? Effect.succeed(DORMANT) : options.readings(checkout),
  updateRegistry: (_, transform) =>
    options.registryWritable === false ? Effect.succeedNone : Effect.asSome(Ref.updateAndGet(registry, transform)),
});

const reap = (
  fleet: Fleet,
  probe: ResidueDrainProbeShape,
  options: {
    readonly nowMillis: number;
    readonly apply?: boolean;
    readonly classes?: ReadonlyArray<ResidueReapClass>;
    readonly extraCheckouts?: ReadonlyArray<string>;
  }
) =>
  runResidueReap({
    homeRoot: fleet.home,
    repoRoot: fleet.invoker,
    checkoutRoots: [fleet.invoker, fleet.clone, fleet.lane, fleet.stray, ...(options.extraCheckouts ?? [])],
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

describe("residue reap drainable class", () => {
  it.layer(DrainTestLayer, { timeout: "60 seconds" })("drain predicate", (it) => {
    it.effect("reports per-checkout drain reasons on a dry run and starts the grace window", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
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
    );

    it.effect("removes a lane only after its grace window and only when drainable is named", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
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
        const rendered = A.join(renderResidueReportLinesForTesting(wave), "\n");
        expect(rendered).toContain("== fleet drain ==");
        expect(rendered).toContain("drain grace window: 7d");
        expect(rendered).toContain("legacy clones before: 3 clone(s)");
        expect(rendered).toContain("legacy clones after: 2 clone(s)");
        expect(rendered).toContain("blocked-by=invoking-checkout");
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
    );

    it.effect("bundles an unpushed branch and a stash before removing a clone, never without a bundle", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
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
        const preserved = O.getOrThrow(O.fromNullishOr(removed.drain?.preserved));
        const env = yield* fs.readFileString(path.join(preserved, ".env"));
        expect(env).toBe("API_KEY=op://vault/item/field\n");
        const envLocal = yield* fs.readFileString(path.join(preserved, ".env.local"));
        expect(envLocal).toBe("LOCAL_ONLY=1\n");
        const key = yield* fs.readFileString(path.join(preserved, "id.key"));
        expect(key).toBe("private key\n");
        yield* expectExists(path.join(preserved, "credentials.json"), true);
        const token = yield* fs.readFileString(path.join(preserved, "secrets", "token.txt"));
        expect(token).toBe("token\n");
        yield* expectExists(path.join(preserved, "node_modules"), false);
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
    );

    it.effect("refuses unknown liveness and a clone whose objects another clone borrows", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.writeFileString(
          path.join(fleet.invoker, ".git", "objects", "info", "alternates"),
          `${path.join(fleet.stray, ".git", "objects")}\n`
        );
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const probe = fleetProbe(fleet, registry, {
          readings: (checkout) => Effect.succeed(Str.Equivalence(checkout, fleet.lane) ? UNREADABLE_MTIME : DORMANT),
        });
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
    );

    it.effect("restarts the grace window when HEAD moves", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
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
    );

    it.effect("assesses nothing and warns when the fleet facts are unreadable", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const report = yield* reap(fleet, UNREADABLE_FACTS, { nowMillis: NOW, classes: ["drainable"] });
        expect(A.filter(report.candidates, (candidate) => candidate.reapClass === "drainable")).toEqual([]);
        expect(A.some(report.warnings, Str.includes("drainable was not assessed"))).toBe(true);
      })
    );

    it.effect("refuses timer hosts, proof units, open pull requests, open session rows and authored seats", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([
          FleetRegistryRow.make({ checkout: fleet.clone, seatRole: "main" }),
          FleetRegistryRow.make({ checkout: fleet.stray, seatRole: "legacy", retentionExempt: true }),
        ]);
        const probe = fleetProbe(fleet, registry, {
          lists: {
            openPullRequestHeads: ["feat/lane"],
            proofUnitCheckouts: [fleet.stray],
            timerDirectories: [fleet.lane],
            openSessionCheckouts: [fleet.clone],
          },
        });
        const report = yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
        const lane = drainRow(report, fleet.lane);
        expect(outcomeOf(lane, "timer-host")).toBe("fail");
        expect(outcomeOf(lane, "open-pr")).toBe("fail");
        const clone = drainRow(report, fleet.clone);
        expect(outcomeOf(clone, "seat-role")).toBe("fail");
        expect(outcomeOf(clone, "session-ledger")).toBe("fail");
        const stray = drainRow(report, fleet.stray);
        expect(outcomeOf(stray, "retention-exempt")).toBe("fail");
        expect(outcomeOf(stray, "proof-unit")).toBe("fail");
        expect(A.every([lane, clone, stray], (row) => row.skipReason === "drain-blocked")).toBe(true);
      })
    );

    it.effect("fails closed on unreadable fleet lists, an unreadable checkout and a registry it cannot write", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const notACheckout = path.join(fleet.projects, "beep-effect-plain");
        yield* fs.makeDirectory(notACheckout, { recursive: true });
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const unreadable = fleetProbe(fleet, registry, {
          lists: {
            openPullRequestHeads: null,
            proofUnitCheckouts: null,
            timerDirectories: null,
            openSessionCheckouts: null,
          },
        });
        const report = yield* reap(fleet, unreadable, {
          nowMillis: NOW,
          classes: ["drainable"],
          extraCheckouts: [notACheckout],
        });
        const lane = drainRow(report, fleet.lane);
        expect(
          A.map(["timer-host", "proof-unit", "open-pr", "session-ledger"] as const, (check) => outcomeOf(lane, check))
        ).toEqual(["probe-failed", "probe-failed", "probe-failed", "probe-failed"]);
        expect(drainRow(report, notACheckout).skipReason).toBe("git-probe-failed");

        // Drainable, but the grace window cannot start while the registry refuses writes.
        const readOnly = fleetProbe(fleet, registry, { registryWritable: false });
        const blind = yield* reap(fleet, readOnly, { nowMillis: NOW, classes: ["drainable"] });
        const blindLane = drainRow(blind, fleet.lane);
        expect(blindLane.skipReason).toBe("drain-grace");
        expect(outcomeOf(blindLane, "grace-window")).toBe("probe-failed");
        expect(A.some(blind.warnings, Str.includes("could not record drain observations"))).toBe(true);
      })
    );

    it.effect("keeps a clone whose locked lane lost its directory, and drops a prunable one", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const fs = yield* FileSystem.FileSystem;
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const probe = fleetProbe(fleet, registry);
        // Unmounted storage: the lane is locked and its directory is gone.
        yield* run(fleet.clone, "git", ["worktree", "lock", "--reason", "removable volume", fleet.lane]);
        yield* fs.remove(fleet.lane, { recursive: true });
        const locked = yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
        expect(outcomeOf(drainRow(locked, fleet.clone), "owned-worktrees")).toBe("fail");

        yield* run(fleet.clone, "git", ["worktree", "unlock", fleet.lane]);
        const prunable = yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
        expect(outcomeOf(drainRow(prunable, fleet.clone), "owned-worktrees")).toBe("pass");
      })
    );

    it.effect("refuses a checkout with live activity", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const probe = fleetProbe(fleet, registry, {
          readings: (checkout) =>
            Effect.succeed(
              Str.Equivalence(checkout, fleet.lane)
                ? ResidueDrainLivenessReadings.make({
                    transcript: { _tag: "absent" },
                    worktreeMtime: { _tag: "measured", ageSeconds: 10 },
                    sessionMatches: 0,
                  })
                : DORMANT
            ),
        });
        const report = yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
        const lane = drainRow(report, fleet.lane);
        expect(outcomeOf(lane, "liveness")).toBe("fail");
        const liveness = A.findFirst(lane.drain?.checks ?? [], (result) => result.check === "liveness");
        expect(O.getOrThrow(liveness).detail).toContain("worktree-mtime");
      })
    );

    it.effect("skips ignored symlinks and refuses to preserve more than the cap", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.symlink(path.join(fleet.stray, "README.md"), path.join(fleet.stray, "readme.link"));
        // Sparse: 513 MiB apparent, nothing written.
        yield* run(fleet.stray, "truncate", ["-s", "513M", "big.bin"]);
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const probe = fleetProbe(fleet, registry);
        yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });

        const capped = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
        expect(drainRow(capped, fleet.stray).skipReason).toBe("drain-bundle-failed");
        yield* expectExists(fleet.stray, true);

        yield* fs.remove(path.join(fleet.stray, "big.bin"));
        const wave = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
        const preserved = O.getOrThrow(O.fromNullishOr(drainRow(wave, fleet.stray).drain?.preserved));
        yield* expectExists(fleet.stray, false);
        yield* expectExists(path.join(preserved, ".env"), true);
        yield* expectExists(path.join(preserved, "readme.link"), false);
      })
    );

    it.effect("refuses a drain whose checkout goes live or moves HEAD while its work is preserved", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const services = yield* Effect.context<
          FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
        >();
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const strayCalls = yield* Ref.make(0);
        const armed = yield* Ref.make<"off" | "live" | "move-head">("off");
        // Apply-time calls for the stray clone: discovery (1), the pre-bundle re-check (2), the post-preservation read (3).
        const probe = fleetProbe(fleet, registry, {
          readings: Effect.fn("ResidueDrainTest.windowReadings")(function* (checkout: string) {
            const mode = yield* Ref.get(armed);
            if (!Str.Equivalence(checkout, fleet.stray) || mode === "off") return DORMANT;
            const call = yield* Ref.updateAndGet(strayCalls, (count) => count + 1);
            if (mode === "move-head" && call === 2) {
              yield* run(fleet.stray, "git", ["commit", "--quiet", "--allow-empty", "-m", "late work"]).pipe(
                Effect.provideContext(services),
                Effect.orDie
              );
            }
            return mode === "live" && call === 3
              ? ResidueDrainLivenessReadings.make({
                  transcript: { _tag: "measured", ageSeconds: 5 },
                  worktreeMtime: { _tag: "measured", ageSeconds: 86_400 },
                  sessionMatches: 0,
                })
              : DORMANT;
          }),
        });
        yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });

        yield* Ref.set(armed, "live");
        const wentLive = yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, apply: true, classes: ["drainable"] });
        expect(drainRow(wentLive, fleet.stray).skipReason).toBe("drain-blocked");
        expect(A.some(wentLive.warnings, Str.includes("no longer dormant"))).toBe(true);
        yield* expectExists(fleet.stray, true);
        // The refusal ended the grace window: the stray clone needs a fresh one before it drains.
        const afterLive = yield* Ref.get(registry);
        expect(rowFor(afterLive, fleet.stray).drainingSince).toBeNull();

        yield* Ref.set(armed, "off");
        yield* reap(fleet, probe, { nowMillis: NOW + 8 * DAY, classes: ["drainable"] });
        yield* Ref.set(strayCalls, 0);
        yield* Ref.set(armed, "move-head");
        const moved = yield* reap(fleet, probe, { nowMillis: NOW + 16 * DAY, apply: true, classes: ["drainable"] });
        expect(drainRow(moved, fleet.stray).skipReason).toBe("drain-blocked");
        expect(A.some(moved.warnings, Str.includes("HEAD moved while its work was being preserved"))).toBe(true);
        yield* expectExists(fleet.stray, true);

        const entries = yield* journal(fleet);
        const refusals = A.filter(entries, (entry) => entry.checkout === fleet.stray);
        expect(A.map(refusals, (entry) => [entry.outcome, entry.reason])).toEqual([
          ["refused", "drain-blocked"],
          ["refused", "drain-blocked"],
        ]);
      })
    );

    it.effect("needs a bundle for commits only a stale remote-tracking ref still covers", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* run(fleet.clone, "git", ["worktree", "remove", fleet.lane]);
        yield* run(fleet.clone, "git", ["checkout", "--quiet", "-b", "gone"]);
        yield* fs.writeFileString(path.join(fleet.clone, "gone.txt"), "deleted upstream\n");
        yield* run(fleet.clone, "git", ["add", "gone.txt"]);
        yield* run(fleet.clone, "git", ["commit", "--quiet", "-m", "pushed then deleted upstream"]);
        yield* run(fleet.clone, "git", ["push", "--quiet", "origin", "gone"]);
        // Deleted from another clone: this clone keeps a stale origin/gone.
        yield* run(fleet.invoker, "git", ["push", "--quiet", "origin", "--delete", "gone"]);
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const report = yield* reap(fleet, fleetProbe(fleet, registry), { nowMillis: NOW, classes: ["drainable"] });
        expect(outcomeOf(drainRow(report, fleet.clone), "local-only-work")).toBe("bundle-required");
      })
    );

    it.effect("ends the grace window of a checkout whose layout becomes unreadable", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const probe = fleetProbe(fleet, registry);
        yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"] });
        const started = yield* Ref.get(registry);
        expect(rowFor(started, fleet.lane).drainingSince).not.toBeNull();

        yield* fs.rename(path.join(fleet.lane, ".git"), path.join(fleet.lane, ".git.away"));
        const blind = yield* reap(fleet, probe, { nowMillis: NOW + DAY, classes: ["drainable"] });
        expect(drainRow(blind, fleet.lane).skipReason).toBe("git-probe-failed");
        const ended = yield* Ref.get(registry);
        expect(rowFor(ended, fleet.lane).drainingSince).toBeNull();
      })
    );

    it.effect("drains a checkout that sits directly under home", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const path = yield* Path.Path;
        yield* run(fleet.home, "git", ["clone", "--quiet", path.join(fleet.projects, "origin.git"), "beep-effect5"]);
        const atHome = path.join(fleet.home, "beep-effect5");
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const probe = fleetProbe(fleet, registry);
        yield* reap(fleet, probe, { nowMillis: NOW, classes: ["drainable"], extraCheckouts: [atHome] });
        const wave = yield* reap(fleet, probe, {
          nowMillis: NOW + 8 * DAY,
          apply: true,
          classes: ["drainable"],
          extraCheckouts: [atHome],
        });
        expect(drainRow(wave, atHome).action).toBe("remove-dir");
        yield* expectExists(atHome, false);
      })
    );

    it.effect("refuses to assess while a git repository-location variable is set", () =>
      Effect.gen(function* () {
        const fleet = yield* makeFleet();
        const registry = yield* Ref.make<ReadonlyArray<FleetRegistryRow>>([]);
        const report = yield* reap(fleet, fleetProbe(fleet, registry), { nowMillis: NOW, classes: ["drainable"] }).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ GIT_DIR: fleet.clone, HOME: fleet.home })
          )
        );
        expect(A.filter(report.candidates, (candidate) => candidate.reapClass === "drainable")).toEqual([]);
        expect(A.some(report.warnings, Str.includes("GIT_DIR"))).toBe(true);
      })
    );
  });
});
