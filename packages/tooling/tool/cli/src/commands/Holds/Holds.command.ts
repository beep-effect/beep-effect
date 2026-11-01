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
import {
  HoldsProbeInput,
  HoldsUpdateInput,
  runHoldsLint,
  runHoldsList,
  runHoldsProbe,
  runHoldsUpdate,
  runHoldsWhy,
} from "./Holds.program.ts";
import { HoldLedger, HoldProbe, makeHoldLedger, makeHoldProbe } from "./Holds.service.ts";
import { HoldSites, makeHoldSites } from "./Holds.sites.ts";
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

const headCommitSha = Effect.fn("Holds.headCommitSha")(function* () {
  const root = yield* resolveRoot;
  return Str.trim(yield* runGitOutput(root, ["rev-parse", "HEAD"], gitAdapter));
});

const layerHoldLedgerLive = Layer.effect(HoldLedger, Effect.flatMap(resolveRoot, makeHoldLedger));

const layerHoldSitesLive = Layer.effect(HoldSites, Effect.flatMap(resolveRoot, makeHoldSites));

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
    const commitSha = yield* headCommitSha();
    const lines = yield* runHoldsProbe(HoldsProbeInput.make({ holdId, dryRun, commitSha }));
    yield* Console.log(A.join(lines, "\n"));
  })
).pipe(
  Command.withDescription("Probe one hold's control and candidate versions and record the run"),
  Command.provide(Layer.mergeAll(layerHoldLedgerLive, layerHoldProbeLive))
);

/**
 * `beep holds lint [--write]`: check that every hold-shaped config site has a
 * live record and every record's anchors still exist.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { holdsLintCommand } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdsLintCommand.name) // "lint"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const holdsLintCommand = Command.make(
  "lint",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Tombstone orphaned records and regenerate the syncpack held list first")
    ),
  },
  ({ write }) => Effect.flatMap(runHoldsLint(write), (lines) => Console.log(A.join(lines, "\n")))
).pipe(
  Command.withDescription("Check hold-shaped config sites against the hold ledger"),
  Command.provide(Layer.mergeAll(layerHoldLedgerLive, layerHoldSitesLive))
);

/**
 * `beep holds update [--dry-run]`: the `deps:update` pre-step. Probe due holds,
 * then retire flipped holds that a catalog bump completes.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { holdsUpdateCommand } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdsUpdateCommand.name) // "update"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const holdsUpdateCommand = Command.make(
  "update",
  {
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Probe and report without recording runs, tombstones or the held list")
    ),
  },
  Effect.fn(function* ({ dryRun }) {
    const commitSha = yield* headCommitSha();
    const lines = yield* runHoldsUpdate(HoldsUpdateInput.make({ dryRun, commitSha }));
    yield* Console.log(A.join(lines, "\n"));
  })
).pipe(
  Command.withDescription("Probe due holds and retire flipped holds before a catalog bump"),
  Command.provide(Layer.mergeAll(layerHoldLedgerLive, layerHoldProbeLive))
);

/**
 * `beep holds why <package>`: every hold record that governs a package.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { holdsWhyCommand } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdsWhyCommand.name) // "why"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const holdsWhyCommand = Command.make(
  "why",
  { packageName: Argument.String("package").pipe(Argument.withDescription("The package to explain")) },
  ({ packageName }) => Effect.flatMap(runHoldsWhy(packageName), (lines) => Console.log(A.join(lines, "\n")))
).pipe(
  Command.withDescription("Explain the live and tombstoned holds on a package"),
  Command.provide(layerHoldLedgerLive)
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
  Console.log(
    "Hold ledger commands: bun run beep holds list | bun run beep holds why <package> | bun run beep holds probe <hold-id> [--dry-run] | bun run beep holds update [--dry-run] | bun run beep holds lint [--write]"
  )
).pipe(
  Command.withDescription("Temporary repo decisions as probe-backed holds"),
  Command.withSubcommands([holdsListCommand, holdsWhyCommand, holdsProbeCommand, holdsUpdateCommand, holdsLintCommand])
);
