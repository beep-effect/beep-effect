/**
 * `beep yeet gh`: REST-first GitHub pull-request operations.
 *
 * **Details**
 *
 * Every subcommand speaks GitHub REST through `@effected/github`, except
 * `pr ready` and the review-thread read inside `merge` (and inside
 * `pr status --threads`), which have no REST equivalent and spend GraphQL
 * through the budget guard. `--token-ref op://…` (or `BEEP_GH_TOKEN_REF`) and the
 * `BEEP_GH_APP_*` variables select an identity with its own rate-limit budget.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Argument, Command, Flag } from "effect/cli";
import {
  runYeetGhChecks,
  runYeetGhMerge,
  runYeetGhPrComment,
  runYeetGhPrLabel,
  runYeetGhPrReady,
  runYeetGhPrStatus,
  runYeetGhRateLimit,
} from "./internal/GhOps.ts";

const tokenRefFlag = Flag.String("token-ref").pipe(
  Flag.optional,
  Flag.withDescription(
    "op:// reference to an alternate GitHub token (default: BEEP_GH_TOKEN_REF, then the BEEP_GH_APP_* App identity, then the gh login)"
  )
);
const noWaitFlag = Flag.Boolean("no-wait").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Fail at once (exit 75) instead of waiting for the GraphQL budget reset")
);
const prArgument = Argument.Int("pr").pipe(Argument.withDescription("Pull request number"));
const labelArgument = Argument.String("label").pipe(Argument.withDescription("Label name"));

const statusCommand = Command.make(
  "status",
  {
    tokenRef: tokenRefFlag,
    noWait: noWaitFlag,
    number: prArgument,
    threads: Flag.Boolean("threads").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Also read review threads (GraphQL, budget-guarded)")
    ),
  },
  runYeetGhPrStatus
).pipe(
  Command.withDescription(
    "Show the REST merge-gate view of a pull request: draft, head, required checks, review window, threads"
  )
);

const labelAddCommand = Command.make(
  "add",
  { tokenRef: tokenRefFlag, number: prArgument, label: labelArgument },
  (options) => runYeetGhPrLabel({ ...options, action: "add" })
).pipe(Command.withDescription("Add a label (REST)"));

const labelRemoveCommand = Command.make(
  "remove",
  { tokenRef: tokenRefFlag, number: prArgument, label: labelArgument },
  (options) => runYeetGhPrLabel({ ...options, action: "remove" })
).pipe(Command.withDescription("Remove a label (REST)"));

const labelCommand = Command.make("label").pipe(
  Command.withDescription("Add or remove a pull request label over REST"),
  Command.withSubcommands([labelAddCommand, labelRemoveCommand])
);

const commentCommand = Command.make(
  "comment",
  {
    tokenRef: tokenRefFlag,
    number: prArgument,
    body: Flag.String("body").pipe(Flag.withDescription("Comment text")),
  },
  runYeetGhPrComment
).pipe(Command.withDescription("Post an issue comment on a pull request (REST)"));

const readyCommand = Command.make(
  "ready",
  { tokenRef: tokenRefFlag, noWait: noWaitFlag, number: prArgument },
  runYeetGhPrReady
).pipe(Command.withDescription("Flip a draft to ready (GraphQL-only mutation, behind the budget guard)"));

const prCommand = Command.make("pr").pipe(
  Command.withDescription("Pull request reads and writes over REST"),
  Command.withSubcommands([statusCommand, labelCommand, commentCommand, readyCommand])
);

const rerunFailedCommand = Command.make("rerun-failed", { tokenRef: tokenRefFlag, number: prArgument }, (options) =>
  runYeetGhChecks({ ...options, action: "rerun-failed" })
).pipe(Command.withDescription("Re-run the failed jobs of every failed workflow run on the PR head (REST)"));

const cancelQueuedCommand = Command.make("cancel-queued", { tokenRef: tokenRefFlag, number: prArgument }, (options) =>
  runYeetGhChecks({ ...options, action: "cancel-queued" })
).pipe(Command.withDescription("Cancel every queued or running workflow run on the PR head (REST)"));

const checksCommand = Command.make("checks").pipe(
  Command.withDescription("Act on the workflow runs of a pull request's head commit over REST"),
  Command.withSubcommands([rerunFailedCommand, cancelQueuedCommand])
);

const mergeCommand = Command.make(
  "merge",
  {
    tokenRef: tokenRefFlag,
    noWait: noWaitFlag,
    number: prArgument,
    sha: Flag.String("sha").pipe(
      Flag.withDescription("The head sha (10+ chars) you verified; the gate refuses when the head moved")
    ),
    tolerate: Flag.String("tolerate").pipe(
      Flag.atMost(16),
      Flag.withDescription("A NON-required check name to tolerate red or pending, after attributing it (repeatable)")
    ),
    forceWindow: Flag.Boolean("force-window").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Skip the 20-minute review window; only for a fix that unblocks main")
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Decide and print, never merge")
    ),
  },
  runYeetGhMerge
).pipe(
  Command.withDescription(
    "Squash-merge over REST pinned to --sha once required checks are green, threads are zero (GraphQL, guarded), and the review window has passed; exit 75 means hold"
  )
);

const rateLimitCommand = Command.make("rate-limit", { tokenRef: tokenRefFlag }, runYeetGhRateLimit).pipe(
  Command.withDescription("Show the REST core budget and probe the GraphQL budget (one point)")
);

/**
 * The `yeet gh` command group.
 *
 * **Example** (Inspect the command)
 *
 * ```ts
 * import { yeetGhCommand } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof yeetGhCommand) // "object"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const yeetGhCommand = Command.make("gh").pipe(
  Command.withDescription(
    "REST-first GitHub operations: PR status, labels, comments, ready, checks, merge, rate limit"
  ),
  Command.withSubcommands([prCommand, checksCommand, mergeCommand, rateLimitCommand])
);
