import {
  Discord,
  DiscordChannelProof,
  DiscordChannelRequest,
  DiscordConfigInput,
  DiscordCreateMessageRequest,
  DiscordError,
  DiscordErrorReason,
  DiscordMessageProof,
} from "@beep/discord";
import { decodeJsonString } from "@beep/schema/Json";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

const channelId = "123456789012345678";
const guildId = "987654321098765432";
const messageId = "111111111111111111";

class CapturedDiscordRequest extends S.Class<CapturedDiscordRequest>("CapturedDiscordRequest")({
  bodyText: S.OptionFromOptionalKey(S.String),
  headers: S.Record(S.String, S.String),
  method: S.String,
  url: S.String,
}) {}

class CapturedDiscordMessageAllowedMentions extends S.Class<CapturedDiscordMessageAllowedMentions>(
  "CapturedDiscordMessageAllowedMentions"
)({
  parse: S.Array(S.String),
}) {}

class CapturedDiscordMessageBody extends S.Class<CapturedDiscordMessageBody>("CapturedDiscordMessageBody")({
  allowed_mentions: CapturedDiscordMessageAllowedMentions,
  content: S.String,
}) {}

type DiscordTestHttpShape = {
  readonly capture: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<void>;
  readonly captures: Effect.Effect<ReadonlyArray<CapturedDiscordRequest>>;
  readonly reset: Effect.Effect<void>;
};

class DiscordTestHttp extends Context.Service<DiscordTestHttp, DiscordTestHttpShape>()(
  "@beep/discord/test/Discord.service.test/DiscordTestHttp"
) {}

const decodeMessageBody = S.decodeUnknownEffect(CapturedDiscordMessageBody);
const ConfigInputArbitrary = S.toArbitrary(DiscordConfigInput);
const ChannelRequestArbitrary = S.toArbitrary(DiscordChannelRequest);
const CreateMessageRequestArbitrary = S.toArbitrary(DiscordCreateMessageRequest);
const ChannelProofArbitrary = S.toArbitrary(DiscordChannelProof);
const MessageProofArbitrary = S.toArbitrary(DiscordMessageProof);
const ErrorReasonArbitrary = S.toArbitrary(DiscordErrorReason);

const expectEncodedRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(decoded).toEqual(value);
};

const expectDecodedSelf = <Schema extends S.Top & S.ConstraintDecoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
): void => {
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(value));

  expect(decoded).toEqual(value);
};

const bodyTextFor = (request: HttpClientRequest.HttpClientRequest): string | undefined =>
  request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : undefined;

const responseFor = (request: HttpClientRequest.HttpClientRequest): Response =>
  request.method === "GET"
    ? Response.json({ guild_id: guildId, id: channelId, name: "proof-channel" })
    : Response.json({ channel_id: channelId, id: messageId, timestamp: "2026-05-14T14:30:00.000Z" });

const DiscordTestHttpLayer = Layer.effect(
  DiscordTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedDiscordRequest>>([]);

    return DiscordTestHttp.of({
      capture: Effect.fn("DiscordTestHttp.capture")(function* (request) {
        const url = O.getOrElse(
          O.map(HttpClientRequest.toUrl(request), (value) => value.toString()),
          () => request.url
        );
        const bodyText = bodyTextFor(request);
        yield* Ref.update(
          capturesRef,
          A.append(
            CapturedDiscordRequest.make({
              bodyText: O.fromUndefinedOr(bodyText),
              headers: request.headers,
              method: request.method,
              url,
            })
          )
        );
      }),
      captures: Ref.get(capturesRef),
      reset: Ref.set(capturesRef, []),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* DiscordTestHttp;

    return HttpClient.make((request) =>
      Effect.gen(function* () {
        yield* testHttp.capture(request);
        return HttpClientResponse.fromWeb(request, responseFor(request));
      })
    );
  })
);

const makeLayer = () =>
  Discord.makeLayer(DiscordConfigInput.make({ baseUrl: "https://discord.example.test/api/v10///" })).pipe(
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(DiscordTestHttpLayer)
  );

