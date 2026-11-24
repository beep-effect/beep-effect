/**
 * Provider-instance command and query payloads.
 *
 * @packageDocumentation
 * @category commands
 * @since 0.0.0
 */

import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import { $AgentsUseCasesId } from "@beep/identity/packages";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.commands");

const configurationFields = {
  binaryPath: Domain.BinaryPath.annotateKey({ description: "Provider CLI binary path." }),
  envVars: Domain.EnvVars.annotateKey({ description: "Token-safe environment variables passed to the CLI." }),
  homePath: S.OptionFromNullOr(Domain.HomePath).annotateKey({ description: "Optional isolated CLI HOME path." }),
  kind: Domain.ProviderKind.annotateKey({ description: "Provider CLI kind." }),
  label: Domain.InstanceLabel.annotateKey({ description: "Human-readable instance label." }),
};

/**
 * **Example** (Make add provider command)
 *
 * ```ts
 * import { AddProviderInstanceCommand } from "@beep/agents-use-cases/public"
 * import * as Domain from "@beep/agents-domain/entities/ProviderInstance"
 * import * as O from "effect/Option"
 * const command = AddProviderInstanceCommand.make({
 *   binaryPath: Domain.BinaryPath.make("/usr/bin/claude"),
 *   envVars: {},
 *   homePath: O.none(),
 *   kind: "claude",
 *   label: Domain.InstanceLabel.make("Personal")
 * })
 * console.log(command.kind) // "claude"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class AddProviderInstanceCommand extends S.Opaque<
  AddProviderInstanceCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct(configurationFields).pipe(
    $I.annoteSchema("AddProviderInstanceCommand", { description: "Command for adding a provider CLI instance." })
  )
) {}

/**
 * **Example** (Make update provider command)
 *
 * ```ts
 * import { UpdateProviderInstanceCommand } from "@beep/agents-use-cases/public"
 * import * as Domain from "@beep/agents-domain/entities/ProviderInstance"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * import * as O from "effect/Option"
 * const command = UpdateProviderInstanceCommand.make({
 *   id: Agents.ProviderInstanceId.make(1),
 *   binaryPath: Domain.BinaryPath.make("/usr/bin/codex"),
 *   envVars: {},
 *   homePath: O.none(),
 *   kind: "codex",
 *   label: Domain.InstanceLabel.make("Work")
 * })
 * console.log(command.label) // "Work"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UpdateProviderInstanceCommand extends S.Opaque<
  UpdateProviderInstanceCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct({ id: Agents.ProviderInstanceId, ...configurationFields }).pipe(
    $I.annoteSchema("UpdateProviderInstanceCommand", {
      description: "Command for updating provider instance configuration.",
    })
  )
) {}

/**
 * **Example** (Make remove provider command)
 *
 * ```ts
 * import { RemoveProviderInstanceCommand } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * console.log(RemoveProviderInstanceCommand.make({ id: Agents.ProviderInstanceId.make(1) }).id) // 1
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class RemoveProviderInstanceCommand extends S.Opaque<
  RemoveProviderInstanceCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct({ id: Agents.ProviderInstanceId }).pipe(
    $I.annoteSchema("RemoveProviderInstanceCommand", { description: "Command for removing a provider instance." })
  )
) {}

/**
 * Probes one provider instance and persists its resulting auth snapshot.
 *
 * **Example** (Make probe provider command)
 *
 * ```ts
 * import { ProbeProviderInstanceCommand } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * console.log(ProbeProviderInstanceCommand.make({ id: Agents.ProviderInstanceId.make(1) }).id) // 1
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ProbeProviderInstanceCommand extends S.Opaque<
  ProbeProviderInstanceCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct({ id: Agents.ProviderInstanceId }).pipe(
    $I.annoteSchema("ProbeProviderInstanceCommand", { description: "Command for probing a provider instance." })
  )
) {}

/**
 * **Example** (Make get provider query)
 *
 * ```ts
 * import { GetProviderInstanceQuery } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * console.log(GetProviderInstanceQuery.make({ id: Agents.ProviderInstanceId.make(1) }).id) // 1
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class GetProviderInstanceQuery extends S.Opaque<GetProviderInstanceQuery, { readonly brand: unique symbol }>()(
  S.Struct({ id: Agents.ProviderInstanceId }).pipe(
    $I.annoteSchema("GetProviderInstanceQuery", { description: "Query for loading one provider instance." })
  )
) {}

/**
 * **Example** (Make list providers query)
 *
 * ```ts
 * import { ListProviderInstancesQuery } from "@beep/agents-use-cases/public"
 * console.log(ListProviderInstancesQuery.make({}))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class ListProviderInstancesQuery extends S.Opaque<
  ListProviderInstancesQuery,
  { readonly brand: unique symbol }
>()(
  S.Struct({}).pipe(
    $I.annoteSchema("ListProviderInstancesQuery", { description: "Query for listing every provider instance." })
  )
) {}
