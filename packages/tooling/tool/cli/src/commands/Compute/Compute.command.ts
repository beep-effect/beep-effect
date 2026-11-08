/**
 * `beep compute` command group: the per-process compute profile probe.
 *
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ComputeProfile, ComputeProfileProbe, ComputeProfileResolution } from "../../internal/repo-run/index.ts";

const encodeResolutionJson = S.encodeEffect(S.fromJsonString(ComputeProfileResolution));

/**
 * `beep compute profile`: print this process's compute profile.
 *
 * **Details**
 *
 * Prints `workstation` or `worker` on one line. `--is <profile>` prints
 * nothing and exits 0 on a match, 1 otherwise, for shell conditions such as
 * lefthook `skip: - run:`. `--json` prints the encoded resolution with its
 * source, ceiling, envelope and override. The command reads only
 * `process.constrainedMemory()`, installed memory and `BEEP_COMPUTE_PROFILE`:
 * no repository scan and no git.
 *
 * **Example** (Inspect the command name)
 *
 * ```ts
 * import { computeProfileCommand } from "@beep/repo-cli/commands/Compute"
 *
 * console.log(computeProfileCommand.name) // "profile"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const computeProfileCommand = Command.make(
  "profile",
  {
    is: Flag.Literals("is", ComputeProfile.literals).pipe(
      Flag.optional,
      Flag.withDescription("Print nothing; exit 0 when the profile matches, 1 otherwise")
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the encoded resolution (profile, source, ceiling, envelope, override)")
    ),
  },
  Effect.fn("Compute.profile")(function* ({ is, json }) {
    const resolution = yield* ComputeProfileProbe.use((probe) => probe.resolve);
    if (O.isSome(is)) {
      return resolution.profile === is.value
        ? undefined
        : yield* failWithReportedExit(`compute profile is ${resolution.profile}, not ${is.value}`, 1);
    }
    const line = json ? yield* encodeResolutionJson(resolution) : resolution.profile;
    yield* Console.log(line);
  })
).pipe(Command.withDescription("Print the compute profile (workstation or worker) of this process"));

/**
 * `beep compute`: compute-profile tooling.
 *
 * **Example** (Inspect the group name)
 *
 * ```ts
 * import { computeCommand } from "@beep/repo-cli/commands/Compute"
 *
 * console.log(computeCommand.name) // "compute"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const computeCommand = Command.make("compute").pipe(
  Command.withDescription("Compute profile of this process: workstation or a sub-envelope worker"),
  Command.withSubcommands([computeProfileCommand])
);
