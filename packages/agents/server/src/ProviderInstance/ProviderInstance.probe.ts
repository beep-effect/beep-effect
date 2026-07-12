/** ProviderInstance probe adapter over the AI provider CLI driver. @packageDocumentation @since 0.0.0 */

import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import { ProviderProbe, ProviderProbeUnavailable } from "@beep/agents-use-cases/server";
import { AiProviderCli } from "@beep/ai-provider-cli";
import { DateTime, Effect, Match } from "effect";
import type { AiProviderCliAuthSnapshot, AiProviderCliError } from "@beep/ai-provider-cli";

const translateDriverError = (_error: AiProviderCliError): ProviderProbeUnavailable =>
  ProviderProbeUnavailable.make({
    guidance: "Check the configured binary path and provider CLI HOME, then probe again.",
  });

const toDomainSnapshot = Effect.fn("Agents.ProviderProbe.toDomainSnapshot")(function* (
  snapshot: AiProviderCliAuthSnapshot
) {
  const probedAt = yield* DateTime.now;
  return yield* Match.value(snapshot.status).pipe(
    Match.when("authenticated", () =>
      Effect.succeed(
        Domain.AuthenticatedSnapshot.make({
          email: snapshot.email,
          probedAt,
          subscriptionLabel: snapshot.subscriptionLabel,
          tokenSource: snapshot.tokenSource,
        })
      )
    ),
    Match.when("not-authenticated", () => Effect.succeed(Domain.UnauthenticatedSnapshot.make({ probedAt }))),
    Match.exhaustive
  );
});

/** Build the ProviderProbe adapter from the live driver service.
 * @example
 * ```ts
 * import { makeProviderProbe } from "@beep/agents-server/ProviderInstance"
 * console.log(makeProviderProbe)
 * ```
 * @category ports @since 0.0.0
 */
export const makeProviderProbe = Effect.fn("Agents.ProviderProbe.make")(function* () {
  const cli = yield* AiProviderCli;
  return ProviderProbe.of({
    probe: Effect.fn("Agents.ProviderProbe.probe")(function* (input) {
      const snapshot = yield* cli.checkAuthSnapshot(input.kind).pipe(Effect.mapError(translateDriverError));
      return yield* toDomainSnapshot(snapshot);
    }),
  });
});
