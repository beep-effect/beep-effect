/**
 * `beep accounts`: which subscription account to use next, per provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Terminal from "effect/Terminal";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { AccountsError } from "./Accounts.errors.ts";
import { AccountsStatusReportJson } from "./Accounts.schemas.ts";
import { watchAccounts } from "./Accounts.tui.ts";
import { AccountsBoardLayout, renderAccountsBoard } from "./Accounts.view.ts";
import { layerAccountsUsageLive, loadAccountsReport } from "./AccountsUsage.service.ts";

// Width used when the board is printed to something that is not a terminal.
const PLAIN_WIDTH = 100;

const reportFailure = <A, R>(effect: Effect.Effect<A, AccountsError, R>) =>
  effect.pipe(Effect.catchTag("AccountsError", (error) => failWithReportedExit(`[accounts] ${error.message}`)));

const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit the report as JSON"));

const everyFlag = Flag.Int("every").pipe(
  Flag.withDefault(60),
  Flag.withDescription("Seconds between polls on the live screen (at least 15)")
);

/**
 * `beep accounts status`: poll every account once and print the board, or the
 * report as JSON.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { accountsStatusCommand } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(accountsStatusCommand.name) // "status"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const accountsStatusCommand = Command.make(
  "status",
  { json: jsonFlag },
  Effect.fn(function* ({ json }) {
    const program = Effect.gen(function* () {
      const report = yield* loadAccountsReport(O.none());
      if (!json) {
        const columns = yield* (yield* Terminal.Terminal).columns;
        const status = `updated ${DateTime.formatLocal(report.generatedAt, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
        yield* Console.log(
          renderAccountsBoard(
            report,
            AccountsBoardLayout.make({ width: columns === 0 ? PLAIN_WIDTH : columns, color: columns !== 0, status })
          )
        );
        return;
      }
      // One document on the console, like the other `--json` surfaces that
      // automation decodes as a whole.
      yield* Console.log(
        yield* AccountsStatusReportJson.encode(report).pipe(
          Effect.mapError((cause) =>
            AccountsError.make({ reason: "decode", message: "Failed to encode the accounts report.", cause })
          )
        )
      );
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription("Poll every account once and print each provider's accounts, most urgent first"),
  Command.provide(layerAccountsUsageLive)
);

/**
 * `beep accounts`: the live accounts screen, and the `status` subcommand.
 *
 * **Example** (Read the family name)
 *
 * ```ts
 * import { accountsCommand } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(accountsCommand.name) // "accounts"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const accountsCommand = Command.make(
  "accounts",
  { every: everyFlag },
  Effect.fn(function* ({ every }) {
    yield* Duration.seconds(every).pipe(watchAccounts, reportFailure);
  })
).pipe(
  Command.withDescription(
    "Live screen of every Claude, Codex, SuperGrok, and Muse account: which one to use next, per provider"
  ),
  Command.provide(layerAccountsUsageLive),
  Command.withSubcommands([accountsStatusCommand])
);
