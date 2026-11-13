import { TestTerminal } from "@beep/cli-kit/testing";
import { Git, GitCommandError, UnknownRefError } from "@beep/git/Git";
import {
  HISTORY_COMMIT_MESSAGE_MAP_PATH,
  HistoryNotesCheckError,
  historyCommand,
} from "@beep/repo-cli/commands/History";
import { assert, describe, it } from "@effect/vitest";
import { assertExitSuccess, assertInstanceOf, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { GitStubs } from "@beep/git/Git";

const runHistory = Command.runWith(historyCommand, { version: "0.0.0" });
const COMMIT = Str.repeat(40)("c");
const TREE = Str.repeat(40)("d");

const KEYS = [Str.repeat(40)("a"), Str.repeat(40)("b")];
const MAP_TEXT = `{"${KEYS[0]}":"chore(repo): checkpoint work\\n","${KEYS[1]}":"build(deps): bump dependencies\\n"}`;

/** An in-memory checkout: every directory looks like a repository root and the map holds two rows. */
const MemoryFileSystem = FileSystem.layerNoop({
  exists: (file) => Effect.succeed(Str.endsWith("/.git")(file)),
  readFileString: (file) =>
    Str.endsWith(HISTORY_COMMIT_MESSAGE_MAP_PATH)(file)
      ? Effect.succeed(MAP_TEXT)
      : Effect.fail(
          PlatformError.systemError({
            _tag: "NotFound",
            module: "HistoryCommandTest",
            method: "readFileString",
            pathOrDescriptor: file,
          })
        ),
});

/** The command spawns nothing itself: every git call goes through the stubbed `Git`. */
// Own double: dies on any spawn, so a git call that bypasses the stubbed `Git` fails loudly;
// `ScriptedSpawner` records and answers every spawn instead.
const NoSpawner = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(() => Effect.die("history command tests spawn no processes"))
);

/** Runs `beep history <argv>` over the in-memory checkout, a stubbed `Git`, and a fresh capturing console. */
const run = Effect.fnUntraced(function* (argv: ReadonlyArray<string>, stubs: Partial<GitStubs>) {
  const terminal = yield* TestTerminal.make();
  const context = yield* Layer.build(
    Layer.mergeAll(
      MemoryFileSystem,
      Path.layer,
      Layer.fresh(TestConsole.layer),
      Git.layerTest(stubs),
      terminal.layer,
      Stdio.layerTest({}),
      NoSpawner
    )
  );
  const exit = yield* runHistory(argv).pipe(Effect.exit, Effect.provideContext(context));
  const lines = yield* TestConsole.logLines.pipe(Effect.provideContext(context));
  return { exit, lines: A.map(lines, String) };
});

const unpublished = (keys: ReadonlyArray<string>): Partial<GitStubs> => ({
  isShallow: () => Effect.succeed(false),
  revList: () => Effect.succeed(keys),
  refExists: () => Effect.succeed(false),
});

