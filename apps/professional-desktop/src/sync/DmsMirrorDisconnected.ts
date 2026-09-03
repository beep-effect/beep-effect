/**
 * App-side disconnected DMS mirror layers.
 *
 * Substituted for the Box-backed adapter when no Box credentials (neither the
 * CCG trio nor `CLOUD_BOX_TOKEN`) are configured: every mirror verb fails with
 * a typed, non-retryable `DmsMirrorUnavailable` carrying setup guidance, and the availability probe
 * reports the provider as disconnected so the sync status surface can render
 * an honest connection state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorProbe,
  DmsMirrorUnavailable,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const disconnected = Effect.fail(
  DmsMirrorUnavailable.make({
    provider: "box",
    reason: "Box is not connected. Configure CCG credentials or set CLOUD_BOX_TOKEN, then restart the app.",
    retryable: false,
  })
);

const failDisconnected = () => disconnected;

/**
 * `DmsMirror` layer whose every verb fails with a typed non-retryable
 * `DmsMirrorUnavailable` explaining how to connect Box.
 *
 * **Example** (Verifying disconnected layer)
 *
 * ```ts
 * import { DmsMirrorDisconnectedLayer } from "@/sync/DmsMirrorDisconnected"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(DmsMirrorDisconnectedLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorDisconnectedLayer: Layer.Layer<DmsMirror> = Layer.succeed(
  DmsMirror,
  DmsMirror.of({
    ensureFolder: failDisconnected,
    moveItem: failDisconnected,
    pollEvents: failDisconnected,
    renameItem: failDisconnected,
    uploadFile: failDisconnected,
    uploadFileVersion: failDisconnected,
  })
);

const disconnectedProbe = Effect.succeed(
  DmsMirrorProbe.make({ connected: false, disconnectReason: O.some("credentials-missing"), provider: "box" })
);

/**
 * `DmsMirrorAvailability` layer whose probe reports Box as disconnected.
 *
 * **Example** (Verifying availability layer)
 *
 * ```ts
 * import { DmsMirrorAvailabilityDisconnectedLayer } from "@/sync/DmsMirrorDisconnected"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(DmsMirrorAvailabilityDisconnectedLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorAvailabilityDisconnectedLayer: Layer.Layer<DmsMirrorAvailability> = Layer.succeed(
  DmsMirrorAvailability,
  DmsMirrorAvailability.of({ probe: disconnectedProbe, refresh: disconnectedProbe })
);
