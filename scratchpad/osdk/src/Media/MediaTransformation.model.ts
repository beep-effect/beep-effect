/**
 * Media transformations: requests that derive new content from a stored media item.
 *
 * **Details**
 *
 * A transformation names a conversion between kinds of media (an image to
 * text, a video to an archive of frames), the operation to perform and, when
 * the output is media again, the format to write. The platform runs it as a
 * job: submit the request, poll the job until it ends, then fetch the result.
 *
 * {@link MediaTransformation} is the wire's own tagged union of 18 conversions.
 * OSDK re-spells it as records with exactly one `$`-prefixed key and compiles
 * those to the wire with a chain of `in` checks whose last branch is never
 * verified, which also leaves it behind the wire (two image-to-text operations
 * and the model locator are missing). Here the wire shape is the model, so
 * there is nothing to compile and nothing to fall behind.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { MediaType } from "../Attachment/Attachment.model.ts";
import { absent } from "../internal/AbsentKey.ts";
import { ImageryDecodeFormat, RotationAngle } from "./MediaMetadata.model.ts";
import {
  ArchiveEncodingKind,
  AudioEncodingKind,
  DocumentEncodingKind,
  EmailBodyFormat,
  EmbeddingModelId,
  ImageryEncodingKind,
  MediaTransformationKind,
  OcrLanguage,
  OcrMode,
  OcrOutputFormatKind,
  OcrScript,
  PerformanceMode,
  ResizingMode,
  SceneScore,
  TextOutputFormat,
  TranscriptionLanguage,
  TransformationJobStatus,
  VideoEncodingKind,
  VlmOutputFormat,
} from "./MediaTransformation.values.ts";

const $I = $ScratchpadId.create("osdk/Media/MediaTransformation.model");

const outputHeight = "Height of the output in pixels; with one dimension given the other keeps the aspect ratio.";
const outputWidth = "Width of the output in pixels; with one dimension given the other keeps the aspect ratio.";

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

/**
 * Identifier the platform gives a transformation job when it accepts the request.
 *
 * **Example** (Brand a transformation job identifier)
 *
 * ```ts import.meta.vitest name="Brand a transformation job identifier"
 * import * as S from "effect/Schema"
 * import { TransformationJobId } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const isJobId = S.is(TransformationJobId)
 * const verdicts = [isJobId(TransformationJobId.make("job-7f3a")), isJobId("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TransformationJobId = S.NonEmptyString.pipe(
  S.brand("TransformationJobId"),
  $I.annoteSchema("TransformationJobId", {
    description: "Identifier the platform gives a transformation job when it accepts the request.",
  })
);

/**
 * Runtime type of {@link TransformationJobId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TransformationJobId = typeof TransformationJobId.Type;

/**
 * Companion namespace for {@link TransformationJobId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TransformationJobId {
  /**
   * Encoded (wire) form of {@link TransformationJobId}: the same text, unbranded.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TransformationJobId.Encoded;
}

/**
 * Resource identifier of the cipher license used to encrypt or decrypt regions of an image.
 *
 * **Example** (Brand a cipher license identifier)
 *
 * ```ts import.meta.vitest name="Brand a cipher license identifier"
 * import * as S from "effect/Schema"
 * import { CipherLicenseRid } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const isValid = S.is(CipherLicenseRid)
 * const verdicts = [isValid(CipherLicenseRid.make("ri.cipher.main.license.6c1c9d2e")), isValid("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CipherLicenseRid = S.NonEmptyString.pipe(
  S.brand("CipherLicenseRid"),
  $I.annoteSchema("CipherLicenseRid", {
    description: "Resource identifier of the cipher license used to encrypt or decrypt regions of an image.",
  })
);

/**
 * Runtime type of {@link CipherLicenseRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type CipherLicenseRid = typeof CipherLicenseRid.Type;

/**
 * Companion namespace for {@link CipherLicenseRid}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CipherLicenseRid {
  /**
   * Encoded (wire) form of {@link CipherLicenseRid}: the same text, unbranded.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CipherLicenseRid.Encoded;
}

/**
 * API name of a language model the platform hosts.
 *
 * **Example** (Brand a language model API name)
 *
 * ```ts import.meta.vitest name="Brand a language model API name"
 * import * as S from "effect/Schema"
 * import { LanguageModelApiName } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const isValid = S.is(LanguageModelApiName)
 * const verdicts = [isValid(LanguageModelApiName.make("vision-large")), isValid("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const LanguageModelApiName = S.NonEmptyString.pipe(
  S.brand("LanguageModelApiName"),
  $I.annoteSchema("LanguageModelApiName", { description: "API name of a language model the platform hosts." })
);

/**
 * Runtime type of {@link LanguageModelApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type LanguageModelApiName = typeof LanguageModelApiName.Type;

/**
 * Companion namespace for {@link LanguageModelApiName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LanguageModelApiName {
  /**
   * Encoded (wire) form of {@link LanguageModelApiName}: the same text, unbranded.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LanguageModelApiName.Encoded;
}

/**
 * Resource identifier of a language model registered by its owner.
 *
 * **Example** (Brand a registered model identifier)
 *
 * ```ts import.meta.vitest name="Brand a registered model identifier"
 * import * as S from "effect/Schema"
 * import { RegisteredModelRid } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const isValid = S.is(RegisteredModelRid)
 * const verdicts = [isValid(RegisteredModelRid.make("ri.language-model-service..language-model.custom")), isValid("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const RegisteredModelRid = S.NonEmptyString.pipe(
  S.brand("RegisteredModelRid"),
  $I.annoteSchema("RegisteredModelRid", {
    description: "Resource identifier of a language model registered by its owner.",
  })
);

/**
 * Runtime type of {@link RegisteredModelRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type RegisteredModelRid = typeof RegisteredModelRid.Type;

/**
 * Companion namespace for {@link RegisteredModelRid}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RegisteredModelRid {
  /**
   * Encoded (wire) form of {@link RegisteredModelRid}: the same text, unbranded.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RegisteredModelRid.Encoded;
}

// -----------------------------------------------------------------------------
// Output encodings
// -----------------------------------------------------------------------------

/**
 * Image format a transformation writes, as the bare format name.
 *
 * **Details**
 *
 * The wire spells an image format as a union of empty records
 * (`{ "type": "png" }`). Nothing varies but the tag, so the domain value is the
 * tag itself and the record is only the encoding. The same holds for
 * {@link VideoEncoding}, {@link ArchiveEncoding}, {@link DocumentEncoding} and
 * {@link OcrOutputFormat}.
 *
 * **Example** (Decode an image output format)
 *
 * ```ts import.meta.vitest name="Decode an image output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ImageryEncoding } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const encoding = await Effect.runPromise(S.decodeUnknownEffect(ImageryEncoding)({ type: "webp" }))
 * const wire = await Effect.runPromise(S.encodeEffect(ImageryEncoding)(encoding))
 * const facts = [encoding, wire]
 * facts // => ["webp", { type: "webp" }]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ImageryEncoding = S.Struct({ type: ImageryEncodingKind }).pipe(
  S.decodeTo(
    S.toType(ImageryEncodingKind),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("ImageryEncoding", { description: "Image format a transformation writes." })
);

/**
 * Runtime type of {@link ImageryEncoding}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ImageryEncoding = typeof ImageryEncoding.Type;

/**
 * Companion namespace for {@link ImageryEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageryEncoding {
  /**
   * Encoded (wire) form of {@link ImageryEncoding}: the format name wrapped in a `{ type }` record.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: ImageryEncodingKind.Encoded;
  }
}

/**
 * Video container format a transformation writes, as the bare format name.
 *
 * **Example** (Encode a video output format)
 *
 * ```ts import.meta.vitest name="Encode a video output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { VideoEncoding } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(VideoEncoding)("mkv"))
 * wire // => { type: "mkv" }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const VideoEncoding = S.Struct({ type: VideoEncodingKind }).pipe(
  S.decodeTo(
    S.toType(VideoEncodingKind),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("VideoEncoding", { description: "Video container format a transformation writes." })
);

/**
 * Runtime type of {@link VideoEncoding}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type VideoEncoding = typeof VideoEncoding.Type;

/**
 * Companion namespace for {@link VideoEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoEncoding {
  /**
   * Encoded (wire) form of {@link VideoEncoding}: the format name wrapped in a `{ type }` record.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: VideoEncodingKind.Encoded;
  }
}

/**
 * Archive format a transformation bundles many outputs into, as the bare format name.
 *
 * **Example** (Encode an archive output format)
 *
 * ```ts import.meta.vitest name="Encode an archive output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ArchiveEncoding } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(ArchiveEncoding)("tar"))
 * wire // => { type: "tar" }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ArchiveEncoding = S.Struct({ type: ArchiveEncodingKind }).pipe(
  S.decodeTo(
    S.toType(ArchiveEncodingKind),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("ArchiveEncoding", { description: "Archive format a transformation bundles many outputs into." })
);

/**
 * Runtime type of {@link ArchiveEncoding}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ArchiveEncoding = typeof ArchiveEncoding.Type;

/**
 * Companion namespace for {@link ArchiveEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArchiveEncoding {
  /**
   * Encoded (wire) form of {@link ArchiveEncoding}: the format name wrapped in a `{ type }` record.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: ArchiveEncodingKind.Encoded;
  }
}

/**
 * Document format a transformation writes, as the bare format name.
 *
 * **Example** (Encode a document output format)
 *
 * ```ts import.meta.vitest name="Encode a document output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DocumentEncoding } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const wire = await Effect.runPromise(S.encodeEffect(DocumentEncoding)("pdf"))
 * wire // => { type: "pdf" }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const DocumentEncoding = S.Struct({ type: DocumentEncodingKind }).pipe(
  S.decodeTo(
    S.toType(DocumentEncodingKind),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("DocumentEncoding", { description: "Document format a transformation writes." })
);

/**
 * Runtime type of {@link DocumentEncoding}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type DocumentEncoding = typeof DocumentEncoding.Type;

/**
 * Companion namespace for {@link DocumentEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentEncoding {
  /**
   * Encoded (wire) form of {@link DocumentEncoding}: the format name wrapped in a `{ type }` record.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: DocumentEncodingKind.Encoded;
  }
}

const AudioChannelLayoutKind = LiteralKit(["numberOfChannels"]);

/**
 * An audio channel layout given as a plain channel count.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberOfChannels extends S.Opaque<NumberOfChannels, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("numberOfChannels"),
    numberOfChannels: S.Finite.annotateKey({
      description: "Number of channels to write; the platform writes 2 (stereo) when no layout is given.",
    }),
  }).pipe(
    $I.annoteSchema("NumberOfChannels", { description: "An audio channel layout given as a plain channel count." })
  )
) {}

/**
 * Companion namespace for {@link NumberOfChannels}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberOfChannels {
  /**
   * Encoded (wire) form of {@link NumberOfChannels}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "numberOfChannels";
    readonly numberOfChannels: number;
  }
}

/**
 * How the channels of written audio are laid out.
 *
 * **Example** (Describe a mono channel layout)
 *
 * ```ts import.meta.vitest name="Describe a mono channel layout"
 * import { AudioChannelLayout } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const layout = AudioChannelLayout.cases.numberOfChannels.make({ numberOfChannels: 1 })
 * const channels = AudioChannelLayout.match(layout, { numberOfChannels: ({ numberOfChannels }) => numberOfChannels })
 * channels // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AudioChannelLayout = AudioChannelLayoutKind.mapMembers(() => Tuple.make(NumberOfChannels)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AudioChannelLayout", { description: "How the channels of written audio are laid out." })
);

/**
 * Runtime type of {@link AudioChannelLayout}.
 *
 * @category models
 * @since 0.0.0
 */
export type AudioChannelLayout = typeof AudioChannelLayout.Type;

/**
 * Companion namespace for {@link AudioChannelLayout}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioChannelLayout {
  /**
   * Encoded (wire) form of {@link AudioChannelLayout}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | NumberOfChannels.Encoded;
}

/**
 * Audio written as MP3.
 *
 * @category models
 * @since 0.0.0
 */
export class Mp3Encoding extends S.Opaque<Mp3Encoding, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("mp3") }).pipe($I.annoteSchema("Mp3Encoding", { description: "Audio written as MP3." }))
) {}

/**
 * Companion namespace for {@link Mp3Encoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Mp3Encoding {
  /**
   * Encoded (wire) form of {@link Mp3Encoding}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "mp3";
  }
}

/**
 * Audio written as WAV, optionally resampled and re-laid-out.
 *
 * @category models
 * @since 0.0.0
 */
export class WavEncoding extends S.Opaque<WavEncoding, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("wav"),
    sampleRate: absent(S.Finite, "Samples per second to write."),
    audioChannelLayout: absent(AudioChannelLayout, "Channel layout to write."),
  }).pipe(
    $I.annoteSchema("WavEncoding", { description: "Audio written as WAV, optionally resampled and re-laid-out." })
  )
) {}

/**
 * Companion namespace for {@link WavEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WavEncoding {
  /**
   * Encoded (wire) form of {@link WavEncoding}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "wav";
    readonly sampleRate?: number;
    readonly audioChannelLayout?: AudioChannelLayout.Encoded;
  }
}

/**
 * Audio written into an MPEG transport stream.
 *
 * @category models
 * @since 0.0.0
 */
export class TsAudioEncoding extends S.Opaque<TsAudioEncoding, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("ts") }).pipe(
    $I.annoteSchema("TsAudioEncoding", { description: "Audio written into an MPEG transport stream." })
  )
) {}

/**
 * Companion namespace for {@link TsAudioEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TsAudioEncoding {
  /**
   * Encoded (wire) form of {@link TsAudioEncoding}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "ts";
  }
}

/**
 * Audio format a transformation writes.
 *
 * **Details**
 *
 * Unlike the other output formats this one stays a union of records, because
 * `wav` carries settings. OSDK models it as a mix of two strings and one
 * record and treats every string other than `"mp3"` as `ts`.
 *
 * **Example** (Ask for mono WAV at 16 kHz)
 *
 * ```ts import.meta.vitest name="Ask for mono WAV at 16 kHz"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AudioChannelLayout, AudioEncoding } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const encoding = AudioEncoding.cases.wav.make({
 *   sampleRate: O.some(16000),
 *   audioChannelLayout: O.some(AudioChannelLayout.cases.numberOfChannels.make({ numberOfChannels: 1 })),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(AudioEncoding)(encoding))
 * wire // => { type: "wav", sampleRate: 16000, audioChannelLayout: { type: "numberOfChannels", numberOfChannels: 1 } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AudioEncoding = AudioEncodingKind.mapMembers(() =>
  Tuple.make(Mp3Encoding, WavEncoding, TsAudioEncoding)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AudioEncoding", { description: "Audio format a transformation writes." })
);

/**
 * Runtime type of {@link AudioEncoding}.
 *
 * @category models
 * @since 0.0.0
 */
export type AudioEncoding = typeof AudioEncoding.Type;

/**
 * Companion namespace for {@link AudioEncoding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioEncoding {
  /**
   * Encoded (wire) form of {@link AudioEncoding}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | Mp3Encoding.Encoded
    | WavEncoding.Encoded
    | TsAudioEncoding.Encoded;
}

// -----------------------------------------------------------------------------
// Text recognition settings
// -----------------------------------------------------------------------------

/**
 * A span of document pages, with either bound optional.
 *
 * @category models
 * @since 0.0.0
 */
export class PageRange extends S.Opaque<PageRange, { readonly brand: unique symbol }>()(
  S.Struct({
    startPageInclusive: absent(S.Finite, "First page of the span."),
    endPageExclusive: absent(S.Finite, "Page just past the end of the span."),
  }).pipe(
    $I.annoteSchema("PageRange", {
      description: "A span of document pages, with either bound optional.",
    })
  )
) {}

