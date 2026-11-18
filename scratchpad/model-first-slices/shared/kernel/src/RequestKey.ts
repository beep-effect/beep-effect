import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/** One JSON value as text: the schema encoder, so a value JSON cannot hold fails instead of throwing. */
const jsonText = S.encodeEffect(S.fromJsonString(S.Unknown));

/**
 * Encoded JSON with object keys in one order, so equal content gives equal text. A property
 * whose value is `undefined` is written as `undefined`, as the first version of this function
 * wrote it, so the ids it gave stay the same.
 */
const canonical = (value: unknown): Effect.Effect<string, S.SchemaError> =>
  A.isArray(value)
    ? Effect.map(Effect.forEach(value, canonical, { concurrency: 1 }), (parts) => `[${A.join(parts, ",")}]`)
    : P.isObject(value)
      ? Effect.map(
          Effect.forEach(A.sort(R.keys(value), Order.String), (key) =>
            Effect.zipWith(jsonText(key), canonical(value[key]), (name, text) => `${name}:${text}`),
            { concurrency: 1 },
          ),
          (parts) => `{${A.join(parts, ",")}}`,
        )
      : P.isUndefined(value)
        ? Effect.succeed("undefined")
        : jsonText(value);

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
 * `tenant` is the org (D36): the same resource scope grants are checked
 * against.
 *
 * **Example** (The id for one report)
 * ```ts
 * import { requestKey } from "@proto/kernel/RequestKey";
 * import * as Digest from "effect/crypto/Digest";
 * import * as Effect from "effect/Effect";
 *
 * const commandId = requestKey({ tenant: "org_acme", operation: "ReserveBudget", payload: { units: 40 } }).pipe(
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
  // A payload JSON cannot hold (a bigint, a cycle) is a defect, as it was when this threw.
  const text = yield* Effect.orDie(canonical(request.payload));
  const hex = yield* digest.digestHex(Digest.sha256, encoder.encode(text));
  return `${request.tenant}:${request.operation}:${pipe(hex, Str.slice(0, 32))}`;
});
