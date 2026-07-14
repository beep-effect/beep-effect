/** ProviderInstance probe adapter over the AI provider CLI driver. @packageDocumentation @since 0.0.0 */

import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import { ProviderProbe, ProviderProbeUnavailable } from "@beep/agents-use-cases/server";
import { AiProviderCli, AiProviderCliHome } from "@beep/ai-provider-cli";
import { DateTime, Effect, Match } from "effect";
import * as O from "effect/Option";
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
 * @category ports
 * @since 0.0.0
 */
export const makeProviderProbe = Effect.fn("Agents.ProviderProbe.make")(function* () {
  const cli = yield* AiProviderCli;
  const home = yield* AiProviderCliHome;
  return ProviderProbe.of({
    probe: Effect.fn("Agents.ProviderProbe.probe")(function* (input) {
      const env = yield* Match.value(input.kind).pipe(
        Match.when("claude", () =>
          Effect.succeed(home.makeClaudeEnv({ baseEnv: input.envVars, homePath: input.homePath }))
        ),
        Match.when("codex", () => {
          const layout = home.resolveCodexHomeLayout({
            homePath: O.none(),
            shadowHomePath: input.homePath,
          });
          return home.ensureCodexShadowHome(layout).pipe(
            Effect.as(home.makeCodexEnv({ baseEnv: input.envVars, layout })),
            Effect.mapError(() =>
              ProviderProbeUnavailable.make({
                guidance: "Check the configured binary path and provider CLI HOME, then probe again.",
              })
            )
          );
        }),
        Match.exhaustive
      );
      const snapshot = yield* cli
        .checkAuthSnapshot(input.kind, { env, executable: O.some(input.binaryPath) })
        .pipe(Effect.mapError(translateDriverError));
      return yield* toDomainSnapshot(snapshot);
    }),
  });
});