/**
 * Companion namespace for {@link PageRange}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PageRange {
  /**
   * Encoded (wire) form of {@link PageRange}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly startPageInclusive?: number;
    readonly endPageExclusive?: number;
  }
}

/**
 * What optical character recognition returns, as the bare format name.
 *
 * **Example** (Decode an OCR output format)
 *
 * ```ts import.meta.vitest name="Decode an OCR output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OcrOutputFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const format = await Effect.runPromise(S.decodeUnknownEffect(OcrOutputFormat)({ type: "hocr" }))
 * format // => "hocr"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OcrOutputFormat = S.Struct({ type: OcrOutputFormatKind }).pipe(
  S.decodeTo(
    S.toType(OcrOutputFormatKind),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("OcrOutputFormat", { description: "What optical character recognition returns." })
);

/**
 * Runtime type of {@link OcrOutputFormat}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type OcrOutputFormat = typeof OcrOutputFormat.Type;

/**
 * Companion namespace for {@link OcrOutputFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrOutputFormat {
  /**
   * Encoded (wire) form of {@link OcrOutputFormat}: the format name wrapped in a `{ type }` record.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: OcrOutputFormatKind.Encoded;
  }
}

const OcrLanguageOrScriptKind = LiteralKit(["language", "script"]);

/**
 * A hint that the text to recognise is in one language.
 *
 * @category models
 * @since 0.0.0
 */
export class OcrLanguageHint extends S.Opaque<OcrLanguageHint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("language"),
    language: OcrLanguage.annotateKey({ description: "Language the text is written in." }),
  }).pipe(
    $I.annoteSchema("OcrLanguageHint", { description: "A hint that the text to recognise is in one language." })
  )
) {}

/**
 * Companion namespace for {@link OcrLanguageHint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrLanguageHint {
  /**
   * Encoded (wire) form of {@link OcrLanguageHint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "language";
    readonly language: OcrLanguage.Encoded;
  }
}

/**
 * A hint that the text to recognise uses one writing system, whatever its language.
 *
 * @category models
 * @since 0.0.0
 */
export class OcrScriptHint extends S.Opaque<OcrScriptHint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("script"),
    script: OcrScript.annotateKey({ description: "Writing system the text uses." }),
  }).pipe(
    $I.annoteSchema("OcrScriptHint", {
      description: "A hint that the text to recognise uses one writing system, whatever its language.",
    })
  )
) {}

/**
 * Companion namespace for {@link OcrScriptHint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrScriptHint {
  /**
   * Encoded (wire) form of {@link OcrScriptHint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "script";
    readonly script: OcrScript.Encoded;
  }
}

/**
 * What text recognition is told to expect: a language, or only a writing system.
 *
 * **Example** (Mix a language hint and a script hint)
 *
 * ```ts import.meta.vitest name="Mix a language hint and a script hint"
 * import * as A from "effect/Array"
 * import { OcrLanguageOrScript } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const hints = [
 *   OcrLanguageOrScript.cases.language.make({ language: "DEU" }),
 *   OcrLanguageOrScript.cases.script.make({ script: "CYRILLIC" }),
 * ]
 * const labels = A.map(
 *   hints,
 *   OcrLanguageOrScript.match({ language: ({ language }) => language, script: ({ script }) => script })
 * )
 * labels // => ["DEU", "CYRILLIC"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OcrLanguageOrScript = OcrLanguageOrScriptKind.mapMembers(() =>
  Tuple.make(OcrLanguageHint, OcrScriptHint)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("OcrLanguageOrScript", {
    description: "What text recognition is told to expect: a language, or only a writing system.",
  })
);

/**
 * Runtime type of {@link OcrLanguageOrScript}.
 *
 * @category models
 * @since 0.0.0
 */
export type OcrLanguageOrScript = typeof OcrLanguageOrScript.Type;

/**
 * Companion namespace for {@link OcrLanguageOrScript}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrLanguageOrScript {
  /**
   * Encoded (wire) form of {@link OcrLanguageOrScript}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | OcrLanguageHint.Encoded
    | OcrScriptHint.Encoded;
}

/**
 * Settings of optical character recognition: what to return and what text to expect.
 *
 * @category models
 * @since 0.0.0
 */
export class OcrParameters extends S.Opaque<OcrParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    outputFormat: OcrOutputFormat.annotateKey({ description: "Whether to return hOCR markup or the words alone." }),
    languages: S.Array(OcrLanguageOrScript).annotateKey({
      description: "Languages and writing systems the text may be in.",
    }),
  }).pipe(
    $I.annoteSchema("OcrParameters", {
      description: "Settings of optical character recognition: what to return and what text to expect.",
    })
  )
) {}

/**
 * Companion namespace for {@link OcrParameters}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrParameters {
  /**
   * Encoded (wire) form of {@link OcrParameters}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly outputFormat: OcrOutputFormat.Encoded;
    readonly languages: ReadonlyArray<OcrLanguageOrScript.Encoded>;
  }
}

/**
 * Settings of the older layout-aware extraction, which takes languages only.
 *
 * @category models
 * @since 0.0.0
 */
export class LayoutAwareExtractionParameters extends S.Opaque<
  LayoutAwareExtractionParameters,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    languages: S.Array(OcrLanguage).annotateKey({ description: "Languages the text may be in." }),
  }).pipe(
    $I.annoteSchema("LayoutAwareExtractionParameters", {
      description: "Settings of the older layout-aware extraction, which takes languages only.",
    })
  )
) {}

/**
 * Companion namespace for {@link LayoutAwareExtractionParameters}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LayoutAwareExtractionParameters {
  /**
   * Encoded (wire) form of {@link LayoutAwareExtractionParameters}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly languages: ReadonlyArray<OcrLanguage.Encoded>;
  }
}

const TextExtractionConfigFields = S.Struct({
  format: absent(TextOutputFormat, "Markup to return the text in."),
  mode: absent(OcrMode, "Whether to read embedded text, recognise the page as a scan, or decide per page."),
  languages: S.Array(OcrLanguageOrScript).annotateKey({
    description: "Languages and writing systems the text may be in.",
  }),
});

/**
 * Settings of text extraction from document pages.
 *
 * **Details**
 *
 * The wire declares this record twice under two names, once for plain and
 * once for layout-aware extraction, with identical fields. It is one type
 * here.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentTextExtractionConfig extends S.Opaque<
  DocumentTextExtractionConfig,
  { readonly brand: unique symbol }
>()(
  TextExtractionConfigFields.pipe(
    $I.annoteSchema("DocumentTextExtractionConfig", {
      description: "Settings of text extraction from document pages.",
    })
  )
) {}

/**
 * Companion namespace for {@link DocumentTextExtractionConfig}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentTextExtractionConfig {
  /**
   * Encoded (wire) form of {@link DocumentTextExtractionConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly format?: TextOutputFormat.Encoded;
    readonly mode?: OcrMode.Encoded;
    readonly languages: ReadonlyArray<OcrLanguageOrScript.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// Transcription output
// -----------------------------------------------------------------------------

const TranscribeOutputFormatKind = LiteralKit(["plainTextNoSegmentData", "json", "pttml"]);

/**
 * A transcript returned as running text, with or without timestamps.
 *
 * @category models
 * @since 0.0.0
 */
export class PlainTextNoSegmentData extends S.Opaque<PlainTextNoSegmentData, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("plainTextNoSegmentData"),
    addTimestamps: S.Boolean.annotateKey({ description: "Whether timestamps are added to the text." }),
  }).pipe(
    $I.annoteSchema("PlainTextNoSegmentData", {
      description: "A transcript returned as running text, with or without timestamps.",
    })
  )
) {}

/**
 * Companion namespace for {@link PlainTextNoSegmentData}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PlainTextNoSegmentData {
  /**
   * Encoded (wire) form of {@link PlainTextNoSegmentData}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "plainTextNoSegmentData";
    readonly addTimestamps: boolean;
  }
}

/**
 * A transcript returned as JSON segments.
 *
 * @category models
 * @since 0.0.0
 */
export class TranscribeJson extends S.Opaque<TranscribeJson, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("json") }).pipe(
    $I.annoteSchema("TranscribeJson", { description: "A transcript returned as JSON segments." })
  )
) {}

/**
 * Companion namespace for {@link TranscribeJson}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscribeJson {
  /**
   * Encoded (wire) form of {@link TranscribeJson}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "json";
  }
}

/**
 * A transcript returned in the platform's timed-text markup.
 *
 * @category models
 * @since 0.0.0
 */
export class Pttml extends S.Opaque<Pttml, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("pttml") }).pipe(
    $I.annoteSchema("Pttml", { description: "A transcript returned in the platform's timed-text markup." })
  )
) {}

/**
 * Companion namespace for {@link Pttml}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Pttml {
  /**
   * Encoded (wire) form of {@link Pttml}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "pttml";
  }
}

/**
 * The form a transcript is returned in.
 *
 * **Example** (Ask for a plain transcript with timestamps)
 *
 * ```ts import.meta.vitest name="Ask for a plain transcript with timestamps"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TranscribeOutputFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const format = TranscribeOutputFormat.cases.plainTextNoSegmentData.make({ addTimestamps: true })
 * const wire = await Effect.runPromise(S.encodeEffect(TranscribeOutputFormat)(format))
 * wire // => { type: "plainTextNoSegmentData", addTimestamps: true }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TranscribeOutputFormat = TranscribeOutputFormatKind.mapMembers(() =>
  Tuple.make(PlainTextNoSegmentData, TranscribeJson, Pttml)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TranscribeOutputFormat", { description: "The form a transcript is returned in." })
);

/**
 * Runtime type of {@link TranscribeOutputFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type TranscribeOutputFormat = typeof TranscribeOutputFormat.Type;

/**
 * Companion namespace for {@link TranscribeOutputFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscribeOutputFormat {
  /**
   * Encoded (wire) form of {@link TranscribeOutputFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | PlainTextNoSegmentData.Encoded
    | TranscribeJson.Encoded
    | Pttml.Encoded;
}

// -----------------------------------------------------------------------------
// Vision language model extraction
// -----------------------------------------------------------------------------

const LanguageModelLocatorKind = LiteralKit(["apiName", "registeredModelRid"]);

/**
 * A platform-hosted language model, named by its API name.
 *
 * @category models
 * @since 0.0.0
 */
export class ModelByApiName extends S.Opaque<ModelByApiName, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("apiName"),
    apiName: LanguageModelApiName.annotateKey({ description: "API name of the hosted model." }),
  }).pipe(
    $I.annoteSchema("ModelByApiName", { description: "A platform-hosted language model, named by its API name." })
  )
) {}

/**
 * Companion namespace for {@link ModelByApiName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ModelByApiName {
  /**
   * Encoded (wire) form of {@link ModelByApiName}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "apiName";
    readonly apiName: LanguageModelApiName.Encoded;
  }
}

/**
 * A language model its owner registered, named by its resource identifier.
 *
 * @category models
 * @since 0.0.0
 */
export class ModelByRegisteredRid extends S.Opaque<ModelByRegisteredRid, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("registeredModelRid"),
    registeredModelRid: RegisteredModelRid.annotateKey({ description: "Resource identifier of the registered model." }),
  }).pipe(
    $I.annoteSchema("ModelByRegisteredRid", {
      description: "A language model its owner registered, named by its resource identifier.",
    })
  )
) {}

/**
 * Companion namespace for {@link ModelByRegisteredRid}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ModelByRegisteredRid {
  /**
   * Encoded (wire) form of {@link ModelByRegisteredRid}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "registeredModelRid";
    readonly registeredModelRid: RegisteredModelRid.Encoded;
  }
}

/**
 * Which language model to call.
 *
 * **Details**
 *
 * OSDK takes a bare string here and always sends it as an API name, so a
 * registered model cannot be reached through it.
 *
 * **Example** (Name a hosted model)
 *
 * ```ts import.meta.vitest name="Name a hosted model"
 * import { LanguageModelApiName, LanguageModelLocator } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const locator = LanguageModelLocator.cases.apiName.make({ apiName: LanguageModelApiName.make("vision-large") })
 * const name = LanguageModelLocator.match(locator, {
 *   apiName: ({ apiName }) => apiName,
 *   registeredModelRid: ({ registeredModelRid }) => registeredModelRid,
 * })
 * name // => "vision-large"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LanguageModelLocator = LanguageModelLocatorKind.mapMembers(() =>
  Tuple.make(ModelByApiName, ModelByRegisteredRid)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("LanguageModelLocator", { description: "Which language model to call." })
);

/**
 * Runtime type of {@link LanguageModelLocator}.
 *
 * @category models
 * @since 0.0.0
 */
export type LanguageModelLocator = typeof LanguageModelLocator.Type;

/**
 * Companion namespace for {@link LanguageModelLocator}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LanguageModelLocator {
  /**
   * Encoded (wire) form of {@link LanguageModelLocator}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ModelByApiName.Encoded
    | ModelByRegisteredRid.Encoded;
}

const ChatLlmSpecFields = S.Struct({
  modelLocator: LanguageModelLocator.annotateKey({ description: "Model to call." }),
  systemPrompt: S.String.annotateKey({ description: "System prompt the model receives." }),
  userPrompt: S.String.annotateKey({ description: "User prompt the model receives." }),
  maxTokens: absent(S.Finite, "Most tokens the model may answer with."),
});

const LlmSpecKind = LiteralKit(["chat"]);

/**
 * A chat-style call to a language model: which model, and the two prompts it receives.
 *
 * @category models
 * @since 0.0.0
 */
export class ChatLlmSpec extends S.Opaque<ChatLlmSpec, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("chat"), chat: S.toEncoded(ChatLlmSpecFields) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("chat"), ...ChatLlmSpecFields.fields }),
      SchemaTransformation.transform({
        decode: ({ type, chat }) => ({ type, ...chat }),
        encode: ({ type, ...chat }) => ({ type, chat }),
      })
    ),
    $I.annoteSchema("ChatLlmSpec", {
      description: "A chat-style call to a language model: which model, and the two prompts it receives.",
    })
  )
) {}

/**
 * Companion namespace for {@link ChatLlmSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatLlmSpec {
  /**
   * Encoded (wire) form of {@link ChatLlmSpec}: the settings nested under a `chat` key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "chat";
    readonly chat: {
      readonly modelLocator: LanguageModelLocator.Encoded;
      readonly systemPrompt: string;
      readonly userPrompt: string;
      readonly maxTokens?: number;
    };
  }
}

/**
 * How a language model is called during extraction.
 *
 * **Details**
 *
 * The wire nests the call's settings under a key that repeats the tag
 * (`{ type: "chat", chat: {...} }`). Here they sit beside the tag, and
 * encoding restores the nesting.
 *
 * **Example** (Describe a chat call to a hosted model)
 *
 * ```ts import.meta.vitest name="Describe a chat call to a hosted model"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LanguageModelApiName, LanguageModelLocator, LlmSpec } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const spec = LlmSpec.cases.chat.make({
 *   modelLocator: LanguageModelLocator.cases.apiName.make({ apiName: LanguageModelApiName.make("vision-large") }),
 *   systemPrompt: "You transcribe scanned pages.",
 *   userPrompt: "Transcribe this page.",
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(LlmSpec)(spec))
 * wire.chat.modelLocator // => { type: "apiName", apiName: "vision-large" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LlmSpec = LlmSpecKind.mapMembers(() => Tuple.make(ChatLlmSpec)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("LlmSpec", { description: "How a language model is called during extraction." })
);

/**
 * Runtime type of {@link LlmSpec}.
 *
 * @category models
 * @since 0.0.0
 */
export type LlmSpec = typeof LlmSpec.Type;

/**
 * Companion namespace for {@link LlmSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LlmSpec {
  /**
   * Encoded (wire) form of {@link LlmSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ChatLlmSpec.Encoded;
}

/**
 * Settings for cropping tables out of a page before a language model reads them.
 *
 * @category models
 * @since 0.0.0
 */
export class CropConfig extends S.Opaque<CropConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    tablePrompt: S.String.annotateKey({ description: "Prompt used for cropped tables." }),
  }).pipe(
    $I.annoteSchema("CropConfig", {
      description: "Settings for cropping tables out of a page before a language model reads them.",
    })
  )
) {}

