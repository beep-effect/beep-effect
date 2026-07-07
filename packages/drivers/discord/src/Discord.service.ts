/**
 * Effect service for Discord REST API proof calls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DiscordId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { Context, Effect, Layer, pipe, Redacted } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { DiscordError } from "./Discord.errors.ts";
import {
  DiscordChannelProof,
  DiscordChannelRequest,
  DiscordConfigInput,
  DiscordCreateMessageRequest,
  DiscordHttpStatus,
  DiscordMessageProof,
} from "./Discord.models.ts";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

const $I = $DiscordId.create("Discord.service");

const decodeConfigInput = S.decodeUnknownEffect(DiscordConfigInput);
const decodeBaseUrl = S.decodeUnknownEffect(URLStr);
const decodeErrorPathOption = S.decodeUnknownOption(S.NonEmptyString);
const decodeErrorStatusOption = S.decodeUnknownOption(DiscordHttpStatus);

class DiscordRawChannel extends S.Class<DiscordRawChannel>($I`DiscordRawChannel`)(
  {
    guild_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    id: S.String,
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("DiscordRawChannel", {
    description: "Subset of Discord channel response fields needed for sanitized proof.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(DiscordRawChannel);
}

class DiscordRawMessage extends S.Class<DiscordRawMessage>($I`DiscordRawMessage`)(
  {
    channel_id: S.String,
    id: S.String,
    timestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("DiscordRawMessage", {
    description: "Subset of Discord message response fields needed for sanitized proof.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(DiscordRawMessage);
}

/**
 * Runtime shape exposed by the Discord REST driver service.
 *
 * @category services
 * @since 0.0.0
 */
interface DiscordShape {
  readonly createMessage: (
    request: DiscordCreateMessageRequest,
    botToken: Redacted.Redacted
  ) => Effect.Effect<DiscordMessageProof, DiscordError>;
  readonly getChannel: (
    request: DiscordChannelRequest,
    botToken: Redacted.Redacted
  ) => Effect.Effect<DiscordChannelProof, DiscordError>;
}

const errorCause = (cause: unknown): string => (P.isString(cause) ? cause : "unknown");

const discordPath = (path: string): string => (Str.startsWith("/")(path) ? path : `/${path}`);

const authRequest = (
  request: HttpClientRequest.HttpClientRequest,
  botToken: Redacted.Redacted
): HttpClientRequest.HttpClientRequest =>
  pipe(
    request,
    HttpClientRequest.setHeader("Authorization", `Bot ${Redacted.value(botToken)}`),
    HttpClientRequest.accept("application/json")
  );

const ensureSuccess = (
  response: HttpClientResponse.HttpClientResponse,
  path: string,
  method: "GET" | "POST"
): Effect.Effect<HttpClientResponse.HttpClientResponse, DiscordError> =>
  response.status >= 200 && response.status < 300
    ? Effect.succeed(response)
    : Effect.fail(
        DiscordError.make({
          method: O.some(method),
          path: decodeErrorPathOption(path),
          reason: "response-status",
          status: decodeErrorStatusOption(response.status),
        })
      );

const executeJson = Effect.fn("Discord.executeJson")(function* (
  client: HttpClient.HttpClient,
  baseUrl: string,
  path: string,
  method: "GET" | "POST",
  botToken: Redacted.Redacted,
  body?: unknown
) {
  const fullPath = discordPath(path);
  const rawRequest = HttpClientRequest.make(method)(`${baseUrl}${fullPath}`);
  const request = yield* pipe(
    body === undefined ? Effect.succeed(rawRequest) : HttpClientRequest.bodyJson(rawRequest, body),
    Effect.mapError((cause) =>
      DiscordError.make({
        cause: pipe(cause, errorCause, O.some),
        method: O.some(method),
        path: decodeErrorPathOption(fullPath),
        reason: "request",
      })
    ),
    Effect.map((requestWithBody) => authRequest(requestWithBody, botToken))
  );

  const response = yield* client.execute(request).pipe(
    Effect.mapError((cause) =>
      DiscordError.make({
        cause: pipe(cause, errorCause, O.some),
        method: O.some(method),
        path: decodeErrorPathOption(fullPath),
        reason: "transport",
      })
    )
  );
  const successful = yield* ensureSuccess(response, fullPath, method);

  return yield* successful.json.pipe(
    Effect.mapError((cause) =>
      DiscordError.make({
        cause: pipe(cause, errorCause, O.some),
        method: O.some(method),
        path: decodeErrorPathOption(fullPath),
        reason: "response-decoding",
      })
    )
  );
});

const resolveBaseUrl = Effect.fnUntraced(function* (input: DiscordConfigInput) {
  const config = yield* decodeConfigInput(input);
  return yield* decodeBaseUrl(config.baseUrl);
}, Effect.orDie);

