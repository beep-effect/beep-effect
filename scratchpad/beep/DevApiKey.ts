/**
 * Developer API key rows.
 *
 * **Details**
 *
 * The public key, the stored hash, and the one-shot raw secret stay on
 * different models. A create request does not carry an id or a secret.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { optionalTimestamp, text, timestamp, userId } from "./Kit.ts";
import { Model, optionalJsonColumn } from "./Port.ts";

const $I = $ScratchpadId.create("beep/DevApiKey");

const devApiKeyFields = {
  id: text("id"),
  name: text("name"),
  keyPrefix: text("key_prefix"),
  createdAt: timestamp("created_at"),
  lastUsedAt: optionalTimestamp("last_used_at"),
  scopes: optionalJsonColumn(S.Array(S.String), "scopes"),
};

/**
 * Public developer API key.
 *
 * **Details**
 *
 * `scopes` null is not an empty list. `last_used_at` is absent until the key
 * is used. The raw secret and the hash are not on this model.
 *
 * **Example** (Decode a key that has not been used)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DevApiKeyWire } from "@beep/scratchpad/beep/DevApiKey"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DevApiKeyWire)({
 *     id: "k1",
 *     name: "ci",
 *     key_prefix: "omi_",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     last_used_at: null,
 *     scopes: null,
 *   }),
 * )
 * console.log(O.isNone(decoded.lastUsedAt)) // true
 * console.log(O.isNone(decoded.scopes)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DevApiKey extends Model<DevApiKey>("DevApiKey")(
  devApiKeyFields,
  $I.annote("DevApiKey", {
    description: "Public developer API key. The raw secret and the hash are stored on other models.",
  }),
) {}

/**
 * Encoded form of {@link DevApiKey}.
 *
 * @see {@link DevApiKeyWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevApiKey {
  export type Encoded = S.Codec.Encoded<typeof DevApiKey>;
}

/**
 * Snake_case codec for {@link DevApiKey}.
 *
 * **Example** (Encode the key prefix)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DevApiKey, DevApiKeyWire } from "@beep/scratchpad/beep/DevApiKey"
 *
 * const encoded = Effect.runSync(
 *   S.encodeEffect(DevApiKeyWire)(
 *     DevApiKey.make({
 *       id: "k1",
 *       name: "ci",
 *       keyPrefix: "omi_",
 *       createdAt: "2020-01-02T03:04:05.000Z",
 *     }),
 *   ),
 * )
 * console.log(encoded.key_prefix) // "omi_"
 * ```
 *
 * @see {@link DevApiKey} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DevApiKeyWire = DevApiKey.pipe(
  S.encodeKeys({
    keyPrefix: "key_prefix",
    createdAt: "created_at",
    lastUsedAt: "last_used_at",
  }),
);

/**
 * Server row for a developer API key.
 *
 * **Details**
 *
 * Adds the owning user and the secret hash. Those fields are not part of the
 * public read model.
 *
 * **Gotchas**
 *
 * `hashed_key` is a secret. Do not copy it onto {@link DevApiKey} or a create
 * request.
 *
 * **Example** (Decode the stored hash)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DevApiKeyDbWire } from "@beep/scratchpad/beep/DevApiKey"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DevApiKeyDbWire)({
 *     id: "k1",
 *     name: "ci",
 *     key_prefix: "omi_",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     user_id: "u1",
 *     hashed_key: "hash",
 *   }),
 * )
 * console.log(decoded.hashedKey) // "hash"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DevApiKeyDb extends Model<DevApiKeyDb>("DevApiKeyDb")(
  {
    ...devApiKeyFields,
    userId: userId("user_id"),
    hashedKey: text("hashed_key"),
  },
  $I.annote("DevApiKeyDb", {
    description: "Server-side developer API key row, including the owner and the secret hash.",
  }),
) {}

/**
 * Encoded form of {@link DevApiKeyDb}.
 *
 * @see {@link DevApiKeyDbWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevApiKeyDb {
  export type Encoded = S.Codec.Encoded<typeof DevApiKeyDb>;
}

/**
 * Snake_case codec for {@link DevApiKeyDb}.
 *
 * **Example** (Keep the hash off the public shape)
 *
 * ```ts
 * import { DevApiKeyDb } from "@beep/scratchpad/beep/DevApiKey"
 *
 * console.log("hashedKey" in DevApiKeyDb.fields) // true
 * ```
 *
 * @see {@link DevApiKey} for the public read model.
 * @category codecs
 * @since 0.0.0
 */
