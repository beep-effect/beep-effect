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
 * Adds one provider instance.
 *
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
export class AddProviderInstanceCommand extends S.Class<AddProviderInstanceCommand>($I`AddProviderInstanceCommand`)(
  configurationFields,
  $I.annote("AddProviderInstanceCommand", { description: "Command for adding a provider CLI instance." })
) {}

/**
 * Updates one provider instance's configuration.
 *
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
export class UpdateProviderInstanceCommand extends S.Class<UpdateProviderInstanceCommand>(
  $I`UpdateProviderInstanceCommand`
)(
  { id: Agents.ProviderInstanceId, ...configurationFields },
  $I.annote("UpdateProviderInstanceCommand", { description: "Command for updating provider instance configuration." })
) {}

/**
 * Removes one provider instance.
 *
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
export class RemoveProviderInstanceCommand extends S.Class<RemoveProviderInstanceCommand>(
  $I`RemoveProviderInstanceCommand`
)(
  { id: Agents.ProviderInstanceId },
  $I.annote("RemoveProviderInstanceCommand", { description: "Command for removing a provider instance." })
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
export class ProbeProviderInstanceCommand extends S.Class<ProbeProviderInstanceCommand>(
  $I`ProbeProviderInstanceCommand`
)(
  { id: Agents.ProviderInstanceId },
  $I.annote("ProbeProviderInstanceCommand", { description: "Command for probing a provider instance." })
) {}

/**
 * Loads one provider instance by id.
 *
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
export class GetProviderInstanceQuery extends S.Class<GetProviderInstanceQuery>($I`GetProviderInstanceQuery`)(
  { id: Agents.ProviderInstanceId },
  $I.annote("GetProviderInstanceQuery", { description: "Query for loading one provider instance." })
) {}

/**
 * Lists all provider instances.
 *
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
export class ListProviderInstancesQuery extends S.Class<ListProviderInstancesQuery>($I`ListProviderInstancesQuery`)(
  {},
  $I.annote("ListProviderInstancesQuery", { description: "Query for listing every provider instance." })
) {}
