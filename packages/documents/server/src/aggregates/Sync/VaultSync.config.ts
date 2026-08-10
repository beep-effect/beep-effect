/**
 * Runtime configuration for the vault sync engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsServerId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema";
import { Config, Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSync.config");

/**
 * Environment variable controlling the maximum push attempts per operation.
 *
 * **Example** (Log max attempts env)
 *
 * ```ts
 * import { DOCUMENTS_SYNC_MAX_ATTEMPTS_ENV } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DOCUMENTS_SYNC_MAX_ATTEMPTS_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DOCUMENTS_SYNC_MAX_ATTEMPTS_ENV = "DOCUMENTS_SYNC_MAX_ATTEMPTS";

/**
 * Environment variable controlling the maximum remote-event pages polled per sync pass.
 *
 * **Example** (Log event page limit env)
 *
 * ```ts
 * import { DOCUMENTS_SYNC_EVENT_PAGE_LIMIT_ENV } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DOCUMENTS_SYNC_EVENT_PAGE_LIMIT_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DOCUMENTS_SYNC_EVENT_PAGE_LIMIT_ENV = "DOCUMENTS_SYNC_EVENT_PAGE_LIMIT";

/**
 * Default maximum push attempts before an operation fails terminally.
 *
 * **Example** (Log default max attempts)
 *
 * ```ts
 * import { DOCUMENTS_SYNC_DEFAULT_MAX_ATTEMPTS } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DOCUMENTS_SYNC_DEFAULT_MAX_ATTEMPTS)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DOCUMENTS_SYNC_DEFAULT_MAX_ATTEMPTS = PosInt.make(3);

/**
 * Default maximum remote-event pages polled per sync pass.
 *
 * **Example** (Log default page limit)
 *
 * ```ts
 * import { DOCUMENTS_SYNC_DEFAULT_EVENT_PAGE_LIMIT } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DOCUMENTS_SYNC_DEFAULT_EVENT_PAGE_LIMIT)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DOCUMENTS_SYNC_DEFAULT_EVENT_PAGE_LIMIT = PosInt.make(100);

/**
 * Resolved configuration value for the vault sync engine.
 *
 * **Example** (Make vault sync config)
 *
 * ```ts
 * import { VaultSyncConfigValue } from "@beep/documents-server/aggregates/Sync"
 * import { PosInt } from "@beep/schema"
 *
 * const config = VaultSyncConfigValue.make({
 *   eventPageLimit: PosInt.make(100),
 *   maxAttempts: PosInt.make(3)
 * })
 * console.log(config.maxAttempts)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class VaultSyncConfigValue extends S.Class<VaultSyncConfigValue>($I`VaultSyncConfigValue`)(
  {
    eventPageLimit: PosInt.annotateKey({
      description: "Maximum remote-event pages polled per sync pass.",
    }),
    maxAttempts: PosInt.annotateKey({
      description: "Maximum push attempts before an operation fails terminally.",
    }),
  },
  $I.annote("VaultSyncConfigValue", {
    description: "Resolved configuration value for the vault sync engine.",
  })
) {}

/**
 * Typed runtime configuration service for the vault sync engine.
 *
 * **Example** (Log config service key)
 *
 * ```ts
 * import { VaultSyncConfig } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncConfig.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncConfig extends Context.Service<VaultSyncConfig, VaultSyncConfigValue>()($I`VaultSyncConfig`) {
  /**
   * Escape hatch building a config layer from an explicit value.
   *
   * **Example** (Build layer from value)
   *
   * ```ts
   * import { VaultSyncConfig, VaultSyncConfigValue } from "@beep/documents-server/aggregates/Sync"
   * import { PosInt } from "@beep/schema"
   *
   * const layer = VaultSyncConfig.layerConfig(
   *   VaultSyncConfigValue.make({ eventPageLimit: PosInt.make(10), maxAttempts: PosInt.make(1) })
   * )
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerConfig = (value: VaultSyncConfigValue): Layer.Layer<VaultSyncConfig> =>
    Layer.succeed(VaultSyncConfig, value);
}

const readVaultSyncConfig = Effect.fn($I`readVaultSyncConfig`)(function* () {
  const eventPageLimit = yield* Config.schema(PosInt, DOCUMENTS_SYNC_EVENT_PAGE_LIMIT_ENV).pipe(
    Config.withDefault(DOCUMENTS_SYNC_DEFAULT_EVENT_PAGE_LIMIT)
  );
  const maxAttempts = yield* Config.schema(PosInt, DOCUMENTS_SYNC_MAX_ATTEMPTS_ENV).pipe(
    Config.withDefault(DOCUMENTS_SYNC_DEFAULT_MAX_ATTEMPTS)
  );

  return VaultSyncConfigValue.make({ eventPageLimit, maxAttempts });
});

/**
 * Live configuration layer backed by the ambient Effect ConfigProvider.
 *
 * **Example** (Log live config layer)
 *
 * ```ts
 * import { VaultSyncConfigLayer } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncConfigLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncConfigLayer = Layer.effect(VaultSyncConfig, readVaultSyncConfig());
