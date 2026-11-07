import { Git } from "@beep/git/Git";
import {
  FleetCheckout,
  FleetMirrorService,
  FleetMirrorServiceLive,
  FleetScanOptions,
  printFleetCheckoutDescription,
  printFleetJoin,
  registerFleetCheckout,
} from "@beep/repo-cli/commands/Worktree";
import { repoRunOutputBound, runCaptured } from "@beep/repo-cli/test/Process";
import { acquireJournalFileLock, releaseJournalFileLock } from "@beep/repo-cli/test/RepoRun";
import {
  layerSessionLedgerMemory,
  PrNumber,
  PrRepository,
  SessionLedger,
  SessionLedgerRow,
} from "@beep/repo-cli/test/Session";
import {
  adoptFleetRegistryRows,
  describeFleetCheckout,
  EMPTY_FLEET_REGISTRY,
  FleetAdoptionCandidate,
  FleetRegistryDocument,
  FleetRegistryRow,
  FleetRegistryStore,
  FleetRegistryStoreLive,
  FleetRootEntry,
  fleetRepositoryFromOriginUrl,
  joinFleetRows,
  loadFleetJoin,
  originUrlFromGitConfig,
  parseFleetRootsPathList,
  registerFleetRegistryRow,
} from "@beep/repo-cli/test/Worktree";
import { CommandJsonOutput } from "@beep/repo-cli-kit/cli/Json";
import { it } from "@beep/test-runner";
import { A, O, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type { FleetSnapshot } from "@beep/repo-cli/commands/Worktree";

const SCAN_TIMEOUT_MILLIS = 120_000;
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown, { space: 2 }));

const platformLayer = Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));
const testLayer = Layer.mergeAll(
  platformLayer,
  FleetMirrorServiceLive.pipe(Layer.provide(platformLayer)),
  FleetRegistryStoreLive.pipe(Layer.provide(platformLayer)),
  layerSessionLedgerMemory
);

const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });

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

const isString = (line: unknown): line is string => typeof line === "string";

const fixtureRoots = (fixture: FleetRootsFixture) =>
  [
    FleetRootEntry.make({ path: fixture.projects, namePrefix: "beep-effect" }),
    FleetRootEntry.make({ path: `${fixture.projects}/beep/seats` }),
    FleetRootEntry.make({ path: `${fixture.projects}/beep/lanes` }),
  ] as const;

