import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";

/** Encoded JSON with object keys in one order, so equal content gives equal text. */
const canonical = (value: unknown): string =>
  A.isArray(value)
    ? `[${A.join(A.map(value, canonical), ",")}]`
    : P.isObject(value)
      ? `{${A.join(
          A.map(A.sort(R.keys(value), Order.String), (key) => `${JSON.stringify(key)}:${canonical(value[key])}`),
          ",",
        )}}`
      : JSON.stringify(value);

const encoder = new TextEncoder();

/**
 * A command id bound to its tenant, its operation and a SHA-256 fingerprint
 * of its encoded content (the first 128 bits, as the workflow engine keeps
 * for its own idempotency keys). A retry of the same request gets the same
 * id, so the platform answers with the first receipt; a different request
 * cannot reuse an id and receive another request's result (D14).
 *
 * **Gotchas**
 *
 * It guards the sends the prototype makes itself (gateways, inboxes). A
 * client that picks its own command id is still answered from the stored
 * receipt without a check; that needs the library (see the phase 3 notes).
 * `tenant` is the scope whose ids must not collide: the principal a gateway
 * acts for, or the producer an inbox consumes.
 *
 * **Example** (The id for one report)
 * ```ts
 * import { requestKey } from "@proto/kernel/RequestKey";
 * import * as Digest from "effect/crypto/Digest";
 * import * as Effect from "effect/Effect";
 *
 * const commandId = requestKey({ tenant: "p_req", operation: "ReserveBudget", payload: { units: 40 } }).pipe(
 *   Effect.provide(Digest.layerWebCrypto),
 * );
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const requestKey = Effect.fnUntraced(function* (request: {
  readonly tenant: string;
  readonly operation: string;
  readonly payload: unknown;
}) {
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, encoder.encode(canonical(request.payload)));
  return `${request.tenant}:${request.operation}:${pipe(hex, Str.slice(0, 32))}`;
});