/**
 * Companion namespace for {@link CropConfig}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CropConfig {
  /**
   * Encoded (wire) form of {@link CropConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly tablePrompt: string;
  }
}

const LayoutAwarePreprocessingFields = S.Struct({
  transformationConfig: DocumentTextExtractionConfig,
  cropConfig: absent(CropConfig, "How tables are cropped out and prompted for."),
});

const VlmPreprocessingKind = LiteralKit(["layoutAware", "extractText"]);

/**
 * Preprocessing that first extracts each page's layout, so the model sees text blocks and tables in place.
 *
 * @category models
 * @since 0.0.0
 */
export class LayoutAwarePreprocessing extends S.Opaque<LayoutAwarePreprocessing, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("layoutAware"), layoutAware: S.toEncoded(LayoutAwarePreprocessingFields) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("layoutAware"), ...LayoutAwarePreprocessingFields.fields }),
      SchemaTransformation.transform({
        decode: ({ type, layoutAware }) => ({ type, ...layoutAware }),
        encode: ({ type, ...layoutAware }) => ({ type, layoutAware }),
      })
    ),
    $I.annoteSchema("LayoutAwarePreprocessing", {
      description: "Preprocessing that first extracts each page's layout before the model reads it.",
    })
  )
) {}

/**
 * Companion namespace for {@link LayoutAwarePreprocessing}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LayoutAwarePreprocessing {
  /**
   * Encoded (wire) form of {@link LayoutAwarePreprocessing}: the settings nested under a `layoutAware` key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "layoutAware";
    readonly layoutAware: {
      readonly transformationConfig: DocumentTextExtractionConfig.Encoded;
      readonly cropConfig?: CropConfig.Encoded;
    };
  }
}

/**
 * Preprocessing that first extracts each page's plain text and hands it to the model with the page image.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractTextPreprocessing extends S.Opaque<ExtractTextPreprocessing, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("extractText"), extractText: S.toEncoded(TextExtractionConfigFields) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("extractText"), ...TextExtractionConfigFields.fields }),
      SchemaTransformation.transform({
        decode: ({ type, extractText }) => ({ type, ...extractText }),
        encode: ({ type, ...extractText }) => ({ type, extractText }),
      })
    ),
    $I.annoteSchema("ExtractTextPreprocessing", {
      description: "Preprocessing that first extracts each page's plain text and hands it to the model.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractTextPreprocessing}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractTextPreprocessing {
  /**
   * Encoded (wire) form of {@link ExtractTextPreprocessing}: the settings nested under an `extractText` key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractText";
    readonly extractText: {
      readonly format?: TextOutputFormat.Encoded;
      readonly mode?: OcrMode.Encoded;
      readonly languages: ReadonlyArray<OcrLanguageOrScript.Encoded>;
    };
  }
}

/**
 * What is extracted from a page before a vision language model reads it.
 *
 * **Details**
 *
 * The wire nests each case under a key that repeats the tag. Here the
 * settings sit beside the tag, and encoding restores the nesting.
 *
 * **Example** (Preprocess pages by extracting their text)
 *
 * ```ts import.meta.vitest name="Preprocess pages by extracting their text"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OcrLanguageOrScript, VlmPreprocessingConfig } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const preprocessing = VlmPreprocessingConfig.cases.extractText.make({
 *   languages: [OcrLanguageOrScript.cases.language.make({ language: "ENG" })],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(VlmPreprocessingConfig)(preprocessing))
 * wire // => { type: "extractText", extractText: { languages: [{ type: "language", language: "ENG" }] } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VlmPreprocessingConfig = VlmPreprocessingKind.mapMembers(() =>
  Tuple.make(LayoutAwarePreprocessing, ExtractTextPreprocessing)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("VlmPreprocessingConfig", {
    description: "What is extracted from a page before a vision language model reads it.",
  })
);

/**
 * Runtime type of {@link VlmPreprocessingConfig}.
 *
 * @category models
 * @since 0.0.0
 */
export type VlmPreprocessingConfig = typeof VlmPreprocessingConfig.Type;

/**
 * Companion namespace for {@link VlmPreprocessingConfig}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VlmPreprocessingConfig {
  /**
   * Encoded (wire) form of {@link VlmPreprocessingConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | LayoutAwarePreprocessing.Encoded
    | ExtractTextPreprocessing.Encoded;
}

/**
 * How a document page is rendered to an image before a vision language model sees it.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageSpec extends S.Opaque<ImageSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    resizingMode: ResizingMode.annotateKey({
      description: "Whether the page is scaled freely or fitted inside a box.",
    }),
    height: absent(S.Finite, "Height of the rendered page in pixels."),
    width: absent(S.Finite, "Width of the rendered page in pixels."),
    mimeType: ImageryDecodeFormat.annotateKey({ description: "Image format the page is rendered to." }),
  }).pipe(
    $I.annoteSchema("ImageSpec", {
      description: "How a document page is rendered to an image before a vision language model sees it.",
    })
  )
) {}

/**
 * Companion namespace for {@link ImageSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageSpec {
  /**
   * Encoded (wire) form of {@link ImageSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly resizingMode: ResizingMode.Encoded;
    readonly height?: number;
    readonly width?: number;
    readonly mimeType: ImageryDecodeFormat.Encoded;
  }
}

// -----------------------------------------------------------------------------
// Image annotation, contrast and regions
// -----------------------------------------------------------------------------

/**
 * A colour as red, green and blue components with an optional opacity.
 *
 * @category models
 * @since 0.0.0
 */
export class Color extends S.Opaque<Color, { readonly brand: unique symbol }>()(
  S.Struct({
    r: S.Finite.annotateKey({ description: "Red component." }),
    g: S.Finite.annotateKey({ description: "Green component." }),
    b: S.Finite.annotateKey({ description: "Blue component." }),
    a: absent(S.Finite, "Opacity component."),
  }).pipe(
    $I.annoteSchema("Color", { description: "A colour as red, green and blue components with an optional opacity." })
  )
) {}

/**
 * Companion namespace for {@link Color}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Color {
  /**
   * Encoded (wire) form of {@link Color}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a?: number;
  }
}

const BoundingBoxFields = S.Struct({
  left: S.Finite.annotateKey({ description: "Distance of the box from the left edge of the image, in pixels." }),
  top: S.Finite.annotateKey({ description: "Distance of the box from the top edge of the image, in pixels." }),
  width: S.Finite.annotateKey({ description: "Width of the box in pixels." }),
  height: S.Finite.annotateKey({ description: "Height of the box in pixels." }),
});

const AnnotateGeometryKind = LiteralKit(["boundingBox"]);

/**
 * An axis-aligned rectangle on an image, placed by its top-left corner.
 *
 * @category models
 * @since 0.0.0
 */
export class BoundingBoxGeometry extends S.Opaque<BoundingBoxGeometry, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("boundingBox"), boundingBox: S.toEncoded(BoundingBoxFields) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("boundingBox"), ...BoundingBoxFields.fields }),
      SchemaTransformation.transform({
        decode: ({ type, boundingBox }) => ({ type, ...boundingBox }),
        encode: ({ type, ...boundingBox }) => ({ type, boundingBox }),
      })
    ),
    $I.annoteSchema("BoundingBoxGeometry", {
      description: "An axis-aligned rectangle on an image, placed by its top-left corner.",
    })
  )
) {}

/**
 * Companion namespace for {@link BoundingBoxGeometry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BoundingBoxGeometry {
  /**
   * Encoded (wire) form of {@link BoundingBoxGeometry}: the box nested under a `boundingBox` key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "boundingBox";
    readonly boundingBox: {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly height: number;
    };
  }
}

/**
 * The shape an annotation draws.
 *
 * **Details**
 *
 * The platform draws rectangles only today. The wire nests the rectangle under
 * a key that repeats the tag; here its sides sit beside the tag, and encoding
 * restores the nesting.
 *
 * **Example** (Encode a rectangle to draw)
 *
 * ```ts import.meta.vitest name="Encode a rectangle to draw"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AnnotateGeometry } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const box = AnnotateGeometry.cases.boundingBox.make({ left: 10, top: 20, width: 300, height: 120 })
 * const wire = await Effect.runPromise(S.encodeEffect(AnnotateGeometry)(box))
 * wire // => { type: "boundingBox", boundingBox: { left: 10, top: 20, width: 300, height: 120 } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AnnotateGeometry = AnnotateGeometryKind.mapMembers(() => Tuple.make(BoundingBoxGeometry)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AnnotateGeometry", { description: "The shape an annotation draws." })
);

/**
 * Runtime type of {@link AnnotateGeometry}.
 *
 * @category models
 * @since 0.0.0
 */
export type AnnotateGeometry = typeof AnnotateGeometry.Type;

/**
 * Companion namespace for {@link AnnotateGeometry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AnnotateGeometry {
  /**
   * Encoded (wire) form of {@link AnnotateGeometry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | BoundingBoxGeometry.Encoded;
}

/**
 * One mark drawn on an image: a shape, and optionally a label and how to stroke it.
 *
 * @category models
 * @since 0.0.0
 */
export class Annotation extends S.Opaque<Annotation, { readonly brand: unique symbol }>()(
  S.Struct({
    geometry: AnnotateGeometry.annotateKey({ description: "Shape to draw." }),
    label: absent(S.String, "Text drawn beside the shape."),
    color: absent(Color, "Colour of the shape and its label."),
    thickness: absent(S.Finite, "Stroke width of the shape in pixels."),
    fontSize: absent(S.Finite, "Size of the label text."),
  }).pipe(
    $I.annoteSchema("Annotation", {
      description: "One mark drawn on an image: a shape, and optionally a label and how to stroke it.",
    })
  )
) {}

/**
 * Companion namespace for {@link Annotation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Annotation {
  /**
   * Encoded (wire) form of {@link Annotation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly geometry: AnnotateGeometry.Encoded;
    readonly label?: string;
    readonly color?: Color.Encoded;
    readonly thickness?: number;
    readonly fontSize?: number;
  }
}

const ContrastKind = LiteralKit(["equalize", "rayleigh", "binarize"]);

/**
 * Contrast adjustment that spreads pixel intensities evenly across the available range.
 *
 * @category models
 * @since 0.0.0
 */
export class ContrastEqualize extends S.Opaque<ContrastEqualize, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("equalize") }).pipe(
    $I.annoteSchema("ContrastEqualize", {
      description: "Contrast adjustment that spreads pixel intensities evenly across the available range.",
    })
  )
) {}

/**
 * Companion namespace for {@link ContrastEqualize}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ContrastEqualize {
  /**
   * Encoded (wire) form of {@link ContrastEqualize}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "equalize";
  }
}

/**
 * Contrast adjustment that reshapes pixel intensities to a Rayleigh distribution.
 *
 * @category models
 * @since 0.0.0
 */
export class ContrastRayleigh extends S.Opaque<ContrastRayleigh, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("rayleigh"),
    sigma: S.Finite.annotateKey({ description: "Scale parameter of the target distribution." }),
  }).pipe(
    $I.annoteSchema("ContrastRayleigh", {
      description: "Contrast adjustment that reshapes pixel intensities to a Rayleigh distribution.",
    })
  )
) {}

/**
 * Companion namespace for {@link ContrastRayleigh}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ContrastRayleigh {
  /**
   * Encoded (wire) form of {@link ContrastRayleigh}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "rayleigh";
    readonly sigma: number;
  }
}

/**
 * Contrast adjustment that turns every pixel black or white around a threshold.
 *
 * @category models
 * @since 0.0.0
 */
export class ContrastBinarize extends S.Opaque<ContrastBinarize, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("binarize"),
    threshold: absent(S.Finite, "Intensity that separates black from white."),
  }).pipe(
    $I.annoteSchema("ContrastBinarize", {
      description: "Contrast adjustment that turns every pixel black or white around a threshold.",
    })
  )
) {}

/**
 * Companion namespace for {@link ContrastBinarize}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ContrastBinarize {
  /**
   * Encoded (wire) form of {@link ContrastBinarize}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "binarize";
    readonly threshold?: number;
  }
}

/**
 * How the contrast of an image is adjusted.
 *
 * **Example** (Name each contrast adjustment)
 *
 * ```ts import.meta.vitest name="Name each contrast adjustment"
 * import * as A from "effect/Array"
 * import { ContrastType } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const adjustments = [
 *   ContrastType.cases.equalize.make({}),
 *   ContrastType.cases.rayleigh.make({ sigma: 0.4 }),
 *   ContrastType.cases.binarize.make({}),
 * ]
 * const labels = A.map(
 *   adjustments,
 *   ContrastType.match({
 *     equalize: () => "equalize",
 *     rayleigh: ({ sigma }) => `rayleigh(${sigma})`,
 *     binarize: () => "binarize",
 *   })
 * )
 * labels // => ["equalize", "rayleigh(0.4)", "binarize"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContrastType = ContrastKind.mapMembers(() =>
  Tuple.make(ContrastEqualize, ContrastRayleigh, ContrastBinarize)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ContrastType", { description: "How the contrast of an image is adjusted." })
);

/**
 * Runtime type of {@link ContrastType}.
 *
 * @category models
 * @since 0.0.0
 */
export type ContrastType = typeof ContrastType.Type;

/**
 * Companion namespace for {@link ContrastType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ContrastType {
  /**
   * Encoded (wire) form of {@link ContrastType}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ContrastEqualize.Encoded
    | ContrastRayleigh.Encoded
    | ContrastBinarize.Encoded;
}

/**
 * A pixel position on an image, measured from its top-left corner.
 *
 * @category models
 * @since 0.0.0
 */
export class ImagePixelCoordinate extends S.Opaque<ImagePixelCoordinate, { readonly brand: unique symbol }>()(
  S.Struct({
    x: S.Finite.annotateKey({ description: "Distance from the left edge, in pixels." }),
    y: S.Finite.annotateKey({ description: "Distance from the top edge, in pixels." }),
  }).pipe(
    $I.annoteSchema("ImagePixelCoordinate", {
      description: "A pixel position on an image, measured from its top-left corner.",
    })
  )
) {}

/**
 * Companion namespace for {@link ImagePixelCoordinate}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImagePixelCoordinate {
  /**
   * Encoded (wire) form of {@link ImagePixelCoordinate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly x: number;
    readonly y: number;
  }
}

/**
 * A region of an image outlined by its corners; the last corner joins the first.
 *
 * **Example** (Outline a triangular region)
 *
 * ```ts import.meta.vitest name="Outline a triangular region"
 * import * as S from "effect/Schema"
 * import { ImagePixelCoordinate, ImageRegionPolygon } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const triangle = [
 *   ImagePixelCoordinate.make({ x: 0, y: 0 }),
 *   ImagePixelCoordinate.make({ x: 40, y: 0 }),
 *   ImagePixelCoordinate.make({ x: 0, y: 30 }),
 * ]
 * S.is(ImageRegionPolygon)(triangle) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageRegionPolygon = S.Array(ImagePixelCoordinate).pipe(
  $I.annoteSchema("ImageRegionPolygon", {
    description: "A region of an image outlined by its corners; the last corner joins the first.",
  })
);

/**
 * Runtime type of {@link ImageRegionPolygon}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageRegionPolygon = typeof ImageRegionPolygon.Type;

/**
 * Companion namespace for {@link ImageRegionPolygon}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageRegionPolygon {
  /**
   * Encoded (wire) form of {@link ImageRegionPolygon}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<ImagePixelCoordinate.Encoded>;
}

// -----------------------------------------------------------------------------
// Image operations
// -----------------------------------------------------------------------------

const ImageOperationKind = LiteralKit([
  "resize",
  "resizeToFitBoundingBox",
  "rotate",
  "crop",
  "grayscale",
  "tile",
  "annotate",
  "contrast",
  "encrypt",
  "decrypt",
]);

/**
 * Scales an image to a size; with neither dimension given the size is kept.
 *
 * @category models
 * @since 0.0.0
 */
export class ResizeImageOperation extends S.Opaque<ResizeImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("resize"),
    height: absent(S.Finite, outputHeight),
    width: absent(S.Finite, outputWidth),
    autoOrient: absent(S.Boolean, "Whether the image is turned upright, following its orientation tag, first."),
  }).pipe(
    $I.annoteSchema("ResizeImageOperation", {
      description: "Scales an image to a size; with neither dimension given the size is kept.",
    })
  )
) {}

