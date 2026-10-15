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

import { WorktreeRemovalServiceLive, worktreeCommand } from "@beep/repo-cli/commands/Worktree";
import { NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const name = O.getOrThrow(A.get(process.argv, 2));

const failureMessage = (error: unknown): string =>
  P.hasProperty(error, "message") && P.isString(error.message) ? error.message : String(error);

const layer = Layer.mergeAll(NodeServices.layer, WorktreeRemovalServiceLive.pipe(Layer.provide(NodeServices.layer)));
await using runtime = ManagedRuntime.make(layer);

const program = Effect.result(
  Command.runWith(worktreeCommand, { version: "0.0.0" })(["remove", name, "--archive", "--delete-branch"])
).pipe(
  Effect.map(
    Result.match({
      onFailure: (error) => ({ ok: false, message: failureMessage(error) }),
      onSuccess: () => ({ ok: true, message: "removed" }),
    })
  )
);

const outcome = await runtime.runPromise(program);
await Effect.runPromise(S.encodeEffect(S.fromJsonString(S.Unknown))(outcome).pipe(Effect.flatMap(Console.log)));
process.exitCode = outcome.ok ? 0 : 1;
