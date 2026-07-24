/**
 * Provider-instance server ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { Context } from "effect";
import * as S from "effect/Schema";
import type * as Agents from "@beep/shared-domain/identity/Agents";
import type { Effect } from "effect";
import type { AddProviderInstanceCommand } from "./ProviderInstance.commands.ts";
import type { ProviderInstanceNotFound, ProviderProbeUnavailable } from "./ProviderInstance.errors.ts";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.repository");

/** Trusted actor and organization scope supplied by the server boundary.
 * @example
 * ```ts
 * import { ProviderInstanceActorScope } from "@beep/agents-use-cases/server"
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 * const scope = ProviderInstanceActorScope.make({
 *   orgId: S.decodeUnknownSync(Shared.OrganizationId)(1),
 *   principal: SystemPrincipal.make({ component: "Runtime" })
 * })
 * console.log(scope.orgId)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProviderInstanceActorScope extends S.Class<ProviderInstanceActorScope>($I`ProviderInstanceActorScope`)(
  {
    orgId: Shared.OrganizationId.annotateKey({
      description: "Authenticated organization that owns every repository operation.",
    }),
    principal: Principal.annotateKey({
      description: "Authenticated principal attributed to repository writes.",
    }),
  },
  $I.annote("ProviderInstanceActorScope", {
    description: "Trusted server-side actor and organization scope for provider-instance persistence.",
  })
) {}

/** Required server context for tenant-scoped provider-instance persistence.
 * @example
 * ```ts
 * import { ProviderInstanceActorContext } from "@beep/agents-use-cases/server"
 * console.log(ProviderInstanceActorContext)
 * ```
 * @category services
 * @since 0.0.0
 */
export class ProviderInstanceActorContext extends Context.Service<
  ProviderInstanceActorContext,
  ProviderInstanceActorScope
>()($I`ProviderInstanceActorContext`) {}

/** Persistence operations required by provider-instance use cases.
 * @example
 * ```ts
 * import type { ProviderInstanceRepositoryShape } from "@beep/agents-use-cases/server"
 * import { Effect } from "effect"
 * const repository = { add: () => Effect.die("example"), get: () => Effect.die("example"), list: Effect.succeed([]), remove: () => Effect.void, save: (instance) => Effect.succeed(instance) } satisfies ProviderInstanceRepositoryShape
 * console.log(repository.list)
 * ```
 * @category repositories
 * @since 0.0.0
 */
export interface ProviderInstanceRepositoryShape {
  readonly add: (input: AddProviderInstanceCommand) => Effect.Effect<Domain.ProviderInstance, ProviderProbeUnavailable>;
  readonly get: (
    id: Agents.ProviderInstanceId
  ) => Effect.Effect<Domain.ProviderInstance, ProviderInstanceNotFound | ProviderProbeUnavailable>;
  readonly list: Effect.Effect<ReadonlyArray<Domain.ProviderInstance>, ProviderProbeUnavailable>;
  readonly remove: (
    id: Agents.ProviderInstanceId
  ) => Effect.Effect<void, ProviderInstanceNotFound | ProviderProbeUnavailable>;
  readonly save: (
    instance: Domain.ProviderInstance
  ) => Effect.Effect<Domain.ProviderInstance, ProviderInstanceNotFound | ProviderProbeUnavailable>;
}

/** Context tag for provider-instance persistence.
 * @example
 * ```ts
 * import { ProviderInstanceRepository } from "@beep/agents-use-cases/server"
 * import { Effect } from "effect"
 * const program = Effect.gen(function* () { return (yield* ProviderInstanceRepository).list })
 * console.log(program)
 * ```
 * @category repositories
 * @since 0.0.0
 */
export class ProviderInstanceRepository extends Context.Service<
  ProviderInstanceRepository,
  ProviderInstanceRepositoryShape
>()($I`ProviderInstanceRepository`) {}

/** Input consumed by the product-neutral provider probe port.
 * @example
 * ```ts
 * import { ProviderProbeInput } from "@beep/agents-use-cases/server"
 * import * as Domain from "@beep/agents-domain/entities/ProviderInstance"
 * import * as O from "effect/Option"
 * const input = ProviderProbeInput.make({
 *   binaryPath: Domain.BinaryPath.make("/usr/bin/claude"),
 *   envVars: Domain.EnvVars.make({}),
 *   homePath: O.none(),
 *   kind: "claude"
 * })
 * console.log(input.kind)
 * ```
 * @category ports
 * @since 0.0.0
 */
export class ProviderProbeInput extends S.Class<ProviderProbeInput>($I`ProviderProbeInput`)(
  {
    binaryPath: Domain.BinaryPath,
    envVars: Domain.EnvVars,
    homePath: S.OptionFromNullOr(Domain.HomePath),
    kind: Domain.ProviderKind,
  },
  $I.annote("ProviderProbeInput", {
    description: "Provider CLI configuration consumed by the product-neutral authentication probe port.",
  })
) {}

/** Probe operation implemented by the agents server adapter.
 * @example
 * ```ts
 * import type { ProviderProbeShape } from "@beep/agents-use-cases/server"
 * import { Effect } from "effect"
 * const probe = { probe: () => Effect.die("example") } satisfies ProviderProbeShape
 * console.log(probe.probe)
 * ```
 * @category ports
 * @since 0.0.0
 */
export interface ProviderProbeShape {
  readonly probe: (input: ProviderProbeInput) => Effect.Effect<Domain.AuthSnapshot, ProviderProbeUnavailable>;
}

/** Context tag for probing provider CLI authentication.
 * @example
 * ```ts
 * import { ProviderProbe } from "@beep/agents-use-cases/server"
 * import { Effect } from "effect"
 * const program = Effect.gen(function* () { return yield* ProviderProbe })
 * console.log(program)
 * ```
 * @category ports
 * @since 0.0.0
 */
export class ProviderProbe extends Context.Service<ProviderProbe, ProviderProbeShape>()($I`ProviderProbe`) {}
