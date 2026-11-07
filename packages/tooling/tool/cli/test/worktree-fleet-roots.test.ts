import { Git } from "@beep/git/Git";
import { FleetMirrorService, FleetMirrorServiceLive, FleetScanOptions } from "@beep/repo-cli/commands/Worktree";
import { repoRunOutputBound, runCaptured } from "@beep/repo-cli/test/Process";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { FleetSnapshot } from "@beep/repo-cli/commands/Worktree";

const SCAN_TIMEOUT_MILLIS = 120_000;
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown, { space: 2 }));

const platformLayer = Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));
const testLayer = Layer.mergeAll(platformLayer, FleetMirrorServiceLive.pipe(Layer.provide(platformLayer)));

// Fixed identity and dates make every commit SHA, and so every snapshot byte, reproducible.
const FIXTURE_GIT_ENV = {
  GIT_AUTHOR_NAME: "Fleet Fixture",
  GIT_AUTHOR_EMAIL: "fleet-fixture@example.com",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_NAME: "Fleet Fixture",
  GIT_COMMITTER_EMAIL: "fleet-fixture@example.com",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};

const fixtureGit = Effect.fn("FleetRootsTest.git")(function* (cwd: string, args: ReadonlyArray<string>) {
  const { exitCode, output } = yield* runCaptured({
    command: "git",
    args: ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args],
    cwd,
    env: FIXTURE_GIT_ENV,
    extendEnv: true,
    stdin: "ignore",
    source: "merge",
    bound: repoRunOutputBound,
  });
  expect(exitCode, `git ${A.join(args, " ")}: ${output}`).toBe(0);
});

/**
 * A scratch projects directory shaped like the workstation: two legacy
 * `beep-effectN` clones, a `<clone>-worktrees` lane, a Claude Code nested
 * lane, a seat under `beep/seats` with its lane under `beep/lanes`, and an
 * unrelated project with a different origin.
 */
type FleetRootsFixture = {
  readonly tmpDir: string;
  readonly originPath: string;
  readonly projects: string;
  readonly legacy0: string;
  readonly legacy1: string;
  readonly siblingLane: string;
  readonly nestedLane: string;
  readonly seat: string;
  readonly seatLane: string;
  readonly unrelated: string;
  readonly scannerDir: string;
  readonly homeDir: string;
};

const seedOrigin = Effect.fn("FleetRootsTest.seedOrigin")(function* (tmpDir: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const origin = path.join(tmpDir, `${name}.git`);
  const seed = path.join(tmpDir, `${name}-seed`);
  yield* fixtureGit(tmpDir, ["init", "--bare", "--quiet", origin]);
  yield* fixtureGit(tmpDir, ["clone", "--quiet", origin, seed]);
  yield* fixtureGit(seed, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  yield* fs.writeFileString(path.join(seed, "README.md"), `# ${name}\n`);
  yield* fs.writeFileString(path.join(seed, ".gitignore"), ".claude/worktrees/\n");
  yield* fixtureGit(seed, ["add", "--all"]);
  yield* fixtureGit(seed, ["commit", "--quiet", "-m", "chore: seed"]);
  yield* fixtureGit(seed, ["push", "--quiet", "origin", "main"]);
  yield* fs.remove(seed, { recursive: true });
  return origin;
});

const initFleetRootsFixture = Effect.fn("FleetRootsTest.init")(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const projects = path.join(tmpDir, "projects");
  const homeDir = path.join(tmpDir, "home");
  const scannerDir = path.join(tmpDir, "scanner");
  yield* fs.makeDirectory(path.join(projects, "beep", "seats"), { recursive: true });
  yield* fs.makeDirectory(path.join(projects, "beep", "lanes"), { recursive: true });
  yield* fs.makeDirectory(path.join(projects, "beep-effect0-worktrees"), { recursive: true });
  yield* fs.makeDirectory(homeDir, { recursive: true });

  const originPath = yield* seedOrigin(tmpDir, "origin");
  const otherOrigin = yield* seedOrigin(tmpDir, "other");

  const legacy0 = path.join(projects, "beep-effect0");
  const legacy1 = path.join(projects, "beep-effect1");
  const seat = path.join(projects, "beep", "seats", "main");
  const unrelated = path.join(projects, "unrelated");
  for (const clone of [legacy0, legacy1, seat]) {
    yield* fixtureGit(tmpDir, ["clone", "--quiet", originPath, clone]);
  }
  yield* fixtureGit(tmpDir, ["clone", "--quiet", otherOrigin, unrelated]);

  const siblingLane = path.join(projects, "beep-effect0-worktrees", "lane-a");
  const nestedLane = path.join(legacy1, ".claude", "worktrees", "lane-b");
  const seatLane = path.join(projects, "beep", "lanes", "x");
  yield* fixtureGit(legacy0, ["worktree", "add", "--quiet", "-b", "lane-a", siblingLane]);
  yield* fixtureGit(legacy1, ["worktree", "add", "--quiet", "-b", "lane-b", nestedLane]);
  yield* fixtureGit(seat, ["worktree", "add", "--quiet", "-b", "x", seatLane]);
  yield* fs.writeFileString(path.join(siblingLane, "README.md"), "# origin (lane-a)\n");

  return {
    tmpDir,
    originPath,
    projects,
    legacy0,
    legacy1,
    siblingLane,
    nestedLane,
    seat,
    seatLane,
    unrelated,
    scannerDir,
    homeDir,
  } satisfies FleetRootsFixture;
});

const acquireFleetRootsFixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const tmpDir = yield* Effect.acquireRelease(fs.makeTempDirectory(), (root) =>
    fs.remove(root, { recursive: true, force: true }).pipe(Effect.orDie)
  );
  return yield* initFleetRootsFixture(tmpDir);
});

// The scratch prefix and the host's /proc census are the only inputs a fixed clock does not pin.
const stableSnapshotText = Effect.fn("FleetRootsTest.stableSnapshotText")(function* (
  snapshot: FleetSnapshot,
  tmpDir: string
) {
  const text = yield* encodeJson({
    ...snapshot,
    coverage: { ...snapshot.coverage, processesScanned: 0, processesUnreadable: 0 },
  });
  return `${Str.replaceAll(tmpDir, "<tmp>")(text)}\n`;
});

describe("fleet discovery roots", () => {
  it.layer(testLayer, { timeout: "120 seconds" })("fixture fleet", (it) => {
    it.effect(
      "roots unset: the derived single root keeps the pre-change snapshot byte for byte",
      Effect.fnUntraced(function* () {
        const fixture = yield* acquireFleetRootsFixture;
        const path = yield* Path.Path;
        const service = yield* FleetMirrorService;
        const snapshot = yield* service.scan(
          FleetScanOptions.make({
            startFrom: fixture.legacy0,
            originUrl: fixture.originPath,
            scannerDir: fixture.scannerDir,
            homeDir: fixture.homeDir,
            targetRef: "main",
          })
        );

        expect(snapshot.fleetRoot).toBe(fixture.projects);
        // The pre-change mirror sees legacy clones and their lanes; beep/seats and beep/lanes are invisible.
        expect(A.map(snapshot.checkouts, (row) => row.path)).toEqual([
          fixture.legacy0,
          fixture.siblingLane,
          fixture.legacy1,
          fixture.nestedLane,
        ]);
        // Captured from the pre-change build (commit before the roots list landed). Regenerate only when the
        // JSON contract changes on purpose: `bunx vitest run test/worktree-fleet-roots.test.ts -u`, then rerun
        // without -u and review the diff.
        const text = yield* stableSnapshotText(snapshot, fixture.tmpDir);
        yield* Effect.promise(() =>
          expect(text).toMatchFileSnapshot(path.join(__dirname, "fixtures", "fleet-roots", "roots-unset.json"))
        );
      }),
      SCAN_TIMEOUT_MILLIS
    );
  });
});
