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
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type * as Agents from "@beep/shared-domain/identity/Agents";
import type * as Effect from "effect/Effect";
import type { AddProviderInstanceCommand } from "./ProviderInstance.commands.ts";
import type {
  ProviderInstanceNotFound,
  ProviderInstanceVersionConflict,
  ProviderProbeUnavailable,
} from "./ProviderInstance.errors.ts";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.repository");

/**
 *  Trusted actor and organization scope supplied by the server boundary.
 *
 * **Example** (Make actor scope)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderInstanceActorScope extends S.Opaque<
  ProviderInstanceActorScope,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    orgId: Shared.OrganizationId.annotateKey({
      description: "Authenticated organization that owns every repository operation.",
    }),
    principal: Principal.annotateKey({
      description: "Authenticated principal attributed to repository writes.",
    }),
  }).pipe(
    $I.annoteSchema("ProviderInstanceActorScope", {
      description: "Trusted server-side actor and organization scope for provider-instance persistence.",
    })
  )
) {}

/**
 *  Required server context for tenant-scoped provider-instance persistence.
 *
 * **Example** (Log actor context)
 *
 * ```ts
 * import { ProviderInstanceActorContext } from "@beep/agents-use-cases/server"
 * console.log(ProviderInstanceActorContext)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProviderInstanceActorContext extends Context.Service<
  ProviderInstanceActorContext,
  ProviderInstanceActorScope
>()($I`ProviderInstanceActorContext`) {}

/**
 *  Persistence operations required by provider-instance use cases.
 *
 * **Details**
 *
 * `save` writes only while the stored `rowVersion` still equals the
 * instance's, stores the next version, and returns the stored instance. A row
 * outside the actor's organization is `ProviderInstanceNotFound`; a row another
 * write advanced is `ProviderInstanceVersionConflict`.
 *
 * **Example** (Satisfy repository shape)
 *
 * ```ts
 * import type { ProviderInstanceRepositoryShape } from "@beep/agents-use-cases/server"
 * import * as Effect from "effect/Effect";
 * const repository = { add: () => Effect.die("example"), get: () => Effect.die("example"), list: Effect.succeed([]), remove: () => Effect.void, save: (instance) => Effect.succeed(instance) } satisfies ProviderInstanceRepositoryShape
 * console.log(repository.list)
 * ```
 *
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
  ) => Effect.Effect<
    Domain.ProviderInstance,
    ProviderInstanceNotFound | ProviderInstanceVersionConflict | ProviderProbeUnavailable
  >;
}

/**
 *  Context tag for provider-instance persistence.
 *
 * **Example** (Yield repository list)
 *
 * ```ts
 * import { ProviderInstanceRepository } from "@beep/agents-use-cases/server"
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () { return (yield* ProviderInstanceRepository).list })
 * console.log(program)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ProviderInstanceRepository extends Context.Service<
  ProviderInstanceRepository,
  ProviderInstanceRepositoryShape
>()($I`ProviderInstanceRepository`) {}

/**
 * **Example** (Make probe input)
 *
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
 *
 * @category ports
 * @since 0.0.0
 */
export class ProviderProbeInput extends S.Opaque<ProviderProbeInput, { readonly brand: unique symbol }>()(
  S.Struct({
    binaryPath: Domain.BinaryPath,
    envVars: Domain.EnvVars,
    homePath: S.OptionFromNullOr(Domain.HomePath),
    kind: Domain.ProviderKind,
  }).pipe(
    $I.annoteSchema("ProviderProbeInput", {
      description: "Provider CLI configuration consumed by the product-neutral authentication probe port.",
    })
  )
) {}

/**
 *  Probe operation implemented by the agents server adapter.
 *
 * **Example** (Satisfy probe shape)
 *
 * ```ts
 * import type { ProviderProbeShape } from "@beep/agents-use-cases/server"
 * import * as Effect from "effect/Effect";
 * const probe = { probe: () => Effect.die("example") } satisfies ProviderProbeShape
 * console.log(probe.probe)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface ProviderProbeShape {
  readonly probe: (input: ProviderProbeInput) => Effect.Effect<Domain.AuthSnapshot, ProviderProbeUnavailable>;
}

/**
 *  Context tag for probing provider CLI authentication.
 *
 * **Example** (Yield provider probe)
 *
 * ```ts
 * import { ProviderProbe } from "@beep/agents-use-cases/server"
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () { return yield* ProviderProbe })
 * console.log(program)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class ProviderProbe extends Context.Service<ProviderProbe, ProviderProbeShape>()($I`ProviderProbe`) {}
