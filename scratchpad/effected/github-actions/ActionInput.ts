import * as O from "effect/Option";
import * as MutableHashMap from "effect/MutableHashMap";
import * as HashSet from "effect/HashSet";
import type * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Result from "effect/Result";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const Json = S.fromJsonString(S.Unknown);
const StringList = S.Array(S.String);

/**
 * The variable name the runner publishes an input under.
 *
 * @remarks
 * GitHub uppercases the input name and replaces **spaces** with underscores —
 * and leaves every other character, **dashes included**, alone. So the input
 * `sbom-config` arrives as `INPUT_SBOM-CONFIG`, not `INPUT_SBOM_CONFIG`.
 *
 * That distinction is not academic: reading `process.env["INPUT_SBOM_CONFIG"]`
 * directly silently yields nothing. Every accessor in this module goes through
 * this function so no caller ever spells the variable name, which makes that
 * class of bug unrepresentable rather than merely documented.
 *
 * @internal
 */
export const inputVariable = (name: string): string => `INPUT_${name.replaceAll(" ", "_").toUpperCase()}`;

/**
 * A validation failure for an input that is present but unusable.
 *
 * @remarks
 * `Config.withDefault` and `Config.option` fall back only when the config
 * resolves *absent* — no provider input at all. A failure raised from inside
 * `Config.mapEffect` is a hard evaluation failure carrying the evidence that
 * input WAS present, so a default never swallows it. That is the guard against
 * `dry-run: yes` quietly becoming `false` and the action performing the
 * mutations the author meant to rehearse. `actual` carries the offending value
 * so the rendered error names it.
 */
const configError = (message: string, actual: unknown): Config.ConfigError =>
	new Config.ConfigError(new S.SchemaError(new SchemaIssue.InvalidValue({ message }, actual)));

/** YAML 1.2 core-schema booleans, which is what the runner documents. */
const TRUE = HashSet.fromIterable<string>(["true", "True", "TRUE"]);
const FALSE = HashSet.fromIterable<string>(["false", "False", "FALSE"]);

/**
 * Options for {@link ActionInput.pairs}.
 *
 * @public
 */
export interface PairsOptions {
	/**
	 * Reject a pair whose value is empty (`key=`).
	 *
	 * @defaultValue `false` — an empty value is a legitimate empty string.
	 */
	readonly requireValue?: boolean;
}

/** Strip a trailing `#` comment and surrounding whitespace from one line. */
const stripComment = (line: string): string => {
	const hash = line.indexOf("#");
	return (hash === -1 ? line : line.slice(0, hash)).trim();
};

/**
 * Action inputs, read as `Config` values.
 *
 * @remarks
 * Inputs are **never** read from `process.env` directly. Every accessor names
 * the input the way the workflow author wrote it and lets this module derive
 * the runner's variable name — see `ActionInput.variable` for why that
 * matters.
 *
 * `lines` is the `@actions/core`-faithful newline split; `list` and `pairs`
 * read the richer shapes workflow authors write — JSON arrays, bullet lists,
 * comments and `key=value` pairs.
 *
 * **The absence contract, shared by every accessor:** the runner writes `""`
 * for an input the workflow left out, and the provider reads an empty string
 * as absent — so *unset* and *empty* are the same case, **missing data**, and
 * the read fails rather than yielding an empty value. `Config.withDefault`
 * falls back for exactly that class, which makes
 * `.pipe(Config.withDefault(…))` the idiom for every optional input. What a
 * default never swallows is a *present but malformed* value — see
 * {@link ActionInput.boolean}.
 *
 * @example
 * ```ts
 * import { ActionInput } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const dryRun = yield* ActionInput.boolean("dry-run");
 *   const globs = yield* ActionInput.list("paths");
 * });
 * ```
 *
 * @public
 */
export class ActionInput {
	private constructor() {}