const allFleetCheckouts = (fixture: FleetRootsFixture): ReadonlyArray<string> =>
  A.sort(
    [fixture.legacy0, fixture.siblingLane, fixture.legacy1, fixture.nestedLane, fixture.seat, fixture.seatLane],
    Str.Order
  );

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
          expect(text).toMatchFileSnapshot(path.join(__dirname, "fixtures", "fleet-roots", "roots-unset.snapshot.txt"))
        );
      }),
      SCAN_TIMEOUT_MILLIS
    );

    it.effect(
      "roots configured: the three roots list every checkout and skip the unrelated project",
      Effect.fnUntraced(function* () {
        const fixture = yield* acquireFleetRootsFixture;
        const service = yield* FleetMirrorService;
        const checkouts = yield* service.listCheckouts(
          FleetScanOptions.make({
            startFrom: fixture.legacy0,
            originUrl: fixture.originPath,
            roots: fixtureRoots(fixture),
          })
        );

        expect(checkouts).toEqual(allFleetCheckouts(fixture));
        expect(checkouts).not.toContain(fixture.unrelated);
      }),
      SCAN_TIMEOUT_MILLIS
    );

    it.effect(
      "BEEP_FLEET_ROOTS overrides roots.json, and roots.json decodes when the environment is unset",
      Effect.fnUntraced(function* () {
        const fixture = yield* acquireFleetRootsFixture;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const service = yield* FleetMirrorService;
        const stateRoot = path.join(fixture.tmpDir, "fleet-state");
        const stateDir = path.join(stateRoot, "github.com__beep-effect__beep-effect");
        yield* fs.makeDirectory(stateDir, { recursive: true });
        // roots.json names only the seats root; the environment names all three.
        yield* fs.writeFileString(
          path.join(stateDir, "roots.json"),
          `{"schemaVersion":"fleet-roots/v1","roots":[{"path":"${path.join(fixture.projects, "beep", "seats")}"}]}\n`
        );
        // A github.com origin gives the scope its repository key; listing never contacts the remote.
        const githubOrigin = "git@github.com:beep-effect/beep-effect.git";
        for (const clone of [fixture.legacy0, fixture.legacy1, fixture.seat]) {
          yield* fixtureGit(clone, ["remote", "set-url", "origin", githubOrigin]);
        }
        const options = FleetScanOptions.make({ startFrom: fixture.legacy0, originUrl: githubOrigin });
        const withEnv = (env: Record<string, string>) =>
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

        const fromFile = yield* service.roots(options).pipe(withEnv({ BEEP_FLEET_STATE_ROOT: stateRoot }));
        expect(fromFile.source).toBe("file");
        expect(A.map(fromFile.roots, (root) => root.path)).toEqual([path.join(fixture.projects, "beep", "seats")]);
        const fileCheckouts = yield* service.listCheckouts(options).pipe(withEnv({ BEEP_FLEET_STATE_ROOT: stateRoot }));
        expect(fileCheckouts).toEqual([fixture.seatLane, fixture.seat].sort());

        const envList = A.join(
          [
            `${fixture.projects}/beep-effect*`,
            path.join(fixture.projects, "beep", "seats"),
            path.join(fixture.projects, "beep", "lanes"),
          ],
          ":"
        );
        const fromEnv = yield* service
          .roots(options)
          .pipe(withEnv({ BEEP_FLEET_STATE_ROOT: stateRoot, BEEP_FLEET_ROOTS: envList }));
        expect(fromEnv.source).toBe("env");
        expect(fromEnv.roots[0]).toEqual(FleetRootEntry.make({ path: fixture.projects, namePrefix: "beep-effect" }));
        const envCheckouts = yield* service
          .listCheckouts(options)
          .pipe(withEnv({ BEEP_FLEET_STATE_ROOT: stateRoot, BEEP_FLEET_ROOTS: envList }));
        expect(envCheckouts).toEqual(allFleetCheckouts(fixture));

        // An unexpanded `~` (or any relative entry) would resolve against the cwd and shrink the fleet silently.
        const relative = yield* service
          .roots(options)
          .pipe(withEnv({ BEEP_FLEET_STATE_ROOT: stateRoot, BEEP_FLEET_ROOTS: "~/projects/beep/seats" }), Effect.flip);
        expect(relative.message).toContain("absolute");

        yield* fs.writeFileString(path.join(stateDir, "roots.json"), '{"schemaVersion":"fleet-roots/v1","roots":[]}\n');
        const refused = yield* service.roots(options).pipe(withEnv({ BEEP_FLEET_STATE_ROOT: stateRoot }), Effect.flip);
        expect(refused.message).toContain("fleet roots document");
      }),
      SCAN_TIMEOUT_MILLIS
    );

    it.effect(
      "join adopts legacy clones and lanes, reads the ledger, and keeps a registered role across rescans",
      () =>
        TestClock.withLive(
          Effect.gen(function* () {
            const fixture = yield* acquireFleetRootsFixture;
            const path = yield* Path.Path;
            const ledger = yield* SessionLedger;
            const store = yield* FleetRegistryStore;
            const stateRoot = path.join(fixture.tmpDir, "fleet-state");
            const withState = Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({ env: { BEEP_FLEET_STATE_ROOT: stateRoot } })
            );
            const options = FleetScanOptions.make({
              startFrom: fixture.legacy0,
              originUrl: fixture.originPath,
              scannerDir: fixture.scannerDir,
              homeDir: fixture.homeDir,
              roots: fixtureRoots(fixture),
            });
            for (const [recordedAt, state] of [
              [1, "open"],
              [2, "blocked"],
            ] as const) {
              yield* ledger
                .append(
                  SessionLedgerRow.make({
                    schemaVersion: "session-ledger/v1",
                    repository,
                    clone: fixture.legacy0,
                    checkout: fixture.siblingLane,
                    lane: "lane-a",
                    branch: "lane-a",
                    state,
                    next: `step ${recordedAt}`,
                    summary: O.none(),
                    pr: O.some(PrNumber.make(4242)),
                    harness: "claude-code",
                    sessionId: O.none(),
                    recordedAt: DateTime.makeUnsafe(recordedAt),
                  })
                )
                .pipe(Effect.orDie);
            }

            const first = yield* loadFleetJoin(options, repository).pipe(withState);
            expect(A.length(first.adopted)).toBe(6);
            const rows = joinFleetRows({
              checkouts: first.snapshot.checkouts,
              registry: first.registry,
              ledger: first.ledger,
            });
            const byPath = (checkout: string) => O.getOrThrow(A.findFirst(rows, (row) => row.path === checkout));
            expect(A.map(rows, (row) => row.path)).toEqual(allFleetCheckouts(fixture));
            expect(byPath(fixture.legacy0).seatRole).toBe("legacy");
            expect(byPath(fixture.legacy1).seatRole).toBe("legacy");
            expect(byPath(fixture.seat).seatRole).toBe("adopted");
            expect(byPath(fixture.seatLane)).toMatchObject({ seatRole: "adopted", owningSeat: fixture.seat });
            expect(byPath(fixture.nestedLane)).toMatchObject({ seatRole: "adopted", owningSeat: fixture.legacy1 });
            expect(byPath(fixture.siblingLane)).toMatchObject({
              owningSeat: fixture.legacy0,
              drainStatus: "active",
              lane: "lane-a",
              pr: 4242,
              state: "blocked",
            });
            expect(byPath(fixture.legacy0)).toMatchObject({ lane: null, pr: null, state: null });

            const registered = registerFleetRegistryRow(
              first.registry,
              FleetRegistryRow.make({ checkout: fixture.seat, seatRole: "main", retentionExempt: true })
            );
            yield* store.update(repository, () => [registered, undefined] as const).pipe(withState);
            const second = yield* loadFleetJoin(options, repository).pipe(withState);
            expect(second.adopted).toEqual([]);
            const seatRow = O.getOrThrow(A.findFirst(second.registry.rows, (row) => row.checkout === fixture.seat));
            expect(seatRow).toMatchObject({ seatRole: "main", retentionExempt: true });

            // Concurrent writers serialize on the registry lock: neither overwrites the other's row. The test runs on
            // the live clock because the lock's retry pause is a real sleep the test clock would never wake.
            yield* Effect.all(
              [
                store.update(repository, (current) => [
                  registerFleetRegistryRow(
                    current,
                    FleetRegistryRow.make({ checkout: fixture.legacy0, seatRole: "review" })
                  ),
                  undefined,
                ]),
                store.update(repository, (current) => [
                  registerFleetRegistryRow(
                    current,
                    FleetRegistryRow.make({ checkout: fixture.legacy1, seatRole: "impl" })
                  ),
                  undefined,
                ]),
              ],
              { concurrency: "unbounded" }
            ).pipe(withState);
            const [afterRace] = yield* store
              .update(repository, (current) => [current, undefined] as const)
              .pipe(withState);
            const roleOf = (checkout: string) =>
              O.getOrThrow(A.findFirst(afterRace.rows, (row) => row.checkout === checkout)).seatRole;
            expect([roleOf(fixture.legacy0), roleOf(fixture.legacy1), roleOf(fixture.seat)]).toEqual([
              "review",
              "impl",
              "main",
            ]);

            const description = O.getOrThrow(
              describeFleetCheckout({
                checkouts: second.snapshot.checkouts,
                registry: second.registry,
                ledger: second.ledger,
                checkout: fixture.siblingLane,
                ledgerLimit: 1,
              })
            );
            expect(description.checkout.path).toBe(fixture.siblingLane);
            expect(description.registry.owningSeat).toBe(fixture.legacy0);
            expect(A.map(description.ledger, (row) => row.next)).toEqual(["step 2"]);
          })
        ),
      SCAN_TIMEOUT_MILLIS
    );

    it.effect(
      "join, describe and register views print the joined fleet and author registry rows",
      () =>
        TestClock.withLive(
          Effect.gen(function* () {
            const fixture = yield* acquireFleetRootsFixture;
            const path = yield* Path.Path;
            const ledger = yield* SessionLedger;
            const stateRoot = path.join(fixture.tmpDir, "fleet-state");
            const json: Array<string> = [];
            const capture = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
              effect.pipe(
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromEnv({ env: { BEEP_FLEET_STATE_ROOT: stateRoot } })
                ),
                Effect.provideService(CommandJsonOutput, (text: string) => Effect.sync(() => json.push(text)))
              );
            const options = FleetScanOptions.make({
              startFrom: fixture.legacy0,
              originUrl: fixture.originPath,
              scannerDir: fixture.scannerDir,
              homeDir: fixture.homeDir,
              roots: fixtureRoots(fixture),
            });
            yield* ledger
              .append(
                SessionLedgerRow.make({
                  schemaVersion: "session-ledger/v1",
                  repository,
                  clone: fixture.legacy0,
                  checkout: fixture.siblingLane,
                  lane: "lane-a",
                  branch: "lane-a",
                  state: "open",
                  next: "finish lane-a",
                  summary: O.none(),
                  pr: O.some(PrNumber.make(77)),
                  harness: "claude-code",
                  sessionId: O.none(),
                  recordedAt: DateTime.makeUnsafe(5),
                })
              )
              .pipe(Effect.orDie);

            yield* capture(printFleetJoin(options, repository, false));
            const joinLines = yield* TestConsole.logLines;
            const joinText = A.join(A.filter(joinLines, isString), "\n");
            expect(joinText).toContain("Fleet roots: ");
            expect(joinText).toContain("(option)");
            expect(joinText).toContain("6 row(s); 6 adopted by this scan");
            expect(joinText).toContain(`- ${fixture.siblingLane} [linked-worktree] lane-a`);
            expect(joinText).toContain(`seat=${fixture.legacy0} drain=active  lane=lane-a pr=#77 state=open`);
            expect(joinText).toContain(`- ${fixture.legacy0} [clone] main`);
            expect(joinText).toContain("role=legacy seat=- drain=active  lane=- pr=- state=-");

            yield* capture(printFleetJoin(options, repository, true));
            const joinedJson = json[0] ?? "";
            for (const checkout of allFleetCheckouts(fixture)) {
              expect(joinedJson).toContain(`"path":"${checkout}"`);
            }

            yield* capture(
              registerFleetCheckout(options, repository, {
                checkout: fixture.seat,
                role: "main",
                owningSeat: O.none(),
                retentionExempt: true,
              })
            );
            yield* capture(
              registerFleetCheckout(options, repository, {
                checkout: `${fixture.seatLane}/`,
                role: "impl",
                owningSeat: O.some(fixture.seat),
                retentionExempt: false,
              })
            );
            const refused = yield* capture(
              registerFleetCheckout(options, repository, {
                checkout: fixture.unrelated,
                role: "review",
                owningSeat: O.none(),
                retentionExempt: false,
              })
            ).pipe(Effect.flip);
            expect(refused.message).toContain("register only a checkout the fleet discovers");

            yield* capture(
              printFleetCheckoutDescription(options, repository, { checkout: fixture.seat, ledgerRows: 5, json: false })
            );
            yield* capture(
              printFleetCheckoutDescription(options, repository, {
                checkout: fixture.siblingLane,
                ledgerRows: 5,
                json: false,
              })
            );
            yield* capture(
              printFleetCheckoutDescription(options, repository, {
                checkout: fixture.seatLane,
                ledgerRows: 1,
                json: true,
              })
            );
            const lines = yield* TestConsole.logLines;
            const all = A.join(A.filter(lines, isString), "\n");
            expect(all).toContain(`Registered ${fixture.seat}: role=main seat=-`);
            expect(all).toContain(`Registered ${fixture.seatLane}: role=impl seat=${fixture.seat}`);
            expect(all).toContain("registry: role=main seat=- drain=active retention-exempt=true");
            expect(all).toContain("ledger (1 newest):");
            expect(all).toContain("open lane=lane-a branch=lane-a pr=#77 next: finish lane-a");
            const describedJson = json[1] ?? "";
            expect(describedJson).toContain('"seatRole":"impl"');
            expect(describedJson).toContain(`"owningSeat":"${fixture.seat}"`);

            const missing = yield* capture(
              printFleetCheckoutDescription(options, repository, {
                checkout: fixture.unrelated,
                ledgerRows: 5,
                json: false,
              })
            ).pipe(Effect.flip);
            expect(missing.message).toContain("No fleet checkout at");
          }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
        ),
      SCAN_TIMEOUT_MILLIS
    );

    it.effect(
      "store reads the registry and refuses an update while another owner holds the registry lock",
      () =>
        TestClock.withLive(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const store = yield* FleetRegistryStore;
            const stateRoot = yield* fs.makeTempDirectoryScoped();
            const withState = Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({ env: { BEEP_FLEET_STATE_ROOT: stateRoot } })
            );
            // A registry that was never written reads as the empty document.
            const empty = yield* store.read(repository).pipe(withState);
            expect(empty.rows).toEqual([]);
            yield* store
              .update(repository, (current) => [
                registerFleetRegistryRow(
                  current,
                  FleetRegistryRow.make({ checkout: "/p/beep/seats/main", seatRole: "main" })
                ),
                undefined,
              ])
              .pipe(withState);
            const written = yield* store.read(repository).pipe(withState);
            expect(A.map(written.rows, (row) => row.seatRole)).toEqual(["main"]);

            const lockPath = path.join(stateRoot, "github.com__beep-effect__beep-effect", "registry.json.lock");
            const held = yield* acquireJournalFileLock(lockPath, "other-owner");
            expect(held).toBe(true);
            const refused = yield* store
              .update(repository, (current) => [current, undefined])
              .pipe(withState, Effect.flip, Effect.ensuring(releaseJournalFileLock(lockPath, "other-owner")));
            expect(refused.message).toContain("Timed out waiting for the fleet registry lock");
          })
        ),
      SCAN_TIMEOUT_MILLIS
    );
  });
});

