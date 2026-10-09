// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/semver.ts. Pure: no process reads.
const SEMVER_RE = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

/**
 * Compare two semver-like strings (`MAJOR[.MINOR[.PATCH]]`). Prerelease tags
 * (e.g. `-beta`, `-rc.1`) are stripped and ignored. Malformed inputs are
 * treated as equal — this is a permissive helper, not a strict parser.
 *
 * @returns negative if `a` is less than `b`, positive if `a` is greater than `b`, 0 if equal or malformed.
 */
export const compareSemver = (a: string, b: string): number => {
	const parsed = (s: string): [number, number, number] | null => {
		const m = SEMVER_RE.exec(s);
		if (!m) return null;
		return [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)];
	};
	const aa = parsed(a);
	const bb = parsed(b);
	if (!aa || !bb) return 0;
	for (let i = 0; i < 3; i++) {
		const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
};

/**
 * Parse a VTE_VERSION env value. VTE encodes versions as
 * `MAJOR * 10000 + MINOR * 100 + PATCH`. So `5202` means `0.52.2`.
 */
export const parseVteVersion = (raw: string | undefined): string | null => {
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 0) return null;
	const major = Math.floor(n / 10000);
	const minor = Math.floor((n % 10000) / 100);
	const patch = n % 100;
	return `${major}.${minor}.${patch}`;
};

/**
 * Parse a KONSOLE_VERSION env value. Konsole uses calendar versioning
 * packed identically to VTE: `YY * 10000 + MM * 100 + PATCH`.
 */
export const parseKonsoleVersion = parseVteVersion;