describe("@beep/discord", () => {
  it("keeps encoded Discord schema wire shapes byte-identical", () => {
    const decodedConfig = Result.getOrThrow(
      S.decodeUnknownResult(DiscordConfigInput)({ baseUrl: "https://discord.example.test/api/v10///" })
    );
    const fullChannelProof = DiscordChannelProof.make({
      channelId,
      guildId: O.some(guildId),
      name: O.some("proof-channel"),
      status: 200,
    });
    const minimalChannelProof = DiscordChannelProof.make({
      channelId,
      status: 200,
    });
    const fullMessageProof = DiscordMessageProof.make({
      channelId,
      messageId,
      status: 200,
      timestamp: O.some("2026-05-14T14:30:00.000Z"),
    });
    const minimalMessageProof = DiscordMessageProof.make({
      channelId,
      messageId,
      status: 200,
    });
    const fullError = DiscordError.make({
      cause: O.some("transport failed"),
      method: O.some("GET"),
      path: O.some(`/channels/${channelId}`),
      reason: "response-status",
      status: O.some(404),
    });
    const minimalError = DiscordError.make({
      reason: "request",
    });

    expect(decodedConfig.baseUrl).toBe("https://discord.example.test/api/v10");
    expect(Result.getOrThrow(S.encodeResult(DiscordChannelProof)(fullChannelProof))).toEqual({
      channelId,
      guildId,
      name: "proof-channel",
      status: 200,
    });
    expect(Result.getOrThrow(S.encodeResult(DiscordChannelProof)(minimalChannelProof))).toEqual({
      channelId,
      status: 200,
    });
    expect(Result.getOrThrow(S.encodeResult(DiscordMessageProof)(fullMessageProof))).toEqual({
      channelId,
      messageId,
      status: 200,
      timestamp: "2026-05-14T14:30:00.000Z",
    });
    expect(Result.getOrThrow(S.encodeResult(DiscordMessageProof)(minimalMessageProof))).toEqual({
      channelId,
      messageId,
      status: 200,
    });
    expect(Result.getOrThrow(S.decodeUnknownResult(DiscordErrorReason)("transport"))).toBe("transport");
    expect(
      Result.getOrThrow(
        S.decodeUnknownResult(DiscordError)({
          _tag: "DiscordError",
          cause: "transport failed",
          method: "GET",
          path: `/channels/${channelId}`,
          reason: "response-status",
          status: 404,
        })
      )
    ).toEqual(fullError);
    expect(
      Result.getOrThrow(
        S.decodeUnknownResult(DiscordError)({
          _tag: "DiscordError",
          reason: "request",
        })
      )
    ).toEqual(minimalError);
    expect(fullError).toMatchObject({
      _tag: "DiscordError",
      reason: "response-status",
    });
    expect(minimalError).toMatchObject({
      _tag: "DiscordError",
      reason: "request",
    });
  });

  it("round-trips schema-derived Discord payloads through encoded form", () =>
    fc.assert(
      fc.property(
        ConfigInputArbitrary,
        ChannelRequestArbitrary,
        CreateMessageRequestArbitrary,
        ChannelProofArbitrary,
        MessageProofArbitrary,
        ErrorReasonArbitrary,
        (config, channelRequest, createMessageRequest, channelProof, messageProof, errorReason) => {
          const normalizedConfig = Result.getOrThrow(
            S.decodeUnknownResult(DiscordConfigInput)(Result.getOrThrow(S.encodeResult(DiscordConfigInput)(config)))
          );

          expectEncodedRoundTrip(DiscordConfigInput, normalizedConfig);
          expectEncodedRoundTrip(DiscordChannelRequest, channelRequest);
          expectEncodedRoundTrip(DiscordCreateMessageRequest, createMessageRequest);
          expectEncodedRoundTrip(DiscordChannelProof, channelProof);
          expectEncodedRoundTrip(DiscordMessageProof, messageProof);
          expectDecodedSelf(DiscordErrorReason, errorReason);
        }
      ),
      { numRuns: 50 }
    ));

  layer(makeLayer())((it) => {
    it.effect(
      "probes channel liveness and sends a test message with mentions disabled",
      Effect.fnUntraced(function* () {
        const discord = yield* Discord;
        const testHttp = yield* DiscordTestHttp;
        yield* testHttp.reset;

        const channel = yield* discord.getChannel(
          DiscordChannelRequest.make({ channelId }),
          Redacted.make("bot-token")
        );
        const message = yield* discord.createMessage(
          DiscordCreateMessageRequest.make({ channelId, content: "P1 proof" }),
          Redacted.make("bot-token")
        );
        const captures = yield* testHttp.captures;
        const messageCapture = yield* pipe(
          A.get(captures, 1),
          O.match({
            onNone: () => Effect.die("missing message capture"),
            onSome: Effect.succeed,
          })
        );
        const rawBody = O.getOrElse(messageCapture.bodyText, () => "{}");
        const body = yield* decodeJsonString(rawBody).pipe(Effect.flatMap(decodeMessageBody));

        expect(channel.channelId).toBe(channelId);
        expect(message.messageId).toBe(messageId);
        expect(captures[0]?.url).toBe(`https://discord.example.test/api/v10/channels/${channelId}`);
        expect(captures[1]?.url).toBe(`https://discord.example.test/api/v10/channels/${channelId}/messages`);
        expect(messageCapture.headers.authorization).toBe("Bot bot-token");
        expect(body.allowed_mentions.parse).toEqual([]);
      })
    );
  });
});
