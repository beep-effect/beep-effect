/**
 * Data models for Discord REST probes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DiscordId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $DiscordId.create("Discord.models");

/**
 * Discord's public REST v10 base URL.
 *
 * **Example** (Log Discord API URL)
 *
 * ```ts
 * import { DISCORD_API_URL } from "@beep/discord"
 *
 * console.log(DISCORD_API_URL) // "https://discord.com/api/v10"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DISCORD_API_URL = "https://discord.com/api/v10";

const normalizeDiscordBaseUrl = Str.replace(/\/+$/, "");

const DiscordBaseUrl = S.String.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: normalizeDiscordBaseUrl,
      encode: (baseUrl) => baseUrl,
    })
  ),
  $I.annoteSchema("DiscordBaseUrl", {
    description: "Discord REST API base URL normalized without trailing slashes.",
  })
);

const DiscordSnowflake = S.String.check(
  S.isPattern(/^\d{17,20}$/u, {
    identifier: $I`DiscordSnowflakePattern`,
    title: "Discord snowflake identifier",
    description: "Discord snowflake identifiers are decimal strings between 17 and 20 digits.",
    message: "Discord snowflakes must be 17 to 20 decimal digits",
  })
).pipe(
  $I.annoteSchema("DiscordSnowflake", {
    description: "Discord snowflake identifier encoded as a decimal string.",
  })
);

/**
 * Numeric HTTP status code used in Discord proof and error payloads.
 *
 * **Example** (Decode HTTP status code)
 *
 * ```ts
 * import { DiscordHttpStatus } from "@beep/discord"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownOption(DiscordHttpStatus)(200)
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DiscordHttpStatus = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isInt32({
        identifier: $I`DiscordHttpStatusInteger`,
        title: "Discord HTTP status integer",
        description: "Discord HTTP status codes must be integer numbers.",
        message: "Discord HTTP status codes must be integer numbers",
      }),
      S.isGreaterThanOrEqualTo(100, {
        identifier: $I`DiscordHttpStatusMinimum`,
        title: "Discord HTTP status minimum",
        description: "Discord HTTP status codes start at 100.",
        message: "Discord HTTP status codes must be at least 100",
      }),
      S.isLessThanOrEqualTo(599, {
        identifier: $I`DiscordHttpStatusMaximum`,
        title: "Discord HTTP status maximum",
        description: "Discord HTTP status codes end at 599.",
        message: "Discord HTTP status codes must be at most 599",
      }),
    ],
    {
      identifier: $I`DiscordHttpStatusChecks`,
      title: "Discord HTTP status",
      description: "Checks for numeric HTTP status codes retained in Discord proof and error payloads.",
    }
  )
).pipe(
  $I.annoteSchema("DiscordHttpStatus", {
    description: "Numeric HTTP status code used in Discord proof and error payloads.",
  })
);

/**
 * {@inheritDoc DiscordHttpStatus}
 *
 * **Example** (Type-annotate status value)
 *
 * ```ts
 * import type { DiscordHttpStatus } from "@beep/discord"
 *
 * const status: DiscordHttpStatus = 200
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DiscordHttpStatus = typeof DiscordHttpStatus.Type;

const DiscordHttpSuccessStatus = DiscordHttpStatus.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(200, {
        identifier: $I`DiscordHttpSuccessStatusMinimum`,
        title: "Discord HTTP success status minimum",
        description: "Successful Discord proof statuses start at 200.",
        message: "Discord proof statuses must be at least 200",
      }),
      S.isLessThanOrEqualTo(299, {
        identifier: $I`DiscordHttpSuccessStatusMaximum`,
        title: "Discord HTTP success status maximum",
        description: "Successful Discord proof statuses end at 299.",
        message: "Discord proof statuses must be at most 299",
      }),
    ],
    {
      identifier: $I`DiscordHttpSuccessStatusChecks`,
      title: "Discord HTTP success status",
      description: "Checks for numeric 2XX HTTP status codes retained in Discord proof payloads.",
    }
  )
).pipe(
  $I.annoteSchema("DiscordHttpSuccessStatus", {
    description: "Numeric 2XX HTTP status code retained in Discord proof payloads.",
  })
);

/**
 * Runtime configuration accepted by {@link Discord.makeLayer}.
 *
 * **Details**
 *
 * Omit `baseUrl` for Discord's public v10 API. Tests and local adapters can
 * provide a replacement base URL; the service decodes configuration before
 * request construction so trailing slashes are stripped from request paths.
 *
 * **Example** (Make config with baseUrl)
 *
 * ```ts
 * import { DiscordConfigInput } from "@beep/discord"
 *
 * const config = DiscordConfigInput.make({
 *   baseUrl: "https://discord.example.test/api/v10/"
 * })
 *
 * console.log(config.baseUrl)
 * ```
 *
 * @see {@link Discord.makeLayer} for the Discord service layer.
 * @category models
 * @since 0.0.0
 */