describe("fleet roots and registry documents", () => {
  it("falls back to an adopted row for a mirror checkout the registry does not know", () => {
    const checkout = FleetCheckout.make({
      path: "/p/beep/lanes/unregistered",
      kind: "linked-worktree",
      branch: null,
      detached: true,
      head: null,
      dirtyCount: null,
      mergeBase: null,
      branchDiffCount: null,
      liveness: "unknown",
      livenessEvidence: [],
      conflict: "unknown",
      conflictReason: "head-unknown",
      conflictPaths: [],
      policyMovement: "unknown",
      policyReason: "head-unknown",
      policyPaths: [],
    });
    const [joined] = joinFleetRows({ checkouts: [checkout], registry: EMPTY_FLEET_REGISTRY, ledger: [] });
    expect(joined).toMatchObject({ seatRole: "adopted", owningSeat: null, drainStatus: "active", lane: null });
    const described = O.getOrThrow(
      describeFleetCheckout({
        checkouts: [checkout],
        registry: EMPTY_FLEET_REGISTRY,
        ledger: [],
        checkout: checkout.path,
        ledgerLimit: 5,
      })
    );
    expect(described.registry).toMatchObject({ checkout: checkout.path, seatRole: "adopted" });
    expect(described.ledger).toEqual([]);
  });
  it("parses a BEEP_FLEET_ROOTS path list, prefix entries included", () => {
    const roots = O.getOrThrow(parseFleetRootsPathList(" /p/beep-effect* : /p/beep/seats ::/p/beep/lanes "));
    expect(roots).toEqual([
      FleetRootEntry.make({ path: "/p", namePrefix: "beep-effect" }),
      FleetRootEntry.make({ path: "/p/beep/seats" }),
      FleetRootEntry.make({ path: "/p/beep/lanes" }),
    ]);
    expect(O.isNone(parseFleetRootsPathList(" : "))).toBe(true);
  });

  it("reads the origin URL from git config text and keys github remotes in either spelling", () => {
    const config =
      '[core]\n\tbare = false\n[remote "upstream"]\n\turl = git@github.com:other/repo.git\n' +
      '[remote "origin"]\n\turl = https://github.com/Beep-Effect/beep-effect.git\n\tfetch = +refs/heads/*\n';
    const url = O.getOrThrow(originUrlFromGitConfig(config));
    expect(url).toBe("https://github.com/Beep-Effect/beep-effect.git");
    const https = O.getOrThrow(fleetRepositoryFromOriginUrl(url));
    const scp = O.getOrThrow(fleetRepositoryFromOriginUrl("git@github.com:beep-effect/beep-effect.git"));
    expect({ ...https }).toEqual({ ...scp });
    expect(O.isNone(fleetRepositoryFromOriginUrl("/srv/git/beep-effect.git"))).toBe(true);
  });

  it.effect(
    "decodes hand-authored registry rows with defaults and adopts idempotently",
    Effect.fnUntraced(function* () {
      const decodeRegistry = S.decodeUnknownEffect(FleetRegistryDocument);
      const document = yield* decodeRegistry({
        schemaVersion: "fleet-registry/v1",
        rows: [{ checkout: "/p/beep/seats/main", seatRole: "main" }],
      });
      expect(document.rows[0]).toMatchObject({ owningSeat: null, drainStatus: "active", retentionExempt: false });
      const refused = yield* Effect.flip(
        decodeRegistry({ schemaVersion: "fleet-registry/v1", rows: [{ checkout: "/p/x", seatRole: "a" }] })
      );
      expect(S.isSchemaError(refused)).toBe(true);

      const candidates = [
        FleetAdoptionCandidate.make({ checkout: "/p/beep/seats/main", role: "adopted", owningSeat: null }),
        FleetAdoptionCandidate.make({ checkout: "/p/beep/lanes/x", role: "adopted", owningSeat: "/p/beep/seats/main" }),
      ];
      const once = adoptFleetRegistryRows(document, candidates);
      expect(A.map(once.adopted, (row) => row.checkout)).toEqual(["/p/beep/lanes/x"]);
      expect(A.map(once.document.rows, (row) => [row.checkout, row.seatRole])).toEqual([
        ["/p/beep/lanes/x", "adopted"],
        ["/p/beep/seats/main", "main"],
      ]);
      const twice = adoptFleetRegistryRows(once.document, candidates);
      expect(twice.adopted).toEqual([]);
      expect(twice.document).toEqual(once.document);
      // Adoption never deletes a row for a checkout the scan stopped seeing.
      expect(adoptFleetRegistryRows(once.document, []).document.rows).toHaveLength(2);
      expect(EMPTY_FLEET_REGISTRY.rows).toEqual([]);
    })
  );
});
