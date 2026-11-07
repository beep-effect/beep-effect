/**
 * GitHub command group: human-operated GitHub App registration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubAppName } from "@beep/repo-configs/PolicyData";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { GitHubAppMint, GitHubAppMintLive } from "./Github.service.ts";

const mintCommand = Command.make(
  "mint",
  {
    app: Argument.Literals("app", GitHubAppName.literals).pipe(Argument.withDescription("GitHub App to register")),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDescription("Print the checked-in App manifest byte for byte and exit without serving")
    ),
  },
  Effect.fn("Github.app.mint")(function* ({ app, dryRun }) {
    const mint = yield* GitHubAppMint;
    if (dryRun) {
      const text = yield* mint.manifestText(app);
      const stdio = yield* Stdio.Stdio;
      return yield* Stream.make(text).pipe(Stream.run(stdio.stdout()));
    }
    return yield* mint.serve(app);
  })
).pipe(
  Command.withDescription(
    "Register a GitHub App from its checked-in manifest through a loopback browser handoff; credentials go to 1Password"
  ),
  Command.provide(GitHubAppMintLive)
);

const appCommand = Command.make("app", {}, () => Console.log("github app commands: mint")).pipe(
  Command.withDescription("GitHub App registration commands"),
  Command.withSubcommands([mintCommand])
);

/**
 * GitHub integration command group.
 *
 * **Example** (Inspect the github command)
 *
 * ```ts
 * import { githubCommand } from "@beep/repo-cli/commands/Github"
 *
 * console.log(githubCommand.name) // "github"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const githubCommand = Command.make("github", {}, () => Console.log("github commands: app")).pipe(
  Command.withDescription("GitHub integration commands"),
  Command.withSubcommands([appCommand])
);