export class DiscordConfigInput extends S.Class<DiscordConfigInput>($I`DiscordConfigInput`)(
  {
    baseUrl: DiscordBaseUrl.pipe(SchemaUtils.withKeyDefaults(DISCORD_API_URL)).annotateKey({
      description: "Discord REST base URL; defaults to Discord's public v10 API.",
    }),
  },
  $I.annote("DiscordConfigInput", {
    description: "Runtime configuration accepted by the Discord REST driver layer.",
  })
) {}

/**
 * Request payload for proving a Discord channel can be reached.
 *
 * **Example** (Make channel request)
 *
 * ```ts
 * import { DiscordChannelRequest } from "@beep/discord"
 *
 * const request = DiscordChannelRequest.make({
 *   channelId: "123456789012345678"
 * })
 *
 * console.log(request.channelId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiscordChannelRequest extends S.Class<DiscordChannelRequest>($I`DiscordChannelRequest`)(
  {
    channelId: DiscordSnowflake.annotateKey({
      description: "Discord channel snowflake identifier.",
    }),
  },
  $I.annote("DiscordChannelRequest", {
    description: "Request payload for proving a Discord channel can be reached.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(DiscordChannelRequest);
}

/**
 * Request payload for creating a Discord proof message.
 *
 * **Details**
 *
 * The service sends the content with `allowed_mentions.parse` set to an empty
 * array so proof messages do not notify users, roles, or everyone mentions.
 *
 * **Example** (Make create message request)
 *
 * ```ts
 * import { DiscordCreateMessageRequest } from "@beep/discord"
 *
 * const request = DiscordCreateMessageRequest.make({
 *   channelId: "123456789012345678",
 *   content: "P1 Discord proof"
 * })
 *
 * console.log(request.content)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiscordCreateMessageRequest extends S.Class<DiscordCreateMessageRequest>($I`DiscordCreateMessageRequest`)(
  {
    channelId: DiscordSnowflake.annotateKey({
      description: "Discord channel snowflake identifier.",
    }),
    content: S.NonEmptyString.annotateKey({
      description: "Proof message content to send without Discord mention expansion.",
    }),
  },
  $I.annote("DiscordCreateMessageRequest", {
    description: "Request payload for creating a Discord proof message.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(DiscordCreateMessageRequest);
}

/**
 * Sanitized metadata returned after a successful channel lookup.
 *
 * **Details**
 *
 * The proof keeps the channel identifier, HTTP status, and optional guild/name
 * metadata needed for liveness evidence without retaining the raw Discord
 * response payload.
 *
 * **Example** (Make channel proof)
 *
 * ```ts
 * import { DiscordChannelProof } from "@beep/discord"
 * import * as O from "effect/Option"
 *
 * const proof = DiscordChannelProof.make({
 *   channelId: "123456789012345678",
 *   guildId: O.some("987654321098765432"),
 *   name: O.some("proof-channel"),
 *   status: 200
 * })
 *
 * console.log(O.getOrElse(proof.name, () => "unnamed"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiscordChannelProof extends S.Class<DiscordChannelProof>($I`DiscordChannelProof`)(
  {
    channelId: DiscordSnowflake.annotateKey({
      description: "Discord channel snowflake identifier confirmed by the REST API.",
    }),
    guildId: S.OptionFromOptionalKey(DiscordSnowflake).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Discord guild snowflake identifier when the channel belongs to a guild.",
      })
    ),
    name: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Discord channel display name when returned by the API.",
      })
    ),
    status: DiscordHttpSuccessStatus.annotateKey({
      description: "Successful HTTP status observed for the channel lookup.",
    }),
  },
  $I.annote("DiscordChannelProof", {
    description: "Sanitized metadata returned after a successful channel lookup.",
  })
) {}

/**
 * Sanitized metadata returned after a successful proof message creation.
 *
 * **Details**
 *
 * The proof records identifiers, HTTP status, and Discord's optional timestamp
 * while excluding message content and authorization data.
 *
 * **Example** (Make message proof)
 *
 * ```ts
 * import { DiscordMessageProof } from "@beep/discord"
 * import * as O from "effect/Option"
 *
 * const proof = DiscordMessageProof.make({
 *   channelId: "123456789012345678",
 *   messageId: "111111111111111111",
 *   status: 200,
 *   timestamp: O.some("2026-05-14T14:30:00.000Z")
 * })
 *
 * console.log(proof.messageId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiscordMessageProof extends S.Class<DiscordMessageProof>($I`DiscordMessageProof`)(
  {
    channelId: DiscordSnowflake.annotateKey({
      description: "Discord channel snowflake identifier that received the proof message.",
    }),
    messageId: DiscordSnowflake.annotateKey({
      description: "Discord message snowflake identifier returned after message creation.",
    }),
    status: DiscordHttpSuccessStatus.annotateKey({
      description: "Successful HTTP status observed for the message creation request.",
    }),
    timestamp: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Discord message creation timestamp when returned by the API.",
      })
    ),
  },
  $I.annote("DiscordMessageProof", {
    description: "Sanitized metadata returned after a successful proof message creation.",
  })
) {}
