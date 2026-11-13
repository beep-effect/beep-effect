// PERIL-11 slice 2 admission gate: `yeet economics --fleet` counts a lane under
// a T3 Code worktree root through its `roots.json` row, once, and reads a
// checkout reachable through two roots (a symlinked alias of the T3 root, or a
// nested lane listed under the clone and under its own root) only once. The
// fixture lives on an in-memory volume; nothing touches a real home, state
// directory or worktree.
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import { FleetRootEntry, FleetRootsDocument } from "@beep/repo-cli/test/Worktree";
import {
  buildYeetEconomicsReport,
  EconomicsScope,
  EconomicsScopeRequest,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetAttemptTerminated,
  YeetEconomicsSource,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const ORIGIN = "git@github.com:beep-effect/beep-effect.git";
const REPO_KEY = "github.com__beep-effect__beep-effect";

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));
const encodeRoots = S.encodeUnknownEffect(S.fromJsonString(FleetRootsDocument));

const LiveSource = Layer.provideMerge(
  YeetEconomicsSource.layer,
  Layer.mergeAll(MemoryFileSystem.layer, Path.layer, Digest.layerWebCrypto)
);

const attemptId = (suffix: number): UUID => UUID.make(`7c9f5b1e-2d4a-4f6b-9a8c-${Str.padStart(12, "0")(`${suffix}`)}`);

const interruptedAttempt = (id: UUID, runId: string): ReadonlyArray<YeetAttemptJournalEvent> => [
  YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId: id,
    runId,
    branch: runId,
    base: "origin/main",
    head: "HEAD",
    mode: "verify",
    startedAt: "2026-11-13T00:00:00.000Z",
  }),
  YeetAttemptTerminated.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-terminated",
    attemptId: id,
    recordedAt: "2026-11-13T00:05:00.000Z",
    reason: "interrupted",
  }),
];

const writeJournal = Effect.fnUntraced(function* (checkout: string, runId: string, id: UUID) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(checkout, ".beep", "yeet", "runs", runId);
  yield* fs.makeDirectory(directory, { recursive: true });
  const lines = yield* Effect.forEach(interruptedAttempt(id, runId), (event) => encodeEvent(event));
  yield* fs.writeFileString(path.join(directory, "attempts.ndjson"), `${A.join(lines, "\n")}\n`);
});

const writeClone = Effect.fnUntraced(function* (clone: string, origin: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(clone, ".git", "worktrees"), { recursive: true });
  yield* fs.writeFileString(
    path.join(clone, ".git", "config"),
    `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${origin}\n`
  );
});

// A linked worktree: its `.git` file names `<clone>/.git/worktrees/<name>`.
const writeLinkedLane = Effect.fnUntraced(function* (clone: string, lane: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const gitDir = path.join(clone, ".git", "worktrees", path.basename(lane));
  yield* fs.makeDirectory(gitDir, { recursive: true });
  yield* fs.makeDirectory(lane, { recursive: true });
  yield* fs.writeFileString(path.join(lane, ".git"), `gitdir: ${gitDir}\n`);
});

const readFleet = Effect.fnUntraced(function* (repoRoot: string, env: Record<string, string>) {
  const source = yield* YeetEconomicsSource;
  return yield* source
    .read(EconomicsScopeRequest.make({ repoRoot, branch: O.none(), fleet: true }))
    .pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })));
});

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics fleet roots", (layerIt) => {
  layerIt.effect("counts a T3 lane through its roots.json row once, through every alias", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-t3-roots-" });
      const projects = path.join(root, "projects");
      const home = path.join(root, "home");
      const clone = path.join(projects, "beep-effect");
      const t3Root = path.join(home, ".t3", "worktrees", "beep-effect");
      const t3Lane = path.join(t3Root, "t3-lane");
      const nestedRoot = path.join(clone, ".claude", "worktrees");
      const nestedLane = path.join(nestedRoot, "nested-lane");
      const alias = path.join(home, "t3-alias");

      yield* writeClone(clone, ORIGIN);
      yield* writeJournal(clone, "run-clone", attemptId(1));
      yield* writeLinkedLane(clone, t3Lane);
      yield* writeJournal(t3Lane, "run-t3", attemptId(2));
      yield* writeLinkedLane(clone, nestedLane);
      yield* writeJournal(nestedLane, "run-nested", attemptId(3));
      // A T3 lane of another repository sits under the same root and is skipped by origin.
      const other = path.join(projects, "other");
      yield* writeClone(other, "git@github.com:acme/other.git");
      yield* writeLinkedLane(other, path.join(t3Root, "foreign-lane"));
      yield* writeJournal(path.join(t3Root, "foreign-lane"), "run-foreign", attemptId(4));
      yield* fs.symlink(t3Root, alias);

      // The T3 root, then the same lanes through a symlinked alias, then the
      // clone's nested lanes as a root of their own.
      const document = FleetRootsDocument.make({
        schemaVersion: "fleet-roots/v1",
        roots: [
          FleetRootEntry.make({ path: projects, namePrefix: "beep-effect" }),
          FleetRootEntry.make({ path: t3Root }),
          FleetRootEntry.make({ path: alias }),
          FleetRootEntry.make({ path: nestedRoot }),
        ],
      });
      const fleetState = path.join(root, "state", "fleet");
      yield* fs.makeDirectory(path.join(fleetState, REPO_KEY), { recursive: true });
      const rootsJson = yield* encodeRoots(document);
      yield* fs.writeFileString(path.join(fleetState, REPO_KEY, "roots.json"), rootsJson);
      const env = {
        BEEP_FLEET_STATE_ROOT: fleetState,
        BEEP_YEET_STATE_ROOT: path.join(root, "state", "yeet"),
        HOME: home,
      };

      const configured = yield* readFleet(clone, env);
      deepStrictEqual(
        A.map(configured, (journal) => [journal.checkout, journal.runId]),
        [
          ["../home/.t3/worktrees/beep-effect/t3-lane", "run-t3"],
          ["beep-effect", "run-clone"],
          ["beep-effect/.claude/worktrees/nested-lane", "run-nested"],
        ]
      );
      // Invoked from inside the T3 lane, the same three checkouts, each once.
      const fromLane = yield* readFleet(t3Lane, env);
      deepStrictEqual(
        A.map(fromLane, (journal) => journal.runId),
        ["run-t3", "run-clone", "run-nested"]
      );
      const report = buildYeetEconomicsReport(
        configured,
        EconomicsScope.make({
          kind: "fleet",
          checkouts: A.map(configured, (journal) => journal.checkout),
          branch: O.none(),
        }),
        DateTime.makeUnsafe("2026-11-14T00:00:00.000Z"),
        []
      );
      deepStrictEqual(
        [report.terminations.starts, report.dataQuality.diagnostics.finishedAttempts, report.attempts.all.classMix],
        [3, 3, [{ key: "terminated", count: 3 }]]
      );

      // Without a roots list the derived projects root is read, and the T3 lane is not.
      const derived = yield* readFleet(clone, { ...env, BEEP_FLEET_STATE_ROOT: path.join(root, "state", "none") });
      deepStrictEqual(
        A.map(derived, (journal) => journal.runId),
        ["run-clone", "run-nested"]
      );
    })
  );
});
