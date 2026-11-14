import { Git } from "@beep/git/Git";
import {
  HISTORY_NOTES_FETCH_REFSPEC,
  HistoryNotes,
  HistoryNotesCheckOptions,
  HistoryNotesLive,
  HistoryNotesWriteError,
  HistoryNotesWriteOptions,
  historyNotesCheckProblems,
} from "@beep/repo-cli/commands/History";
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const MAP_PATH = "docs/history/commit-message-map.json";
const encodeMap = S.encodeEffect(S.fromJsonString(S.Record(S.String, S.String)));

/** Every git spawn, the service's and the fixture's, runs without the host's global or system config. */
const IsolatedSpawner = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  Effect.gen(function* () {
    const real = yield* ChildProcessSpawner.ChildProcessSpawner;
    // Own double: decorates the real platform spawner, adding the isolated git config to every spawn.
    // biome-ignore lint/plugin/no-unrecorded-spawner-double: Own double, reason above
    return ChildProcessSpawner.make((command) =>
      real.spawn(ChildProcess.setEnv(command, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" }))
    );
  })
).pipe(Layer.provideMerge(NodeServices.layer));

const TestLayer = HistoryNotesLive.pipe(Layer.provideMerge(Git.layer), Layer.provideMerge(IsolatedSpawner));

/** Runs a fixture git command and answers its trimmed stdout; a non-zero exit dies. */
const raw = Effect.fnUntraced(function* (cwd: string, ...args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(
      "git",
      [
        "-c",
        "user.name=History Fixture",
        "-c",
        "user.email=history@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, extendEnv: true }
    )
  );
  const [stdout, exitCode] = yield* Effect.all(
    [handle.stdout.pipe(Stream.decodeText, Stream.mkString), handle.exitCode],
    {
      concurrency: "unbounded",
    }
  );
  assert.strictEqual(exitCode, 0, `git ${A.join(args, " ")} exited ${exitCode}`);
  return stdout;
}, Effect.orDie);

/** An origin with three commits on main, and a clone of it whose map names the first two. */
const fixture = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "history-notes-git-" });
  const origin = path.join(root, "origin");
  const work = path.join(root, "work");
  yield* fs.makeDirectory(origin);
  yield* raw(origin, "init", "--quiet", "--template=", "--initial-branch=main", ".");
  for (const subject of ["saving", "updated deps", "merged in main"]) {
    yield* raw(origin, "commit", "--quiet", "--allow-empty", "-m", subject);
  }
  yield* raw(root, "clone", "--quiet", "--template=", origin, work);
  const listed = yield* raw(work, "rev-list", "--reverse", "origin/main");
  const [first = "", second = "", third = ""] = A.filter(Str.split("\n")(listed), Str.isNonEmpty);
  const rows = {
    [first]: "chore(repo): checkpoint work\n",
    [second]: "build(deps): bump dependencies\n\nBody line.\n",
  };
  const text = yield* encodeMap(rows);
  yield* fs.makeDirectory(path.join(work, "docs", "history"), { recursive: true });
  yield* fs.writeFileString(path.join(work, MAP_PATH), text);
  return { origin, work, first, second, third };
});

it.layer(TestLayer, { timeout: "60 seconds" })("history notes over real git", (it) => {
  it.effect("--write is reproducible, shown by git log, and passes --check", () =>
    Effect.gen(function* () {
      const { work, first, second } = yield* fixture();
      const history = yield* HistoryNotes;
      const options = HistoryNotesWriteOptions.make({
        root: work,
        mapPath: MAP_PATH,
        ref: "refs/notes/history",
        base: "origin/main",
      });

      const written = yield* history.write(options);
      assert.isTrue(written.changed);
      const again = yield* history.write(options);
      assert.isFalse(again.changed);
      assert.strictEqual(again.commit, written.commit);
      assert.strictEqual(again.tree, written.tree);

      const shown = yield* raw(work, "log", "-1", "--notes=history", "--format=%N", second);
      assert.strictEqual(shown, "build(deps): bump dependencies\n\nBody line.\n\n");
      const firstNote = yield* raw(work, "notes", "--ref=history", "show", first);
      assert.strictEqual(firstNote, "chore(repo): checkpoint work\n");

      const report = yield* history.check(
        HistoryNotesCheckOptions.make({
          root: work,
          mapPath: MAP_PATH,
          ref: "refs/notes/history",
          base: "origin/main",
          requirePublished: true,
        })
      );
      assert.strictEqual(report.matching, 2);
      assert.deepStrictEqual(historyNotesCheckProblems(report), []);
    })
  );

  it.effect("--write refuses an unreachable key and leaves the ref alone", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { work, first } = yield* fixture();
      const text = yield* encodeMap({ [first]: "chore: one\n", [Str.repeat(40)("f")]: "chore: ghost\n" });
      yield* fs.writeFileString(path.join(work, MAP_PATH), text);
      const history = yield* HistoryNotes;
      const failure = yield* Effect.flip(
        history.write(
          HistoryNotesWriteOptions.make({
            root: work,
            mapPath: MAP_PATH,
            ref: "refs/notes/history",
            base: "origin/main",
          })
        )
      );
      assertInstanceOf(failure, HistoryNotesWriteError);
      const refs = yield* raw(work, "for-each-ref", "refs/notes/");
      assert.strictEqual(refs, "");
    })
  );

  it.effect("sync configures once, tolerates an unpublished ref, then fetches and displays it", () =>
    Effect.gen(function* () {
      const { origin, work, third } = yield* fixture();
      const history = yield* HistoryNotes;

      const firstSync = yield* history.sync({ root: work, fetch: true });
      assert.deepStrictEqual(
        [firstSync.origin, firstSync.fetchRefspec, firstSync.displayRef, firstSync.fetch],
        [true, "added", "added", "unpublished"]
      );
      const secondSync = yield* history.sync({ root: work, fetch: false });
      assert.deepStrictEqual(
        [secondSync.fetchRefspec, secondSync.displayRef, secondSync.fetch],
        ["present", "present", "skipped"]
      );
      const fetchSpecs = yield* raw(work, "config", "--get-all", "remote.origin.fetch");
      assert.strictEqual(
        A.filter(Str.split("\n")(fetchSpecs), (spec) => spec === HISTORY_NOTES_FETCH_REFSPEC).length,
        1
      );
      const displayRefs = yield* raw(work, "config", "--get-all", "notes.displayRef");
      assert.strictEqual(displayRefs, "refs/notes/history\n");

      yield* raw(origin, "notes", "--ref=refs/notes/history", "add", "-m", "chore(repo): merge main", third);
      const thirdSync = yield* history.sync({ root: work, fetch: true });
      assert.strictEqual(thirdSync.fetch, "fetched");
      // No --notes flag: the configured notes.displayRef alone makes git log show the overlay.
      const log = yield* raw(work, "log", "-1", third);
      assert.isTrue(Str.includes("Notes (history):\n    chore(repo): merge main")(log));
    })
  );
});
