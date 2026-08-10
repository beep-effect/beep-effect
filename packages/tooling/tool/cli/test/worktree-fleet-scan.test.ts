import {
  FleetMirrorService,
  FleetMirrorServiceLive,
  FleetScanOptions,
  parseProcStatStartTime,
} from "@beep/repo-cli/commands/Worktree";
import { A, N, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import type { FleetCheckout, FleetSnapshot } from "@beep/repo-cli/commands/Worktree";

const SCAN_TIMEOUT_MILLIS = 60_000;
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const README_BASE = "# fleet fixture\n\nshared line\n";
const README_BETA = "# fleet fixture\n\nshared line (beta)\n";
const README_MAIN = "# fleet fixture\n\nshared line (main)\n";
const TURBO_BASE = '{ "tasks": {} }\n';
const TURBO_MOVED = '{ "tasks": { "check": {} } }\n';

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, FleetMirrorServiceLive.pipe(Layer.provide(NodeServices.layer)));

/** A scratch fleet: a bare origin, two sibling clones under one fleet root, and hermetic scanner/home directories. */
type FleetFixture = {
  readonly tmpDir: string;
  readonly originPath: string;
  readonly fleetRoot: string;
  readonly alpha: string;
  readonly beta: string;
  readonly scannerDir: string;
  readonly homeDir: string;
};

const runGit = Effect.fn("FleetScanTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const exitCode = yield* Effect.scoped(
    ChildProcess.make("git", [...args], {
      cwd,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    }).pipe(Effect.flatMap((handle) => handle.exitCode))
  );
  expect(exitCode).toBe(0);
});

const configureCheckout = Effect.fn("FleetScanTest.configureCheckout")(function* (checkout: string) {
  yield* runGit(checkout, ["config", "user.email", "fleet-test@example.com"]);
  yield* runGit(checkout, ["config", "user.name", "Fleet Test"]);
  yield* runGit(checkout, ["config", "commit.gpgsign", "false"]);
});

const commitAll = Effect.fn("FleetScanTest.commitAll")(function* (checkout: string, message: string) {
  yield* runGit(checkout, ["add", "--all"]);
  yield* runGit(checkout, ["commit", "-m", message]);
});

const initScratchFleet = Effect.fn("FleetScanTest.initScratchFleet")(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const originPath = path.join(tmpDir, "origin.git");
  const fleetRoot = path.join(tmpDir, "fleet");
  const homeDir = path.join(tmpDir, "home");
  const scannerDir = path.join(tmpDir, "scanner");
  const alpha = path.join(fleetRoot, "alpha");
  const beta = path.join(fleetRoot, "beta");

  yield* fs.makeDirectory(fleetRoot, { recursive: true });
  // An empty home keeps the transcript and session-registry probes hermetic:
  // they measure "absent", never the developer's real ~/.claude tree.
  yield* fs.makeDirectory(homeDir, { recursive: true });
  yield* runGit(tmpDir, ["init", "--bare", "--quiet", "--initial-branch=main", originPath]);

  yield* runGit(fleetRoot, ["clone", "--quiet", originPath, "alpha"]);
  // Cloning an empty repository leaves HEAD unborn; pin it to main before the
  // first commit so the fixture never inherits a global init.defaultBranch.
  yield* runGit(alpha, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  yield* configureCheckout(alpha);
  yield* fs.writeFileString(path.join(alpha, "README.md"), README_BASE);
  yield* fs.writeFileString(path.join(alpha, "turbo.json"), TURBO_BASE);
  yield* fs.writeFileString(path.join(alpha, "src.txt"), "base\n");
  yield* commitAll(alpha, "chore: seed fixture");
  yield* runGit(alpha, ["push", "--quiet", "-u", "origin", "main"]);

  yield* runGit(fleetRoot, ["clone", "--quiet", originPath, "beta"]);
  yield* configureCheckout(beta);

  return { tmpDir, originPath, fleetRoot, alpha, beta, scannerDir, homeDir };
});

const withScratchFleet = <A, E, R>(use: (fixture: FleetFixture) => Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const fixture = yield* initScratchFleet(tmpDir);
        return { fs, fixture };
      }),
      ({ fixture }) => use(fixture),
      ({ fixture, fs }) => fs.remove(fixture.tmpDir, { recursive: true, force: true }).pipe(Effect.ignore)
    ).pipe(provideScopedLayer(testLayer))
  );

const scanFixture = Effect.fn("FleetScanTest.scanFixture")(function* (fixture: FleetFixture) {
  const service = yield* FleetMirrorService;
  return yield* service.scan(
    FleetScanOptions.make({
      startFrom: fixture.alpha,
      fleetRoot: fixture.fleetRoot,
      originUrl: fixture.originPath,
      scannerDir: fixture.scannerDir,
      homeDir: fixture.homeDir,
      targetRef: "main",
    })
  );
});

const checkoutAt = (snapshot: FleetSnapshot, checkoutPath: string): FleetCheckout =>
  O.getOrThrowWith(
    A.findFirst(snapshot.checkouts, (row) => row.path === checkoutPath),
    () => new Error(`The fleet snapshot has no row for ${checkoutPath}.`)
  );