/**
 * Companion namespace for {@link ResizeImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ResizeImageOperation {
  /**
   * Encoded (wire) form of {@link ResizeImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "resize";
    readonly height?: number;
    readonly width?: number;
    readonly autoOrient?: boolean;
  }
}

/**
 * Scales an image to the largest size that fits inside a box, keeping its aspect ratio.
 *
 * @category models
 * @since 0.0.0
 */
export class ResizeToFitBoundingBoxOperation extends S.Opaque<
  ResizeToFitBoundingBoxOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("resizeToFitBoundingBox"),
    width: S.Finite.annotateKey({ description: "Width of the box in pixels." }),
    height: S.Finite.annotateKey({ description: "Height of the box in pixels." }),
  }).pipe(
    $I.annoteSchema("ResizeToFitBoundingBoxOperation", {
      description: "Scales an image to the largest size that fits inside a box, keeping its aspect ratio.",
    })
  )
) {}

/**
 * Companion namespace for {@link ResizeToFitBoundingBoxOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ResizeToFitBoundingBoxOperation {
  /**
   * Encoded (wire) form of {@link ResizeToFitBoundingBoxOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "resizeToFitBoundingBox";
    readonly width: number;
    readonly height: number;
  }
}

/**
 * Turns an image clockwise by a quarter-turn angle.
 *
 * @category models
 * @since 0.0.0
 */
export class RotateImageOperation extends S.Opaque<RotateImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("rotate"),
    angle: RotationAngle.annotateKey({ description: "Clockwise angle to turn the image by." }),
  }).pipe(
    $I.annoteSchema("RotateImageOperation", { description: "Turns an image clockwise by a quarter-turn angle." })
  )
) {}

/**
 * Companion namespace for {@link RotateImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RotateImageOperation {
  /**
   * Encoded (wire) form of {@link RotateImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "rotate";
    readonly angle: RotationAngle.Encoded;
  }
}

/**
 * Cuts a rectangular window out of an image.
 *
 * @category models
 * @since 0.0.0
 */
export class CropImageOperation extends S.Opaque<CropImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("crop"),
    xOffset: S.Finite.annotateKey({ description: "Distance of the window from the left edge, in pixels." }),
    yOffset: S.Finite.annotateKey({ description: "Distance of the window from the top edge, in pixels." }),
    width: S.Finite.annotateKey({ description: "Width of the window in pixels." }),
    height: S.Finite.annotateKey({ description: "Height of the window in pixels." }),
  }).pipe($I.annoteSchema("CropImageOperation", { description: "Cuts a rectangular window out of an image." }))
) {}

/**
 * Companion namespace for {@link CropImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CropImageOperation {
  /**
   * Encoded (wire) form of {@link CropImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "crop";
    readonly xOffset: number;
    readonly yOffset: number;
    readonly width: number;
    readonly height: number;
  }
}

/**
 * Converts an image to shades of grey.
 *
 * @category models
 * @since 0.0.0
 */
export class GrayscaleImageOperation extends S.Opaque<GrayscaleImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("grayscale") }).pipe(
    $I.annoteSchema("GrayscaleImageOperation", { description: "Converts an image to shades of grey." })
  )
) {}

/**
 * Companion namespace for {@link GrayscaleImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GrayscaleImageOperation {
  /**
   * Encoded (wire) form of {@link GrayscaleImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "grayscale";
  }
}

/**
 * Renders one web-map tile of a geo-referenced image.
 *
 * **Details**
 *
 * Tiles follow the slippy-map scheme in the web Mercator projection. Only
 * geo-referenced TIFF and NITF images of at most 100 million pixels can be
 * tiled.
 *
 * @category models
 * @since 0.0.0
 */
export class TileImageOperation extends S.Opaque<TileImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("tile"),
    zoom: S.Finite.annotateKey({ description: "Zoom level of the tile." }),
    x: S.Finite.annotateKey({ description: "Column of the tile at that zoom level." }),
    y: S.Finite.annotateKey({ description: "Row of the tile at that zoom level." }),
  }).pipe(
    $I.annoteSchema("TileImageOperation", { description: "Renders one web-map tile of a geo-referenced image." })
  )
) {}

/**
 * Companion namespace for {@link TileImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TileImageOperation {
  /**
   * Encoded (wire) form of {@link TileImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "tile";
    readonly zoom: number;
    readonly x: number;
    readonly y: number;
  }
}

/**
 * Draws shapes and labels on an image.
 *
 * @category models
 * @since 0.0.0
 */
export class AnnotateImageOperation extends S.Opaque<AnnotateImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("annotate"),
    annotations: S.Array(Annotation).annotateKey({ description: "Marks to draw, in drawing order." }),
  }).pipe($I.annoteSchema("AnnotateImageOperation", { description: "Draws shapes and labels on an image." }))
) {}

/**
 * Companion namespace for {@link AnnotateImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AnnotateImageOperation {
  /**
   * Encoded (wire) form of {@link AnnotateImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "annotate";
    readonly annotations: ReadonlyArray<Annotation.Encoded>;
  }
}

/**
 * Adjusts the contrast of an image.
 *
 * @category models
 * @since 0.0.0
 */
export class ContrastImageOperation extends S.Opaque<ContrastImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("contrast"),
    contrastType: ContrastType.annotateKey({ description: "Adjustment to apply." }),
  }).pipe($I.annoteSchema("ContrastImageOperation", { description: "Adjusts the contrast of an image." }))
) {}

/**
 * Companion namespace for {@link ContrastImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ContrastImageOperation {
  /**
   * Encoded (wire) form of {@link ContrastImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "contrast";
    readonly contrastType: ContrastType.Encoded;
  }
}

/**
 * Encrypts regions of an image with a commutative encryption algorithm.
 *
 * @category models
 * @since 0.0.0
 */
export class EncryptImageOperation extends S.Opaque<EncryptImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("encrypt"),
    polygons: S.Array(ImageRegionPolygon).annotateKey({ description: "Regions to encrypt." }),
    cipherLicenseRid: CipherLicenseRid.annotateKey({ description: "Cipher license to encrypt with." }),
  }).pipe(
    $I.annoteSchema("EncryptImageOperation", {
      description: "Encrypts regions of an image with a commutative encryption algorithm.",
    })
  )
) {}

/**
 * Companion namespace for {@link EncryptImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EncryptImageOperation {
  /**
   * Encoded (wire) form of {@link EncryptImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "encrypt";
    readonly polygons: ReadonlyArray<ImageRegionPolygon.Encoded>;
    readonly cipherLicenseRid: CipherLicenseRid.Encoded;
  }
}

/**
 * Decrypts regions of an image that were encrypted with a commutative encryption algorithm.
 *
 * @category models
 * @since 0.0.0
 */
export class DecryptImageOperation extends S.Opaque<DecryptImageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("decrypt"),
    polygons: S.Array(ImageRegionPolygon).annotateKey({ description: "Regions to decrypt." }),
    cipherLicenseRid: CipherLicenseRid.annotateKey({ description: "Cipher license to decrypt with." }),
  }).pipe(
    $I.annoteSchema("DecryptImageOperation", {
      description: "Decrypts regions of an image that were encrypted with a commutative encryption algorithm.",
    })
  )
) {}

/**
 * Companion namespace for {@link DecryptImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DecryptImageOperation {
  /**
   * Encoded (wire) form of {@link DecryptImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "decrypt";
    readonly polygons: ReadonlyArray<ImageRegionPolygon.Encoded>;
    readonly cipherLicenseRid: CipherLicenseRid.Encoded;
  }
}

/**
 * One step of an image-to-image transformation.
 *
 * **Example** (Build a list of image steps)
 *
 * ```ts import.meta.vitest name="Build a list of image steps"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { ImageOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const steps = [
 *   ImageOperation.cases.resize.make({ width: O.some(800) }),
 *   ImageOperation.cases.rotate.make({ angle: "degree90" }),
 *   ImageOperation.cases.grayscale.make({}),
 * ]
 * const changesPixels = ImageOperation.isAnyOf(["grayscale", "contrast", "encrypt", "decrypt"])
 * const verdicts = A.map(steps, changesPixels)
 * verdicts // => [false, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageOperation = ImageOperationKind.mapMembers(() =>
  Tuple.make(
    ResizeImageOperation,
    ResizeToFitBoundingBoxOperation,
    RotateImageOperation,
    CropImageOperation,
    GrayscaleImageOperation,
    TileImageOperation,
    AnnotateImageOperation,
    ContrastImageOperation,
    EncryptImageOperation,
    DecryptImageOperation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ImageOperation", { description: "One step of an image-to-image transformation." })
);

/**
 * Runtime type of {@link ImageOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageOperation = typeof ImageOperation.Type;

/**
 * Companion namespace for {@link ImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageOperation {
  /**
   * Encoded (wire) form of {@link ImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ResizeImageOperation.Encoded
    | ResizeToFitBoundingBoxOperation.Encoded
    | RotateImageOperation.Encoded
    | CropImageOperation.Encoded
    | GrayscaleImageOperation.Encoded
    | TileImageOperation.Encoded
    | AnnotateImageOperation.Encoded
    | ContrastImageOperation.Encoded
    | EncryptImageOperation.Encoded
    | DecryptImageOperation.Encoded;
}

// -----------------------------------------------------------------------------
// Video and audio operations
// -----------------------------------------------------------------------------

const VideoOperationKind = LiteralKit(["transcode", "chunk"]);

/**
 * Re-encodes a whole video into the requested container format.
 *
 * @category models
 * @since 0.0.0
 */
export class TranscodeOperation extends S.Opaque<TranscodeOperation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("transcode") }).pipe(
    $I.annoteSchema("TranscodeOperation", {
      description: "Re-encodes a whole video into the requested container format.",
    })
  )
) {}

/**
 * Companion namespace for {@link TranscodeOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscodeOperation {
  /**
   * Encoded (wire) form of {@link TranscodeOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "transcode";
  }
}

/**
 * Returns one fixed-length segment of a video; the final segment may be shorter.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoChunkOperation extends S.Opaque<VideoChunkOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("chunk"),
    chunkDurationMilliseconds: S.Finite.annotateKey({ description: "Length of every segment in milliseconds." }),
    chunkIndex: S.Finite.annotateKey({ description: "Which segment to return." }),
  }).pipe(
    $I.annoteSchema("VideoChunkOperation", {
      description: "Returns one fixed-length segment of a video; the final segment may be shorter.",
    })
  )
) {}

/**
 * Companion namespace for {@link VideoChunkOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoChunkOperation {
  /**
   * Encoded (wire) form of {@link VideoChunkOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "chunk";
    readonly chunkDurationMilliseconds: number;
    readonly chunkIndex: number;
  }
}

/**
 * What a video-to-video transformation does.
 *
 * **Example** (Ask for the third ten-second segment of a video)
 *
 * ```ts import.meta.vitest name="Ask for the third ten-second segment of a video"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { VideoOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = VideoOperation.cases.chunk.make({ chunkDurationMilliseconds: 10000, chunkIndex: 2 })
 * const wire = await Effect.runPromise(S.encodeEffect(VideoOperation)(operation))
 * wire // => { type: "chunk", chunkDurationMilliseconds: 10000, chunkIndex: 2 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoOperation = VideoOperationKind.mapMembers(() =>
  Tuple.make(TranscodeOperation, VideoChunkOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("VideoOperation", { description: "What a video-to-video transformation does." })
);

/**
 * Runtime type of {@link VideoOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoOperation = typeof VideoOperation.Type;

/**
 * Companion namespace for {@link VideoOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoOperation {
  /**
   * Encoded (wire) form of {@link VideoOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | TranscodeOperation.Encoded
    | VideoChunkOperation.Encoded;
}

const AudioOperationKind = LiteralKit(["channel", "chunk", "convert"]);

/**
 * Extracts one channel of multi-channel audio.
 *
 * @category models
 * @since 0.0.0
 */
export class AudioChannelOperation extends S.Opaque<AudioChannelOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("channel"),
    encodeFormat: AudioEncoding.annotateKey({ description: "Format to write the channel in." }),
    channel: S.Finite.annotateKey({ description: "Which channel to extract." }),
  }).pipe(
    $I.annoteSchema("AudioChannelOperation", { description: "Extracts one channel of multi-channel audio." })
  )
) {}

/**
 * Companion namespace for {@link AudioChannelOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioChannelOperation {
  /**
   * Encoded (wire) form of {@link AudioChannelOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "channel";
    readonly encodeFormat: AudioEncoding.Encoded;
    readonly channel: number;
  }
}

/**
 * Returns one fixed-length segment of an audio file.
 *
 * @category models
 * @since 0.0.0
 */
export class AudioChunkOperation extends S.Opaque<AudioChunkOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("chunk"),
    chunkDurationMilliseconds: S.Finite.annotateKey({ description: "Length of every segment in milliseconds." }),
    encodeFormat: AudioEncoding.annotateKey({ description: "Format to write the segment in." }),
    chunkIndex: S.Finite.annotateKey({ description: "Which segment to return." }),
  }).pipe(
    $I.annoteSchema("AudioChunkOperation", { description: "Returns one fixed-length segment of an audio file." })
  )
) {}

/**
 * Companion namespace for {@link AudioChunkOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioChunkOperation {
  /**
   * Encoded (wire) form of {@link AudioChunkOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "chunk";
    readonly chunkDurationMilliseconds: number;
    readonly encodeFormat: AudioEncoding.Encoded;
    readonly chunkIndex: number;
  }
}

/**
 * Re-encodes a whole audio file into another format.
 *
 * @category models
 * @since 0.0.0
 */
export class ConvertAudioOperation extends S.Opaque<ConvertAudioOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("convert"),
    encodeFormat: AudioEncoding.annotateKey({ description: "Format to write the audio in." }),
  }).pipe(
    $I.annoteSchema("ConvertAudioOperation", { description: "Re-encodes a whole audio file into another format." })
  )
) {}

/**
 * Companion namespace for {@link ConvertAudioOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConvertAudioOperation {
  /**
   * Encoded (wire) form of {@link ConvertAudioOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "convert";
    readonly encodeFormat: AudioEncoding.Encoded;
  }
}

/**
 * What an audio-to-audio transformation does.
 *
 * **Details**
 *
 * An audio transformation has no output format of its own: each operation
 * names the format it writes.
 *
 * **Example** (Convert audio to MP3)
 *
 * ```ts import.meta.vitest name="Convert audio to MP3"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AudioEncoding, AudioOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = AudioOperation.cases.convert.make({ encodeFormat: AudioEncoding.cases.mp3.make({}) })
 * const wire = await Effect.runPromise(S.encodeEffect(AudioOperation)(operation))
 * wire // => { type: "convert", encodeFormat: { type: "mp3" } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AudioOperation = AudioOperationKind.mapMembers(() =>
  Tuple.make(AudioChannelOperation, AudioChunkOperation, ConvertAudioOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AudioOperation", { description: "What an audio-to-audio transformation does." })
);

/**
 * Runtime type of {@link AudioOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type AudioOperation = typeof AudioOperation.Type;

/**
 * Companion namespace for {@link AudioOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioOperation {
  /**
   * Encoded (wire) form of {@link AudioOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | AudioChannelOperation.Encoded
    | AudioChunkOperation.Encoded
    | ConvertAudioOperation.Encoded;
}

const VideoToAudioOperationKind = LiteralKit(["extractAudio"]);

/**
 * Takes the first audio stream out of a video.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractAudioOperation extends S.Opaque<ExtractAudioOperation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("extractAudio") }).pipe(
    $I.annoteSchema("ExtractAudioOperation", { description: "Takes the first audio stream out of a video." })
  )
) {}

/**
 * Companion namespace for {@link ExtractAudioOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractAudioOperation {
  /**
   * Encoded (wire) form of {@link ExtractAudioOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractAudio";
  }
}

/**
 * What a video-to-audio transformation does.
 *
 * **Example** (Name the video-to-audio operation)
 *
 * ```ts import.meta.vitest name="Name the video-to-audio operation"
 * import { VideoToAudioOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = VideoToAudioOperation.cases.extractAudio.make({})
 * operation.type // => "extractAudio"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoToAudioOperation = VideoToAudioOperationKind.mapMembers(() =>
  Tuple.make(ExtractAudioOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("VideoToAudioOperation", { description: "What a video-to-audio transformation does." })
);

/**
 * Runtime type of {@link VideoToAudioOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoToAudioOperation = typeof VideoToAudioOperation.Type;

/**
 * Companion namespace for {@link VideoToAudioOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToAudioOperation {
  /**
   * Encoded (wire) form of {@link VideoToAudioOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ExtractAudioOperation.Encoded;
}

const AudioToTextOperationKind = LiteralKit(["transcribe", "waveform"]);

/**
 * Turns the speech in an audio file into text.
 *
 * @category models
 * @since 0.0.0
 */
