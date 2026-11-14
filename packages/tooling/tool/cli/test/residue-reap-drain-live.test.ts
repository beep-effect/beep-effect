import { Git } from "@beep/git/Git";
import { FleetMirrorService } from "@beep/repo-cli/commands/Worktree";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { layerSessionLedgerMemory } from "@beep/repo-cli/test/Session";
import {
  ConfiguredFleetRoots,
  FleetRegistryRow,
  FleetRegistryStoreLive,
  FleetRootEntry,
  makeResidueDrainProbe,
} from "@beep/repo-cli/test/Worktree";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import type { FleetMirrorServiceShape } from "@beep/repo-cli/commands/Worktree";

const NOW = 2_000_000_000_000;

const LiveProbeTestLayer = Layer.provideMerge(
  Layer.mergeAll(FleetRegistryStoreLive, layerSessionLedgerMemory),
  Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))
);

const run = Effect.fn("ResidueDrainLiveTest.run")(function* (
  cwd: string,
  command: string,
  args: ReadonlyArray<string>
) {
  const result = yield* runRepoCommandCapture(command, args, cwd);
  expect(result.exitCode, result.output).toBe(0);
});

const PROOF_UNITS = A.join(
  [
    "beep-proof-1.service loaded active running beep-yeet-job id=1 mode=verify checkout=/p/beep-effect-worktrees/lane",
    "beep-proof-2.service loaded active running a unit that names no checkout",
    "",
  ],
  "\n"
);

// A home with systemd user units (working directories, a drop-in, a dangling link, a masked unit,
// a timer) and a GitHub-origin checkout.
const makeHost = Effect.fn("ResidueDrainLiveTest.makeHost")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "residue-drain-live-test-" });
  const home = path.join(root, "home");
  const state = path.join(root, "state");
  const repo = path.join(root, "beep-effect");
  const units = path.join(home, ".config", "systemd", "user");
  yield* fs.makeDirectory(path.join(units, "e.service.d"), { recursive: true });
  yield* fs.makeDirectory(repo, { recursive: true });
  yield* fs.writeFileString(path.join(units, "a.service"), "[Service]\nWorkingDirectory=%h/projects/a\n");
  yield* fs.writeFileString(path.join(units, "b.service"), "[Service]\nWorkingDirectory=-~/projects/b\n");
  yield* fs.writeFileString(path.join(units, "e.service.d", "override.conf"), "[Service]\nWorkingDirectory=/srv/e\n");
  yield* fs.writeFileString(path.join(units, "f.timer"), "[Timer]\nWorkingDirectory=/never\n");
  yield* fs.symlink(path.join(root, "missing.service"), path.join(units, "c.service"));
  yield* fs.symlink("/dev/null", path.join(units, "d.service"));
  yield* run(repo, "git", ["init", "--quiet", "-b", "main"]);
  yield* run(repo, "git", ["remote", "add", "origin", "https://github.com/acme/widgets.git"]);
  const config = ConfigProvider.fromUnknown({ HOME: home, BEEP_FLEET_STATE_ROOT: state });
  return { root, home, state, repo, config };
});

const mirrorFor = (root: string): FleetMirrorServiceShape => ({
  roots: () =>
    Effect.succeed(ConfiguredFleetRoots.make({ source: "derived", roots: [FleetRootEntry.make({ path: root })] })),
  scan: () => Effect.die("the drain probe never scans"),
  listCheckouts: () => Effect.die("the drain probe never lists checkouts"),
});

describe("live residue drain probe", () => {
  it.layer(LiveProbeTestLayer, { timeout: "60 seconds" })("over fixture sources", (it) => {
    it.effect("reads timer hosts, proof units, open pull requests, the registry and liveness", () =>
      Effect.gen(function* () {
        const host = yield* makeHost();
        const probe = yield* makeResidueDrainProbe(
          () => Effect.succeedSome(["feat/lane"]),
          () => Effect.succeedSome(PROOF_UNITS)
        ).pipe(Effect.provideService(FleetMirrorService, FleetMirrorService.of(mirrorFor(host.root))));
        const withConfig = Effect.provideService(ConfigProvider.ConfigProvider, host.config);

        const read = yield* withConfig(probe.facts(host.repo));
        const facts = O.getOrThrow(read);
        expect(A.sort(facts.timerDirectories ?? [], Str.Order)).toEqual([
          `${host.home}/projects/a`,
          `${host.home}/projects/b`,
          "/srv/e",
        ]);
        expect(facts.proofUnitCheckouts).toEqual(["/p/beep-effect-worktrees/lane"]);
        expect(facts.openPullRequestHeads).toEqual(["feat/lane"]);
        expect(facts.openSessionCheckouts).toEqual([]);
        expect(facts.registry).toEqual([]);
        expect(Str.startsWith(host.state)(facts.stateDirectory)).toBe(true);

        const written = yield* withConfig(
          probe.updateRegistry(host.repo, (rows) =>
            A.append(rows, FleetRegistryRow.make({ checkout: host.repo, seatRole: "legacy" }))
          )
        );
        assertSome(O.map(written, A.length), 1);
        const again = yield* withConfig(probe.facts(host.repo));
        const reread = O.getOrThrow(again);
        expect(A.map(reread.registry, (row) => row.checkout)).toEqual([host.repo]);

        const readings = yield* withConfig(probe.livenessReadings(host.repo, NOW));
        expect(readings.transcript).toEqual({ _tag: "absent" });
        expect(readings.sessionMatches).toBe(0);
      })
    );

    it.effect("reports unreadable sources as null and an unidentifiable repository as no facts", () =>
      Effect.gen(function* () {
        const host = yield* makeHost();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const probe = yield* makeResidueDrainProbe(
          () => Effect.succeedNone,
          () => Effect.succeedNone
        ).pipe(Effect.provideService(FleetMirrorService, FleetMirrorService.of(mirrorFor(host.root))));
        const withConfig = Effect.provideService(ConfigProvider.ConfigProvider, host.config);

        const read = yield* withConfig(probe.facts(host.repo));
        const facts = O.getOrThrow(read);
        expect(facts.openPullRequestHeads).toBeNull();
        expect(facts.proofUnitCheckouts).toBeNull();

        const orphan = path.join(host.root, "no-origin");
        yield* fs.makeDirectory(orphan, { recursive: true });
        yield* run(orphan, "git", ["init", "--quiet", "-b", "main"]);
        const none = yield* withConfig(probe.facts(orphan));
        assertNone(none);
        const unwritten = yield* withConfig(probe.updateRegistry(orphan, (rows) => rows));
        assertNone(unwritten);
      })
    );
  });
});
