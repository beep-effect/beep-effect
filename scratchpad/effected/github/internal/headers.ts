// Reading GitHub's response headers.
//
// octokit hands headers back as a plain object whose values may be `string`,
// `number` or absent depending on the fetch implementation, so every read here
// is defensive about both. Header names are already lowercased by octokit.

/** A header's value as a string, when it is present and non-empty. */
export const headerString = (
	headers: Readonly<Record<string, unknown>> | undefined,
	name: string,
): string | undefined => {
	const value = headers?.[name];
	if (typeof value === "string") return value.length > 0 ? value : undefined;
	if (typeof value === "number") return String(value);
	return undefined;
};

/** A header's value as a finite integer, when it parses as one. */
export const headerNumber = (
	headers: Readonly<Record<string, unknown>> | undefined,
	name: string,
): number | undefined => {
	const raw = headerString(headers, name);
	if (raw === undefined) return undefined;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
};

/**
 * How long GitHub asked us to wait, in milliseconds, or `undefined` when it
 * did not ask.
 *
 * @remarks
 * Two mechanisms, checked in GitHub's own order of specificity:
 *
 * 1. `retry-after` — whole seconds, sent for secondary rate limits and abuse
 *    detection. Authoritative when present.
 * 2. `x-ratelimit-remaining: 0` plus `x-ratelimit-reset` — the primary rate
 *    limit, where the reset is an absolute epoch **second**. Only meaningful
 *    when the budget is actually exhausted: every successful response carries a
 *    reset header too, and treating that as a delay would make every call look
 *    rate-limited.
 *
 * `nowMillis` is a parameter rather than a `Date.now()` read so this stays pure
 * and so a test can pin it.
 */
export const retryAfterMillisFrom = (
	headers: Readonly<Record<string, unknown>> | undefined,
	nowMillis: number,
): number | undefined => {
	const retryAfterSeconds = headerNumber(headers, "retry-after");
	if (retryAfterSeconds !== undefined && retryAfterSeconds >= 0) {
		return retryAfterSeconds * 1000;
	}
	const remaining = headerNumber(headers, "x-ratelimit-remaining");
	const reset = headerNumber(headers, "x-ratelimit-reset");
	if (remaining !== undefined && remaining <= 0 && reset !== undefined) {
		return Math.max(0, reset * 1000 - nowMillis);
	}
	return undefined;
};
