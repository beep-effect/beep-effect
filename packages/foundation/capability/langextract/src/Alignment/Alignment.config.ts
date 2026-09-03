/**
 * Alignment defaults and defensive CPU-budget bounds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema/Int";

/**
 * Default similarity threshold applied when an alignment source resolves no
 * explicit fuzzy threshold.
 *
 * **Example** (Log the default threshold)
 *
 * ```ts import.meta.vitest name="Log the default threshold"
 * import { DEFAULT_FUZZY_THRESHOLD } from "@beep/langextract/Alignment"
 *
 * DEFAULT_FUZZY_THRESHOLD // => 0.82
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_FUZZY_THRESHOLD = UnitInterval.make(0.82);

/**
 * Maximum source-text length accepted by the fuzzy alignment path.
 *
 * **Details**
 *
 * Fuzzy matching slides a query-sized word window across the source and runs
 * an `O(n*m)` Levenshtein comparison per window, so even schema-bounded inputs
 * are kept within a predictable CPU budget. When the source exceeds this limit
 * the fuzzy fallback is skipped and the candidate fails closed to `unaligned`
 * rather than blocking the runtime.
 *
 * **Example** (Log the fuzzy source bound)
 *
 * ```ts import.meta.vitest name="Log the fuzzy source bound"
 * import { MAX_FUZZY_SOURCE_LENGTH } from "@beep/langextract/Alignment"
 *
 * MAX_FUZZY_SOURCE_LENGTH // => 100000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_FUZZY_SOURCE_LENGTH = 100_000;

/**
 * Maximum candidate-query length accepted by the fuzzy alignment path.
 *
 * **Details**
 *
 * Queries longer than this bound skip the fuzzy fallback and fail closed to
 * `unaligned`, keeping the per-candidate Levenshtein cost predictable.
 *
 * **Example** (Log the fuzzy query bound)
 *
 * ```ts import.meta.vitest name="Log the fuzzy query bound"
 * import { MAX_FUZZY_QUERY_LENGTH } from "@beep/langextract/Alignment"
 *
 * MAX_FUZZY_QUERY_LENGTH // => 4096
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_FUZZY_QUERY_LENGTH = 4_096;

/**
 * Maximum minimal-fold NFA transitions shared by one alignment batch.
 *
 * **Details**
 *
 * Exhaustion fails minimal-fold alignment closed for the current batch and
 * suppresses fuzzy fallback, bounding synchronous matcher work.
 *
 * **Example** (Inspect the minimal-fold work ceiling)
 *
 * ```ts import.meta.vitest name="Inspect the minimal-fold work ceiling"
 * import { MAX_MINIMAL_FOLD_TRANSITIONS } from "@beep/langextract/Alignment"
 *
 * MAX_MINIMAL_FOLD_TRANSITIONS // => 1000000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_MINIMAL_FOLD_TRANSITIONS = 1_000_000;

/**
 * Default extraction cap applied when an alignment source resolves no explicit
 * `maxExtractions`.
 *
 * **Details**
 *
 * The cap prevents an unbounded candidate array from multiplying the
 * per-candidate alignment cost when the caller omits an explicit limit.
 *
 * **Example** (Log the default extraction cap)
 *
 * ```ts import.meta.vitest name="Log the default extraction cap"
 * import { DEFAULT_MAX_EXTRACTIONS } from "@beep/langextract/Alignment"
 *
 * DEFAULT_MAX_EXTRACTIONS // => 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_MAX_EXTRACTIONS = NonNegativeInt.make(256);
