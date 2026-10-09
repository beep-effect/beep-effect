import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { ActionOutputs } from "./ActionOutputs.ts";
import * as R from "effect/Record";

/**
 * The declassification seam: the **only** place in this package where a
 * `Redacted` value becomes a plain string.
 *
 * @remarks
 * Some boundaries cannot carry a `Redacted`. A detached child process reads
 * its configuration from environment variables; `GITHUB_STATE` is a plaintext
 * file by GitHub's protocol. `Redacted` refusing to serialize is the whole
 * value of the type, so this module does not try to make it serializable —
 * it makes declassification **explicit, auditable, and impossible to do
 * quietly**.
 *
 * The invariant: **masking is the floor, and declassification implies it.**
 * Every member that touches plaintext routes through
 * `ActionOutputs.setSecret`, registering the value with the runner's log
 * filter (`::add-mask::`) *before* any plaintext is returned — and the one
 * member that returns nothing, {@link Secret.mask}, registers and stops there
 * — so under the normal runner layer a secret cannot reach a child's
 * environment or a state file without the runner already knowing to redact it
 * from logs. Two scoped exceptions: {@link Secret.adopt} is a `Config` that
 * re-wraps an inherited plaintext without involving `ActionOutputs` at all —
 * the parent masked that value before the handoff — and under
 * `ActionOutputs.layerDetached` the registration is a documented no-op,
 * because a mask emitted inside a detached worker would itself be the leak.
 *
 * `Redacted.value` appears nowhere else in this package, and a test asserts
 * that structurally — a reintroduction elsewhere fails the suite rather than
 * review.
 *
 * What this deliberately does **not** do is encrypt the handoff. The child
 * runs on the same runner, as the same user, as the parent; a key would have
 * to travel the same channel as the secret it protects.
 *
 * @example
 * ```ts
 * import { Secret } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const env = yield* Secret.forChildEnv({ MY_TOKEN: theToken });
 *   // every value in `env` is already masked in the runner log
 *   return env;
 * });
 * ```
 *
 * @public
 */
export class Secret {
	private constructor() {}

	/**
	 * Declassify a set of secrets for a child process's environment.
	 *
	 * @remarks
	 * Every value is masked before any plaintext is returned — including when
	 * one of them fails, because masking happens for the whole set first.
	 *
	 * **Detached workers invert the masking model.** Masking works because the
	 * runner parses this process's stdout; a *detached* child's stdout is a log
	 * file no runner parses, so a mask emitted **inside** the worker is inert
	 * and writes the plaintext verbatim into that log. The rule: **the parent masks, before the spawn** — call
	 * this member in the parent, where the runner is listening, and hand the
	 * already-masked plaintext to the worker's environment. Inside the worker,
	 * compose `ActionOutputs.layerDetached`, whose `setSecret` is a documented
	 * no-op, so the same code cannot re-leak what the parent already masked.
	 */
	static readonly forChildEnv = (
		entries: Readonly<Record<string, Redacted.Redacted<string>>>,
	): Effect.Effect<Record<string, string>, never, ActionOutputs> =>
		Effect.gen(function* () {
			const outputs = yield* ActionOutputs;
			const declassified: Record<string, string> = {};
			for (const [name, secret] of R.toEntries(entries)) {
				const plaintext = Redacted.value(secret);
				yield* outputs.setSecret(plaintext);
				declassified[name] = plaintext;
			}
			return declassified;
		});

	/**
	 * Declassify one secret for a runner file (`GITHUB_STATE`, `GITHUB_OUTPUT`).
	 *
	 * @remarks
	 * Masks first. The runner file is plaintext regardless; the mask is what
	 * keeps the value out of the visible log.
	 */
	static readonly forRunnerFile = (secret: Redacted.Redacted<string>): Effect.Effect<string, never, ActionOutputs> =>
		Effect.gen(function* () {
			const outputs = yield* ActionOutputs;
			const plaintext = Redacted.value(secret);
			yield* outputs.setSecret(plaintext);
			return plaintext;
		});

