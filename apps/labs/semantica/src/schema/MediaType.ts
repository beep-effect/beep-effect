import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $SemanticaId.create("schema/MediaType");

/**
 * Source media types supported by the C0 parser contract.
 *
 * **Example** (Check a PDF media type)
 *
 * ```ts
 * import { MediaType } from "@/schema/MediaType"
 *
 * console.log(MediaType.is["application/pdf"]("application/pdf")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MediaType = LiteralKit(["text/markdown", "text/html", "application/pdf"]).pipe(
  $I.annoteSchema("MediaType", {
    description: "Markdown, HTML, and born-digital PDF media types accepted by the C0 parser.",
  })
);

/**
 * Decoded literal accepted by {@link MediaType}.
 *
 * **Example** (Annotate a media type)
 *
 * ```ts
 * import type { MediaType } from "@/schema/MediaType"
 *
 * const mediaType: MediaType = "application/pdf"
 * console.log(mediaType) // "application/pdf"
 * ```
 *
 * @see {@link MediaType} for literal helpers and validation.
 * @category type-level
 * @since 0.0.0
 */
export type MediaType = typeof MediaType.Type;
