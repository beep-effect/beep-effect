/**
 * `beep holds`: list hold ledger records and probe them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { HoldsError } from "./Holds.errors.ts";
import { HoldsProbeInput, runHoldsList, runHoldsProbe } from "./Holds.program.ts";
import { HoldLedger, HoldProbe, makeHoldLedger, makeHoldProbe } from "./Holds.service.ts";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";

const gitAdapter: GitCommandErrorAdapter<HoldsError> = {
  onSpawnFailure: (commandLine) => (cause) =>
    HoldsError.make({ reason: "io", message: `Could not run ${commandLine}.`, cause }),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    HoldsError.make({ reason: "io", message: `${commandLine} exited ${exitCode}: ${output}` }),
  onTruncated: O.none(),
};

const resolveRoot = findRepoRoot().pipe(
  Effect.mapError((cause) => HoldsError.make({ reason: "io", message: "Could not find the repository root.", cause }))
);

const scratchRootFor = Effect.fn("Holds.scratchRoot")(function* () {
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME").pipe(
    Effect.mapError((cause) => HoldsError.make({ reason: "usage", message: "HOME is not set.", cause }))
  );
  return path.join(home, ".cache", "beep", "holds");
});

const layerHoldLedgerLive = Layer.effect(HoldLedger, Effect.flatMap(resolveRoot, makeHoldLedger));

const layerHoldProbeLive = Layer.effect(HoldProbe, Effect.flatMap(scratchRootFor(), makeHoldProbe));

/**
 * `beep holds list`: current hold versions and their latest verdicts.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { holdsListCommand } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdsListCommand.name) // "list"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const holdsListCommand = Command.make("list", {}, () =>
  Effect.flatMap(runHoldsList, (lines) => Console.log(A.join(lines, "\n")))
).pipe(
  Command.withDescription("List current hold records and their confirmed verdicts"),
  Command.provide(layerHoldLedgerLive)
);

/**
 * `beep holds probe <hold-id>`: run a hold's control and candidate, record the run.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { holdsProbeCommand } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdsProbeCommand.name) // "probe"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const holdsProbeCommand = Command.make(
  "probe",
  {
    holdId: Argument.String("hold-id").pipe(Argument.withDescription("The hold to probe")),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Run the probe without appending to the ledger")
    ),
  },
  Effect.fn(function* ({ holdId, dryRun }) {
    const root = yield* resolveRoot;
    const commitSha = Str.trim(yield* runGitOutput(root, ["rev-parse", "HEAD"], gitAdapter));
    const lines = yield* runHoldsProbe(HoldsProbeInput.make({ holdId, dryRun, commitSha }));
    yield* Console.log(A.join(lines, "\n"));
  })
).pipe(
  Command.withDescription("Probe one hold's control and candidate versions and record the run"),
  Command.provide(Layer.mergeAll(layerHoldLedgerLive, layerHoldProbeLive))
);

/**
 * `beep holds`: the hold ledger command group.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { holdsCommand } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdsCommand.name) // "holds"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const holdsCommand = Command.make("holds", {}, () =>
  Console.log("Hold ledger commands: bun run beep holds list | bun run beep holds probe <hold-id> [--dry-run]")
).pipe(
  Command.withDescription("Temporary repo decisions as probe-backed holds"),
  Command.withSubcommands([holdsListCommand, holdsProbeCommand])
);
