import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/Arbitrary";
import {
  AudioFileUrlInfo,
  AudioPrecacheResponse,
  AudioUrlsResponse,
  ConversationAudioSpanInfo,
  ConversationAudioUrlInfo,
} from "../../beep/SyncAudio.ts";

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("SyncAudio", () => {
  it("keeps len as len and defaults duration and spans at construction", () => {
    const span = decode(ConversationAudioSpanInfo, {
      fileId: "file-1",
      wallOffset: 1.5,
      artifactOffset: 0,
      len: 3,
    });
    expect(span.len).toBe(3);
    expect(AudioFileUrlInfo.make({ id: "file-1", status: "custom" }).duration).toBe(0);
    const file = decode(AudioFileUrlInfo, { id: "file-1", status: "ready", duration: 1 });
    expect(O.isNone(file.signedUrl)).toBe(true);
    expect(ConversationAudioUrlInfo.make({ status: "pending" }).spans).toHaveLength(0);
  });

  it("decodes present, null, and missing optional audio fields", () => {
    const precache = decode(AudioPrecacheResponse, {
      status: "queued",
      message: null,
      audioFileCount: 2,
    });
    expect(O.isNone(precache.message)).toBe(true);
    expect(precache.audioFileCount).toEqual(O.some(2));
    const urls = decode(AudioUrlsResponse, {
      audioFiles: [{ id: "file-1", status: "ready", duration: 4 }],
      conversationAudio: null,
    });
    expect(O.isNone(urls.conversationAudio)).toBe(true);
    expect(O.isNone(urls.pollAfterMs)).toBe(true);
    const polling = decode(AudioUrlsResponse, {
      audioFiles: [],
      conversationAudio: {
        status: "ready",
        spans: [],
        duration: 1.25,
        signedUrl: null,
        contentType: null,
        capturedDuration: null,
      },
      pollAfterMs: 1000,
    });
    expect(O.isSome(polling.conversationAudio) && polling.conversationAudio.value.duration).toEqual(O.some(1.25));
    expect(polling.pollAfterMs).toEqual(O.some(1000));
  });

  it("builds an arbitrary for each audio model", () => {
    for (const model of [
      AudioPrecacheResponse,
      AudioFileUrlInfo,
      ConversationAudioSpanInfo,
      ConversationAudioUrlInfo,
      AudioUrlsResponse,
    ]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});
