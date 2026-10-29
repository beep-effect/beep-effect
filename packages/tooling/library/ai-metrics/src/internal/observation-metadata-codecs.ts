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
 * **Example** (Inspect the native encoder)
 * ```ts
 * import { encodeNativeTraceMetadataJson } from "@beep/repo-ai-metrics/internal/observation-metadata-codecs"
 * console.log(typeof encodeNativeTraceMetadataJson)
 * ```
 * **Details** Preserves the model's existing JSON representation. Callers retain
 * responsibility for hashing, ownership validation and safe error mapping.
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
 * **Example** (Inspect the stored-page decoder)
 * ```ts
 * import { decodeTranscriptPageJson } from "@beep/repo-ai-metrics/internal/observation-metadata-codecs"
 * console.log(typeof decodeTranscriptPageJson)
 * ```
 * **Details** Rejects excess properties. This validates the representation only;
 * the caller must still verify ownership, checksums and event membership.
 * @category decoding
 * @since 0.0.0
 */
export const decodeTranscriptPageJson = Effect.fnUntraced(function* (...args: Parameters<typeof decodePage>) {
  return yield* decodePage(...args);
});

/**
 * Encode transcript occurrence metadata consistently for identity verification.
 * **Example** (Inspect the occurrence encoder)
 * ```ts
 * import { encodeTranscriptFrameJson } from "@beep/repo-ai-metrics/internal/observation-metadata-codecs"
 * console.log(typeof encodeTranscriptFrameJson)
 * ```
 * **Details** Delivery and reclamation hash this same model representation.
 * This encoder neither reads source transcripts nor establishes delivery.
 * @category encoding
 * @since 0.0.0
 */
export const encodeTranscriptFrameJson = Effect.fnUntraced(function* (...args: Parameters<typeof encodeFrame>) {
  return yield* encodeFrame(...args);
});