	/**
	 * Declassify one secret for an in-process use that needs the raw bytes.
	 *
	 * @remarks
	 * Request signing is the case this exists for: an HMAC cannot be computed
	 * over a `Redacted`, so a signing key has to become a string somewhere, and
	 * the point of this module is that "somewhere" is here and nowhere else.
	 *
	 * Signing named the member; it does not gate it. **Any in-process use that
	 * needs the raw value without writing it to a runner file is this
	 * operation** — handing a key to a library that takes a plain string. The
	 * dividing line is where the value goes, not what it is for: a value
	 * crossing into a **child's** environment is {@link Secret.forChildEnv},
	 * one written to `GITHUB_STATE` or `GITHUB_OUTPUT` is
	 * {@link Secret.forRunnerFile}, one bound for the ambient environment is
	 * {@link Secret.forProcessEnv}, and one that stays in this process — held
	 * by this code, passed as an argument — is this member.
	 *
	 * It masks even though the value is never *written* anywhere, and that is
	 * deliberate rather than superstitious: a signing key that leaks does so
	 * through something nobody audited — a debug log of outgoing headers, a
	 * serialized error, a stack trace carrying the closure. Registering it with
	 * the runner's filter costs one call and makes every one of those redacted.
	 *
	 * Call it **once, at layer construction**, not per operation: masking is
	 * idempotent but a workflow command per request is noise in the log.
	 *
	 * **In a detached worker, the mask this member emits is a leak.** The
	 * `::add-mask::` command only masks when the runner parses this process's
	 * stdout; a detached worker's stdout is a log file no runner parses, so
	 * there the command masks nothing *and* spells the plaintext into the log.
	 * A worker that signs (an S3-style `BlobStore` is the canonical case) must compose
	 * `ActionOutputs.layerDetached`, under which this member still returns the
	 * raw key for the HMAC but the mask is a documented no-op; the masking
	 * itself is the **parent's** job, done before the spawn via
	 * {@link Secret.forChildEnv} under the real layer.
	 */
	static readonly forSigning = (secret: Redacted.Redacted<string>): Effect.Effect<string, never, ActionOutputs> =>
		Secret.forRunnerFile(secret);

	/**
	 * Declassify one secret for the caller to bridge into `process.env`.
	 *
	 * @remarks
	 * The third-party-SDK case, under its own auditable name: an SDK that reads
	 * only the ambient environment cannot take the plaintext as an argument, so
	 * the value has to cross into `process.env` before the SDK looks. The
	 * mechanism is identical to {@link Secret.forRunnerFile} — mask first, then
	 * return plaintext — and the name is what earns the member: these names are
	 * the audit vocabulary, and a search for this one finds every place a
	 * secret enters the ambient environment without wading through signing
	 * keys and runner files.
	 *
	 * **This package never mutates `process.env`.** Reads are seeded once, at layer
	 * construction, through `ActionEnvironment`, and nothing here writes back
	 * — a write from inside the kit would be invisible to that seeding and to
	 * every consumer's assumptions about when the environment is stable. This
	 * member declassifies and masks; the assignment to `process.env`, and the
	 * restore discipline that unwinds it when the bridged scope ends, live in
	 * the **caller**, as the caller's own explicit tradeoff.
	 *
	 * The detached-worker inversion applies exactly as it does to
	 * {@link Secret.forSigning}: the mask only works where the runner parses
	 * stdout, so a worker that needs a bridged environment gets it from the
	 * parent — masked before the spawn via {@link Secret.forChildEnv} — rather
	 * than declassifying inside itself.
	 */
	static readonly forProcessEnv = (secret: Redacted.Redacted<string>): Effect.Effect<string, never, ActionOutputs> =>
		Secret.forRunnerFile(secret);

	/**
	 * Register a secret with the runner's log filter — and return nothing.
	 *
	 * @remarks
	 * Masking without declassification: the value is registered with
	 * `::add-mask::` through the same route as every other member, and the
	 * success channel is `void`, so a caller cannot come away holding the raw
	 * value at all. Prefer it to calling {@link Secret.forSigning} and discarding
	 * the result, which would mislabel a masking site as a signing one. The names
	 * are the audit vocabulary: a grep for this member finds every register-only
	 * site, and a grep for `forSigning` finds only signing.
	 *
	 * The canonical caller masks every supplied credential input
	 * unconditionally, before the logic that decides which of them will
	 * actually be used — a secret the workflow supplied deserves redaction from
	 * the log whether or not resolution reaches for it.
	 *
	 * One value per call is the blessed shape; there is deliberately no
	 * set-taking form. {@link Secret.forChildEnv} takes a set because its
	 * mask-everything-before-returning-anything ordering is load-bearing; a
	 * plain mask returns nothing to order against, and a loop is fine.
	 *
	 * **In a detached worker, the mask this member emits is a leak.** The
	 * `::add-mask::` command only masks when the runner parses this process's
	 * stdout; a detached worker's stdout is a log file no runner parses, so
	 * there the command masks nothing *and* spells the plaintext into the log.
	 * A worker must compose `ActionOutputs.layerDetached`, under which the mask is a
	 * documented no-op; the masking itself is the **parent's** job, done
	 * before the spawn via {@link Secret.forChildEnv} under the real layer.
	 */
	static readonly mask = (secret: Redacted.Redacted<string>): Effect.Effect<void, never, ActionOutputs> =>
		Effect.asVoid(Secret.forRunnerFile(secret));

	/**
	 * The far side of a handoff: re-wrap a plaintext environment variable.
	 *
	 * @remarks
	 * A `Config`, so a missing or empty handoff is an honest `ConfigError`
	 * naming the variable rather than an empty `Redacted` that fails much later
	 * as an authentication error.
	 */
	static readonly adopt = (name: string): Config.Config<Redacted.Redacted<string>> => Config.Redacted(name);
}