const makeService = (client: HttpClient.HttpClient, baseUrl: URLStr): DiscordShape => ({
  createMessage: Effect.fn("Discord.createMessage")(function* (rawRequest, botToken) {
    const request = yield* DiscordCreateMessageRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) => DiscordError.make({ cause: pipe(cause, errorCause, O.some), reason: "request" }))
    );
    const body = {
      allowed_mentions: {
        parse: [],
      },
      content: request.content,
    };
    const raw = yield* executeJson(client, baseUrl, `/channels/${request.channelId}/messages`, "POST", botToken, body);
    const decoded = yield* DiscordRawMessage.decodeEffect(raw).pipe(
      Effect.mapError((cause) =>
        DiscordError.make({ cause: pipe(cause, errorCause, O.some), reason: "response-decoding" })
      )
    );

    return DiscordMessageProof.make({
      channelId: decoded.channel_id,
      messageId: decoded.id,
      status: 200,
      timestamp: decoded.timestamp,
    });
  }),
  getChannel: Effect.fn("Discord.getChannel")(function* (rawRequest, botToken) {
    const request = yield* DiscordChannelRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) => DiscordError.make({ cause: pipe(cause, errorCause, O.some), reason: "request" }))
    );
    const raw = yield* executeJson(client, baseUrl, `/channels/${request.channelId}`, "GET", botToken);
    const decoded = yield* DiscordRawChannel.decodeEffect(raw).pipe(
      Effect.mapError((cause) =>
        DiscordError.make({ cause: pipe(cause, errorCause, O.some), reason: "response-decoding" })
      )
    );

    return DiscordChannelProof.make({
      channelId: decoded.id,
      guildId: decoded.guild_id,
      name: decoded.name,
      status: 200,
    });
  }),
});

/**
 * Discord REST boundary for channel liveness checks and proof message creation.
 *
 * @remarks
 * The service validates request objects before issuing HTTP, maps transport and
 * decoding failures into {@link DiscordError}, and returns sanitized proof
 * models instead of raw Discord payloads.
 *
 * @example
 * ```ts
 * import {
 *   Discord,
 *   DiscordChannelRequest,
 *   DiscordConfigInput
 * } from "@beep/discord"
 * import { Effect, Layer, Redacted } from "effect"
 * import * as O from "effect/Option"
 * import * as HttpClient from "effect/unstable/http/HttpClient"
 * import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
 *
 * const TestHttpClient = Layer.succeed(
 *   HttpClient.HttpClient,
 *   HttpClient.make((request) =>
 *     Effect.succeed(
 *       HttpClientResponse.fromWeb(
 *         request,
 *         Response.json({
 *           guild_id: "987654321098765432",
 *           id: "123456789012345678",
 *           name: "proof-channel"
 *         })
 *       )
 *     )
 *   )
 * )
 *
 * const DiscordTest = Discord.makeLayer(
 *   DiscordConfigInput.make({
 *     baseUrl: "https://discord.example.test/api/v10"
 *   })
 * ).pipe(Layer.provide(TestHttpClient))
 *
 * const program = Effect.gen(function* () {
 *   const discord = yield* Discord
 *   const proof = yield* discord.getChannel(
 *     DiscordChannelRequest.make({ channelId: "123456789012345678" }),
 *     Redacted.make("bot-token")
 *   )
 *   return O.getOrElse(proof.name, () => "unnamed")
 * }).pipe(Effect.provide(DiscordTest))
 *
 * const channelName = await Effect.runPromise(program)
 * console.log(channelName) // "proof-channel"
 * ```
 *
 * @effects
 * - Sends authenticated `GET /channels/:id` and
 *   `POST /channels/:id/messages` requests through the provided HTTP client.
 * - Reads the redacted bot token to set Discord's `Authorization` header.
 * - Creates proof messages with Discord mentions disabled.
 *
 * @see {@link DiscordConfigInput} for base URL configuration.
 * @see {@link DiscordError} for typed failures.
 * @category services
 * @since 0.0.0
 */
export class Discord extends Context.Service<Discord, DiscordShape>()($I`Discord`) {
  /**
   * Build a Discord REST driver layer with an injected HTTP client.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config = DiscordConfigInput.make({})
  ): Layer.Layer<Discord, never, HttpClient.HttpClient> =>
    Layer.effect(
      Discord,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const baseUrl = yield* resolveBaseUrl(config);
        return Discord.of(makeService(client, baseUrl));
      })
    );

  /**
   * Live Discord REST driver layer backed by the platform fetch client.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Discord> = Discord.makeLayer().pipe(Layer.provide(FetchHttpClient.layer));
}
