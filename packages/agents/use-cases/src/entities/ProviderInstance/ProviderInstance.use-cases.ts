/**
 * Provider-instance use-case contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import type { Effect } from "effect";
import type {
  AddProviderInstanceCommand,
  GetProviderInstanceQuery,
  ListProviderInstancesQuery,
  ProbeProviderInstanceCommand,
  RemoveProviderInstanceCommand,
  UpdateProviderInstanceCommand,
} from "./ProviderInstance.commands.js";
import type { ProviderActionError } from "./ProviderInstance.errors.js";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.use-cases");

/** Callable provider-instance application operations.
 * @example
 * ```ts
 * import type { ProviderInstanceUseCasesShape } from "@beep/agents-use-cases/public"
 * import { Effect } from "effect"
 * const useCases = { add: () => Effect.die("example"), update: () => Effect.die("example"), remove: () => Effect.void, probe: () => Effect.die("example"), get: () => Effect.die("example"), list: () => Effect.succeed([]) } satisfies ProviderInstanceUseCasesShape
 * console.log(useCases.list)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export interface ProviderInstanceUseCasesShape {
  readonly add: (command: AddProviderInstanceCommand) => Effect.Effect<Domain.ProviderInstance, ProviderActionError>;
  readonly get: (query: GetProviderInstanceQuery) => Effect.Effect<Domain.ProviderInstance, ProviderActionError>;
  readonly list: (
    query: ListProviderInstancesQuery
  ) => Effect.Effect<ReadonlyArray<Domain.ProviderInstance>, ProviderActionError>;
  readonly probe: (
    command: ProbeProviderInstanceCommand
  ) => Effect.Effect<Domain.ProviderInstance, ProviderActionError>;
  readonly remove: (command: RemoveProviderInstanceCommand) => Effect.Effect<void, ProviderActionError>;
  readonly update: (
    command: UpdateProviderInstanceCommand
  ) => Effect.Effect<Domain.ProviderInstance, ProviderActionError>;
}

/** Context tag for provider-instance use cases.
 * @example
 * ```ts
 * import { ProviderInstanceUseCases } from "@beep/agents-use-cases/public"
 * import { Effect } from "effect"
 * const program = Effect.gen(function* () { return yield* ProviderInstanceUseCases })
 * console.log(program)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class ProviderInstanceUseCases extends Context.Service<
  ProviderInstanceUseCases,
  ProviderInstanceUseCasesShape
>()($I`ProviderInstanceUseCases`) {}
