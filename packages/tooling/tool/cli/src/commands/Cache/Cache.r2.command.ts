/**
 * `beep cache r2` qualification probe and fleet enrollment commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CacheCommandError } from "./Cache.errors.ts";
import { CacheR2Marker, CacheR2ProbeMode, CacheR2ProbeReceipt } from "./Cache.r2.schemas.ts";
import { layerCacheR2ProbeIo, runCacheR2Fleet, runCacheR2Probe } from "./Cache.r2.ts";

const renderFailure = <A, E, R>(effect: Effect.Effect<A, E | CacheCommandError, R>) =>
  effect.pipe(
    Effect.catchIf(S.is(CacheCommandError), (error) =>
      Console.error(error.message).pipe(Effect.andThen(failWithReportedExit(error.message)))
    )
  );

const TurboTuple = Config.all({
  api: Config.String("TURBO_API").pipe(Config.withDefault("")),
  token: Config.String("TURBO_TOKEN").pipe(Config.withDefault("")),
  team: Config.String("TURBO_TEAM").pipe(Config.withDefault("")),
});

const cacheR2ProbeCommand = Command.make(
  "probe",
  {
    mode: Argument.Literals("mode", CacheR2ProbeMode.literals).pipe(
      Argument.withDescription("seed (workstation), ci (protected Cache Warm) or restore (workstation)")
    ),
    marker: Flag.String("marker").pipe(Flag.withDescription("Nonsecret sixteen-hex marker shared by the three modes")),
  },
  Effect.fn("CacheR2.probeCommand")(
    function* ({ mode, marker }) {
      const tuple = yield* TurboTuple.pipe(
        Effect.mapError(() => CacheCommandError.new("A resolved Turbo API/token/team tuple is required"))
      );
      if (Str.isEmpty(tuple.api) || Str.isEmpty(tuple.token) || Str.isEmpty(tuple.team))
        return yield* CacheCommandError.new("A resolved Turbo API/token/team tuple is required");
      const checked = yield* S.decodeEffect(CacheR2Marker)(marker).pipe(
        Effect.mapError(() => CacheCommandError.new("Marker must be sixteen hexadecimal characters"))
      );
      // The command handler is this probe's entry point; the live layer needs the
      // tuple resolved above, so it is built here rather than at command wiring.
      const io = yield* Layer.build(layerCacheR2ProbeIo({ root: process.cwd(), tuple })).pipe(
        CacheCommandError.mapError("Cannot prepare the qualification probe.")
      );
      const receipt = yield* runCacheR2Probe(mode, checked).pipe(Effect.provideContext(io));
      const text = yield* S.encodeEffect(S.fromJsonString(CacheR2ProbeReceipt, { space: 2 }))(receipt).pipe(
        CacheCommandError.mapError("Cannot render the qualification receipt.")
      );
      yield* Console.log(text);
    },
    Effect.scoped,
    renderFailure
  )
).pipe(
  Command.withDescription("Exact-hash R2 qualification over the loopback API; receipts exclude environment values"),
  Command.provide(FetchHttpClient.layer)
);

const cacheR2FleetCommand = Command.make(
  "fleet",
  {
    roots: Argument.String("roots").pipe(
      Argument.atLeast(1),
      Argument.withDescription("Parent directory containing clones, or one clone")
    ),
    apply: Flag.Boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Apply reference-only enrollment; default is a read-only plan")
    ),
    output: Flag.Path("output", { pathType: "file" }).pipe(
      Flag.optional,
      Flag.withDescription("Private sanitized receipt; never contains credentials or refs")
    ),
  },
  Effect.fn("CacheR2.fleetCommand")(function* ({ roots, apply, output }) {
    const path = yield* Path.Path;
    const result = yield* runCacheR2Fleet({
      roots,
      apply,
      output,
      workstation: path.join(process.cwd(), "infra/r2-cache/workstation.sh"),
    });
    yield* Console.log(A.join(result.lines, "\n"));
    if (result.blocked) return yield* failWithReportedExit("Fleet enrollment blocked for at least one checkout.");
  }, renderFailure)
).pipe(Command.withDescription("Enroll existing Beep clones and registered worktrees without changing source"));

/**
 * R2 remote-cache qualification and fleet enrollment command group.
 *
 * **Details**
 * Replaces the retired `infra/r2-cache/probe.py` and `fleet.py`.
 *
 * **Example** (Reference the R2 command group)
 * ```ts
 * import { cacheR2Command } from "@beep/repo-cli/test/Cache"
 * console.assert(cacheR2Command.name === "r2")
 * ```
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const cacheR2Command = Command.make("r2", {}, () => Console.log("cache r2 commands: probe, fleet")).pipe(
  Command.withDescription("R2 remote-cache qualification probe and fleet enrollment"),
  Command.withSubcommands([cacheR2ProbeCommand, cacheR2FleetCommand])
);