describe("fleet mirror scan", () => {
  it.live(
    "derives both sibling clones against a materialized epoch target",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const snapshot = yield* scanFixture(fixture);

          expect(snapshot.fleetRoot).toBe(fixture.fleetRoot);
          expect(snapshot.originUrl).toBe(fixture.originPath);
          expect(snapshot.target.ref).toBe("main");
          expect(snapshot.target.materialized).toBe(true);
          expect(snapshot.coverage.clonesDiscovered).toBe(2);
          expect(snapshot.coverage.checkoutsDiscovered).toBe(2);
          expect(snapshot.coverage.checkoutsDegraded).toBe(0);
          expect(A.map(snapshot.checkouts, (row) => row.path)).toEqual([fixture.alpha, fixture.beta]);

          const alphaRow = checkoutAt(snapshot, fixture.alpha);
          expect(alphaRow.kind).toBe("clone");
          expect(alphaRow.branch).toBe("main");
          expect(alphaRow.detached).toBe(false);
          expect(alphaRow.head).toBe(snapshot.target.sha);
          expect(alphaRow.dirtyCount).toBe(0);
          // Fresh fixture writes are inside the liveness window.
          expect(alphaRow.liveness).toBe("live");
          expect(alphaRow.livenessEvidence).toContain("worktree-mtime");
          expect(alphaRow.conflict).toBe("clean");
          expect(alphaRow.policyMovement).toBe("unmoved");
          expect(snapshot.contestedPaths).toEqual([]);
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );

  it.live(
    "fires signal 3 and keeps signals 1 and 2 silent when main moves onto a measured policy path",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          // beta holds an in-flight branch that never touches the policy surface.
          yield* runGit(fixture.beta, ["checkout", "--quiet", "-b", "feat/beta-work"]);
          yield* fs.writeFileString(path.join(fixture.beta, "src.txt"), "beta work\n");
          yield* commitAll(fixture.beta, "feat: beta work");

          // main moves onto turbo.json, a measured policy path beta never touched.
          yield* fs.writeFileString(path.join(fixture.alpha, "turbo.json"), TURBO_MOVED);
          yield* commitAll(fixture.alpha, "chore: retune turbo");
          yield* runGit(fixture.alpha, ["push", "--quiet", "origin", "main"]);

          const snapshot = yield* scanFixture(fixture);
          expect(snapshot.target.materialized).toBe(true);

          const betaRow = checkoutAt(snapshot, fixture.beta);
          expect(betaRow.branch).toBe("feat/beta-work");
          expect(betaRow.liveness).toBe("live");

          // Signal 3 fires: main moved onto the measured surface.
          expect(betaRow.policyMovement).toBe("moved");
          expect(betaRow.policyPaths).toContain("turbo.json");
          expect(betaRow.policyReason).toBeNull();

          // Signal 2 stays silent: the collision produces no textual conflict,
          // and the branch's own diff is disjoint from the moved file.
          expect(betaRow.conflict).toBe("clean");
          expect(betaRow.conflictPaths).toEqual([]);
          expect(betaRow.branchDiffCount).toBe(1);

          // Signal 1 stays silent: no path is claimed by two checkouts.
          expect(snapshot.contestedPaths).toEqual([]);

          // alpha already sits on the new tip, so nothing moved underneath it.
          const alphaRow = checkoutAt(snapshot, fixture.alpha);
          expect(alphaRow.head).toBe(snapshot.target.sha);
          expect(alphaRow.policyMovement).toBe("unmoved");
          expect(alphaRow.policyPaths).toEqual([]);
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );

  it.live(
    "reports unknown, never clean, when the epoch target cannot be materialized",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          // The clones keep their configured origin string, so enumeration still
          // matches; only ls-remote against the moved repository fails.
          yield* fs.rename(fixture.originPath, path.join(fixture.tmpDir, "origin-gone.git"));

          const snapshot = yield* scanFixture(fixture);

          expect(snapshot.target.sha).toBeNull();
          expect(snapshot.target.materialized).toBe(false);
          expect(snapshot.coverage.checkoutsDiscovered).toBe(2);
          expect(snapshot.coverage.checkoutsDegraded).toBe(0);

          for (const row of snapshot.checkouts) {
            expect(row.head).not.toBeNull();
            expect(row.conflict).toBe("unknown");
            expect(row.conflictReason).toBe("target-unmaterialized");
            expect(row.conflictPaths).toEqual([]);
            expect(row.policyMovement).toBe("unknown");
            expect(row.policyReason).toBe("target-unmaterialized");
            expect(row.policyPaths).toEqual([]);
            expect(row.mergeBase).toBeNull();
          }
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );

  it.live(
    "predicts a real textual conflict against the epoch target",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          yield* runGit(fixture.beta, ["checkout", "--quiet", "-b", "feat/beta-readme"]);
          yield* fs.writeFileString(path.join(fixture.beta, "README.md"), README_BETA);
          yield* commitAll(fixture.beta, "docs: beta rewrites the shared line");

          yield* fs.writeFileString(path.join(fixture.alpha, "README.md"), README_MAIN);
          yield* commitAll(fixture.alpha, "docs: main rewrites the shared line");
          yield* runGit(fixture.alpha, ["push", "--quiet", "origin", "main"]);

          const snapshot = yield* scanFixture(fixture);
          const betaRow = checkoutAt(snapshot, fixture.beta);

          expect(betaRow.liveness).toBe("live");
          expect(betaRow.conflict).toBe("conflict");
          expect(betaRow.conflictPaths).toContain("README.md");
          expect(betaRow.conflictReason).toBeNull();
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );

  it.live(
    "reports an untracked path held by two checkouts as contested",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          yield* Effect.forEach([fixture.alpha, fixture.beta], (checkout) =>
            Effect.gen(function* () {
              yield* fs.makeDirectory(path.join(checkout, "notes"), { recursive: true });
              yield* fs.writeFileString(path.join(checkout, "notes", "shared.md"), "# shared\n");
            })
          );

          const snapshot = yield* scanFixture(fixture);

          const contested = O.getOrThrowWith(
            A.findFirst(snapshot.contestedPaths, (entry) => entry.path === "notes/shared.md"),
            () => new Error("Expected notes/shared.md to be contested by both checkouts.")
          );
          expect(contested.checkouts).toEqual([fixture.alpha, fixture.beta]);

          // -uall expands the untracked directory, so the row counts the file.
          expect(checkoutAt(snapshot, fixture.alpha).dirtyCount).toBe(1);
          expect(checkoutAt(snapshot, fixture.beta).dirtyCount).toBe(1);
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );

  it.live(
    "classifies live with claude-session evidence from a confirmed registry entry recorded in a subdirectory",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          // The test runner's own /proc identity makes the fixture entry pass
          // the starttime reuse guard against a genuinely live process.
          const stat = yield* fs.readFileString("/proc/self/stat");
          const pid = O.getOrThrowWith(A.head(Str.split(stat, " ")), () => new Error("Failed to read the test pid."));
          const numericPid = O.getOrThrowWith(N.parse(pid), () => new Error("Failed to parse the test pid."));
          const procStart = O.getOrThrowWith(
            parseProcStatStartTime(stat),
            () => new Error("Failed to parse starttime from /proc/self/stat.")
          );

          const sessionsDir = path.join(fixture.homeDir, ".claude", "sessions");
          yield* fs.makeDirectory(sessionsDir, { recursive: true });
          // Real registry entries carry many more fields than the probe reads;
          // the fixture keeps a representative sample to prove tolerant decode.
          const registryEntry = yield* encodeJson({
            pid: numericPid,
            sessionId: "fixture-session",
            cwd: path.join(fixture.beta, "notes"),
            procStart,
            version: "2.1.226",
            kind: "interactive",
            status: "busy",
            messagingSocketPath: null,
          });
          yield* fs.writeFileString(path.join(sessionsDir, `${pid}.json`), registryEntry);

          const snapshot = yield* scanFixture(fixture);

          const betaRow = checkoutAt(snapshot, fixture.beta);
          expect(betaRow.liveness).toBe("live");
          // The recorded cwd is a subdirectory, so the at-or-under join credits beta.
          expect(betaRow.livenessEvidence).toContain("claude-session");
          expect(checkoutAt(snapshot, fixture.alpha).livenessEvidence).not.toContain("claude-session");
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );

  it.live(
    "contributes nothing for recycled-PID, dead-PID, or malformed registry entries",
    () =>
      withScratchFleet((fixture) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          const stat = yield* fs.readFileString("/proc/self/stat");
          const pid = O.getOrThrowWith(A.head(Str.split(stat, " ")), () => new Error("Failed to read the test pid."));
          const numericPid = O.getOrThrowWith(N.parse(pid), () => new Error("Failed to parse the test pid."));

          const sessionsDir = path.join(fixture.homeDir, ".claude", "sessions");
          yield* fs.makeDirectory(sessionsDir, { recursive: true });
          // A stale file over a recycled PID: the process is alive, but its starttime differs.
          const recycledEntry = yield* encodeJson({
            pid: numericPid,
            procStart: "1",
            cwd: fixture.beta,
          });
          yield* fs.writeFileString(path.join(sessionsDir, `${pid}.json`), recycledEntry);
          // A PID beyond pid_max, so /proc/<pid>/stat cannot exist.
          const deadEntry = yield* encodeJson({ pid: 999999999, procStart: "1", cwd: fixture.beta });
          yield* fs.writeFileString(path.join(sessionsDir, "999999999.json"), deadEntry);
          // An entry that does not decode.
          yield* fs.writeFileString(path.join(sessionsDir, "12345.json"), "not json");

          const snapshot = yield* scanFixture(fixture);

          expect(snapshot.coverage.checkoutsDiscovered).toBe(2);
          for (const row of snapshot.checkouts) {
            expect(row.livenessEvidence).not.toContain("claude-session");
          }
        })
      ),
    SCAN_TIMEOUT_MILLIS
  );
});
