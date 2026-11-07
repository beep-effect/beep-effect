/**
 * Closed vault-sync API surface. Hosts must use the protected delivery adapters.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as Cli from "@alchemy.run/domain/Cli";
import { VaultSyncPassModel } from "./Model.ts";

/**
 * Public initiators and member Views; internal confirmation and worker commands stay private.
 *
 * **Example** (Inspect exposed commands)
 * ```ts
 * import { VaultSyncApi } from "@beep/documents-use-cases/aggregates/VaultSync";
 * console.log(VaultSyncApi.commands.map((command) => command.tag));
 * ```
 * @category protocols
 * @since 0.0.0
 */
export class VaultSyncApi extends Domain.Api("VaultSyncApi", {
  model: VaultSyncPassModel,
  commands: [
    "RequestVaultSync",
    "ProbeDestination",
    "ClaimDestinationName",
    "RecordConflict",
    "PauseDestination",
    "ResumeDestination",
    "ReviewConflict",
  ],
  views: ["VaultSyncStatus", "OpenConflicts", "DestinationList", "OperationQueue"],
  streams: [],
  aggregates: [],
}) {}

/**
 * CLI derived from the same API; the host supplies per-call enrolled credentials.
 *
 * **Example** (Build command)
 * ```ts
 * import { vaultSyncCli } from "@beep/documents-use-cases/aggregates/VaultSync";
 * const command = vaultSyncCli({ headers: {} });
 * void command;
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const vaultSyncCli = <E, R>(options: Cli.Options<E, R>) => Cli.toCli(VaultSyncApi, options);

/**
 * Generated remote CLI bound to the sidecar RPC endpoint.
 *
 * **Example** (Select the sidecar endpoint)
 * ```ts
 * import { vaultSyncRemoteCli } from "@beep/documents-use-cases/aggregates/VaultSync";
 * const command = vaultSyncRemoteCli("http://localhost:3939/vault-sync/rpc", { headers: {} });
 * void command;
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const vaultSyncRemoteCli = <E, R>(url: string, options: Cli.Options<E, R>) =>
  Cli.toCli(
    {
      apiName: VaultSyncApi.apiName,
      serves: VaultSyncApi.serves,
      group: VaultSyncApi.group,
      client: VaultSyncApi.clientHttp(url),
    },
    options
  );
