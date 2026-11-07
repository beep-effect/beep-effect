import { HistoryGitError, HistoryNotes, HistoryNotesSyncReport } from "@beep/repo-cli/commands/History";
import { syncHistoryNotesConfig } from "@beep/repo-cli/commands/Worktree";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestConsole from "effect/testing/TestConsole";

type SyncOptions = Parameters<HistoryNotes["Service"]["sync"]>[0];

const unused = Effect.fn("HistoryNotesStub.unused")(function* () {
  return yield* Effect.die("the worktree hook only syncs");
});

const runHook = Effect.fnUntraced(function* (sync: HistoryNotes["Service"]["sync"]) {
  const layer = Layer.merge(
    Layer.succeed(HistoryNotes, HistoryNotes.of({ check: unused, write: unused, sync })),
    Layer.fresh(TestConsole.layer)
  );
  const program = Effect.gen(function* () {
    yield* syncHistoryNotesConfig("/lane");
    return yield* TestConsole.logLines;
  });
  return yield* Layer.build(layer).pipe(Effect.flatMap((context) => Effect.provideContext(program, context)));
});

describe("syncHistoryNotesConfig", () => {
  it.effect("configures without fetching and logs the sync report", () =>
    Effect.gen(function* () {
      const calls: Array<SyncOptions> = [];
      const lines = yield* runHook(
        Effect.fn("HistoryNotesStub.sync")(function* (options: SyncOptions) {
          calls.push(options);
          return HistoryNotesSyncReport.make({
            origin: true,
            fetchRefspec: "added",
            displayRef: "added",
            fetch: "skipped",
          });
        })
      );
      assert.deepStrictEqual(calls, [{ root: "/lane", fetch: false }]);
      assert.isAbove(lines.length, 0);
    })
  );

  it.effect("turns a sync failure into a warning and still succeeds", () =>
    Effect.gen(function* () {
      const lines = yield* runHook(
        Effect.fn("HistoryNotesStub.syncFails")(function* () {
          return yield* HistoryGitError.make({ operation: "config", message: "config is locked" });
        })
      );
      assert.deepStrictEqual(lines, []);
    })
  );
});
