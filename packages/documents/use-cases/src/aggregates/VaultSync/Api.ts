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
}) {}

const vaultSyncCliCalls = [
  "RequestVaultSync",
  "ProbeDestination",
  "ClaimDestinationName",
  "RecordConflict",
  "PauseDestination",
  "ResumeDestination",
  "ReviewConflict",
  "VaultSyncStatus.get",
  "OpenConflicts.get",
  "DestinationList.get",
  "OperationQueue.get",
] satisfies ReadonlyArray<Cli.Exposable<typeof VaultSyncApi>>;

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
export const vaultSyncCli = <E, R>(options: Cli.Options<typeof VaultSyncApi, E, R>) =>
  Cli.toCli(VaultSyncApi, {
    expose: vaultSyncCliCalls,
    ...options,
  });

/**
 * Options for the remote CLI: the sidecar's protected RPC endpoint plus per-call credentials.
 *
 * **Details**
 *
 * The headers effect reads the launch token from the sidecar handoff for every call and never logs it.
 *
 * @category protocols
 * @since 0.0.0
 */
export type VaultSyncRemoteCliOptions<E, R> = Cli.Options<
  Pick<typeof VaultSyncApi, "apiName" | "annotations" | "serves" | "group"> & {
    readonly client: ReturnType<typeof VaultSyncApi.clientHttp>;
  },
  E,
  R
> & { readonly url: string };

/**
 * Generated remote CLI bound to the sidecar's gated RPC endpoint.
 *
 * **Example** (Select the sidecar endpoint)
 * ```ts
 * import { vaultSyncRemoteCli } from "@beep/documents-use-cases/aggregates/VaultSync";
 * const command = vaultSyncRemoteCli({ url: "http://127.0.0.1:3939/vault-sync/rpc", headers: {} });
 * void command;
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const vaultSyncRemoteCli = <E, R>({ url, ...options }: VaultSyncRemoteCliOptions<E, R>) =>
  Cli.toCli(
    {
      apiName: VaultSyncApi.apiName,
      annotations: VaultSyncApi.annotations,
      serves: VaultSyncApi.serves,
      group: VaultSyncApi.group,
      client: VaultSyncApi.clientHttp(url),
    },
    {
      expose: vaultSyncCliCalls,
      ...options,
    }
  );
