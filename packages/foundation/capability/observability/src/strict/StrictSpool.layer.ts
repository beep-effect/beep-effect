/**
 * Layers of the strict-tier encrypted spool: the spool itself, the egress
 * sink that records into it, the span-id salt derived from the same root
 * key, and a dev-only in-memory root key.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { TelemetryRefusalTag } from "../Observability.instruments.ts";
import { StrictEgressSink, StrictSalt } from "./StrictGate.service.ts";
import { StrictKeyProtection } from "./StrictSpool.schemas.ts";
import {
  deriveStrictSalt,
  makeStrictSpool,
  refusalLedgerOf,
  StrictSpool,
  StrictSpoolKey,
} from "./StrictSpool.service.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { StrictEgressRecord } from "./StrictGate.schemas.ts";
import type { StrictSpoolError } from "./StrictSpool.errors.ts";
import type { StrictSpoolOptions } from "./StrictSpool.schemas.ts";

const rootKeyBytes = 32;

/**
 * Provides {@link StrictSpool} for one set of options.
 *
 * **Example** (Build the spool layer)
 *
 * ```ts
 * import { layerStrictSpool, StrictSpoolOptions } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * const spool = layerStrictSpool(StrictSpoolOptions.make({ directory: "/state/spool", tier: "shape-only" }))
 * console.log(Layer.isLayer(spool)) // true
 * ```
 *
 * @param options - Directory, tier and byte bound of the spool.
 * @category layers
 * @since 0.0.0
 */
export const layerStrictSpool = (
  options: StrictSpoolOptions
): Layer.Layer<StrictSpool, StrictSpoolError, StrictSpoolKey | FileSystem.FileSystem | Path.Path> =>
  Layer.effect(StrictSpool, makeStrictSpool(options));

/**
 * {@link StrictEgressSink} that seals every held-back body into the
 * {@link StrictSpool}.
 *
 * **Details**
 *
 * Old segments the write evicted count as `spool-evicted`. A body the spool
 * cannot seal, encode or write is lost and counts as `spool-write-failed`.
 * `records` replays the spool and keeps only the bodies that pass.
 *
 * **Example** (Record into the spool)
 *
 * ```ts
 * import { layerStrictSpoolSink } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerStrictSpoolSink)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStrictSpoolSink: Layer.Layer<StrictEgressSink, never, StrictSpool> = Layer.effect(
  StrictEgressSink,
  Effect.map(Effect.service(StrictSpool), (spool) =>
    StrictEgressSink.of({
      // Untraced: it runs inside the exporter, like the spool behind it.
      record: Effect.fnUntraced(function* (record: StrictEgressRecord) {
        return yield* spool
          .append(record)
          .pipe(Effect.orElseSucceed(() => refusalLedgerOf([TelemetryRefusalTag.Enum["spool-write-failed"]])));
      }),
      records: Effect.map(spool.replay, (replay) => replay.records),
    })
  )
);

/**
 * {@link StrictSalt} derived from the {@link StrictSpoolKey} with
 * HKDF-SHA256. Each id is keyed as `hmacSha256Hex(salt ‖ nonce, id)`.
 *
 * **Details**
 *
 * The caller supplies the synchronous HMAC-SHA256 primitive, as for the
 * in-memory salt; a Bun host passes `Bun.CryptoHasher`. Because the salt
 * derives from the persisted root key, keyed ids are stable for one key
 * epoch, while the per-batch nonce still makes them unlinkable across
 * batches.
 *
 * **Example** (Derive the salt from the root key)
 *
 * ```ts
 * import { layerStrictSaltFromKey } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * const salt = layerStrictSaltFromKey((key, value) => `${key.length}:${value}`)
 * console.log(Layer.isLayer(salt)) // true
 * ```
 *
 * @param hmacSha256Hex - Synchronous lowercase hex HMAC-SHA256 of `value` under `key`.
 * @category layers
 * @since 0.0.0
 */
export const layerStrictSaltFromKey = (
  hmacSha256Hex: (key: Uint8Array, value: string) => string
): Layer.Layer<StrictSalt, StrictSpoolError, StrictSpoolKey> =>
  Layer.effect(
    StrictSalt,
    Effect.gen(function* () {
      const StrictSpoolKey1 = yield* StrictSpoolKey;
      const salt = yield* deriveStrictSalt(StrictSpoolKey1);
      return StrictSalt.of({
        keyedHex: (nonce, value) => {
          const key = new Uint8Array(salt.length + nonce.length);
          key.set(salt);
          key.set(nonce, salt.length);
          return hmacSha256Hex(key, value);
        },
      });
    })
  );

/**
 * A root key drawn fresh for each process and never stored, under the epoch
 * `memory`. Not for production: a spool sealed under it cannot be read after
 * the process exits.
 *
 * **Example** (Provide a dev key)
 *
 * ```ts
 * import { layerDevMemoryStrictSpoolKey } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerDevMemoryStrictSpoolKey)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerDevMemoryStrictSpoolKey: Layer.Layer<StrictSpoolKey> = Layer.sync(StrictSpoolKey, () =>
  StrictSpoolKey.of({
    epoch: "memory",
    protection: StrictKeyProtection.Enum["dev-memory"],
    material: Redacted.make(globalThis.crypto.getRandomValues(new Uint8Array(rootKeyBytes))),
  })
);