export class TranscribeOperation extends S.Opaque<TranscribeOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("transcribe"),
    language: absent(TranscriptionLanguage, "Language spoken; detected from the start of the audio when absent."),
    diarize: absent(S.Boolean, "Whether the transcript tells speakers apart."),
    outputFormat: absent(TranscribeOutputFormat, "Form the transcript is returned in."),
    performanceMode: absent(PerformanceMode, "Whether to favour cost or speed."),
  }).pipe(
    $I.annoteSchema("TranscribeOperation", { description: "Turns the speech in an audio file into text." })
  )
) {}

/**
 * Companion namespace for {@link TranscribeOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscribeOperation {
  /**
   * Encoded (wire) form of {@link TranscribeOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "transcribe";
    readonly language?: TranscriptionLanguage.Encoded;
    readonly diarize?: boolean;
    readonly outputFormat?: TranscribeOutputFormat.Encoded;
    readonly performanceMode?: PerformanceMode.Encoded;
  }
}

/**
 * Samples the loudness of an audio file over time, as JSON amplitudes between 0 and 1.
 *
 * @category models
 * @since 0.0.0
 */
export class WaveformOperation extends S.Opaque<WaveformOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("waveform"),
    peaksPerSecond: S.Finite.annotateKey({ description: "Number of amplitude samples per second of audio." }),
  }).pipe(
    $I.annoteSchema("WaveformOperation", {
      description: "Samples the loudness of an audio file over time, as JSON amplitudes between 0 and 1.",
    })
  )
) {}

/**
 * Companion namespace for {@link WaveformOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WaveformOperation {
  /**
   * Encoded (wire) form of {@link WaveformOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "waveform";
    readonly peaksPerSecond: number;
  }
}

/**
 * What an audio-to-text transformation does.
 *
 * **Example** (Transcribe French audio and tell speakers apart)
 *
 * ```ts import.meta.vitest name="Transcribe French audio and tell speakers apart"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AudioToTextOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = AudioToTextOperation.cases.transcribe.make({
 *   language: O.some("FR"),
 *   diarize: O.some(true),
 *   performanceMode: O.some("morePerformant"),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(AudioToTextOperation)(operation))
 * wire // => { type: "transcribe", language: "FR", diarize: true, performanceMode: "MORE_PERFORMANT" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AudioToTextOperation = AudioToTextOperationKind.mapMembers(() =>
  Tuple.make(TranscribeOperation, WaveformOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AudioToTextOperation", { description: "What an audio-to-text transformation does." })
);

/**
 * Runtime type of {@link AudioToTextOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type AudioToTextOperation = typeof AudioToTextOperation.Type;

/**
 * Companion namespace for {@link AudioToTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioToTextOperation {
  /**
   * Encoded (wire) form of {@link AudioToTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | TranscribeOperation.Encoded
    | WaveformOperation.Encoded;
}

const VideoToArchiveOperationKind = LiteralKit(["extractSceneFrames"]);

/**
 * Collects the scene frames of a video into an archive of images.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractSceneFramesOperation extends S.Opaque<
  ExtractSceneFramesOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractSceneFrames"),
    encoding: ImageryEncoding.annotateKey({ description: "Image format of each frame inside the archive." }),
    sceneScore: absent(SceneScore, "How readily a new scene is declared."),
  }).pipe(
    $I.annoteSchema("ExtractSceneFramesOperation", {
      description: "Collects the scene frames of a video into an archive of images.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractSceneFramesOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractSceneFramesOperation {
  /**
   * Encoded (wire) form of {@link ExtractSceneFramesOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractSceneFrames";
    readonly encoding: ImageryEncoding.Encoded;
    readonly sceneScore?: SceneScore.Encoded;
  }
}

/**
 * What a video-to-archive transformation does.
 *
 * **Example** (Collect scene frames as PNG images)
 *
 * ```ts import.meta.vitest name="Collect scene frames as PNG images"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { VideoToArchiveOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = VideoToArchiveOperation.cases.extractSceneFrames.make({
 *   encoding: "png",
 *   sceneScore: O.some("lessSensitive"),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(VideoToArchiveOperation)(operation))
 * wire // => { type: "extractSceneFrames", encoding: { type: "png" }, sceneScore: "LESS_SENSITIVE" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoToArchiveOperation = VideoToArchiveOperationKind.mapMembers(() =>
  Tuple.make(ExtractSceneFramesOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("VideoToArchiveOperation", { description: "What a video-to-archive transformation does." })
);

/**
 * Runtime type of {@link VideoToArchiveOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoToArchiveOperation = typeof VideoToArchiveOperation.Type;

/**
 * Companion namespace for {@link VideoToArchiveOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToArchiveOperation {
  /**
   * Encoded (wire) form of {@link VideoToArchiveOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ExtractSceneFramesOperation.Encoded;
}

const VideoToTextOperationKind = LiteralKit(["getTimestampsForSceneFrames"]);

/**
 * Lists, as JSON, the timestamps of the scene frames of a video.
 *
 * @category models
 * @since 0.0.0
 */
export class GetTimestampsForSceneFramesOperation extends S.Opaque<
  GetTimestampsForSceneFramesOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("getTimestampsForSceneFrames"),
    sceneScore: absent(SceneScore, "How readily a new scene is declared."),
  }).pipe(
    $I.annoteSchema("GetTimestampsForSceneFramesOperation", {
      description: "Lists, as JSON, the timestamps of the scene frames of a video.",
    })
  )
) {}

/**
 * Companion namespace for {@link GetTimestampsForSceneFramesOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GetTimestampsForSceneFramesOperation {
  /**
   * Encoded (wire) form of {@link GetTimestampsForSceneFramesOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "getTimestampsForSceneFrames";
    readonly sceneScore?: SceneScore.Encoded;
  }
}

/**
 * What a video-to-text transformation does.
 *
 * **Example** (Name the video-to-text operation)
 *
 * ```ts import.meta.vitest name="Name the video-to-text operation"
 * import * as O from "effect/Option"
 * import { VideoToTextOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = VideoToTextOperation.cases.getTimestampsForSceneFrames.make({})
 * const facts = [operation.type, O.isNone(operation.sceneScore)]
 * facts // => ["getTimestampsForSceneFrames", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoToTextOperation = VideoToTextOperationKind.mapMembers(() =>
  Tuple.make(GetTimestampsForSceneFramesOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("VideoToTextOperation", { description: "What a video-to-text transformation does." })
);

/**
 * Runtime type of {@link VideoToTextOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoToTextOperation = typeof VideoToTextOperation.Type;

/**
 * Companion namespace for {@link VideoToTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToTextOperation {
  /**
   * Encoded (wire) form of {@link VideoToTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | GetTimestampsForSceneFramesOperation.Encoded;
}

const VideoToImageOperationKind = LiteralKit(["extractFirstFrame", "extractFramesAtTimestamps"]);

/**
 * Returns the first frame of a video as an image.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFirstFrameOperation extends S.Opaque<
  ExtractFirstFrameOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractFirstFrame"),
    height: absent(S.Finite, outputHeight),
    width: absent(S.Finite, outputWidth),
  }).pipe(
    $I.annoteSchema("ExtractFirstFrameOperation", { description: "Returns the first frame of a video as an image." })
  )
) {}

/**
 * Companion namespace for {@link ExtractFirstFrameOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractFirstFrameOperation {
  /**
   * Encoded (wire) form of {@link ExtractFirstFrameOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractFirstFrame";
    readonly height?: number;
    readonly width?: number;
  }
}

/**
 * Returns the frame of a video at one point in time as an image.
 *
 * **Details**
 *
 * Despite the plural in its wire name, the operation takes a single timestamp.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesAtTimestampsOperation extends S.Opaque<
  ExtractFramesAtTimestampsOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractFramesAtTimestamps"),
    height: absent(S.Finite, outputHeight),
    width: absent(S.Finite, outputWidth),
    timestamp: S.Finite.annotateKey({ description: "Point in the video to take the frame at." }),
  }).pipe(
    $I.annoteSchema("ExtractFramesAtTimestampsOperation", {
      description: "Returns the frame of a video at one point in time as an image.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractFramesAtTimestampsOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractFramesAtTimestampsOperation {
  /**
   * Encoded (wire) form of {@link ExtractFramesAtTimestampsOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractFramesAtTimestamps";
    readonly height?: number;
    readonly width?: number;
    readonly timestamp: number;
  }
}

/**
 * What a video-to-image transformation does.
 *
 * **Example** (Take a frame from the middle of a video)
 *
 * ```ts import.meta.vitest name="Take a frame from the middle of a video"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { VideoToImageOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = VideoToImageOperation.cases.extractFramesAtTimestamps.make({ timestamp: 42.5 })
 * const wire = await Effect.runPromise(S.encodeEffect(VideoToImageOperation)(operation))
 * wire // => { type: "extractFramesAtTimestamps", timestamp: 42.5 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoToImageOperation = VideoToImageOperationKind.mapMembers(() =>
  Tuple.make(ExtractFirstFrameOperation, ExtractFramesAtTimestampsOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("VideoToImageOperation", { description: "What a video-to-image transformation does." })
);

/**
 * Runtime type of {@link VideoToImageOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoToImageOperation = typeof VideoToImageOperation.Type;

/**
 * Companion namespace for {@link VideoToImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToImageOperation {
  /**
   * Encoded (wire) form of {@link VideoToImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ExtractFirstFrameOperation.Encoded
    | ExtractFramesAtTimestampsOperation.Encoded;
}

// -----------------------------------------------------------------------------
// Email and spreadsheet operations
// -----------------------------------------------------------------------------

const EmailToTextOperationKind = LiteralKit(["getEmailBody"]);

/**
 * Returns the body of an email as plain text or HTML.
 *
 * @category models
 * @since 0.0.0
 */
export class GetEmailBodyOperation extends S.Opaque<GetEmailBodyOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("getEmailBody"),
    outputFormat: EmailBodyFormat.annotateKey({ description: "Which rendering of the body to return." }),
  }).pipe(
    $I.annoteSchema("GetEmailBodyOperation", { description: "Returns the body of an email as plain text or HTML." })
  )
) {}

/**
 * Companion namespace for {@link GetEmailBodyOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GetEmailBodyOperation {
  /**
   * Encoded (wire) form of {@link GetEmailBodyOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "getEmailBody";
    readonly outputFormat: EmailBodyFormat.Encoded;
  }
}

/**
 * What an email-to-text transformation does.
 *
 * **Example** (Ask for the HTML body of an email)
 *
 * ```ts import.meta.vitest name="Ask for the HTML body of an email"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmailToTextOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = EmailToTextOperation.cases.getEmailBody.make({ outputFormat: "html" })
 * const wire = await Effect.runPromise(S.encodeEffect(EmailToTextOperation)(operation))
 * wire // => { type: "getEmailBody", outputFormat: "HTML" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmailToTextOperation = EmailToTextOperationKind.mapMembers(() =>
  Tuple.make(GetEmailBodyOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EmailToTextOperation", { description: "What an email-to-text transformation does." })
);

/**
 * Runtime type of {@link EmailToTextOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmailToTextOperation = typeof EmailToTextOperation.Type;

/**
 * Companion namespace for {@link EmailToTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EmailToTextOperation {
  /**
   * Encoded (wire) form of {@link EmailToTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | GetEmailBodyOperation.Encoded;
}

const EmailToAttachmentOperationKind = LiteralKit(["getEmailAttachment"]);

/**
 * Returns the bytes of one file attached to an email.
 *
 * @category models
 * @since 0.0.0
 */
export class GetEmailAttachmentOperation extends S.Opaque<
  GetEmailAttachmentOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("getEmailAttachment"),
    mimeType: MediaType.annotateKey({ description: "MIME type of the attachment, as its metadata reports it." }),
    attachmentIndex: S.Finite.annotateKey({ description: "Position of the attachment in the email." }),
  }).pipe(
    $I.annoteSchema("GetEmailAttachmentOperation", {
      description: "Returns the bytes of one file attached to an email.",
    })
  )
) {}

/**
 * Companion namespace for {@link GetEmailAttachmentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GetEmailAttachmentOperation {
  /**
   * Encoded (wire) form of {@link GetEmailAttachmentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "getEmailAttachment";
    readonly mimeType: MediaType.Encoded;
    readonly attachmentIndex: number;
  }
}

/**
 * What an email-to-attachment transformation does.
 *
 * **Example** (Fetch the first attachment of an email)
 *
 * ```ts import.meta.vitest name="Fetch the first attachment of an email"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MediaType } from "@beep/scratchpad/osdk/src/Attachment/index"
 * import { EmailToAttachmentOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = EmailToAttachmentOperation.cases.getEmailAttachment.make({
 *   mimeType: MediaType.make("application/pdf"),
 *   attachmentIndex: 0,
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(EmailToAttachmentOperation)(operation))
 * wire // => { type: "getEmailAttachment", mimeType: "application/pdf", attachmentIndex: 0 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmailToAttachmentOperation = EmailToAttachmentOperationKind.mapMembers(() =>
  Tuple.make(GetEmailAttachmentOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EmailToAttachmentOperation", {
    description: "What an email-to-attachment transformation does.",
  })
);

/**
 * Runtime type of {@link EmailToAttachmentOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmailToAttachmentOperation = typeof EmailToAttachmentOperation.Type;

/**
 * Companion namespace for {@link EmailToAttachmentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EmailToAttachmentOperation {
  /**
   * Encoded (wire) form of {@link EmailToAttachmentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | GetEmailAttachmentOperation.Encoded;
}

const SpreadsheetToTextOperationKind = LiteralKit(["convertSheetToJson"]);

/**
 * Converts one sheet of a spreadsheet to JSON.
 *
 * @category models
 * @since 0.0.0
 */
export class ConvertSheetToJsonOperation extends S.Opaque<
  ConvertSheetToJsonOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("convertSheetToJson"),
    sheetName: S.String.annotateKey({ description: "Name of the sheet to convert." }),
  }).pipe(
    $I.annoteSchema("ConvertSheetToJsonOperation", {
      description: "Converts one sheet of a spreadsheet to JSON.",
    })
  )
) {}

