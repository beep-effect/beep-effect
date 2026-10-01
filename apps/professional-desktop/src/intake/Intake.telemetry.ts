/**
 * Effect actions shared by the document intake machines.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { IntakeLogRequest } from "./DocumentIntake.models.ts";
import type { EffectActionArgs } from "@xstate/effect";

const decodeIntakeLogRequest = S.decodeUnknownOption(IntakeLogRequest);

/**
 * Effect action that logs a redacted failure cause for an intake operation.
 *
 * **Details**
 *
 * The transition enqueues it with an {@link IntakeLogRequest} as `params` and
 * commits without waiting. The log runs afterwards in the actor's Effect
 * context and is interrupted if the actor stops first. Params that are not a
 * log request are ignored.
 *
 * **Example** (Run the action outside a machine)
 *
 * ```ts
 * import { logIntakeCause } from "@/intake/Intake.telemetry"
 * import type { EffectActionArgs } from "@xstate/effect"
 *
 * declare const args: EffectActionArgs
 * console.log(logIntakeCause(args))
 * ```
 *
 * @param args - Action arguments; `params` carries the log request.
 * @returns An Effect that writes one redacted warning.
 * @category actions
 * @since 0.0.0
 */
export const logIntakeCause = ({ params }: EffectActionArgs): Effect.Effect<void> =>
  O.match(decodeIntakeLogRequest(params), {
    onNone: () => Effect.void,
    onSome: (request) =>
      logRedactedCause(
        request.cause,
        LogRedactedCauseOptions.make({
          message: request.message,
          level: "Warn",
          attributes: {
            "professional_desktop.intake.action": request.action,
            "professional_desktop.subsystem": "document_intake",
          },
        })
      ),
  });
