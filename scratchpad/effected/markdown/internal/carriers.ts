// The engine's raw carrier vocabulary. The internal parser throws these; ONLY
// the public modules (src/MarkdownDiagnostic.ts, src/Markdown.ts,
// src/MarkdownDocument.ts) catch them and materialize a MarkdownDiagnostic or
// a tagged error. This module imports nothing public — the dependency edge
// runs public modules -> engine only (toml src/internal/diagnostics.ts and
// src/internal/limits.ts precedent, collapsed into one file).

/**
 * The engine's error-code vocabulary: currently exactly one, the
 * hardening-guard trip. Widens as new parse-error kinds are added.
 */
export const MARKDOWN_PARSE_ERROR_CODES = ["NestingDepthExceeded"] as const;

/** The union of all raw parse-error code string literals the engine emits. */
export type MarkdownParseErrorCodeRaw = (typeof MARKDOWN_PARSE_ERROR_CODES)[number];

/** The engine's diagnostic record. Public modules derive `line`/`character` from `offset`. */
export interface RawDiagnostic {
	readonly code: MarkdownParseErrorCodeRaw;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/** The engine's carrier for a recoverable-turned-fatal parse condition. */
export class RawMarkdownError extends Error {
	readonly _tag = "RawMarkdownError";
	constructor(readonly diagnostic: RawDiagnostic) {
		super(diagnostic.message);
	}
}

/** Narrows `unknown` to {@link RawMarkdownError}; never a bare `instanceof` at a call site. */
export const isRawMarkdownError = (u: unknown): u is RawMarkdownError => u instanceof RawMarkdownError;

/** The reasons a guard can trip; mirrors {@link MarkdownParseErrorCodeRaw}'s guard members. */
export type GuardReason = "NestingDepthExceeded";

/**
 * Raw guard-trip signal. The engine throws it when a hardening cap
 * (`MAX_NESTING_DEPTH`) is exceeded; it must never escape a public entry
 * point as a defect — the facade catches it and materializes a typed
 * `MarkdownParseError` carrying a `NestingDepthExceeded` diagnostic.
 */
export class GuardExceeded extends Error {
	readonly _tag = "GuardExceeded";
	constructor(
		readonly reason: GuardReason,
		readonly limit: number,
		readonly actual: number,
		readonly offset: number,
	) {
		super(`${reason}: limit ${limit}, actual ${actual}`);
	}
}

/** Narrows `unknown` to {@link GuardExceeded}; never a bare `instanceof` at a call site. */
export const isGuardExceeded = (u: unknown): u is GuardExceeded => u instanceof GuardExceeded;
