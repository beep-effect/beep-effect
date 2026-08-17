/**
 * Defensive extraction bounds that fail closed at decode time.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Maximum source-text length accepted by a LangExtract request.
 *
 * **Details**
 *
 * Fuzzy alignment is `O(sourceWords * candidateChars * candidateCount)`, so
 * each axis is bounded before any untrusted document or model output reaches
 * parsing or the synchronous alignment path.
 *
 * **Example** (Log the request text bound)
 *
 * ```ts
 * import { MAX_REQUEST_TEXT_LENGTH } from "@beep/langextract/Extraction"
 *
 * console.log(MAX_REQUEST_TEXT_LENGTH) // 1000000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_REQUEST_TEXT_LENGTH = 1_000_000;

/**
 * Maximum label and text length accepted on one extraction candidate.
 *
 * **Example** (Log the candidate text bound)
 *
 * ```ts
 * import { MAX_CANDIDATE_TEXT_LENGTH } from "@beep/langextract/Extraction"
 *
 * console.log(MAX_CANDIDATE_TEXT_LENGTH) // 4096
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_CANDIDATE_TEXT_LENGTH = 4_096;

/**
 * Maximum attribute entries accepted on one extraction candidate.
 *
 * **Example** (Log the candidate attribute bound)
 *
 * ```ts
 * import { MAX_CANDIDATE_ATTRIBUTES } from "@beep/langextract/Extraction"
 *
 * console.log(MAX_CANDIDATE_ATTRIBUTES) // 64
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_CANDIDATE_ATTRIBUTES = 64;

/**
 * Maximum few-shot examples accepted on one LangExtract request.
 *
 * **Example** (Log the request example bound)
 *
 * ```ts
 * import { MAX_REQUEST_EXAMPLES } from "@beep/langextract/Extraction"
 *
 * console.log(MAX_REQUEST_EXAMPLES) // 64
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_REQUEST_EXAMPLES = 64;

/**
 * Maximum extraction candidates accepted at any LangExtract boundary.
 *
 * **Example** (Log candidate limit constant)
 *
 * ```ts
 * import { MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction"
 *
 * console.log(MAX_EXTRACTION_CANDIDATES) // 1024
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_EXTRACTION_CANDIDATES = 1_024;
