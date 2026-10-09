import { Redacted } from "effect";

/**
 * The placeholder every redaction writes in place of a secret.
 *
 * @public
 */
export const REDACTED = "***";

/**
 * Argument tokens whose *following* positional (or `=`-joined value) is a
 * secret. Lowercase; matching is case-insensitive.
 *
 * @remarks
 * This is the heuristic backstop, not the primary mechanism — it can only know
 * about flags someone thought to list. The primary mechanism is
 * {@link Redaction.applyArgs}, which redacts by **value**: the caller says what
 * its secrets are and every occurrence goes, whatever flag carried it.
 *
 * @public
 */
export const SECRET_FLAGS: ReadonlySet<string> = new Set([
	"--access-token",
	"--api-key",
	"--auth",
	"--auth-token",
	"--otp",
	"--password",
	"--registry-token",
	"--token",
]);

/**
 * npm config keys whose value is a credential (`//registry/:_authToken`,
 * `//registry/:_password`).
 */
const AUTH_KEY = /:(?:_authtoken|_password)$/i;

/**
 * The distinct, non-empty secret values, longest first.
 *
 * @remarks
 * Longest-first is load-bearing: redacting `"ab"` before `"abcd"` rewrites
 * `"abcd"` to `"***cd"`, leaking `"cd"` — a fragment of the longer secret.
 * Empty values are dropped because `"abc".split("").join("***")` would insert
 * the placeholder between every character.
 */
const prepare = (secrets: ReadonlyArray<Redacted.Redacted<string>>): ReadonlyArray<string> =>
	[...new Set(secrets.map(Redacted.value))].filter((value) => value.length > 0).sort((a, b) => b.length - a.length);

/** Replaces each prepared value with {@link REDACTED}, literally (never as a pattern). */
const replaceAll = (text: string, values: ReadonlyArray<string>): string => {
	let out = text;
	for (const value of values) {
		// split/join is a literal replace on both sides: no regex compilation of
		// the needle, and no `$&`-style expansion of the replacement.
		out = out.split(value).join(REDACTED);
	}
	return out;
};

// Implementation of Redaction.apply; the public contract lives on the static.
const apply = (text: string, secrets: ReadonlyArray<Redacted.Redacted<string>>): string =>
	secrets.length === 0 ? text : replaceAll(text, prepare(secrets));

// Implementation of Redaction.applyArgs; the public contract lives on the static.
const applyArgs = (
	args: ReadonlyArray<string>,
	secrets: ReadonlyArray<Redacted.Redacted<string>>,
): ReadonlyArray<string> => {
	if (secrets.length === 0) return args;
	const values = prepare(secrets);
	return args.map((arg) => replaceAll(arg, values));
};

/** Whether `name` introduces a credential value. */
const isSecretName = (name: string, extra: ReadonlySet<string>): boolean => {
	const lower = name.toLowerCase();
	return SECRET_FLAGS.has(lower) || extra.has(lower) || AUTH_KEY.test(name);
};

// Implementation of Redaction.scrubArgs; the public contract lives on the static.
const scrubArgs = (
	args: ReadonlyArray<string>,
	options?: { readonly flags?: ReadonlyArray<string> | undefined },
): ReadonlyArray<string> => {
	const extra = new Set((options?.flags ?? []).map((flag) => flag.toLowerCase()));
	const out: Array<string> = [];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		const equals = arg.indexOf("=");
		if (equals > 0 && isSecretName(arg.slice(0, equals), extra)) {
			out.push(`${arg.slice(0, equals)}=${REDACTED}`);
			continue;
		}
		out.push(arg);
		// Only consume a following value when one actually exists — a trailing
		// secret flag must not grow the array.
		if (isSecretName(arg, extra) && index + 1 < args.length) {
			out.push(REDACTED);
			index++;
		}
	}
	return out;
};

/**
 * Secret scrubbing for command arguments and captured output.
 *
 * @remarks
 * Two mechanisms, deliberately layered. {@link Redaction.apply} and
 * {@link Redaction.applyArgs} redact **by value** — the caller declares its
 * secrets as `Redacted` and every occurrence is removed wherever it appears.
 * {@link Redaction.scrubArgs} is a **flag heuristic** that runs in addition, for
 * the secrets a caller forgot to declare.
 *
 * @public
 */
export class Redaction {
	private constructor() {}

	/**
	 * Replaces every occurrence of every secret's value in `text` with
	 * {@link REDACTED}.
	 *
	 * @remarks
	 * Exact, literal matching — no pattern compilation, no encoding-aware search. A
	 * secret that reaches the text base64-encoded, URL-encoded, or split across a
	 * line break is **not** found; declare the encoded form as a secret too if that
	 * is a real risk.
	 *
	 * A secret composed only of the placeholder's own characters (`*`, `**`, `***`)
	 * cannot be fully removed, because the replacement reintroduces it. That is a
	 * documented limitation, not a defect.
	 */
	static readonly apply = apply;

	/**
	 * {@link Redaction.apply} over each entry of an argv array. An entry is
	 * redacted whether it *is* a secret or merely *contains* one
	 * (`--url=https://u:s3cr3t@host`).
	 */
	static readonly applyArgs = applyArgs;

	/**
	 * Heuristic backstop: redact any argv value that is introduced by a known
	 * secret-bearing flag or npm auth key, in either the separated
	 * (`--token abc`) or inline (`--token=abc`) form.
	 *
	 * @remarks
	 * This catches secrets the caller forgot to declare; it cannot catch a flag
	 * nobody listed. Prefer {@link Redaction.applyArgs} with the actual
	 * `Redacted` values — this runs *in addition*, never instead.
	 */
	static readonly scrubArgs = scrubArgs;

	/** Flags treated as secret-bearing by {@link Redaction.scrubArgs}. See {@link SECRET_FLAGS}. */
	static readonly SECRET_FLAGS = SECRET_FLAGS;
}
