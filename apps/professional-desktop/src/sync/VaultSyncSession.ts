/**
 * The desktop principal every vault-sync session adapter acts as.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncSessionBinding } from "@beep/documents-server/aggregates/Sync";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { DesktopRpcSessionToken } from "@/runtime/SessionToken";

// The same user, organization and workspace the desktop already acts as for contradiction review.
const desktopVaultSyncRequest = S.decodeEffect(V.VaultSyncRequest)({
  principal: { kind: "User", userId: 1 },
  principalKey: "User:1",
  actorSourceKind: "User",
  sourceKind: "sidecar",
  orgId: 1,
  workspaceId: 1,
  correlationId: "desktop-launch",
  sessionRef: "desktop-launch",
});

/**
 * Binds the launch token to the desktop principal for every vault-sync session adapter.
 *
 * **Example** (Build the binding)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 * import { layerDesktopVaultSyncBinding } from "@/sync/VaultSyncSession"
 * console.log(Layer.isLayer(layerDesktopVaultSyncBinding(Redacted.make("test-token"))))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerDesktopVaultSyncBinding = (token: Redacted.Redacted<string>) =>
  Layer.effect(
    VaultSyncSessionBinding,
    desktopVaultSyncRequest.pipe(
      Effect.map((request) => VaultSyncSessionBinding.of({ request, token })),
      Effect.orDie
    )
  );

/**
 * The desktop binding over the configured per-launch token.
 *
 * **Details**
 *
 * The sidecar channel adapter does not compare tokens; only the launch-token
 * transports do, and they are mounted only when the token is configured. A
 * launch without one binds a placeholder that no transport accepts.
 *
 * **Example** (Verify the binding layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import { VaultSyncDesktopBindingLive } from "@/sync/VaultSyncSession"
 * console.log(Layer.isLayer(VaultSyncDesktopBindingLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncDesktopBindingLive = Layer.unwrap(
  Effect.map(DesktopRpcSessionToken, (token) =>
    layerDesktopVaultSyncBinding(O.getOrElse(token, () => Redacted.make("unconfigured-launch-token")))
  )
).pipe(Layer.orDie);
