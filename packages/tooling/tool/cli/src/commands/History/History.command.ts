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
import { HISTORY_COMMIT_MESSAGE_MAP_PATH, HISTORY_NOTES_REF, HistoryNotesCheckOptions } from "./History.schemas.ts";
import {
  HistoryNotes,
  HistoryNotesLive,
  historyNotesCheckProblems,
  renderHistoryNotesCheck,
} from "./History.service.ts";

const notesCommand = Command.make(
  "notes",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Validate the map and compare it with the local notes ref (read-only)")
    ),
    ref: Flag.String("ref").pipe(
      Flag.withDefault(HISTORY_NOTES_REF),
      Flag.withDescription("Notes ref to compare against the map")
    ),
    base: Flag.String("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Ref every map key must be reachable from")
    ),
    requirePublished: Flag.Boolean("require-published").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail when the notes ref does not exist locally")
    ),
  },
  Effect.fn("History.notes")(function* ({ check, ref, base, requirePublished }) {
    if (!check) return yield* Console.log("History notes modes: --check");
    const root = yield* findRepoRoot();
    const history = yield* HistoryNotes;
    const report = yield* history.check(
      HistoryNotesCheckOptions.make({ root, mapPath: HISTORY_COMMIT_MESSAGE_MAP_PATH, ref, base, requirePublished })
    );
    yield* printLines(renderHistoryNotesCheck(report));
    const problems = historyNotesCheckProblems(report);
    if (A.isReadonlyArrayNonEmpty(problems))
      return yield* HistoryNotesCheckError.make({ message: `history notes check failed: ${A.join(problems, "; ")}` });
  })
).pipe(
  Command.withDescription("Check the commit-message overlay map against refs/notes/history"),
  Command.provide(HistoryNotesLive)
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
