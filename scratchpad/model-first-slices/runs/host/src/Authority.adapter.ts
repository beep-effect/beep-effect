import { AuthorityGateway, RunGrantRefusal } from "@proto/authority-contract/Authority.gateway";
import { Authority, GrantDenied } from "@proto/runs-model/Authority.external";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";

/**
 * The runs model's authority port over the authority context's gateway.
 *
 * @category adapters
 * @since 0.0.0
 */
export const RunsAuthority = Authority.toLayer(
  Effect.map(Effect.service(AuthorityGateway), (gateway) => ({
    grantRun: (request) =>
      gateway.grantRun(request).pipe(
        Effect.mapError(
          flow(
            RunGrantRefusal.match({
              RunGrantRefused: ({ reason }) => reason,
              ReadmissionRefused: ({ reason }) => `readmission:${reason}`,
            }),
            (reason) => GrantDenied.make({ reason }),
          ),
        ),
      ),
  })),
);