/**
 * Companion namespace for {@link ConvertSheetToJsonOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConvertSheetToJsonOperation {
  /**
   * Encoded (wire) form of {@link ConvertSheetToJsonOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "convertSheetToJson";
    readonly sheetName: string;
  }
}

/**
 * What a spreadsheet-to-text transformation does.
 *
 * **Example** (Convert one sheet to JSON)
 *
 * ```ts import.meta.vitest name="Convert one sheet to JSON"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SpreadsheetToTextOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = SpreadsheetToTextOperation.cases.convertSheetToJson.make({ sheetName: "Q3" })
 * const wire = await Effect.runPromise(S.encodeEffect(SpreadsheetToTextOperation)(operation))
 * wire // => { type: "convertSheetToJson", sheetName: "Q3" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpreadsheetToTextOperation = SpreadsheetToTextOperationKind.mapMembers(() =>
  Tuple.make(ConvertSheetToJsonOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("SpreadsheetToTextOperation", {
    description: "What a spreadsheet-to-text transformation does.",
  })
);

/**
 * Runtime type of {@link SpreadsheetToTextOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type SpreadsheetToTextOperation = typeof SpreadsheetToTextOperation.Type;

/**
 * Companion namespace for {@link SpreadsheetToTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SpreadsheetToTextOperation {
  /**
   * Encoded (wire) form of {@link SpreadsheetToTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ConvertSheetToJsonOperation.Encoded;
}

// -----------------------------------------------------------------------------
// Image-to-other operations
// -----------------------------------------------------------------------------

const ImageToTextOperationKind = LiteralKit([
  "extractLayoutAwareContent",
  "ocr",
  "extractLayoutAwareTextV2",
  "extractTextV2",
]);

/**
 * Extracts the text of an image together with its layout, in the older result format.
 *
 * **Details**
 *
 * The platform has deprecated this operation in favour of
 * {@link ExtractImageLayoutAwareTextOperation}, whose result has a different
 * block structure.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageExtractLayoutAwareContentOperation extends S.Opaque<
  ImageExtractLayoutAwareContentOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractLayoutAwareContent"),
    parameters: LayoutAwareExtractionParameters,
  }).pipe(
    $I.annoteSchema("ImageExtractLayoutAwareContentOperation", {
      description: "Extracts the text of an image together with its layout, in the older result format.",
    })
  )
) {}

/**
 * Companion namespace for {@link ImageExtractLayoutAwareContentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageExtractLayoutAwareContentOperation {
  /**
   * Encoded (wire) form of {@link ImageExtractLayoutAwareContentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractLayoutAwareContent";
    readonly parameters: LayoutAwareExtractionParameters.Encoded;
  }
}

/**
 * Recognises the text in an image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageOcrOperation extends S.Opaque<ImageOcrOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("ocr"),
    parameters: OcrParameters,
  }).pipe($I.annoteSchema("ImageOcrOperation", { description: "Recognises the text in an image." }))
) {}

/**
 * Companion namespace for {@link ImageOcrOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageOcrOperation {
  /**
   * Encoded (wire) form of {@link ImageOcrOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "ocr";
    readonly parameters: OcrParameters.Encoded;
  }
}

/**
 * Extracts the text of an image as structured JSON blocks with their positions.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractImageLayoutAwareTextOperation extends S.Opaque<
  ExtractImageLayoutAwareTextOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractLayoutAwareTextV2"),
    format: absent(TextOutputFormat, "Markup of each block's content."),
    languages: S.Array(OcrLanguageOrScript).annotateKey({
      description: "Languages and writing systems the text may be in.",
    }),
  }).pipe(
    $I.annoteSchema("ExtractImageLayoutAwareTextOperation", {
      description: "Extracts the text of an image as structured JSON blocks with their positions.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractImageLayoutAwareTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractImageLayoutAwareTextOperation {
  /**
   * Encoded (wire) form of {@link ExtractImageLayoutAwareTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractLayoutAwareTextV2";
    readonly format?: TextOutputFormat.Encoded;
    readonly languages: ReadonlyArray<OcrLanguageOrScript.Encoded>;
  }
}

/**
 * Extracts the text of an image as plain text, Markdown or HTML, without positions.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractImageTextOperation extends S.Opaque<ExtractImageTextOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("extractTextV2"),
    format: absent(TextOutputFormat, "Markup to return the text in."),
    languages: S.Array(OcrLanguageOrScript).annotateKey({
      description: "Languages and writing systems the text may be in.",
    }),
  }).pipe(
    $I.annoteSchema("ExtractImageTextOperation", {
      description: "Extracts the text of an image as plain text, Markdown or HTML, without positions.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractImageTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractImageTextOperation {
  /**
   * Encoded (wire) form of {@link ExtractImageTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractTextV2";
    readonly format?: TextOutputFormat.Encoded;
    readonly languages: ReadonlyArray<OcrLanguageOrScript.Encoded>;
  }
}

/**
 * What an image-to-text transformation does.
 *
 * **Details**
 *
 * OSDK exposes only the first two of these four operations.
 *
 * **Example** (Extract Markdown from an image)
 *
 * ```ts import.meta.vitest name="Extract Markdown from an image"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ImageToTextOperation, OcrLanguageOrScript } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = ImageToTextOperation.cases.extractTextV2.make({
 *   format: O.some("markdown"),
 *   languages: [OcrLanguageOrScript.cases.script.make({ script: "LATIN" })],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(ImageToTextOperation)(operation))
 * wire // => { type: "extractTextV2", format: "MARKDOWN", languages: [{ type: "script", script: "LATIN" }] }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageToTextOperation = ImageToTextOperationKind.mapMembers(() =>
  Tuple.make(
    ImageExtractLayoutAwareContentOperation,
    ImageOcrOperation,
    ExtractImageLayoutAwareTextOperation,
    ExtractImageTextOperation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ImageToTextOperation", { description: "What an image-to-text transformation does." })
);

/**
 * Runtime type of {@link ImageToTextOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageToTextOperation = typeof ImageToTextOperation.Type;

/**
 * Companion namespace for {@link ImageToTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageToTextOperation {
  /**
   * Encoded (wire) form of {@link ImageToTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ImageExtractLayoutAwareContentOperation.Encoded
    | ImageOcrOperation.Encoded
    | ExtractImageLayoutAwareTextOperation.Encoded
    | ExtractImageTextOperation.Encoded;
}

const ImageToDocumentOperationKind = LiteralKit(["createPdf"]);

/**
 * Converts an image to a PDF document.
 *
 * @category models
 * @since 0.0.0
 */
export class CreatePdfOperation extends S.Opaque<CreatePdfOperation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("createPdf") }).pipe(
    $I.annoteSchema("CreatePdfOperation", { description: "Converts an image to a PDF document." })
  )
) {}

/**
 * Companion namespace for {@link CreatePdfOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreatePdfOperation {
  /**
   * Encoded (wire) form of {@link CreatePdfOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "createPdf";
  }
}

/**
 * What an image-to-document transformation does.
 *
 * **Example** (Name the image-to-document operation)
 *
 * ```ts import.meta.vitest name="Name the image-to-document operation"
 * import { ImageToDocumentOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = ImageToDocumentOperation.cases.createPdf.make({})
 * operation.type // => "createPdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageToDocumentOperation = ImageToDocumentOperationKind.mapMembers(() =>
  Tuple.make(CreatePdfOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ImageToDocumentOperation", { description: "What an image-to-document transformation does." })
);

/**
 * Runtime type of {@link ImageToDocumentOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageToDocumentOperation = typeof ImageToDocumentOperation.Type;

/**
 * Companion namespace for {@link ImageToDocumentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageToDocumentOperation {
  /**
   * Encoded (wire) form of {@link ImageToDocumentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | CreatePdfOperation.Encoded;
}

const ImageToEmbeddingOperationKind = LiteralKit(["generateEmbedding"]);

/**
 * Computes an embedding vector for an image with a named model.
 *
 * @category models
 * @since 0.0.0
 */
export class GenerateEmbeddingOperation extends S.Opaque<
  GenerateEmbeddingOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("generateEmbedding"),
    modelId: EmbeddingModelId.annotateKey({ description: "Model that computes the embedding." }),
  }).pipe(
    $I.annoteSchema("GenerateEmbeddingOperation", {
      description: "Computes an embedding vector for an image with a named model.",
    })
  )
) {}

/**
 * Companion namespace for {@link GenerateEmbeddingOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GenerateEmbeddingOperation {
  /**
   * Encoded (wire) form of {@link GenerateEmbeddingOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "generateEmbedding";
    readonly modelId: EmbeddingModelId.Encoded;
  }
}

/**
 * What an image-to-embedding transformation does.
 *
 * **Example** (Embed an image)
 *
 * ```ts import.meta.vitest name="Embed an image"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ImageToEmbeddingOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = ImageToEmbeddingOperation.cases.generateEmbedding.make({ modelId: "googleSiglip2" })
 * const wire = await Effect.runPromise(S.encodeEffect(ImageToEmbeddingOperation)(operation))
 * wire // => { type: "generateEmbedding", modelId: "GOOGLE_SIGLIP_2" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageToEmbeddingOperation = ImageToEmbeddingOperationKind.mapMembers(() =>
  Tuple.make(GenerateEmbeddingOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ImageToEmbeddingOperation", { description: "What an image-to-embedding transformation does." })
);

/**
 * Runtime type of {@link ImageToEmbeddingOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageToEmbeddingOperation = typeof ImageToEmbeddingOperation.Type;

/**
 * Companion namespace for {@link ImageToEmbeddingOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageToEmbeddingOperation {
  /**
   * Encoded (wire) form of {@link ImageToEmbeddingOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | GenerateEmbeddingOperation.Encoded;
}

const DicomToImageOperationKind = LiteralKit(["renderImageLayer"]);

/**
 * Renders one layer of a DICOM file as an image.
 *
 * @category models
 * @since 0.0.0
 */
export class RenderImageLayerOperation extends S.Opaque<RenderImageLayerOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("renderImageLayer"),
    layerNumber: absent(S.Finite, "Which layer to render."),
    height: absent(S.Finite, outputHeight),
    width: absent(S.Finite, outputWidth),
  }).pipe(
    $I.annoteSchema("RenderImageLayerOperation", {
      description: "Renders one layer of a DICOM file as an image.",
    })
  )
) {}

/**
 * Companion namespace for {@link RenderImageLayerOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RenderImageLayerOperation {
  /**
   * Encoded (wire) form of {@link RenderImageLayerOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "renderImageLayer";
    readonly layerNumber?: number;
    readonly height?: number;
    readonly width?: number;
  }
}

/**
 * What a DICOM-to-image transformation does.
 *
 * **Example** (Render the second layer of a DICOM file)
 *
 * ```ts import.meta.vitest name="Render the second layer of a DICOM file"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DicomToImageOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = DicomToImageOperation.cases.renderImageLayer.make({ layerNumber: O.some(2) })
 * const wire = await Effect.runPromise(S.encodeEffect(DicomToImageOperation)(operation))
 * wire // => { type: "renderImageLayer", layerNumber: 2 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DicomToImageOperation = DicomToImageOperationKind.mapMembers(() =>
  Tuple.make(RenderImageLayerOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DicomToImageOperation", { description: "What a DICOM-to-image transformation does." })
);

/**
 * Runtime type of {@link DicomToImageOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type DicomToImageOperation = typeof DicomToImageOperation.Type;

/**
 * Companion namespace for {@link DicomToImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DicomToImageOperation {
  /**
   * Encoded (wire) form of {@link DicomToImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | RenderImageLayerOperation.Encoded;
}

// -----------------------------------------------------------------------------
// Document operations
// -----------------------------------------------------------------------------

const DocumentToDocumentOperationKind = LiteralKit(["slicePdfRange", "convertDocument"]);

/**
 * Cuts a span of pages out of a PDF into a new PDF.
 *
 * @category models
 * @since 0.0.0
 */
export class SlicePdfRangeOperation extends S.Opaque<SlicePdfRangeOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("slicePdfRange"),
    startPageInclusive: S.Finite.annotateKey({ description: "First page of the span." }),
    endPageExclusive: S.Finite.annotateKey({ description: "Page just past the end of the span." }),
    strictlyEnforceEndPage: absent(S.Boolean, "Whether the end page is enforced strictly."),
  }).pipe(
    $I.annoteSchema("SlicePdfRangeOperation", { description: "Cuts a span of pages out of a PDF into a new PDF." })
  )
) {}

/**
 * Companion namespace for {@link SlicePdfRangeOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SlicePdfRangeOperation {
  /**
   * Encoded (wire) form of {@link SlicePdfRangeOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "slicePdfRange";
    readonly startPageInclusive: number;
    readonly endPageExclusive: number;
    readonly strictlyEnforceEndPage?: boolean;
  }
}

/**
 * Converts a document of another format to PDF.
 *
 * @category models
 * @since 0.0.0
 */
export class ConvertDocumentOperation extends S.Opaque<ConvertDocumentOperation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("convertDocument") }).pipe(
    $I.annoteSchema("ConvertDocumentOperation", { description: "Converts a document of another format to PDF." })
  )
) {}

/**
 * Companion namespace for {@link ConvertDocumentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConvertDocumentOperation {
  /**
   * Encoded (wire) form of {@link ConvertDocumentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "convertDocument";
  }
}

/**
 * What a document-to-document transformation does.
 *
 * **Example** (Cut the first ten pages out of a PDF)
 *
 * ```ts import.meta.vitest name="Cut the first ten pages out of a PDF"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DocumentToDocumentOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = DocumentToDocumentOperation.cases.slicePdfRange.make({
 *   startPageInclusive: 0,
 *   endPageExclusive: 10,
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(DocumentToDocumentOperation)(operation))
 * wire // => { type: "slicePdfRange", startPageInclusive: 0, endPageExclusive: 10 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentToDocumentOperation = DocumentToDocumentOperationKind.mapMembers(() =>
  Tuple.make(SlicePdfRangeOperation, ConvertDocumentOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DocumentToDocumentOperation", {
    description: "What a document-to-document transformation does.",
  })
);

/**
 * Runtime type of {@link DocumentToDocumentOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentToDocumentOperation = typeof DocumentToDocumentOperation.Type;

/**
 * Companion namespace for {@link DocumentToDocumentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentToDocumentOperation {
  /**
   * Encoded (wire) form of {@link DocumentToDocumentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | SlicePdfRangeOperation.Encoded
    | ConvertDocumentOperation.Encoded;
}

const DocumentToImageOperationKind = LiteralKit(["renderPage", "renderPageToFitBoundingBox"]);

/**
 * Renders one page of a document as an image.
 *
 * @category models
 * @since 0.0.0
 */
export class RenderPageOperation extends S.Opaque<RenderPageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("renderPage"),
    pageNumber: absent(S.Finite, "Which page to render."),
    height: absent(S.Finite, outputHeight),
    width: absent(S.Finite, outputWidth),
  }).pipe(
    $I.annoteSchema("RenderPageOperation", {
      description: "Renders one page of a document as an image.",
    })
  )
) {}

/**
 * Companion namespace for {@link RenderPageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RenderPageOperation {
  /**
   * Encoded (wire) form of {@link RenderPageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "renderPage";
    readonly pageNumber?: number;
    readonly height?: number;
    readonly width?: number;
  }
}

/**
 * Renders one page of a document as the largest image that fits inside a box, keeping its aspect ratio.
 *
 * @category models
 * @since 0.0.0
 */
export class RenderPageToFitBoundingBoxOperation extends S.Opaque<
  RenderPageToFitBoundingBoxOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("renderPageToFitBoundingBox"),
    pageNumber: absent(S.Finite, "Which page to render."),
    width: S.Finite.annotateKey({ description: "Width of the box in pixels." }),
    height: S.Finite.annotateKey({ description: "Height of the box in pixels." }),
  }).pipe(
    $I.annoteSchema("RenderPageToFitBoundingBoxOperation", {
      description: "Renders one page of a document as the largest image that fits inside a box.",
    })
  )
) {}

