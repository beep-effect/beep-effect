/**
 * App-side disconnected DMS mirror layers.
 *
 * Substituted for the Box-backed adapter when `CLOUD_BOX_TOKEN` is not
 * configured: every mirror verb fails with a typed, non-retryable
 * `DmsMirrorUnavailable` carrying setup guidance, and the availability probe
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
import { Effect, Layer } from "effect";
import * as O from "effect/Option";

const disconnected = Effect.fail(
  DmsMirrorUnavailable.make({
    provider: "box",
    reason: "Box is not connected. Set CLOUD_BOX_TOKEN and restart the app.",
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
 * import { Layer } from "effect"
 *
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

/**
 * `DmsMirrorAvailability` layer whose probe reports Box as disconnected.
 *
 * **Example** (Verifying availability layer)
 *
 * ```ts
 * import { DmsMirrorAvailabilityDisconnectedLayer } from "@/sync/DmsMirrorDisconnected"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(DmsMirrorAvailabilityDisconnectedLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorAvailabilityDisconnectedLayer: Layer.Layer<DmsMirrorAvailability> = Layer.succeed(
  DmsMirrorAvailability,
  DmsMirrorAvailability.of({
    probe: Effect.succeed(
      DmsMirrorProbe.make({ connected: false, disconnectReason: O.some("credentials-missing"), provider: "box" })
    ),
  })
);
