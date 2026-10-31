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
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { HoldsError } from "./Holds.errors.ts";
import { HoldId } from "./Holds.schemas.ts";
import { HoldLedger, HoldProbe, HoldProbeRequest, makeHoldLedger, makeHoldProbe } from "./Holds.service.ts";
import { confirmHoldRuns } from "./Holds.verdict.ts";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";

const decodeHoldId = S.decodeUnknownEffect(HoldId);

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

const outcomeText = (outcome: { readonly _tag: string; readonly detail?: string }): string =>
  pipe(
    O.fromNullishOr(outcome.detail),
    O.match({ onNone: () => outcome._tag, onSome: (detail) => `${outcome._tag} (${detail})` })
  );

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
export const holdsListCommand = Command.make(
  "list",
  {},
  Effect.fn(function* () {
    {
      const ledger = yield* HoldLedger;
      const versions = yield* ledger.currentVersions;
      if (A.isReadonlyArrayEmpty(versions)) {
        return yield* Console.log("[holds] no hold records yet.");
      }
      yield* Effect.forEach(versions, (version) =>
        ledger
          .runsFor(version)
          .pipe(
            Effect.flatMap((runs) =>
              Console.log(
                `[holds] ${version.proposition.holdId} (${version.proposition.kind}, ${A.join(version.proposition.subject.packages, ", ")}): ${confirmHoldRuns(runs)} after ${A.length(runs)} run(s)`
              )
            )
          )
      );
    }
  })
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
    const id = yield* decodeHoldId(holdId).pipe(
      Effect.mapError((cause) =>
        HoldsError.make({ reason: "usage", message: `"${holdId}" is not a kebab-case hold id.`, cause })
      )
    );
    const root = yield* resolveRoot;
    const commitSha = Str.trim(yield* runGitOutput(root, ["rev-parse", "HEAD"], gitAdapter));
    {
      const ledger = yield* HoldLedger;
      const probe = yield* HoldProbe;
      const version = yield* pipe(
        yield* ledger.currentVersions,
        A.findFirst((candidate) => candidate.proposition.holdId === id),
        O.match({
          onNone: () => HoldsError.make({ reason: "not-found", message: `No current hold record named ${id}.` }),
          onSome: Effect.succeed,
        })
      );
      const run = yield* probe.probe(
        HoldProbeRequest.make({ proposition: version.proposition, holdVersionId: version.id, commitSha })
      );
      yield* Console.log(
        A.join(
          [
            `[holds] ${id}`,
            `  control   ${run.controlVersion}: ${outcomeText(run.control)}`,
            `  candidate ${run.candidateVersion}: ${outcomeText(run.candidate)}`,
            `  run verdict: ${run.verdict}`,
          ],
          "\n"
        )
      );
      if (dryRun) {
        return yield* Console.log("[holds] dry run: nothing recorded.");
      }
      yield* ledger.appendRun(run);
      const confirmed = confirmHoldRuns(yield* ledger.runsFor(version));
      yield* Console.log(`[holds] recorded ${run.id}; confirmed verdict: ${confirmed}`);
    }
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