/**
 * Companion namespace for {@link RenderPageToFitBoundingBoxOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RenderPageToFitBoundingBoxOperation {
  /**
   * Encoded (wire) form of {@link RenderPageToFitBoundingBoxOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "renderPageToFitBoundingBox";
    readonly pageNumber?: number;
    readonly width: number;
    readonly height: number;
  }
}

/**
 * What a document-to-image transformation does.
 *
 * **Example** (Render a page as a thumbnail)
 *
 * ```ts import.meta.vitest name="Render a page as a thumbnail"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DocumentToImageOperation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operation = DocumentToImageOperation.cases.renderPageToFitBoundingBox.make({ width: 256, height: 256 })
 * const wire = await Effect.runPromise(S.encodeEffect(DocumentToImageOperation)(operation))
 * wire // => { type: "renderPageToFitBoundingBox", width: 256, height: 256 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentToImageOperation = DocumentToImageOperationKind.mapMembers(() =>
  Tuple.make(RenderPageOperation, RenderPageToFitBoundingBoxOperation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DocumentToImageOperation", { description: "What a document-to-image transformation does." })
);

/**
 * Runtime type of {@link DocumentToImageOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentToImageOperation = typeof DocumentToImageOperation.Type;

/**
 * Companion namespace for {@link DocumentToImageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentToImageOperation {
  /**
   * Encoded (wire) form of {@link DocumentToImageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | RenderPageOperation.Encoded
    | RenderPageToFitBoundingBoxOperation.Encoded;
}

const DocumentToTextOperationKind = LiteralKit([
  "extractAllText",
  "extractTableOfContents",
  "getPdfPageDimensions",
  "extractFormFields",
  "extractUnstructuredTextFromPage",
  "extractTextFromPagesToArray",
  "ocrOnPage",
  "ocrOnPages",
  "extractLayoutAwareContent",
  "extractLayoutAwareTextV2",
  "extractTextV2",
  "extractVlmText",
]);

/**
 * Extracts all text of a document; for word-processor documents, regular paragraphs only.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractAllTextOperation extends S.Opaque<ExtractAllTextOperation, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("extractAllText") }).pipe(
    $I.annoteSchema("ExtractAllTextOperation", {
      description: "Extracts all text of a document; for word-processor documents, regular paragraphs only.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractAllTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractAllTextOperation {
  /**
   * Encoded (wire) form of {@link ExtractAllTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractAllText";
  }
}

/**
 * Extracts the table of contents a document declares.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractTableOfContentsOperation extends S.Opaque<
  ExtractTableOfContentsOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("extractTableOfContents") }).pipe(
    $I.annoteSchema("ExtractTableOfContentsOperation", {
      description: "Extracts the table of contents a document declares.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractTableOfContentsOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractTableOfContentsOperation {
  /**
   * Encoded (wire) form of {@link ExtractTableOfContentsOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractTableOfContents";
  }
}

/**
 * Lists, as JSON, the width and height of every page of a PDF in points.
 *
 * @category models
 * @since 0.0.0
 */
export class GetPdfPageDimensionsOperation extends S.Opaque<
  GetPdfPageDimensionsOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("getPdfPageDimensions") }).pipe(
    $I.annoteSchema("GetPdfPageDimensionsOperation", {
      description: "Lists, as JSON, the width and height of every page of a PDF in points.",
    })
  )
) {}

/**
 * Companion namespace for {@link GetPdfPageDimensionsOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GetPdfPageDimensionsOperation {
  /**
   * Encoded (wire) form of {@link GetPdfPageDimensionsOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "getPdfPageDimensions";
  }
}

/**
 * Extracts the form field data of a PDF.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFormFieldsOperation extends S.Opaque<
  ExtractFormFieldsOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("extractFormFields") }).pipe(
    $I.annoteSchema("ExtractFormFieldsOperation", {
      description: "Extracts the form field data of a PDF.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractFormFieldsOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractFormFieldsOperation {
  /**
   * Encoded (wire) form of {@link ExtractFormFieldsOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractFormFields";
  }
}

/**
 * Extracts the unstructured text of one page.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractUnstructuredTextFromPageOperation extends S.Opaque<
  ExtractUnstructuredTextFromPageOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractUnstructuredTextFromPage"),
    pageNumber: S.Finite.annotateKey({ description: "Which page to read." }),
  }).pipe(
    $I.annoteSchema("ExtractUnstructuredTextFromPageOperation", {
      description: "Extracts the unstructured text of one page.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractUnstructuredTextFromPageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractUnstructuredTextFromPageOperation {
  /**
   * Encoded (wire) form of {@link ExtractUnstructuredTextFromPageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractUnstructuredTextFromPage";
    readonly pageNumber: number;
  }
}

/**
 * Extracts the text of a span of pages as a list of strings.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractTextFromPagesToArrayOperation extends S.Opaque<
  ExtractTextFromPagesToArrayOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractTextFromPagesToArray"),
    startPage: absent(S.Finite, "First page to read."),
    endPage: absent(S.Finite, "Last page to read."),
  }).pipe(
    $I.annoteSchema("ExtractTextFromPagesToArrayOperation", {
      description: "Extracts the text of a span of pages as a list of strings.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractTextFromPagesToArrayOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractTextFromPagesToArrayOperation {
  /**
   * Encoded (wire) form of {@link ExtractTextFromPagesToArrayOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractTextFromPagesToArray";
    readonly startPage?: number;
    readonly endPage?: number;
  }
}

/**
 * Recognises the text on one page of a document.
 *
 * @category models
 * @since 0.0.0
 */
export class OcrOnPageOperation extends S.Opaque<OcrOnPageOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("ocrOnPage"),
    pageNumber: S.Finite.annotateKey({ description: "Which page to read." }),
    parameters: OcrParameters,
  }).pipe($I.annoteSchema("OcrOnPageOperation", { description: "Recognises the text on one page of a document." }))
) {}

/**
 * Companion namespace for {@link OcrOnPageOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrOnPageOperation {
  /**
   * Encoded (wire) form of {@link OcrOnPageOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "ocrOnPage";
    readonly pageNumber: number;
    readonly parameters: OcrParameters.Encoded;
  }
}

/**
 * Creates access patterns for recognising text across the pages of a document.
 *
 * **Details**
 *
 * The request carries the same fields as {@link OcrOnPageOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export class OcrOnPagesOperation extends S.Opaque<OcrOnPagesOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("ocrOnPages"),
    parameters: OcrParameters,
    pageNumber: S.Finite.annotateKey({ description: "Which page to read." }),
  }).pipe(
    $I.annoteSchema("OcrOnPagesOperation", {
      description: "Creates access patterns for recognising text across the pages of a document.",
    })
  )
) {}

/**
 * Companion namespace for {@link OcrOnPagesOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OcrOnPagesOperation {
  /**
   * Encoded (wire) form of {@link OcrOnPagesOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "ocrOnPages";
    readonly parameters: OcrParameters.Encoded;
    readonly pageNumber: number;
  }
}

/**
 * Extracts the text of a document together with its layout, in the older result format.
 *
 * **Details**
 *
 * The platform has deprecated this operation in favour of
 * {@link ExtractDocumentLayoutAwareTextOperation}, whose result has a
 * different structure.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentExtractLayoutAwareContentOperation extends S.Opaque<
  DocumentExtractLayoutAwareContentOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractLayoutAwareContent"),
    parameters: LayoutAwareExtractionParameters,
  }).pipe(
    $I.annoteSchema("DocumentExtractLayoutAwareContentOperation", {
      description: "Extracts the text of a document together with its layout, in the older result format.",
    })
  )
) {}

/**
 * Companion namespace for {@link DocumentExtractLayoutAwareContentOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentExtractLayoutAwareContentOperation {
  /**
   * Encoded (wire) form of {@link DocumentExtractLayoutAwareContentOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractLayoutAwareContent";
    readonly parameters: LayoutAwareExtractionParameters.Encoded;
  }
}

/**
 * Extracts the text of PDF pages as structured JSON blocks with their positions.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractDocumentLayoutAwareTextOperation extends S.Opaque<
  ExtractDocumentLayoutAwareTextOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractLayoutAwareTextV2"),
    pageRange: absent(PageRange, "Pages to read."),
    config: DocumentTextExtractionConfig,
  }).pipe(
    $I.annoteSchema("ExtractDocumentLayoutAwareTextOperation", {
      description: "Extracts the text of PDF pages as structured JSON blocks with their positions.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractDocumentLayoutAwareTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractDocumentLayoutAwareTextOperation {
  /**
   * Encoded (wire) form of {@link ExtractDocumentLayoutAwareTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractLayoutAwareTextV2";
    readonly pageRange?: PageRange.Encoded;
    readonly config: DocumentTextExtractionConfig.Encoded;
  }
}

/**
 * Extracts the text of PDF pages, page by page, as plain text, Markdown or HTML.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractDocumentTextOperation extends S.Opaque<
  ExtractDocumentTextOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("extractTextV2"),
    pageRange: absent(PageRange, "Pages to read."),
    config: DocumentTextExtractionConfig,
  }).pipe(
    $I.annoteSchema("ExtractDocumentTextOperation", {
      description: "Extracts the text of PDF pages, page by page, as plain text, Markdown or HTML.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractDocumentTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractDocumentTextOperation {
  /**
   * Encoded (wire) form of {@link ExtractDocumentTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractTextV2";
    readonly pageRange?: PageRange.Encoded;
    readonly config: DocumentTextExtractionConfig.Encoded;
  }
}

/**
 * Has a vision language model read the pages of a document and write out their text.
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractVlmTextOperation extends S.Opaque<ExtractVlmTextOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("extractVlmText"),
    llmSpec: LlmSpec.annotateKey({ description: "Model to call and the prompts it receives." }),
    preprocessingConfiguration: absent(
      VlmPreprocessingConfig,
      "What is extracted from a page before the model reads it."
    ),
    imageSpec: absent(ImageSpec, "How each page is rendered to an image for the model."),
    outputFormat: VlmOutputFormat.annotateKey({ description: "Markup the model returns the text in." }),
    pageRange: absent(PageRange, "Pages to read."),
  }).pipe(
    $I.annoteSchema("ExtractVlmTextOperation", {
      description: "Has a vision language model read the pages of a document and write out their text.",
    })
  )
) {}

/**
 * Companion namespace for {@link ExtractVlmTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExtractVlmTextOperation {
  /**
   * Encoded (wire) form of {@link ExtractVlmTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extractVlmText";
    readonly llmSpec: LlmSpec.Encoded;
    readonly preprocessingConfiguration?: VlmPreprocessingConfig.Encoded;
    readonly imageSpec?: ImageSpec.Encoded;
    readonly outputFormat: VlmOutputFormat.Encoded;
    readonly pageRange?: PageRange.Encoded;
  }
}

/**
 * What a document-to-text transformation does.
 *
 * **Example** (Sort document operations by how they read a page)
 *
 * ```ts import.meta.vitest name="Sort document operations by how they read a page"
 * import * as A from "effect/Array"
 * import { DocumentToTextOperation, OcrParameters } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const operations = [
 *   DocumentToTextOperation.cases.extractAllText.make({}),
 *   DocumentToTextOperation.cases.ocrOnPage.make({
 *     pageNumber: 3,
 *     parameters: OcrParameters.make({ outputFormat: "text", languages: [] }),
 *   }),
 * ]
 * const recognisesText = DocumentToTextOperation.isAnyOf(["ocrOnPage", "ocrOnPages", "extractVlmText"])
 * const verdicts = A.map(operations, recognisesText)
 * verdicts // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentToTextOperation = DocumentToTextOperationKind.mapMembers(() =>
  Tuple.make(
    ExtractAllTextOperation,
    ExtractTableOfContentsOperation,
    GetPdfPageDimensionsOperation,
    ExtractFormFieldsOperation,
    ExtractUnstructuredTextFromPageOperation,
    ExtractTextFromPagesToArrayOperation,
    OcrOnPageOperation,
    OcrOnPagesOperation,
    DocumentExtractLayoutAwareContentOperation,
    ExtractDocumentLayoutAwareTextOperation,
    ExtractDocumentTextOperation,
    ExtractVlmTextOperation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DocumentToTextOperation", { description: "What a document-to-text transformation does." })
);

/**
 * Runtime type of {@link DocumentToTextOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentToTextOperation = typeof DocumentToTextOperation.Type;

/**
 * Companion namespace for {@link DocumentToTextOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentToTextOperation {
  /**
   * Encoded (wire) form of {@link DocumentToTextOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ExtractAllTextOperation.Encoded
    | ExtractTableOfContentsOperation.Encoded
    | GetPdfPageDimensionsOperation.Encoded
    | ExtractFormFieldsOperation.Encoded
    | ExtractUnstructuredTextFromPageOperation.Encoded
    | ExtractTextFromPagesToArrayOperation.Encoded
    | OcrOnPageOperation.Encoded
    | OcrOnPagesOperation.Encoded
    | DocumentExtractLayoutAwareContentOperation.Encoded
    | ExtractDocumentLayoutAwareTextOperation.Encoded
    | ExtractDocumentTextOperation.Encoded
    | ExtractVlmTextOperation.Encoded;
}

// -----------------------------------------------------------------------------
// Transformations
// -----------------------------------------------------------------------------

/**
 * Derives an image from an image by applying a list of steps in order.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageTransformation extends S.Opaque<ImageTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("image"),
    encoding: ImageryEncoding.annotateKey({ description: "Image format to write." }),
    operations: S.Array(ImageOperation).annotateKey({ description: "Steps to apply, in order." }),
  }).pipe(
    $I.annoteSchema("ImageTransformation", {
      description: "Derives an image from an image by applying a list of steps in order.",
    })
  )
) {}

/**
 * Companion namespace for {@link ImageTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageTransformation {
  /**
   * Encoded (wire) form of {@link ImageTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "image";
    readonly encoding: ImageryEncoding.Encoded;
    readonly operations: ReadonlyArray<ImageOperation.Encoded>;
  }
}

/**
 * Derives a video from a video.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoTransformation extends S.Opaque<VideoTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("video"),
    encoding: VideoEncoding.annotateKey({ description: "Container format to write." }),
    operation: VideoOperation.annotateKey({ description: "What to do to the video." }),
  }).pipe($I.annoteSchema("VideoTransformation", { description: "Derives a video from a video." }))
) {}

/**
 * Companion namespace for {@link VideoTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoTransformation {
  /**
   * Encoded (wire) form of {@link VideoTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "video";
    readonly encoding: VideoEncoding.Encoded;
    readonly operation: VideoOperation.Encoded;
  }
}

/**
 * Derives audio from audio; the operation names the format to write.
 *
 * @category models
 * @since 0.0.0
 */
export class AudioTransformation extends S.Opaque<AudioTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("audio"),
    operation: AudioOperation.annotateKey({ description: "What to do to the audio." }),
  }).pipe(
    $I.annoteSchema("AudioTransformation", {
      description: "Derives audio from audio; the operation names the format to write.",
    })
  )
) {}

/**
 * Companion namespace for {@link AudioTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioTransformation {
  /**
   * Encoded (wire) form of {@link AudioTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "audio";
    readonly operation: AudioOperation.Encoded;
  }
}

/**
 * Derives text from an email.
 *
 * @category models
 * @since 0.0.0
 */
export class EmailToTextTransformation extends S.Opaque<EmailToTextTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("emailToText"),
    operation: EmailToTextOperation.annotateKey({ description: "What to read from the email." }),
  }).pipe($I.annoteSchema("EmailToTextTransformation", { description: "Derives text from an email." }))
) {}

/**
 * Companion namespace for {@link EmailToTextTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EmailToTextTransformation {
  /**
   * Encoded (wire) form of {@link EmailToTextTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "emailToText";
    readonly operation: EmailToTextOperation.Encoded;
  }
}

/**
 * Derives text from a spreadsheet.
 *
 * @category models
 * @since 0.0.0
 */
export class SpreadsheetToTextTransformation extends S.Opaque<
  SpreadsheetToTextTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("spreadsheetToText"),
    operation: SpreadsheetToTextOperation.annotateKey({ description: "What to read from the spreadsheet." }),
  }).pipe($I.annoteSchema("SpreadsheetToTextTransformation", { description: "Derives text from a spreadsheet." }))
) {}

/**
 * Companion namespace for {@link SpreadsheetToTextTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SpreadsheetToTextTransformation {
  /**
   * Encoded (wire) form of {@link SpreadsheetToTextTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "spreadsheetToText";
    readonly operation: SpreadsheetToTextOperation.Encoded;
  }
}

/**
 * Derives audio from a video.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoToAudioTransformation extends S.Opaque<
  VideoToAudioTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("videoToAudio"),
    encoding: AudioEncoding.annotateKey({ description: "Audio format to write." }),
    operation: VideoToAudioOperation.annotateKey({ description: "What to take from the video." }),
  }).pipe($I.annoteSchema("VideoToAudioTransformation", { description: "Derives audio from a video." }))
) {}

/**
 * Companion namespace for {@link VideoToAudioTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToAudioTransformation {
  /**
   * Encoded (wire) form of {@link VideoToAudioTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "videoToAudio";
    readonly encoding: AudioEncoding.Encoded;
    readonly operation: VideoToAudioOperation.Encoded;
  }
}

/**
 * Derives text from audio.
 *
 * @category models
 * @since 0.0.0
 */