export const DevApiKeyDbWire = DevApiKeyDb.pipe(
  S.encodeKeys({
    keyPrefix: "key_prefix",
    createdAt: "created_at",
    lastUsedAt: "last_used_at",
    userId: "user_id",
    hashedKey: "hashed_key",
  }),
);

/**
 * Request to create a developer API key.
 *
 * **Details**
 *
 * Only the display name and optional scopes are accepted. The server mints
 * the id, prefix, timestamps, and secret.
 *
 * **Example** (Decode a create request with null scopes)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DevApiKeyCreateWire } from "@beep/scratchpad/beep/DevApiKey"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(DevApiKeyCreateWire)({ name: "ci", scopes: null }))
 * console.log(decoded.name) // "ci"
 * console.log(O.isNone(decoded.scopes)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DevApiKeyCreate extends Model<DevApiKeyCreate>("DevApiKeyCreate")(
  {
    name: text("name"),
    scopes: optionalJsonColumn(S.Array(S.String), "scopes"),
  },
  $I.annote("DevApiKeyCreate", {
    description: "Create request for a developer API key. No secret is accepted from the client.",
  }),
) {}

/**
 * Encoded form of {@link DevApiKeyCreate}.
 *
 * @see {@link DevApiKeyCreate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevApiKeyCreate {
  export type Encoded = S.Codec.Encoded<typeof DevApiKeyCreate>;
}

/**
 * Snake_case codec for {@link DevApiKeyCreate}.
 *
 * **Example** (Decode a missing scopes key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DevApiKeyCreateWire } from "@beep/scratchpad/beep/DevApiKey"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(DevApiKeyCreateWire)({ name: "ci" }))
 * console.log(O.isNone(decoded.scopes)) // true
 * ```
 *
 * @see {@link DevApiKeyCreate} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DevApiKeyCreateWire = DevApiKeyCreate.pipe(S.encodeKeys({}));

/**
 * Response returned once, when a developer API key is created.
 *
 * **Details**
 *
 * `key` is the raw secret. It is not stored on {@link DevApiKey} and is not
 * the hash on {@link DevApiKeyDb}.
 *
 * **Gotchas**
 *
 * Showing `key` again is a product bug. Persist {@link DevApiKeyDb.hashedKey}
 * and return that row's public projection afterwards.
 *
 * **Example** (Decode the one-shot secret)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DevApiKeyCreatedWire } from "@beep/scratchpad/beep/DevApiKey"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(DevApiKeyCreatedWire)({
 *     id: "k1",
 *     name: "ci",
 *     key_prefix: "omi_",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     key: "omi_secret",
 *   }),
 * )
 * console.log(decoded.key) // "omi_secret"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DevApiKeyCreated extends Model<DevApiKeyCreated>("DevApiKeyCreated")(
  {
    ...devApiKeyFields,
    key: text("key"),
  },
  $I.annote("DevApiKeyCreated", {
    description: "Create response that includes the raw developer API key once.",
  }),
) {}

/**
 * Encoded form of {@link DevApiKeyCreated}.
 *
 * @see {@link DevApiKeyCreatedWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevApiKeyCreated {
  export type Encoded = S.Codec.Encoded<typeof DevApiKeyCreated>;
}

/**
 * Snake_case codec for {@link DevApiKeyCreated}.
 *
 * **Example** (Confirm the secret field is present)
 *
 * ```ts
 * import { DevApiKeyCreated } from "@beep/scratchpad/beep/DevApiKey"
 *
 * console.log("key" in DevApiKeyCreated.fields) // true
 * ```
 *
 * @see {@link DevApiKeyCreated} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const DevApiKeyCreatedWire = DevApiKeyCreated.pipe(
  S.encodeKeys({
    keyPrefix: "key_prefix",
    createdAt: "created_at",
    lastUsedAt: "last_used_at",
  }),
);
