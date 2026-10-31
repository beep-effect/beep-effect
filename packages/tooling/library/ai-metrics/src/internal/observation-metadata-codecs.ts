/**
 * Shared metadata serialization for delivery identities and reclamation checks.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { NativeTraceMetadata } from "../native-trace.ts";
import { TranscriptFrame, TranscriptPage } from "../transcript-page.ts";

const encodeNativeMetadata = S.encodeEffect(S.fromJsonString(NativeTraceMetadata));
const decodePage = S.decodeEffect(S.fromJsonString(TranscriptPage), { onExcessProperty: "error" });
const encodeFrame = S.encodeEffect(S.fromJsonString(TranscriptFrame));

/**
 * Encode the native metadata used by delivery and reclamation identity hashes.
 *
 * **Details**
 *
 * Preserves the model's existing JSON representation. Callers retain
 * responsibility for hashing, ownership validation and safe error mapping.
 *
 * **Example** (Inspect the native-metadata JSON encoder)
 *
 * ```ts
 * import { encodeNativeTraceMetadataJson } from "@beep/repo-ai-metrics/internal/observation-metadata-codecs"
 * console.log(typeof encodeNativeTraceMetadataJson)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeNativeTraceMetadataJson = Effect.fnUntraced(function* (
  ...args: Parameters<typeof encodeNativeMetadata>
) {
  return yield* encodeNativeMetadata(...args);
});

/**
 * Decode stored transcript metadata with the shared strict page boundary.
 *
 * **Details**
 *
 * Rejects excess properties. This validates the representation only;
 * the caller must still verify ownership, checksums and event membership.
 *
 * **Example** (Inspect the transcript-page JSON decoder)
 *
 * ```ts
 * import { decodeTranscriptPageJson } from "@beep/repo-ai-metrics/internal/observation-metadata-codecs"
 * console.log(typeof decodeTranscriptPageJson)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeTranscriptPageJson = Effect.fnUntraced(function* (...args: Parameters<typeof decodePage>) {
  return yield* decodePage(...args);
});

/**
 * Encode transcript occurrence metadata consistently for identity verification.
 *
 * **Details**
 *
 * Delivery and reclamation hash this same model representation.
 * This encoder neither reads source transcripts nor establishes delivery.
 *
 * **Example** (Inspect the transcript-frame JSON encoder)
 *
 * ```ts
 * import { encodeTranscriptFrameJson } from "@beep/repo-ai-metrics/internal/observation-metadata-codecs"
 * console.log(typeof encodeTranscriptFrameJson)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeTranscriptFrameJson = Effect.fnUntraced(function* (...args: Parameters<typeof encodeFrame>) {
  return yield* encodeFrame(...args);
});
