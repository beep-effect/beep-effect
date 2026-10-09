// The engine's raw carrier vocabulary. The internal parser throws these; ONLY
// the public modules (src/MarkdownDiagnostic.ts, src/Markdown.ts,
// src/MarkdownDocument.ts) catch them and materialize a MarkdownDiagnostic or
// a tagged error. This module imports nothing public — the dependency edge
// runs public modules -> engine only (toml src/internal/diagnostics.ts and
// src/internal/limits.ts precedent, collapsed into one file).

import * as Data from "effect/Data";

/**
 * The engine's error-code vocabulary identifies parse conditions reported by the engine.
 *
 * **Details**
 *
 * Currently exactly one code represents the hardening-guard trip. The vocabulary
 * widens as new parse-error kinds are added.
 *
 * **Example** (Inspect the hardening error code)
 *
 * ```ts
 * import { MARKDOWN_PARSE_ERROR_CODES } from "@beep/scratchpad/effected/markdown/internal/carriers"
 *
 * console.log(MARKDOWN_PARSE_ERROR_CODES.join(", ")) // NestingDepthExceeded
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MARKDOWN_PARSE_ERROR_CODES = ["NestingDepthExceeded"] as const;

/**
 * The union of all raw parse-error code string literals the engine emits.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownParseErrorCodeRaw = (typeof MARKDOWN_PARSE_ERROR_CODES)[number];

/**
 * The engine's diagnostic record preserves a parse condition and its source span.
 *
 * **Details**
 *
 * Public modules derive `line`/`character` from `offset`.
 *
 * @category models
 * @since 0.0.0
 */
export interface RawDiagnostic {
	readonly code: MarkdownParseErrorCodeRaw;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/**
 * The engine's carrier for a recoverable-turned-fatal parse condition.
 *
 * **Example** (Carry a fatal diagnostic)
 *
 * ```ts
 * import { RawMarkdownError } from "@beep/scratchpad/effected/markdown/internal/carriers"
 *
 * const error = new RawMarkdownError({
 *   code: "NestingDepthExceeded",
 *   message: "Markdown nesting exceeds the limit",
 *   offset: 12,
 *   length: 1
 * })
 * console.log(error.message) // Markdown nesting exceeds the limit
 * console.log(error.diagnostic.offset) // 12
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RawMarkdownError extends Data.TaggedError("RawMarkdownError")<{
	readonly diagnostic: RawDiagnostic;
	readonly message: string;
}> {
	/**
	 * Preserves the standard error name on the raw parse-condition carrier.
	 *
	 * **Example** (Inspect the raw parse error name)
	 *
	 * ```ts
	 * import { RawMarkdownError } from "@beep/scratchpad/effected/markdown/internal/carriers"
	 *
	 * const error = new RawMarkdownError({
	 *   code: "NestingDepthExceeded",
	 *   message: "Nesting limit exceeded",
	 *   offset: 0,
	 *   length: 1
	 * })
	 * console.log(error.name) // Error
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	override readonly name = "Error";
	constructor(diagnostic: RawDiagnostic) {
		super({ diagnostic, message: diagnostic.message });
	}
}

/**
 * Narrows `unknown` to {@link RawMarkdownError}; never a bare `instanceof` at a call site.
 *
 * **Example** (Recognize a raw parse error)
 *
 * ```ts
 * import { RawMarkdownError, isRawMarkdownError } from "@beep/scratchpad/effected/markdown/internal/carriers"
 *
 * const error: unknown = new RawMarkdownError({
 *   code: "NestingDepthExceeded",
 *   message: "Nesting limit exceeded",
 *   offset: 0,
 *   length: 1
 * })
 * console.log(isRawMarkdownError(error)) // true
 * console.log(isRawMarkdownError("Nesting limit exceeded")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isRawMarkdownError = (u: unknown): u is RawMarkdownError => u instanceof RawMarkdownError;

/**
 * The reasons a guard can trip; mirrors {@link MarkdownParseErrorCodeRaw}'s guard members.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = "NestingDepthExceeded";

/**
 * Signals that the engine exceeded a hardening cap.
 *
 * **Details**
 *
 * The engine throws this raw guard-trip signal when a hardening cap
 * (`MAX_NESTING_DEPTH`) is exceeded.
 *
 * **Gotchas**
 *
 * It must never escape a public entry point as a defect — the facade catches it
 * and materializes a typed `MarkdownParseError` carrying a `NestingDepthExceeded`
 * diagnostic.
 *
 * **Example** (Inspect a nesting guard trip)
 *
 * ```ts
 * import { GuardExceeded } from "@beep/scratchpad/effected/markdown/internal/carriers"
 *
 * const error = new GuardExceeded("NestingDepthExceeded", 128, 129, 12)
 * console.log(error.message) // NestingDepthExceeded: limit 128, actual 129
 * console.log(error.offset) // 12
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GuardExceeded extends Data.TaggedError("GuardExceeded")<{
	readonly reason: GuardReason;
	readonly limit: number;
	readonly actual: number;
	readonly offset: number;
	readonly message: string;
}> {
	/**
	 * Preserves the standard error name on the raw guard-trip signal.
	 *
	 * **Example** (Inspect the guard error name)
	 *
	 * ```ts
	 * import { GuardExceeded } from "@beep/scratchpad/effected/markdown/internal/carriers"
	 *
	 * const error = new GuardExceeded("NestingDepthExceeded", 128, 129, 12)
	 * console.log(error.name) // Error
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	override readonly name = "Error";
	constructor(reason: GuardReason, limit: number, actual: number, offset: number) {
		super({ reason, limit, actual, offset, message: `${reason}: limit ${limit}, actual ${actual}` });
	}
}

/**
 * Narrows `unknown` to {@link GuardExceeded}; never a bare `instanceof` at a call site.
 *
 * **Example** (Recognize a guard signal)
 *
 * ```ts
 * import { GuardExceeded, isGuardExceeded } from "@beep/scratchpad/effected/markdown/internal/carriers"
 *
 * const error: unknown = new GuardExceeded("NestingDepthExceeded", 128, 129, 12)
 * console.log(isGuardExceeded(error)) // true
 * console.log(isGuardExceeded("NestingDepthExceeded")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isGuardExceeded = (u: unknown): u is GuardExceeded => u instanceof GuardExceeded;