	/**
	 * The exact environment variable the runner publishes an input under.
	 *
	 * @remarks
	 * `variable("biome-version")` is `"INPUT_BIOME-VERSION"` — GitHub
	 * uppercases, replaces **spaces** with underscores, and leaves every other
	 * character (**dashes included**) alone. This is the same derivation every
	 * accessor on this class resolves through, exported so a test that must
	 * spell a runner variable can derive it instead of hand-writing it: a
	 * hand-written `INPUT_BIOME_VERSION` reads as absent on a real runner, the
	 * default silently applies, and the suite goes green against the wrong
	 * value. Prefer keying the test environment by input name (see
	 * {@link ActionInput.provider}) so no variable is spelled at all.
	 */
	static readonly variable = (name: string): string => inputVariable(name);

	/**
	 * A required string input.
	 *
	 * @remarks
	 * Fails as *missing data* when the input is absent **or set to the empty
	 * string** — the runner writes `""` for an unsupplied input, and both the
	 * runtime's provider and {@link ActionInput.provider} read that as absent.
	 * Every accessor on this class shares the rule, so an **optional** input
	 * needs `Config.withDefault` (or `Config.option`) at the call site or the
	 * read fails outright.
	 *
	 * **An input whose documented meaning is "set it empty to disable this"
	 * cannot be read with `Config.withDefault`.** Empty is classified as missing
	 * *before* the default is consulted, so the default substitutes and the
	 * documented behavior can never happen: if `action.yml` promises
	 * `release-prefix: ""` disables retry, a `withDefault` read makes that
	 * impossible. `Config.option` is the shape that distinguishes the states:
	 *
	 * ```ts
	 * Config.option(ActionInput.string("release-prefix"))
	 * // WITH a non-empty default in action.yml:
	 * //   unsupplied     -> Some("release:")   (the manifest default, via the runner)
	 * //   explicit ""    -> None
	 * //   explicit value -> Some(value)
	 * // WITHOUT a default in action.yml:
	 * //   unsupplied     -> None               (the runner still writes the variable, empty)
	 * ```
	 *
	 * Both rows matter: "the runner writes `""` for an unsupplied input" is the
	 * no-default case, and it is the manifest default — when there is one — that
	 * makes the unsupplied and explicitly-empty cases distinguishable at all.
	 *
	 * Two consequences follow from how the runner actually behaves:
	 *
	 * - **The runner publishes a variable for every declared input**, so *absent*
	 *   is a state a runner never produces. The `Some` branch above depends on
	 *   `action.yml` declaring a **non-empty default** — a fact in a different
	 *   file, invisible at this call site. Deleting that default does not restore
	 *   a fallback; an input declaring no default arrives set-and-empty when
	 *   unsupplied, silently flipping every unsupplied run to `None`. Pin the
	 *   default with a test if a read depends on it.
	 * - **A bare test environment inverts the unsupplied case.** Omitting the key
	 *   in a test means genuinely absent, which no runner emits, so a test named
	 *   "unsupplied" asserts the opposite of production and passes. Arrange the
	 *   manifest default explicitly instead of omitting the key.
	 */
	static string(name: string): Config.Config<string> {
		return Config.String(inputVariable(name));
	}

	/**
	 * A boolean input, per the runner's documented YAML 1.2 core schema.
	 *
	 * @remarks
	 * Absent or `""` is **missing data** — wrap with `Config.withDefault` for
	 * an optional flag. A **present but malformed** value (`yes`, `on`, `1`) is
	 * a different class: it fails carrying its `actual`, deliberately, so a
	 * default does NOT swallow it, so a malformed `dry-run` never quietly reads
	 * as `false`.
	 */
	static boolean(name: string): Config.Config<boolean> {
		return Config.String(inputVariable(name)).pipe(
			Config.mapEffect((raw) => {
				const value = raw.trim();
				if (HashSet.has(TRUE, value)) {
					return Effect.succeed(true);
				}
				if (HashSet.has(FALSE, value)) {
					return Effect.succeed(false);
				}
				return Effect.fail(
					configError(
						`Input "${name}" does not meet the YAML 1.2 core schema for booleans. ` +
							"Supported: true | True | TRUE | false | False | FALSE",
						raw,
					),
				);
			}),
		);
	}

