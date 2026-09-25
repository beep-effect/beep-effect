import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AudioFile } from "../../beep/AudioFile.ts";

const decodeAudioFile = S.decodeUnknownEffect(AudioFile);

describe("AudioFile", () => {
  it("builds an arbitrary value", () => {
    assert.notStrictEqual(AudioFile.pipe(Arbitrary.schema), undefined);
  });

  it("defaults the provider and accepts missing or null start times", () => {
    const file = AudioFile.make({
      id: "audio-1",
      uid: "user-1",
      conversationId: "conv-1",
      chunkTimestamps: [0, 1.5],
      duration: 30,
    });
    assert.strictEqual(file.provider, "gcp");
    assert.strictEqual(O.isNone(file.startedAt), true);
    const base = {
      id: "audio-1",
      uid: "user-1",
      conversationId: "conv-1",
      chunkTimestamps: [0],
      provider: "s3",
      startedAt: "2020-01-02T03:04:05.000Z",
      duration: 2,
    };
    const present: unknown = base;
    const decoded = Effect.runSync(decodeAudioFile(present));
    assert.strictEqual(decoded.provider, "s3");
    assert.strictEqual(O.isSome(decoded.startedAt), true);
    const cleared: unknown = { ...base, startedAt: null };
    const none = Effect.runSync(decodeAudioFile(cleared));
    assert.strictEqual(O.isNone(none.startedAt), true);
  });
});
