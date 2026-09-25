import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { toWire } from "../../beep/Port.ts";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_VOICE_ID,
  TtsSynthesizeRequest,
  TtsVoiceSettings,
} from "../../beep/Tts.ts";

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("Tts", () => {
  it("decodes present voice settings and encodes None as null", () => {
    const decoded = decode(toWire(TtsVoiceSettings), {
      stability: 0.4,
      similarity_boost: 0.5,
      style: 0.1,
      use_speaker_boost: true,
    });
    assert.strictEqual(O.getOrElse(decoded.stability, () => 0), 0.4);
    assert.strictEqual(O.getOrElse(decoded.similarityBoost, () => 0), 0.5);
    assert.strictEqual(O.getOrElse(decoded.useSpeakerBoost, () => false), true);
    const missing = decode(toWire(TtsVoiceSettings), {});
    assert.strictEqual(O.isNone(missing.stability), true);
    assert.strictEqual(O.isNone(missing.style), true);
    const nulled = decode(toWire(TtsVoiceSettings), {
      stability: null,
      similarity_boost: null,
      style: null,
      use_speaker_boost: null,
    });
    assert.strictEqual(O.isNone(nulled.similarityBoost), true);
    assert.strictEqual(O.isNone(nulled.useSpeakerBoost), true);
  });

  it("caps text and fills the voice defaults", () => {
    const made = TtsSynthesizeRequest.make({ text: "Hello" });
    assert.strictEqual(made.voiceId, DEFAULT_VOICE_ID);
    assert.strictEqual(made.modelId, DEFAULT_MODEL_ID);
    assert.strictEqual(made.outputFormat, DEFAULT_OUTPUT_FORMAT);
    assert.strictEqual(O.isNone(made.voiceSettings), true);
    const decoded = decode(toWire(TtsSynthesizeRequest), {
      text: "Hello",
      voice_id: "voice-2",
      model_id: "model-2",
      output_format: "pcm",
      voice_settings: null,
    });
    assert.strictEqual(decoded.voiceId, "voice-2");
    assert.strictEqual(decoded.modelId, "model-2");
    assert.strictEqual(O.isNone(decoded.voiceSettings), true);
    const nested = TtsSynthesizeRequest.make({
      text: "Hello",
      voiceSettings: O.some(TtsVoiceSettings.make({ stability: O.none(), similarityBoost: O.some(0.4) })),
    });
    assert.strictEqual(O.isSome(nested.voiceSettings), true);
    assert.strictEqual(
      O.isNone(O.getOrElse(nested.voiceSettings, () => TtsVoiceSettings.make({})).stability),
      true,
    );
    assert.strictEqual(fails(toWire(TtsSynthesizeRequest), { text: "" }), true);
    assert.strictEqual(fails(toWire(TtsSynthesizeRequest), { text: "x".repeat(5001) }), true);
  });

  it("derives an arbitrary for every exported model", () => {
    for (const schema of [TtsVoiceSettings, TtsSynthesizeRequest]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