	/**
	 * An input that must be one of a closed set of strings, typed as their
	 * union.
	 *
	 * @remarks
	 * The match is **exact**: no trimming and no case folding, so `" pr"` and
	 * `"PR"` are both rejected for `["commit", "pr"]`. An action manifest
	 * declares the set in `options:`-style prose and the workflow author copies
	 * a value verbatim; the one thing worth tolerating there is nothing, because
	 * a tolerated near-miss is a value the manifest never named. Absent or `""`
	 * is **missing data** (see {@link ActionInput.string}) — `Config.withDefault`
	 * for an optional input. A present value outside the set fails carrying its
	 * `actual`, naming the input, the value and the allowed set, and is never
	 * swallowed by a default.
	 *
	 * Core's `Config.Literals` is the same idea over `Config.schema`; this one
	 * exists so the failure reads like every other `ActionInput` failure —
	 * naming the input by its action name, not its `INPUT_` variable.
	 *
	 * @example
	 * ```ts
	 * import { ActionInput } from "./index.ts";
	 * import * as Config from "effect/Config";
	 *
	 * // Config<"commit" | "pr">
	 * const mode = ActionInput.literals("mode", ["commit", "pr"]).pipe(Config.withDefault("commit"));
	 * ```
	 */
	static literals<const L extends readonly [string, ...Array<string>]>(
		name: string,
		allowed: L,
	): Config.Config<L[number]> {
		return Config.String(inputVariable(name)).pipe(
			Config.mapEffect((raw) =>
				S.is(S.Literals(allowed))(raw)
					? Effect.succeed(raw)
					: Effect.fail(configError(`Input "${name}" must be one of: ${allowed.join(" | ")} — received "${raw}"`, raw)),
			),
		);
	}

	/**
	 * An integer input.
	 *
	 * @remarks
	 * Unset and `""` both fail as **missing data**; for an optional input,
	 * `.pipe(Config.withDefault(n))`.
	 */
	static integer(name: string): Config.Config<number> {
		return Config.Int(inputVariable(name));
	}

	/**
	 * A secret input, kept redacted.
	 *
	 * @remarks
	 * Unset and `""` both fail as **missing data**; `Config.option` is the
	 * usual shape for an optional secret, since there is rarely a meaningful
	 * default to redact.
	 */
	static redacted(name: string): Config.Config<Redacted.Redacted<string>> {
		return Config.Redacted(inputVariable(name));
	}

