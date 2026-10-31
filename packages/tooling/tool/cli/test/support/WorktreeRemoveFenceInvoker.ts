/**
 * Runs one `worktree remove <name> --archive --delete-branch` in its own process.
 *
 * A test spawns this script so that it can play the agent session above the
 * invoker: whatever `CLAUDE_PID` the test exports lands in this process's real
 * initial environment (the `/proc` view the archive fence proves against), and
 * the lane holders the test spawns are this process's siblings under that
 * session, which is exactly where a desktop session's MCP servers sit. The
 * spawner sets the working directory, so the command resolves the clone from
 * wherever the test started it.
 *
 * Arguments: `<name>`. Prints one JSON line `{ ok, message }` and exits 0 when
 * the worktree was removed.
 */

import { worktreeCommand } from "@beep/repo-cli/commands/Worktree";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { FenceInvokerLayer, reportFenceOutcome } from "./FenceInvoker.ts";

const name = O.getOrThrow(A.get(process.argv, 2));

const failureMessage = (error: unknown): string =>
  P.hasProperty(error, "message") && P.isString(error.message) ? error.message : String(error);

await using runtime = ManagedRuntime.make(FenceInvokerLayer);
const ok = await runtime.runPromise(
  Command.runWith(worktreeCommand, { version: "0.0.0" })(["remove", name, "--archive", "--delete-branch"]).pipe(
    reportFenceOutcome({ onFailure: failureMessage, onSuccess: () => "removed" })
  )
);
process.exitCode = ok ? 0 : 1;
