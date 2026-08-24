/**
 * Explore command group.
 *
 * **Details**
 *
 * Read-only exploration/goal packet-stream tooling: `beep explore --check`
 * folds every opted-in packet event stream and reports forks, integrity
 * issues, and stale trace projections (advisory in this first slice).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import { PacketEventStoreLive } from "../Goals/PacketCore/PacketEventStore.ts";
import { runExploreCheck } from "./Check.ts";

const checkFlag = Flag.boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Fold every packet event stream and report forks, integrity issues, and stale traces (advisory)")
);

/**
 * `bun run beep explore` — read-only packet-stream command group.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { exploreCommand } from "@beep/repo-cli/commands/Explore/Explore.command"
 *
 * console.log(exploreCommand.name) // "explore"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const exploreCommand = Command.make(
  "explore",
  { check: checkFlag },
  Effect.fn(function* ({ check }) {
    if (check) {
      return yield* runExploreCheck();
    }
    return yield* printLines([
      "Explore commands:",
      "- bun run beep explore --check   fold packet event streams; report forks, integrity issues, stale traces (advisory)",
    ]);
  })
).pipe(
  Command.withDescription("Read-only packet-stream checks over explorations and goals (advisory)"),
  Command.provide(PacketEventStoreLive)
);
