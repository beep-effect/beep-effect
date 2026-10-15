/**
 * Read-only permission census command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ContinuityObservation } from "./Continuity.schemas.ts";
import { PermissionContinuity, PermissionContinuityLive } from "./Continuity.service.ts";
import { reportSessionFailure, SessionLedgerError } from "./Session.errors.ts";

const encodeContinuityObservations = S.encodeEffect(ContinuityObservation.pipe(S.Array, S.fromJsonString));

/**
 * Inspect selected effective records without launching or changing a session.
 *
 * **Example** (Inspect the command name)
 * ```ts import.meta.vitest name="Inspect the command name"
 * import { sessionContinuityCommand } from "@beep/repo-cli/test/Session"
 * sessionContinuityCommand.name // => "continuity"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionContinuityCommand = Command.make(
  "continuity",
  {
    input: Flag.String("input").pipe(
      Flag.withDescription("Explicit JSON manifest of rollouts, configs and Claude app/transcript pairs")
    ),
  },
  Effect.fn("Session.continuity")(function* ({ input }) {
    yield* reportSessionFailure(
      Effect.gen(function* () {
        const reader = yield* PermissionContinuity;
        const rows = yield* reader.read(input);
        const encoded = yield* encodeContinuityObservations(rows).pipe(
          Effect.mapError(() =>
            SessionLedgerError.make({ reason: "decode", message: "Cannot encode continuity observations" })
          )
        );
        yield* Console.log(encoded);
      })
    );
  })
).pipe(
  Command.withDescription("Read effective permission metadata; never launch, resume, grant or modify sessions"),
  Command.provide(PermissionContinuityLive)
);