describe("beep history notes", () => {
  it.effect("without a mode prints the available modes", () =>
    Effect.gen(function* () {
      const { exit, lines } = yield* run(["notes"], {});
      assertExitSuccess(exit, undefined);
      assert.deepStrictEqual(lines, ["History notes modes: --check, --write, sync"]);
    })
  );

  it.effect("the group alone prints its subcommands", () =>
    Effect.gen(function* () {
      const { lines } = yield* run([], {});
      assert.deepStrictEqual(lines, ["History commands: notes"]);
    })
  );

  it.effect("--check passes with a notice when the ref is unpublished", () =>
    Effect.gen(function* () {
      const keys = KEYS;
      const { exit, lines } = yield* run(["notes", "--check"], unpublished(keys));
      assertExitSuccess(exit, undefined);
      assertSome(A.last(lines), "result: ok");
    })
  );

  it.effect("--check --require-published fails with HistoryNotesCheckError after printing the summary", () =>
    Effect.gen(function* () {
      const keys = KEYS;
      const { exit, lines } = yield* run(["notes", "--check", "--require-published"], unpublished(keys));
      const failure = yield* Effect.flip(exit);
      assertInstanceOf(failure, HistoryNotesCheckError);
      assert.include(failure.message, "refs/notes/history is not published");
      assert.include(lines, "result: failed (refs/notes/history is not published)");
    })
  );

  it.effect("--check together with --write is refused", () =>
    Effect.gen(function* () {
      const { exit } = yield* run(["notes", "--check", "--write"], {});
      const failure = yield* Effect.flip(exit);
      assertInstanceOf(failure, HistoryNotesCheckError);
      assert.strictEqual(failure.message, "Choose --check or --write, not both.");
    })
  );

  it.effect("--write prints the new commit and tree of the rebuilt ref", () =>
    Effect.gen(function* () {
      const keys = KEYS;
      const written: Array<number> = [];
      const { exit, lines } = yield* run(["notes", "--write", "--ref", "refs/notes/history-test"], {
        ...unpublished(keys),
        replaceNotes: (_cwd, _ref, notes) => Effect.sync(() => written.push(notes.length)).pipe(Effect.as(COMMIT)),
        revParse: () => Effect.succeed(TREE),
      });
      assertExitSuccess(exit, undefined);
      assert.deepStrictEqual(written, [keys.length]);
      assert.deepStrictEqual(lines, [
        `history notes write: refs/notes/history-test updated (${keys.length} notes)`,
        `  commit: ${COMMIT}`,
        `  tree: ${TREE}`,
        "  previous: (none)",
      ]);
    })
  );

  it.effect("sync fetches and reports each config value", () =>
    Effect.gen(function* () {
      const { exit, lines } = yield* run(["notes", "sync"], {
        remoteUrl: () => Effect.succeedSome("git@example.com:repo.git"),
        configGetAll: () => Effect.succeed([]),
        configSet: () => Effect.void,
        fetch: () => Effect.void,
      });
      assertExitSuccess(exit, undefined);
      assert.deepStrictEqual(lines, [
        "history notes sync:",
        "  remote.origin.fetch +refs/notes/history:refs/notes/history: added",
        "  notes.displayRef refs/notes/history: added",
        "  fetch: fetched refs/notes/history from origin",
      ]);
    })
  );

  it.effect("sync reports an unpublished remote ref as a notice", () =>
    Effect.gen(function* () {
      const { exit, lines } = yield* run(["notes", "sync"], {
        remoteUrl: () => Effect.succeedSome("git@example.com:repo.git"),
        configGetAll: (_cwd, key) =>
          Effect.succeed(
            key === "notes.displayRef" ? ["refs/notes/history"] : ["+refs/notes/history:refs/notes/history"]
          ),
        fetch: (cwd, options) => Effect.fail(UnknownRefError.make({ cwd, ref: options.ref ?? "" })),
      });
      assertExitSuccess(exit, undefined);
      assert.include(lines, "  fetch: origin has not published refs/notes/history yet");
      assert.include(lines, "  notes.displayRef refs/notes/history: present");
    })
  );

  it.effect("sync --no-fetch configures without fetching", () =>
    Effect.gen(function* () {
      const fetched: Array<string> = [];
      const { lines } = yield* run(["notes", "sync", "--no-fetch"], {
        remoteUrl: () => Effect.succeedSome("git@example.com:repo.git"),
        configGetAll: () => Effect.succeed([]),
        configSet: () => Effect.void,
        fetch: (cwd) =>
          Effect.fail(GitCommandError.make({ kind: "failed", args: ["fetch"], cwd, stderr: "must not fetch" })).pipe(
            Effect.tap(() => Effect.sync(() => fetched.push(cwd)))
          ),
      });
      assert.deepStrictEqual(fetched, []);
      assert.include(lines, "  fetch: skipped");
    })
  );
});
