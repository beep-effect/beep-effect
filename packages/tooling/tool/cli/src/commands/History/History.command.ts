/**
 * Operator commands for the commit-message overlay on `refs/notes/history`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { HistoryNotesCheckError } from "./History.errors.ts";
import {
  HISTORY_COMMIT_MESSAGE_MAP_PATH,
  HISTORY_NOTES_REF,
  HistoryNotesCheckOptions,
  HistoryNotesWriteOptions,
} from "./History.schemas.ts";
import {
  HistoryNotes,
  HistoryNotesLive,
  historyNotesCheckProblems,
  renderHistoryNotesCheck,
  renderHistoryNotesSync,
  renderHistoryNotesWrite,
} from "./History.service.ts";

const refFlag = Flag.String("ref").pipe(
  Flag.withDefault(HISTORY_NOTES_REF),
  Flag.withDescription("Notes ref to check or rebuild from the map")
);
const baseFlag = Flag.String("base").pipe(
  Flag.withDefault("origin/main"),
  Flag.withDescription("Ref every map key must be reachable from")
);

const runCheck = Effect.fn("History.notes.check")(function* (ref: string, base: string, requirePublished: boolean) {
  const root = yield* findRepoRoot();
  const history = yield* HistoryNotes;
  const report = yield* history.check(
    HistoryNotesCheckOptions.make({ root, mapPath: HISTORY_COMMIT_MESSAGE_MAP_PATH, ref, base, requirePublished })
  );
  yield* printLines(renderHistoryNotesCheck(report));
  const problems = historyNotesCheckProblems(report);
  if (A.isReadonlyArrayNonEmpty(problems))
    return yield* HistoryNotesCheckError.make({ message: `history notes check failed: ${A.join(problems, "; ")}` });
});

const runWrite = Effect.fn("History.notes.write")(function* (ref: string, base: string) {
  const root = yield* findRepoRoot();
  const history = yield* HistoryNotes;
  const report = yield* history.write(
    HistoryNotesWriteOptions.make({ root, mapPath: HISTORY_COMMIT_MESSAGE_MAP_PATH, ref, base })
  );
  yield* printLines(renderHistoryNotesWrite(report));
});

const syncCommand = Command.make(
  "sync",
  {
    noFetch: Flag.Boolean("no-fetch").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Only configure the fetch refspec and display ref; do not fetch")
    ),
  },
  Effect.fn("History.notes.sync")(function* ({ noFetch }) {
    const root = yield* findRepoRoot();
    const history = yield* HistoryNotes;
    const report = yield* history.sync({ root, fetch: !noFetch });
    yield* printLines(renderHistoryNotesSync(report));
  })
).pipe(
  Command.withDescription("Configure this clone to fetch and display refs/notes/history, then fetch it"),
  Command.provide(HistoryNotesLive)
);

const notesCommand = Command.make(
  "notes",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Validate the map and compare it with the local notes ref (read-only)")
    ),
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Rebuild the notes ref from the map as one reproducible commit")
    ),
    ref: refFlag,
    base: baseFlag,
    requirePublished: Flag.Boolean("require-published").pipe(
      Flag.withDefault(false),
      Flag.withDescription("With --check, fail when the notes ref does not exist locally")
    ),
  },
  Effect.fn("History.notes")(function* ({ check, write, ref, base, requirePublished }) {
    if (check && write) return yield* HistoryNotesCheckError.make({ message: "Choose --check or --write, not both." });
    if (write) return yield* runWrite(ref, base);
    if (check) return yield* runCheck(ref, base, requirePublished);
    return yield* Console.log("History notes modes: --check, --write, sync");
  })
).pipe(
  Command.withDescription("Check or rebuild refs/notes/history from the commit-message map"),
  Command.provide(HistoryNotesLive),
  Command.withSubcommands([syncCommand])
);

/**
 * Registers the commit-message overlay commands.
 *
 * **Example** (Inspect the command name)
 *
 * ```ts
 * import { historyCommand } from "@beep/repo-cli/commands/History"
 *
 * console.log(historyCommand.name) // "history"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const historyCommand = Command.make("history", {}, () => Console.log("History commands: notes")).pipe(
  Command.withDescription("Commit-message overlay published as git notes"),
  Command.withSubcommands([notesCommand])
);