export class AudioToTextTransformation extends S.Opaque<AudioToTextTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("audioToText"),
    operation: AudioToTextOperation.annotateKey({ description: "What to read from the audio." }),
  }).pipe($I.annoteSchema("AudioToTextTransformation", { description: "Derives text from audio." }))
) {}

/**
 * Companion namespace for {@link AudioToTextTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudioToTextTransformation {
  /**
   * Encoded (wire) form of {@link AudioToTextTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "audioToText";
    readonly operation: AudioToTextOperation.Encoded;
  }
}

/**
 * Takes an attached file out of an email.
 *
 * @category models
 * @since 0.0.0
 */
export class EmailToAttachmentTransformation extends S.Opaque<
  EmailToAttachmentTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("emailToAttachment"),
    operation: EmailToAttachmentOperation.annotateKey({ description: "Which attachment to take." }),
  }).pipe(
    $I.annoteSchema("EmailToAttachmentTransformation", { description: "Takes an attached file out of an email." })
  )
) {}

/**
 * Companion namespace for {@link EmailToAttachmentTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EmailToAttachmentTransformation {
  /**
   * Encoded (wire) form of {@link EmailToAttachmentTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "emailToAttachment";
    readonly operation: EmailToAttachmentOperation.Encoded;
  }
}

/**
 * Derives an archive of files from a video.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoToArchiveTransformation extends S.Opaque<
  VideoToArchiveTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("videoToArchive"),
    encoding: ArchiveEncoding.annotateKey({ description: "Archive format to write." }),
    operation: VideoToArchiveOperation.annotateKey({ description: "What to collect from the video." }),
  }).pipe(
    $I.annoteSchema("VideoToArchiveTransformation", { description: "Derives an archive of files from a video." })
  )
) {}

/**
 * Companion namespace for {@link VideoToArchiveTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToArchiveTransformation {
  /**
   * Encoded (wire) form of {@link VideoToArchiveTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "videoToArchive";
    readonly encoding: ArchiveEncoding.Encoded;
    readonly operation: VideoToArchiveOperation.Encoded;
  }
}

/**
 * Derives text from a video.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoToTextTransformation extends S.Opaque<VideoToTextTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("videoToText"),
    operation: VideoToTextOperation.annotateKey({ description: "What to read from the video." }),
  }).pipe($I.annoteSchema("VideoToTextTransformation", { description: "Derives text from a video." }))
) {}

/**
 * Companion namespace for {@link VideoToTextTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToTextTransformation {
  /**
   * Encoded (wire) form of {@link VideoToTextTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "videoToText";
    readonly operation: VideoToTextOperation.Encoded;
  }
}

/**
 * Derives text from an image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageToTextTransformation extends S.Opaque<ImageToTextTransformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("imageToText"),
    operation: ImageToTextOperation.annotateKey({ description: "How to read the image." }),
  }).pipe($I.annoteSchema("ImageToTextTransformation", { description: "Derives text from an image." }))
) {}

/**
 * Companion namespace for {@link ImageToTextTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageToTextTransformation {
  /**
   * Encoded (wire) form of {@link ImageToTextTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "imageToText";
    readonly operation: ImageToTextOperation.Encoded;
  }
}

/**
 * Derives an image from a video.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoToImageTransformation extends S.Opaque<
  VideoToImageTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("videoToImage"),
    encoding: ImageryEncoding.annotateKey({ description: "Image format to write." }),
    operation: VideoToImageOperation.annotateKey({ description: "Which frame to take." }),
  }).pipe($I.annoteSchema("VideoToImageTransformation", { description: "Derives an image from a video." }))
) {}

/**
 * Companion namespace for {@link VideoToImageTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VideoToImageTransformation {
  /**
   * Encoded (wire) form of {@link VideoToImageTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "videoToImage";
    readonly encoding: ImageryEncoding.Encoded;
    readonly operation: VideoToImageOperation.Encoded;
  }
}

/**
 * Derives a document from an image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageToDocumentTransformation extends S.Opaque<
  ImageToDocumentTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("imageToDocument"),
    operation: ImageToDocumentOperation.annotateKey({ description: "How to build the document." }),
  }).pipe($I.annoteSchema("ImageToDocumentTransformation", { description: "Derives a document from an image." }))
) {}

/**
 * Companion namespace for {@link ImageToDocumentTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageToDocumentTransformation {
  /**
   * Encoded (wire) form of {@link ImageToDocumentTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "imageToDocument";
    readonly operation: ImageToDocumentOperation.Encoded;
  }
}

/**
 * Derives an image from a DICOM file.
 *
 * @category models
 * @since 0.0.0
 */
export class DicomToImageTransformation extends S.Opaque<
  DicomToImageTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("dicomToImage"),
    encoding: ImageryEncoding.annotateKey({ description: "Image format to write." }),
    operation: DicomToImageOperation.annotateKey({ description: "What to render." }),
  }).pipe($I.annoteSchema("DicomToImageTransformation", { description: "Derives an image from a DICOM file." }))
) {}

/**
 * Companion namespace for {@link DicomToImageTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DicomToImageTransformation {
  /**
   * Encoded (wire) form of {@link DicomToImageTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "dicomToImage";
    readonly encoding: ImageryEncoding.Encoded;
    readonly operation: DicomToImageOperation.Encoded;
  }
}

/**
 * Derives a document from a document.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentToDocumentTransformation extends S.Opaque<
  DocumentToDocumentTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("documentToDocument"),
    encoding: DocumentEncoding.annotateKey({ description: "Document format to write." }),
    operation: DocumentToDocumentOperation.annotateKey({ description: "What to do to the document." }),
  }).pipe(
    $I.annoteSchema("DocumentToDocumentTransformation", { description: "Derives a document from a document." })
  )
) {}

/**
 * Companion namespace for {@link DocumentToDocumentTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentToDocumentTransformation {
  /**
   * Encoded (wire) form of {@link DocumentToDocumentTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "documentToDocument";
    readonly encoding: DocumentEncoding.Encoded;
    readonly operation: DocumentToDocumentOperation.Encoded;
  }
}

/**
 * Derives an image from a document.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentToImageTransformation extends S.Opaque<
  DocumentToImageTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("documentToImage"),
    encoding: ImageryEncoding.annotateKey({ description: "Image format to write." }),
    operation: DocumentToImageOperation.annotateKey({ description: "Which page to render, and how large." }),
  }).pipe($I.annoteSchema("DocumentToImageTransformation", { description: "Derives an image from a document." }))
) {}

/**
 * Companion namespace for {@link DocumentToImageTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentToImageTransformation {
  /**
   * Encoded (wire) form of {@link DocumentToImageTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "documentToImage";
    readonly encoding: ImageryEncoding.Encoded;
    readonly operation: DocumentToImageOperation.Encoded;
  }
}

/**
 * Derives an embedding vector from an image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageToEmbeddingTransformation extends S.Opaque<
  ImageToEmbeddingTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("imageToEmbedding"),
    operation: ImageToEmbeddingOperation.annotateKey({ description: "Which model computes the embedding." }),
  }).pipe(
    $I.annoteSchema("ImageToEmbeddingTransformation", { description: "Derives an embedding vector from an image." })
  )
) {}

/**
 * Companion namespace for {@link ImageToEmbeddingTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImageToEmbeddingTransformation {
  /**
   * Encoded (wire) form of {@link ImageToEmbeddingTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "imageToEmbedding";
    readonly operation: ImageToEmbeddingOperation.Encoded;
  }
}

/**
 * Derives text from a document.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentToTextTransformation extends S.Opaque<
  DocumentToTextTransformation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("documentToText"),
    operation: DocumentToTextOperation.annotateKey({ description: "How to read the document." }),
  }).pipe($I.annoteSchema("DocumentToTextTransformation", { description: "Derives text from a document." }))
) {}

/**
 * Companion namespace for {@link DocumentToTextTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentToTextTransformation {
  /**
   * Encoded (wire) form of {@link DocumentToTextTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "documentToText";
    readonly operation: DocumentToTextOperation.Encoded;
  }
}

/**
 * A request to derive new content from a stored media item: 18 conversions between kinds of media.
 *
 * **Details**
 *
 * A bare source kind (`image`, `video`, `audio`) stays within that kind;
 * `<source>To<target>` crosses kinds. Eight conversions write media and carry
 * an output `encoding`; the ten that write text, an embedding or an attachment
 * do not. An `image` transformation alone takes a list of `operations`,
 * applied in order; every other takes one `operation`.
 *
 * OSDK's records with exactly one `$`-prefixed key (`{ $image: { $encoding:
 * "png" } }`) are a client spelling of this union and are not modelled.
 *
 * **Example** (Decode a transformation and say what it produces)
 *
 * ```ts import.meta.vitest name="Decode a transformation and say what it produces"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MediaTransformation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const transformation = await Effect.runPromise(
 *   S.decodeUnknownEffect(MediaTransformation)({
 *     type: "image",
 *     encoding: { type: "png" },
 *     operations: [{ type: "resize", width: 800 }, { type: "grayscale" }],
 *   })
 * )
 * const summary = MediaTransformation.matchOrElse(
 *   transformation,
 *   { image: ({ encoding, operations }) => `${encoding} after ${A.length(operations)} steps` },
 *   (other) => other.type
 * )
 * const writesMedia = MediaTransformation.isAnyOf(["image", "video", "videoToAudio", "videoToArchive"])
 * const facts = [summary, writesMedia(transformation), MediaTransformation.guards.documentToText(transformation)]
 * facts // => ["png after 2 steps", true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaTransformation = MediaTransformationKind.mapMembers(() =>
  Tuple.make(
    ImageTransformation,
    VideoTransformation,
    AudioTransformation,
    EmailToTextTransformation,
    SpreadsheetToTextTransformation,
    VideoToAudioTransformation,
    AudioToTextTransformation,
    EmailToAttachmentTransformation,
    VideoToArchiveTransformation,
    VideoToTextTransformation,
    ImageToTextTransformation,
    VideoToImageTransformation,
    ImageToDocumentTransformation,
    DicomToImageTransformation,
    DocumentToDocumentTransformation,
    DocumentToImageTransformation,
    ImageToEmbeddingTransformation,
    DocumentToTextTransformation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("MediaTransformation", {
    description: "A request to derive new content from a stored media item.",
  })
);

/**
 * Runtime type of {@link MediaTransformation}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaTransformation = typeof MediaTransformation.Type;

/**
 * Companion namespace for {@link MediaTransformation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MediaTransformation {
  /**
   * Encoded (wire) form of {@link MediaTransformation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ImageTransformation.Encoded
    | VideoTransformation.Encoded
    | AudioTransformation.Encoded
    | EmailToTextTransformation.Encoded
    | SpreadsheetToTextTransformation.Encoded
    | VideoToAudioTransformation.Encoded
    | AudioToTextTransformation.Encoded
    | EmailToAttachmentTransformation.Encoded
    | VideoToArchiveTransformation.Encoded
    | VideoToTextTransformation.Encoded
    | ImageToTextTransformation.Encoded
    | VideoToImageTransformation.Encoded
    | ImageToDocumentTransformation.Encoded
    | DicomToImageTransformation.Encoded
    | DocumentToDocumentTransformation.Encoded
    | DocumentToImageTransformation.Encoded
    | ImageToEmbeddingTransformation.Encoded
    | DocumentToTextTransformation.Encoded;
}

// -----------------------------------------------------------------------------
// Transformation jobs
// -----------------------------------------------------------------------------

/**
 * The body of a request to transform a media item; the item itself is named by the request path.
 *
 * **Example** (Wrap a transformation in a request body)
 *
 * ```ts import.meta.vitest name="Wrap a transformation in a request body"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import {
 *   ImageToDocumentOperation,
 *   MediaTransformation,
 *   TransformMediaItemRequest,
 * } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const request = TransformMediaItemRequest.make({
 *   transformation: MediaTransformation.cases.imageToDocument.make({
 *     operation: ImageToDocumentOperation.cases.createPdf.make({}),
 *   }),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(TransformMediaItemRequest)(request))
 * wire // => { transformation: { type: "imageToDocument", operation: { type: "createPdf" } } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TransformMediaItemRequest extends S.Opaque<TransformMediaItemRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    transformation: MediaTransformation.annotateKey({ description: "What to derive from the media item." }),
  }).pipe(
    $I.annoteSchema("TransformMediaItemRequest", {
      description: "The body of a request to transform a media item.",
    })
  )
) {}

/**
 * Companion namespace for {@link TransformMediaItemRequest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TransformMediaItemRequest {
  /**
   * Encoded (wire) form of {@link TransformMediaItemRequest}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly transformation: MediaTransformation.Encoded;
  }
}

/**
 * A transformation job as the platform reports it: its identifier and where it stands.
 *
 * **Details**
 *
 * The platform answers with this record twice: when it accepts a
 * transformation request, and each time the job's status is asked for. The
 * wire gives the two answers different names; their fields are the same, so
 * they are one type here. A `successful` job has a result to fetch; the record
 * does not carry it.
 *
 * **Example** (Decode the status of a transformation job)
 *
 * ```ts import.meta.vitest name="Decode the status of a transformation job"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TransformationJob } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const job = await Effect.runPromise(
 *   S.decodeUnknownEffect(TransformationJob)({ status: "PENDING", jobId: "job-7f3a" })
 * )
 * const facts = [job.status, job.jobId]
 * facts // => ["pending", "job-7f3a"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TransformationJob extends S.Opaque<TransformationJob, { readonly brand: unique symbol }>()(
  S.Struct({
    status: TransformationJobStatus.annotateKey({ description: "Where the job stands." }),
    jobId: TransformationJobId.annotateKey({ description: "Identifier to ask for the job's status and result with." }),
  }).pipe(
    $I.annoteSchema("TransformationJob", {
      description: "A transformation job as the platform reports it: its identifier and where it stands.",
    })
  )
) {}

/**
 * Companion namespace for {@link TransformationJob}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TransformationJob {
  /**
   * Encoded (wire) form of {@link TransformationJob}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly status: TransformationJobStatus.Encoded;
    readonly jobId: TransformationJobId.Encoded;
  }
}

/**
 * How long a client waits between two status requests for a transformation job unless told otherwise.
 *
 * **Example** (Count the status requests that fit in the default wait)
 *
 * ```ts import.meta.vitest name="Count the status requests that fit in the default wait"
 * import * as Duration from "effect/Duration"
 * import { DefaultPollInterval, DefaultPollTimeout } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const requests = Duration.toMillis(DefaultPollTimeout) / Duration.toMillis(DefaultPollInterval)
 * requests // => 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DefaultPollInterval: Duration.Duration = Duration.seconds(3);

/**
 * The shortest wait between two status requests a client honours; a shorter requested interval is raised to it.
 *
 * **Example** (Read the shortest poll interval)
 *
 * ```ts import.meta.vitest name="Read the shortest poll interval"
 * import * as Duration from "effect/Duration"
 * import { MinimumPollInterval } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * Duration.toMillis(MinimumPollInterval) // => 100
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MinimumPollInterval: Duration.Duration = Duration.millis(100);

/**
 * How long a client waits for a transformation job to end before giving up unless told otherwise.
 *
 * **Example** (Read the default poll timeout)
 *
 * ```ts import.meta.vitest name="Read the default poll timeout"
 * import * as Duration from "effect/Duration"
 * import { DefaultPollTimeout } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * Duration.toSeconds(DefaultPollTimeout) // => 30
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DefaultPollTimeout: Duration.Duration = Duration.seconds(30);

/**
 * The shortest total wait for a transformation job a client honours; a shorter requested timeout is raised to it.
 *
 * **Example** (Read the shortest poll timeout)
 *
 * ```ts import.meta.vitest name="Read the shortest poll timeout"
 * import * as Duration from "effect/Duration"
 * import { MinimumPollTimeout } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * Duration.toSeconds(MinimumPollTimeout) // => 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MinimumPollTimeout: Duration.Duration = Duration.seconds(1);