	/**
	 * A multiline input, split on newlines.
	 *
	 * @remarks
	 * The `@actions/core`-faithful shape: blank lines are dropped and each entry
	 * is trimmed, because a YAML block scalar carries the workflow's own
	 * indentation.
	 *
	 * Absent or `""` fails as missing data (see {@link ActionInput.string}) —
	 * `Config.withDefault([])` is load-bearing for an optional multiline input.
	 */
	static lines(name: string): Config.Config<ReadonlyArray<string>> {
		return Config.String(inputVariable(name)).pipe(
			Config.map((raw) =>
				raw
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line !== ""),
			),
		);
	}

	/**
	 * A list input, accepting the shapes workflow authors actually write.
	 *
	 * @remarks
	 * A JSON array (`["a","b"]`), a bullet list (`- a` or `* a`), or comma- and
	 * newline-separated values, with full-line `#` comments dropped — any
	 * combination of these in the same input — so a workflow author's first
	 * guess works.
	 *
	 * Parsing order, applied per newline/comma-separated item after trimming:
	 *
	 * 1. **Comment lines are dropped first.** A trimmed item whose first
	 *    character is `#` is a full-line comment and is discarded entirely,
	 *    before any bullet marker is considered. This means `- #tag` is a
	 *    value, not a comment: the check runs on the untouched, still-bulleted
	 *    item, and `-` is not `#`.
	 * 2. **Only then is a leading bullet marker stripped** — `- ` or `* `
	 *    (dash-or-asterisk followed by a space), mirroring the indentation a
	 *    YAML block scalar carries in. So `- #tag` becomes the value `#tag`.
	 * 3. Blank results (an empty line, or a comment line) are dropped from the
	 *    final list.
	 *
	 * A `#` that is not the first character of a trimmed item — a trailing or
	 * mid-value `#` — is left alone; unlike {@link ActionInput.pairs}, `list`
	 * has no trailing-comment rule, only a whole-line one.
	 *
	 * Absent or `""` fails as **missing data** (see {@link ActionInput.string}),
	 * so `Config.withDefault([])` is load-bearing at every optional-input call
	 * site — omitting an optional multi-value input otherwise fails the read
	 * outright. A *whitespace-only* value (a block scalar holding only a
	 * newline) is present, and parses to `[]`.
	 */
	static list(name: string): Config.Config<ReadonlyArray<string>> {
		return Config.String(inputVariable(name)).pipe(
			Config.mapEffect((raw) => {
				const trimmed = raw.trim();
				if (trimmed === "") {
					return Effect.succeed<ReadonlyArray<string>>([]);
				}
				if (trimmed.startsWith("[")) {
					try {
						const parsed: unknown = Result.getOrThrowWith(S.decodeResult(Json)(trimmed), (error) => error);
						if (S.is(StringList)(parsed)) {
							return Effect.succeed<ReadonlyArray<string>>(parsed);
						}
						return Effect.fail(configError(`Input "${name}" is a JSON array but not an array of strings`, raw));
					} catch {
						return Effect.fail(configError(`Input "${name}" looks like JSON but could not be parsed`, raw));
					}
				}
				const entries = trimmed
					.split(/[\n,]/)
					.map((item) => item.trim())
					// A line whose first character is "#" is a full-line comment,
					// dropped before a bullet marker is considered.
					.filter((item) => !item.startsWith("#"))
					// A leading "- " or "* " is a YAML/Markdown bullet, not part of the value.
					.map((item) => (item.startsWith("- ") || item.startsWith("* ") ? item.slice(2).trim() : item))
					.filter((item) => item !== "");
				return Effect.succeed<ReadonlyArray<string>>(entries);
			}),
		);
	}

	/**
	 * A `key=value` input, one pair per line, with `#` comments stripped.
	 *
	 * @remarks
	 * Only the **first** `=` splits, so a value may contain one.
	 *
	 * An **empty key** (`=value`, or a bare `=`) is always rejected: `{ "": v }`
	 * cannot be what a workflow meant, and the damage would land far from the
	 * typo — an empty key becomes a filter that matches nothing, and the run
	 * reports zero results with no indication why. An empty **value** (`key=`)
	 * is accepted by default, because setting a property to the empty string is
	 * legitimate; pass `requireValue` to reject it. Every rejection names the
	 * offending line.
	 *
	 * Absent or `""` fails as missing data (see {@link ActionInput.string}) —
	 * `Config.withDefault({})` is the idiom for an optional pairs input.
	 *
	 * @param name - The input name, unmangled.
	 * @param options - `requireValue` rejects a pair whose value is empty.
	 */
	static pairs(name: string, options?: PairsOptions): Config.Config<Record<string, string>> {
		const requireValue = options?.requireValue ?? false;
		return Config.String(inputVariable(name)).pipe(
			Config.mapEffect((raw) => {
				const result: Record<string, string> = {};
				for (const line of raw.split("\n")) {
					const stripped = stripComment(line);
					if (stripped === "") {
						continue;
					}
					const split = stripped.indexOf("=");
					if (split === -1) {
						return Effect.fail(configError(`Input "${name}" has a line that is not \`key=value\`: "${stripped}"`, raw));
					}
					const key = stripped.slice(0, split).trim();
					const value = stripped.slice(split + 1).trim();
					if (key === "") {
						return Effect.fail(configError(`Input "${name}" has a line with an empty key: "${stripped}"`, raw));
					}
					if (requireValue && value === "") {
						return Effect.fail(configError(`Input "${name}" has a line with an empty value: "${stripped}"`, raw));
					}
					result[key] = value;
				}
				return Effect.succeed(result);
			}),
		);
	}

	/**
	 * A JSON-valued input, decoded through a schema.
	 *
	 * @remarks
	 * Absent or `""` fails as **missing data** before any JSON parsing runs
	 * (see {@link ActionInput.string}) — `Config.withDefault` or
	 * `Config.option` for an optional input. A present value that is not valid
	 * JSON, or does not satisfy the schema, fails carrying its `actual` and is
	 * never swallowed by a default.
	 *
	 * There is no `schemaOption`: `ActionInput.schema(name, S).pipe(Config.option)`
	 * yields `Config<Option<A>>` with missing → `None` and a malformed value
	 * still failing — core's `Config.option` lets validation errors propagate,
	 * which is exactly the missing-versus-malformed split above.
	 */
	static schema<A, I>(name: string, schema: S.Codec<A, I>): Config.Config<A> {
		return Config.String(inputVariable(name)).pipe(
			Config.mapEffect((raw) => {
				let parsed: unknown;
				try {
					parsed = Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error);
				} catch {
					return Effect.fail(configError(`Input "${name}" is not valid JSON`, raw));
				}
				return S.decodeUnknownEffect(schema)(parsed).pipe(
					Effect.mapError(() => configError(`Input "${name}" did not satisfy its schema`, parsed)),
				);
			}),
		);
	}

	/**
	 * A `ConfigProvider` over a record of runner variables **or input names**.
	 *
	 * @remarks
	 * The record dual-accepts, and the split is the `INPUT_` prefix:
	 *
	 * - A key already spelled as a runner variable (`INPUT_BIOME-VERSION`,
	 *   `PLAIN_VAR`) is read verbatim.
	 * - Any other key is treated as an **input name**, `with:`-block style —
	 *   `{ "biome-version": "2.3.14" }` — and serves the variable this module
	 *   derives for it (`ActionInput.variable`). This is the spelling to
	 *   prefer in tests: a hand-written `INPUT_BIOME_VERSION` (underscore where
	 *   the runner keeps the dash) reads as absent and the default silently
	 *   applies, and the input-name form makes that class of bug
	 *   unrepresentable — the mangling never leaves this module.
	 *
	 * When both spellings of the same input are present and non-empty, the
	 * explicit `INPUT_`-spelled entry wins.
	 *
	 * A **flat single-segment** lookup additionally tries the `INPUT_`
	 * derivation of the name first, mirroring the order the production runtime
	 * installs ({@link ActionInput.providerOver} via `layerDefault`) — so a
	 * bare `Config.String("biome-version")` resolves under this provider
	 * exactly as it does inside `Action.run`. Nested and numeric paths pass
	 * through as the joined spelling only.
	 *
	 * Otherwise the path is joined with `_`, spaces become underscores and the
	 * whole is uppercased; and an **empty string reads as absent**,
	 * because the runner sets unsupplied inputs to `""` and treating that as
	 * present would make every optional input look supplied. That rule applies
	 * to input-name entries too: `{ "flag": "" }` is an unsupplied input.
	 *
	 * Taking the environment as an argument rather than reading `process.env`
	 * is what makes inputs testable without mutating the test process. The
	 * `process.env` default is a sanctioned exception to the package rule
	 * stated on `ChildEnv` (ambient process state is never read behind a
	 * caller's back) — a default the caller overrides by passing a value, the
	 * same class as `DetachedProcess.spawn`'s `base`.
	 *
	 * **A bare `ConfigProvider.fromEnv` cannot serve input-name keys.** Composed
	 * beneath this provider or {@link ActionInput.providerOver}, it uppercases
	 * the config path, so `{ "target-branch": "trunk" }` is looked up as
	 * `TARGET-BRANCH`, never matches, and the read falls through to whatever
	 * default the call site supplies. It **fails green**: nothing errors, the
	 * suite passes against the default, and the test's name claims it proved the
	 * input was read.
	 *
	 * Runner-variable keys (`INPUT_TARGET-BRANCH`, `PLAIN_VAR`) are unaffected —
	 * they are already in the spelling `fromEnv` produces, and they resolve. The
	 * hazard is specific to keying a `fromEnv` record by **input name**. Passing
	 * the record to *this* function instead removes the distinction: it
	 * dual-accepts both spellings, so neither can miss.
	 */
	static provider(env: Readonly<Record<string, string | undefined>> = process.env): ConfigProvider.ConfigProvider {
		/** Unset, and the `""` the runner writes for an unsupplied input, are both absent. */
		const present = (value: string | undefined): value is string => value !== undefined && value !== "";
		/**
		 * The input-name entries, keyed by the runner variable they would be
		 * (`inputVariable`, the one spelling of the derivation) — built once,
		 * so an `INPUT_`-prefixed miss is a map read rather than a scan of the
		 * whole environment per `Config` read.
		 */
		const byInputName = MutableHashMap.empty<string, string>();
		for (const [key, value] of R.toEntries(env)) {
			if (!key.startsWith("INPUT_") && present(value) && !MutableHashMap.has(byInputName, inputVariable(key))) {
				MutableHashMap.set(byInputName, inputVariable(key), value);
			}
		}
		/** Resolve one runner-variable name: the verbatim entry wins, then the input-name entry. */
		const lookup = (name: string): string | undefined => {
			const direct = env[name];
			return present(direct) ? direct : O.getOrUndefined(MutableHashMap.get(byInputName, name));
		};
		return ConfigProvider.make((path) => {
			const single = path.length === 1 && P.isString(path[0]) ? path[0] : undefined;
			const attempted = single === undefined ? undefined : lookup(inputVariable(single));
			const value = attempted ?? lookup(path.join("_").replaceAll(" ", "_").toUpperCase());
			return Effect.succeed(value === undefined ? undefined : ConfigProvider.makeValue(value));
		});
	}

	/**
	 * A layer installing {@link ActionInput.provider}.
	 *
	 * @remarks
	 * `ConfigProvider.ConfigProvider` is a `Context.Reference`, so this is a
	 * reference override rather than a service.
	 *
	 * A parameterized layer factory mints a fresh reference per call; bind it to
	 * a `const` rather than calling it at each composition site.
	 */
	static layer(env?: Readonly<Record<string, string | undefined>>): Layer.Layer<never> {
		return ConfigProvider.layer(ActionInput.provider(env));
	}

	/**
	 * Inputs-first resolution layered over an existing provider.
	 *
	 * @remarks
	 * A bare `Config.String("dry-run")` resolves a **flat** name — one string
	 * segment — by first trying the variable the runner would have published for
	 * an input of that name (the `INPUT_` derivation this module owns), and only
	 * then trying the name unchanged through `ambient`. Anything the runner
	 * could not have set as an input — a nested path, a numeric segment — is
	 * passed to `ambient` untouched, so no path semantics are invented that the
	 * runner does not have.
	 *
	 * This exists because the runner exposes inputs as `INPUT_<MANGLED>`
	 * variables, so a plain-named lookup finds nothing and a bare `Config` read
	 * would silently fall back to its `withDefault`. Under this provider a bare read resolves through the same
	 * derivation `ActionInput.string` uses, so side-stepping the typed accessors
	 * degrades to the right answer instead of to the default.
	 *
	 * The documented trade: a workflow input named like an environment variable
	 * **shadows it** for bare reads — and because the derivation uppercases,
	 * any casing of the name sees the input. An unsupplied input does not
	 * shadow: the runner writes `""` for it, and the ambient provider's
	 * empty-is-absent rule (which the attempt resolves through) drops it. The
	 * `ActionInput` accessors themselves are unaffected — they read
	 * `INPUT_<MANGLED>` names, whose re-mangled form (`INPUT_INPUT_…`) never
	 * matches, so they fall through to the ambient lookup they always used.
	 *
	 * **A bare `ConfigProvider.fromEnv({ env })` here serves only runner-variable
	 * keys.** `INPUT_TARGET-BRANCH` and `PLAIN_VAR` resolve; an input-name key
	 * like `target-branch` is uppercased to `TARGET-BRANCH`, never matches, and
	 * fails green — see {@link ActionInput.provider} for the mechanism. Use
	 * `ActionInput.provider(env)`, which dual-accepts both spellings.
	 *
	 * **The single-segment retry above makes the obvious test
	 * non-discriminating**, which is worth knowing before writing one. Because a
	 * bare `Config.String("release-branch")` resolves through the same `INPUT_`
	 * derivation as `ActionInput.string("release-branch")`, a test meant to prove
	 * the accessor reads the mangled key passes just as well with the accessor
	 * swapped for a bare `Config`. Only a bare `fromEnv` underneath tells them
	 * apart — and that is the one shape you should never reach for. Test the
	 * derivation through `ActionInput.variable` instead of trying to catch it by
	 * substitution.
	 */
	static providerOver(ambient: ConfigProvider.ConfigProvider): ConfigProvider.ConfigProvider {
		return ConfigProvider.orElse(
			ConfigProvider.make((path) => {
				const name = path.length === 1 ? path[0] : undefined;
				// The attempt resolves through `ambient` rather than reading an
				// environment of its own, so there is exactly one source of values and
				// exactly one spelling of the derivation (`inputVariable`).
				return P.isString(name) ? ambient.load([inputVariable(name)]) : Effect.as(Effect.void, undefined);
			}),
			ambient,
		);
	}

	/**
	 * The provider the default action runtime installs: {@link ActionInput.providerOver}
	 * composed over the ambient environment lookup.
	 *
	 * @remarks
	 * Installed by `ActionRuntime.layer`, and therefore by `Action.run` — a bare
	 * `Config` read inside an action resolves through the runner's `INPUT_`
	 * derivation instead of silently missing. A caller-supplied
	 * `ConfigProvider` layer still wins by normal layer precedence.
	 *
	 * The ambient half is whatever provider is **explicitly installed** when the
	 * layer builds — which is how a test injects a deterministic environment, by
	 * providing `ConfigProvider.layer(ActionInput.provider(env))` beneath the
	 * runtime. Prefer `ActionInput.provider` over a bare
	 * `ConfigProvider.fromEnv({ env })`: `fromEnv` serves runner-variable keys
	 * fine, but uppercases the config path, so a record keyed by **input name**
	 * never matches and every such read silently takes its default while the
	 * suite stays green ({@link ActionInput.provider} has the full account).
	 * `ActionInput.provider` dual-accepts both spellings, so neither can miss.
	 *
	 * When none is installed, a **fresh** `ConfigProvider.fromEnv()`
	 * is built rather than reading the reference's default: core caches that
	 * default once per process, and a snapshot taken before the runner's
	 * variables are visible would resurrect exactly the missed-input class this
	 * layer exists to kill. An action's environment is fixed before the process
	 * starts, so production cannot tell the difference; a test mutating
	 * `process.env` around `Action.run` can.
	 *
	 * A bound constant rather than a factory: layers memoize by reference.
	 */
	static readonly layerDefault: Layer.Layer<never> = ConfigProvider.layer(
		Effect.map(Effect.context<never>(), (context) =>
			ActionInput.providerOver(
				Context.getOrUndefined(context, ConfigProvider.ConfigProvider) ?? ConfigProvider.fromEnv(),
			),
		),
	);
}
