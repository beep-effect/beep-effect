// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/semver.ts. Pure: no process reads.
import { dual } from "effect/Function";
const SEMVER_RE = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

/**
 * Compare semver-like strings (`MAJOR[.MINOR[.PATCH]]`) by their numeric components.
 *
 * **Details**
 *
 * Prerelease tags (e.g. `-beta`, `-rc.1`) are stripped and ignored.
 *
 * **Gotchas**
 *
 * Malformed inputs are treated as equal — this is a permissive helper, not a strict parser.
 *
 * **Example** (Compare releases and malformed input)
 *
 * ```ts
 * import { compareSemver } from "@beep/scratchpad/effected/env/internal/osc8/semver"
 *
 * console.log(compareSemver("3.1.0", "3.0.0")) // 1
 * console.log(compareSemver("3.1.0-beta", "3.1.0")) // 0
 * console.log(compareSemver("unknown", "3.1.0")) // 0
 * ```
 *
 * @returns Negative if `a` is less than `b`, positive if `a` is greater than `b`, 0 if equal or malformed.
 * @category utilities
 * @since 0.0.0
 */
export const compareSemver: {
	(b: string): (a: string) => number;
	(a: string, b: string): number;
} = dual(2, (a: string, b: string): number => {
	const parsed = (s: string): [number, number, number] | null => {
		const m = SEMVER_RE.exec(s);
		if (m === null) return null;
		return [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)];
	};
	const aa = parsed(a);
	const bb = parsed(b);
	if (aa === null || bb === null) return 0;
	for (let i = 0; i < 3; i++) {
		const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
});

/**
 * Decode a packed `VTE_VERSION` environment value into a dotted version.
 *
 * **Details**
 *
 * VTE encodes versions as `MAJOR * 10000 + MINOR * 100 + PATCH`. So `5202` means `0.52.2`.
 * Missing, empty, non-numeric or negative values return `null`; a numeric prefix is accepted.
 *
 * **Example** (Decode a VTE version)
 *
 * ```ts
 * import { parseVteVersion } from "@beep/scratchpad/effected/env/internal/osc8/semver"
 *
 * console.log(parseVteVersion("5202")) // 0.52.2
 * console.log(parseVteVersion(undefined)) // null
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseVteVersion = (raw: string | undefined): string | null => {
	if (raw === undefined || raw === "") return null;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 0) return null;
	const major = Math.floor(n / 10000);
	const minor = Math.floor((n % 10000) / 100);
	const patch = n % 100;
	return `${major}.${minor}.${patch}`;
};

/**
 * Decode a packed `KONSOLE_VERSION` environment value into a dotted calendar version.
 *
 * **Details**
 *
 * Konsole uses calendar versioning packed identically to VTE: `YY * 10000 + MM * 100 + PATCH`.
 *
 * **Example** (Decode a Konsole calendar version)
 *
 * ```ts
 * import { parseKonsoleVersion } from "@beep/scratchpad/effected/env/internal/osc8/semver"
 *
 * console.log(parseKonsoleVersion("220400")) // 22.4.0
 * ```
 *
 * @see {@link parseVteVersion} for the shared parser and its permissive input handling.
 * @category parsing
 * @since 0.0.0
 */
export const parseKonsoleVersion = parseVteVersion;
