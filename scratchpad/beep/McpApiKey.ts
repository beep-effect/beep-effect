/**
 * MCP API key metadata, the stored hash row, and the one-time created secret.
 *
 * **Details**
 *
 * The public key, the database row, and the creation response share the same
 * metadata fields. The raw key and the hash are siblings, not the same column.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model, optionalNull, optionalText, optionalTimestamp, pg, text, timestamp, userId } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/McpApiKey");

const apiKeyFields = {
  id: text("id"),
  name: text("name"),
  keyPrefix: text("key_prefix"),
  createdAt: timestamp("created_at"),
  lastUsedAt: optionalTimestamp("last_used_at"),
  appId: optionalText("app_id"),
  scopes: S.String.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("scopes")),
};

/**
 * Public MCP API key metadata.
 *
 * **Details**
 *
 * `lastUsedAt`, `appId`, and `scopes` are missing-or-null. `scopes` encodes
 * `None` as JSON null, not as an empty list.
 *
 * **Example** (Decode a key that has not been used)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { McpApiKey } from "@beep/scratchpad/beep/McpApiKey"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(McpApiKey)({
 *     id: "key-1",
 *     name: "desktop",
 *     keyPrefix: "omi_live",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(O.isNone(decoded.lastUsedAt)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpApiKey extends Model<McpApiKey>("McpApiKey")(
  apiKeyFields,
  $I.annote("McpApiKey", {
    description: "Public MCP API key metadata. The raw secret and the stored hash are not on this row.",
  }),
) {}

/**
 * Encoded MCP API key metadata.
 *
 * @see {@link McpApiKey} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpApiKey {
  export type Encoded = S.Codec.Encoded<typeof McpApiKey>;
}

/**
 * Stored MCP API key, including the owner and the secret hash.
 *
 * **Details**
 *
 * Python subclasses the public key. This model repeats those columns so the
 * table keeps its own SQL metadata. `hashedKey` is the stored secret hash.
 *
 * **Gotchas**
 *
 * Do not copy `hashedKey` onto {@link McpApiKey} or {@link McpApiKeyCreated}.
 * The created response returns the raw key once; it does not return the hash.
 *
 * **Example** (Decode a stored hash row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { McpApiKeyDB } from "@beep/scratchpad/beep/McpApiKey"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(McpApiKeyDB)({
 *     id: "key-1",
 *     name: "desktop",
 *     keyPrefix: "omi_live",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     userId: "user-1",
 *     hashedKey: "hash",
 *   }),
 * )
 * console.log(decoded.hashedKey) // "hash"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpApiKeyDB extends Model<McpApiKeyDB>("McpApiKeyDB")(
  {
    ...apiKeyFields,
    userId: userId("user_id"),
    hashedKey: text("hashed_key"),
  },
  $I.annote("McpApiKeyDB", {
    description: "Persisted MCP API key: public metadata plus the owning user and the secret hash.",
  }),
) {}

/**
 * Encoded stored MCP API key.
 *
 * @see {@link McpApiKeyDB} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpApiKeyDB {
  export type Encoded = S.Codec.Encoded<typeof McpApiKeyDB>;
}

/**
 * Name supplied when creating an MCP API key.
 *
 * **Example** (Decode a create request)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { McpApiKeyCreate } from "@beep/scratchpad/beep/McpApiKey"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(McpApiKeyCreate)({ name: "desktop" }))
 * console.log(decoded.name) // "desktop"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpApiKeyCreate extends Model<McpApiKeyCreate>("McpApiKeyCreate")(
  { name: text("name") },
  $I.annote("McpApiKeyCreate", {
    description: "Request body that names a new MCP API key.",
  }),
) {}

/**
 * Encoded MCP API key create request.
 *
 * @see {@link McpApiKeyCreate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpApiKeyCreate {
  export type Encoded = S.Codec.Encoded<typeof McpApiKeyCreate>;
}

/**
 * MCP API key creation response, including the raw secret once.
 *
 * **Gotchas**
 *
 * `key` is the raw secret returned once. It is not {@link McpApiKeyDB.hashedKey}
 * and this response is not a subclass of the database row.
 *
 * **Example** (Decode the one-time secret)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { McpApiKeyCreated } from "@beep/scratchpad/beep/McpApiKey"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(McpApiKeyCreated)({
 *     id: "key-1",
 *     name: "desktop",
 *     keyPrefix: "omi_live",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     key: "secret",
 *   }),
 * )
 * console.log(decoded.key) // "secret"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpApiKeyCreated extends Model<McpApiKeyCreated>("McpApiKeyCreated")(
  {
    ...apiKeyFields,
    key: text("key"),
  },
  $I.annote("McpApiKeyCreated", {
    description: "MCP API key creation response. The raw key is present only on this payload.",
  }),
) {}

/**
 * Encoded MCP API key creation response.
 *
 * @see {@link McpApiKeyCreated} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpApiKeyCreated {
  export type Encoded = S.Codec.Encoded<typeof McpApiKeyCreated>;
}
