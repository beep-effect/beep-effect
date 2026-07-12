/** Provider-instance server ports. @packageDocumentation @since 0.0.0 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import type * as Agents from "@beep/shared-domain/identity/Agents";
import type { Effect } from "effect";
import type { AddProviderInstanceCommand } from "./ProviderInstance.commands.js";
import type { ProviderInstanceNotFound, ProviderProbeUnavailable } from "./ProviderInstance.errors.js";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.repository");

/** Persistence operations required by provider-instance use cases.
 * @example
 * ```ts
 * import type { ProviderInstanceRepositoryShape } from "@beep/agents-use-cases/server"
 * import { Effect } from "effect"
 * const repository = { add: () => Effect.die("example"), get: () => Effect.die("example"), list: Effect.succeed([]), remove: () => Effect.void, save: (instance) => Effect.succeed(instance) } satisfies ProviderInstanceRepositoryShape
 * console.log(repository.list)
 * ```
 * @category repositories @since 0.0.0
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
 * @category repositories @since 0.0.0
 */
export class ProviderInstanceRepository extends Context.Service<
  ProviderInstanceRepository,
  ProviderInstanceRepositoryShape
>()($I`ProviderInstanceRepository`) {}

/** Input consumed by the product-neutral provider probe port.
 * @example
 * ```ts
 * import type { ProviderProbeInput } from "@beep/agents-use-cases/server"
 * import * as O from "effect/Option"
 * const input = { binaryPath: "/usr/bin/claude", envVars: {}, homePath: O.none(), kind: "claude" } satisfies ProviderProbeInput
 * console.log(input.kind)
 * ```
 * @category ports @since 0.0.0
 */
export interface ProviderProbeInput {
  readonly binaryPath: Domain.BinaryPath;
  readonly envVars: Domain.EnvVars;
  readonly homePath: import("effect/Option").Option<Domain.HomePath>;
  readonly kind: Domain.ProviderKind;
}

/** Probe operation implemented by the agents server adapter.
 * @example
 * ```ts
 * import type { ProviderProbeShape } from "@beep/agents-use-cases/server"
 * import { Effect } from "effect"
 * const probe = { probe: () => Effect.die("example") } satisfies ProviderProbeShape
 * console.log(probe.probe)
 * ```
 * @category ports @since 0.0.0
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
 * @category ports @since 0.0.0
 */
export class ProviderProbe extends Context.Service<ProviderProbe, ProviderProbeShape>()($I`ProviderProbe`) {}
