/**
 * Text-to-speech proxy request shared by mobile and desktop clients.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model, boundedText, optionalBool, pg, textBoundsCheck } from "./Kit.ts";
import { optionalJsonColumn, optionalNull, textDefault } from "./Port.ts";

const $I = $ScratchpadId.create("beep/Tts");

/**
 * Default ElevenLabs voice id. The comment in the Python module names it Sloane.
 *
 * **Example** (Read the Sloane voice id)
 *
 * ```ts
 * import { DEFAULT_VOICE_ID } from "./Tts.ts"
 *
 * console.log(DEFAULT_VOICE_ID) // "BAMYoBHLZM7lJgJAmFz0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_VOICE_ID = "BAMYoBHLZM7lJgJAmFz0";

/**
 * Default ElevenLabs model id for the TTS proxy.
 *
 * **Example** (Read the turbo model id)
 *
 * ```ts
 * import { DEFAULT_MODEL_ID } from "./Tts.ts"
 *
 * console.log(DEFAULT_MODEL_ID) // "eleven_turbo_v2_5"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";

/**
 * Default audio output format for the TTS proxy.
 *
 * **Example** (Read the output format)
 *
 * ```ts
 * import { DEFAULT_OUTPUT_FORMAT } from "./Tts.ts"
 *
 * console.log(DEFAULT_OUTPUT_FORMAT) // "mp3_44100_128"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

const optionalFinite = (column: string) =>
  optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName(column));

/**
 * Optional ElevenLabs voice controls.
 *
 * **Details**
 *
 * Every field is optional. Missing and null decode to `None` and encode as null.
 * The floats are finite and otherwise unbounded, matching the Python model.
 *
 * **Example** (Decode a null similarity boost)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { TtsVoiceSettings } from "./Tts.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(TtsVoiceSettings))({ similarity_boost: null }),
 * )
 * console.log(O.isNone(decoded.similarityBoost)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TtsVoiceSettings extends Model<TtsVoiceSettings>("TtsVoiceSettings")(
  {
    stability: optionalFinite("stability"),
    similarityBoost: optionalFinite("similarity_boost"),
    style: optionalFinite("style"),
    useSpeakerBoost: optionalBool("use_speaker_boost"),
  },
  $I.annote("TtsVoiceSettings", {
    description: "Optional ElevenLabs stability, similarity, style, and speaker-boost controls.",
  }),
) {}

/**
 * Encoded TTS voice settings.
 *
 * @see {@link TtsVoiceSettings} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TtsVoiceSettings {
  export type Encoded = S.Codec.Encoded<typeof TtsVoiceSettings>;
}

/**
 * TTS proxy synthesize request.
 *
 * **Details**
 *
 * `text` is 1 to 5000 characters, the same cap as the router and the Rust
 * backend, so an oversized request fails at the schema. `voiceId`, `modelId`,
 * and `outputFormat` construct as the module defaults. Python disables
 * Pydantic's protected `model_` namespace so `model_id` is a normal field.
 * Nested `voiceSettings` keeps the class's camelCase keys. Wrapping that
 * model in `toWire` makes `Arbitrary.schema` unable to derive the parent.
 *
 * **Example** (Construct the voice and model defaults)
 *
 * ```ts
 * import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, TtsSynthesizeRequest } from "./Tts.ts"
 *
 * const request = TtsSynthesizeRequest.make({ text: "Hello" })
 * console.log(request.voiceId) // "BAMYoBHLZM7lJgJAmFz0"
 * console.log(request.modelId === DEFAULT_MODEL_ID && request.voiceId === DEFAULT_VOICE_ID) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TtsSynthesizeRequest extends Model<TtsSynthesizeRequest>("TtsSynthesizeRequest")(
  {
    text: boundedText("text", { minLength: 1, maxLength: 5000 }),
    voiceId: textDefault("voice_id", DEFAULT_VOICE_ID),
    modelId: textDefault("model_id", DEFAULT_MODEL_ID),
    outputFormat: textDefault("output_format", DEFAULT_OUTPUT_FORMAT),
    voiceSettings: optionalJsonColumn(TtsVoiceSettings, "voice_settings"),
  },
  $I.annote("TtsSynthesizeRequest", {
    description: "TTS proxy request. text is capped at 5000 characters and voice defaults to Sloane.",
  }),
  (columns) => [textBoundsCheck("text", { minLength: 1, maxLength: 5000 })(columns.text)],
) {}

/**
 * Encoded TTS synthesize request.
 *
 * @see {@link TtsSynthesizeRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TtsSynthesizeRequest {
  export type Encoded = S.Codec.Encoded<typeof TtsSynthesizeRequest>;
}
