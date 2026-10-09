import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as N from "effect/Number";
import * as Str from "effect/String";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type { GitConfigEditError, GitConfigParseError } from "./GitConfig.ts";
import { GitConfig } from "./GitConfig.ts";
import { serializeHeader, serializeValue } from "./internal/config.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/git/Gitmodules");

/** A value that can be rendered and scanned without a NUL-byte diagnostic. */
const GitmodulesValue = S.String.check(S.isPattern(/^[^\0]*$/u)).annotate(
	$I.annote("GitmodulesValue", { description: "A NUL-free git-config field value." }),
);

/** Git's case-folded submodule status-ignore policies. */
const SubmoduleIgnore = LiteralKit(["all", "dirty", "untracked", "none"]).annotate(
	$I.annote("SubmoduleIgnore", { description: "The supported submodule status-ignore policies." }),
);
const isSubmoduleIgnore = S.is(SubmoduleIgnore);

/** Git's base-zero integer syntax, with an optional binary size suffix. */
const GitIntegerText = S.String.check(S.isPattern(/^[ \t\n\r\v\f]*[+-]?(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)[kKmMgG]?$/)).annotate(
	$I.annote("GitIntegerText", { description: "A signed decimal, octal or hexadecimal Git integer, optionally suffixed by k, m or g." }),
);
const isGitIntegerText = S.is(GitIntegerText);

/** Git boolean text and bare keys, encoded canonically as true or false. */
const GitBoolean = S.UndefinedOr(S.String).pipe(
	S.decodeTo(S.Boolean, SchemaTransformation.transformEffect<boolean, string | undefined>({
		decode: Effect.fn("GitBoolean.decode")((value: string | undefined): Effect.Effect<boolean, SchemaIssue.Issue> => {
			if (value === undefined) return Effect.succeed(true);
			const folded = Str.toLowerCase(value);
			if (A.contains(["true", "yes", "on"], folded)) return Effect.succeed(true);
			if (A.contains(["", "false", "no", "off"], folded)) return Effect.succeed(false);
			const invalid = () => Effect.fail(new SchemaIssue.InvalidValue({ message: "Expected a Git boolean or a signed 32-bit Git integer" }, value));
			if (!isGitIntegerText(value)) return invalid();
			const integer = Str.replace(/^[+-]/, "")(Str.trimStart(folded));
			const suffix = integer[integer.length - 1];
			const multiplier = suffix === "k" ? 1024 : suffix === "m" ? 1048576 : suffix === "g" ? 1073741824 : 1;
			const digits = multiplier === 1 ? integer : Str.slice(0, -1)(integer);
			const normalized = /^0[0-7]+$/.test(digits) ? `0o${digits}` : digits;
			const parsed = N.parse(normalized);
			if (O.isNone(parsed)) return invalid();
			const signed = parsed.value * multiplier * (Str.startsWith("-")(Str.trimStart(folded)) ? -1 : 1);
			return signed < -2147483648 || signed > 2147483647 ? invalid() : Effect.succeed(signed !== 0);
		}),
		encode: (value) => Effect.succeed(value ? "true" : "false"),
	})),
).annotate($I.annote("GitBoolean", { description: "Git boolean words, integer spellings and bare-key semantics." }));
const decodeGitBoolean = S.decodeUnknownOption(GitBoolean);

/**
 * One `[submodule "<name>"]` entry of a `.gitmodules` document, decoded into
 * typed fields.
 *
 * **Example** (Construct a submodule entry)
 *
 * ```ts
 * import { GitmodulesEntry } from "@beep/scratchpad/effected/git/Gitmodules"
 *
 * const entry = GitmodulesEntry.make({ name: "lib", path: "vendor/lib", url: "../lib.git" })
 * console.log(entry.path) // vendor/lib
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitmodulesEntry extends S.Class<GitmodulesEntry>($I`GitmodulesEntry`)({
	/**
  * The submodule's logical name — the section's subsection, case-sensitive.
  *
  * **Gotchas**
  *
  * Constrained to exclude newline, carriage return and NUL: `render` quotes
  * and escapes header names for `"` and `\` only (git's subsection grammar
  * has no newline escape), so an unconstrained name could serialize a
  * document that does not re-parse to the same entries. The parse side can
  * never produce such a name — the scanner refuses a header broken across
  * lines — so the check bites only on hand-built entries, matching
  * `GitConfig.addSection`'s refusal of `[\n\r\0]` subsections.
  */
	name: S.String.check(S.isPattern(/^[^\n\r\0]*$/u)).annotateKey({ description: "The submodule's logical name — the section's subsection, case-sensitive." }),
	/** The submodule's path relative to the superproject root (`submodule.<name>.path`). */
	path: GitmodulesValue.annotateKey({ description: "The submodule's path relative to the superproject root (`submodule.<name>.path`)." }),
	/** The submodule's remote URL (`submodule.<name>.url`). */
	url: GitmodulesValue.annotateKey({ description: "The submodule's remote URL (`submodule.<name>.url`)." }),
	/** The branch the submodule tracks (`submodule.<name>.branch`), when recorded. */
	branch: S.optionalKey(GitmodulesValue).annotateKey({ description: "The branch the submodule tracks (`submodule.<name>.branch`), when recorded." }),
	/** Whether the submodule clones shallow (`submodule.<name>.shallow`), when recorded. */
	shallow: S.optionalKey(S.Boolean).annotateKey({ description: "Whether the submodule clones shallow (`submodule.<name>.shallow`), when recorded." }),
	/**
	 * The update strategy (`submodule.<name>.update`), when recorded. Kept as a
	 * raw string deliberately: beyond `checkout`/`rebase`/`merge`/`none` git
	 * accepts arbitrary `!command` values, so a literal union would reject
	 * valid documents.
	 */
	update: S.optionalKey(GitmodulesValue).annotateKey({ description: "The update strategy (`submodule.<name>.update`), when recorded. Kept as a raw string deliberately: beyond `checkout`/`rebase`/`merge`/`none` git accepts arbitrary `!command` values, so a literal union would reject valid documents." }),
	/** The status-ignore policy (`submodule.<name>.ignore`), when recorded. */
	ignore: S.optionalKey(SubmoduleIgnore).annotateKey({ description: "The status-ignore policy (`submodule.<name>.ignore`), when recorded." }),
	/** Whether fetch recurses into the submodule (`submodule.<name>.fetchRecurseSubmodules`), when recorded. */
	fetchRecurseSubmodules: S.optionalKey(S.Union([S.Boolean, S.Literal("on-demand")])).annotateKey({ description: "Whether fetch recurses into the submodule (`submodule.<name>.fetchRecurseSubmodules`), when recorded." }),
}, $I.annote("GitmodulesEntry", { description: "One `[submodule \"<name>\"]` entry of a `.gitmodules` document, decoded into typed fields." })) {}

/**
 * A `[submodule]` section could not be decoded into a {@link GitmodulesEntry}.
 *
 * **Example** (Describe a missing submodule path)
 *
 * ```ts
 * import { GitmodulesDecodeError } from "@beep/scratchpad/effected/git/Gitmodules"
 *
 * const error = GitmodulesDecodeError.make({ name: "lib", reason: "missingPath" })
 * console.log(error.message) // submodule "lib" has no path
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitmodulesDecodeError extends S.TaggedError<GitmodulesDecodeError>($I`GitmodulesDecodeError`)("GitmodulesDecodeError", {
	/** The submodule name (the section's subsection) that failed to decode. */
	name: S.String.annotateKey({ description: "The submodule name (the section's subsection) that failed to decode." }),
	/** The field the failure is about, when it is field-specific. */
	field: S.optionalKey(S.String).annotateKey({ description: "The field the failure is about, when it is field-specific." }),
	/** The offending raw value, when there was one. */
	value: S.optionalKey(S.String).annotateKey({ description: "The offending raw value, when there was one." }),
	/** What went wrong. */
	reason: S.Literals(["missingPath", "missingUrl", "invalidValue"]).annotateKey({ description: "What went wrong." }),
}, $I.annote("GitmodulesDecodeError", { description: "A `[submodule]` section could not be decoded into a GitmodulesEntry." })) {
	/**
	 *  Renders the failing submodule and field into a one-line message. 
	 *
	 * **Example** (Read a missing URL diagnostic)
	 *
	 * ```ts
	 * import { GitmodulesDecodeError } from "@beep/scratchpad/effected/git/Gitmodules"
	 *
	 * const error = GitmodulesDecodeError.make({ name: "lib", reason: "missingUrl" })
	 * console.log(error.message) // submodule "lib" has no url
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return this.reason === "missingPath"
			? `submodule "${this.name}" has no path`
			: this.reason === "missingUrl"
				? `submodule "${this.name}" has no url`
				: `submodule "${this.name}": invalid value ${JSON.stringify(this.value ?? "")} for ${this.field ?? "a field"}`;
	}
}

/**
 * Everything {@link Gitmodules.parseResult} can fail with: the text failed to
 * parse as git-config at all, or a submodule section failed to decode.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type GitmodulesParseError = GitConfigParseError | GitmodulesDecodeError;

/**
 * Renders entry fields as a canonical `.gitmodules` document — shared by the
 * instance `stringify` and `FromString`'s encode direction so the two cannot
 * drift. Accepts the ENCODED field shape, which a decoded instance satisfies
 * structurally.
 */
const render = (fields: (typeof Gitmodules)["Encoded"]): string => {
	const lines: Array<string> = [];
	for (const entry of fields.entries) {
		lines.push(serializeHeader("submodule", entry.name));
		lines.push(`\tpath = ${serializeValue(entry.path)}`);
		lines.push(`\turl = ${serializeValue(entry.url)}`);
		if (entry.branch !== undefined) lines.push(`\tbranch = ${serializeValue(entry.branch)}`);
		if (entry.shallow !== undefined) lines.push(`\tshallow = ${entry.shallow ? "true" : "false"}`);
		if (entry.update !== undefined) lines.push(`\tupdate = ${serializeValue(entry.update)}`);
		if (entry.ignore !== undefined) lines.push(`\tignore = ${entry.ignore}`);
		if (entry.fetchRecurseSubmodules !== undefined) {
			const value =
				entry.fetchRecurseSubmodules === "on-demand" ? "on-demand" : entry.fetchRecurseSubmodules ? "true" : "false";
			lines.push(`\tfetchRecurseSubmodules = ${value}`);
		}
	}
	return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
};

/**
 * The typed view over a `.gitmodules` document: the decoded submodule
 * entries, in first-appearance order.
 *
 * **Details**
 *
 * This class is the READ side. The write side deliberately does not go
 * through it: entry-level mutations ({@link Gitmodules.setUrl} and friends)
 * take a {@link GitConfig} document and compile into its surgical edits, so
 * git's own formatting — comments, ordering, indentation — survives a
 * mutation. Use `stringify`/`FromString`'s encode direction only when a
 * canonical, freshly-rendered document is wanted (there is no source
 * formatting to preserve).
 *
 * **Example** (Inspect decoded entries)
 *
 * ```ts
 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
 * import * as Result from "effect/Result"
 *
 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
 * const modules = Result.getOrThrow(Gitmodules.parseResult(text))
 * console.log(modules.entries[0]?.name) // lib
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Gitmodules extends S.Class<Gitmodules>($I`Gitmodules`)({
	/** The decoded submodule entries, in first-appearance order. */
	entries: S.Array(GitmodulesEntry).check(S.makeFilter(
		(entries) => A.dedupe(A.map(entries, (entry) => entry.name)).length === entries.length,
		$I.annote("UniqueSubmoduleNames", { title: "Unique submodule names", description: "Submodule entries must have distinct case-sensitive names." }),
	)).annotateKey({ description: "The decoded submodule entries, in first-appearance order." }),
}, $I.annote("Gitmodules", { description: "The typed view over a `.gitmodules` document: the decoded submodule entries, in first-appearance order." })) {
	/**
	 * Decodes an already-parsed git-config document into submodule entries —
	 * the pure, synchronous primitive.
	 *
	 * **Details**
	 *
	 * Sections named `submodule` (case-insensitively) with a subsection are
	 * decoded; duplicate sections for one name merge with git's last-wins
	 * read semantics. An entry missing `path` or `url`, or carrying an
	 * undecodable `shallow`/`ignore`/`fetchRecurseSubmodules` value, fails
	 * typed.
	 *
	 * **Example** (Decode a parsed config)
	 *
	 * ```ts
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const modules = Result.getOrThrow(Gitmodules.fromConfigResult(config))
	 * console.log(modules.entries[0]?.url) // ../lib.git
	 * ```
	 *
	 * @category decoding
	 * @since 0.0.0
	 */
	static fromConfigResult(config: GitConfig): Result.Result<Gitmodules, GitmodulesDecodeError> {
		interface Collected {
			readonly name: string;
			/** key (lowercased) → raw value; `null` marks git's bare boolean-true shorthand. */
			readonly fields: MutableHashMap.MutableHashMap<string, string | null>;
		}
		const byName = MutableHashMap.empty<string, Collected>();
		for (const section of config.sections) {
			if (section.name.toLowerCase() !== "submodule" || section.subsection === undefined) continue;
			const collected = O.getOrElse(MutableHashMap.get(byName, section.subsection), () => ({
				name: section.subsection,
				fields: MutableHashMap.empty<string, string | null>(),
			}));
			for (const entry of section.entries) {
				MutableHashMap.set(collected.fields, entry.key.toLowerCase(), entry.value ?? null);
			}
			MutableHashMap.set(byName, section.subsection, collected);
		}
		const entries: Array<GitmodulesEntry> = [];
		for (const { name, fields } of MutableHashMap.values(byName)) {
			const raw = (key: string): string | null | undefined => O.getOrUndefined(MutableHashMap.get(fields, key));
			const invalid = (field: string, value: string | null): GitmodulesDecodeError =>
				GitmodulesDecodeError.make({
					name,
					field,
					...(value !== null ? { value } : {}),
					reason: "invalidValue",
				});
			const path = raw("path");
			if (path === undefined || path === null) {
				return Result.fail(GitmodulesDecodeError.make({ name, field: "path", reason: "missingPath" }));
			}
			const url = raw("url");
			if (url === undefined || url === null) {
				return Result.fail(GitmodulesDecodeError.make({ name, field: "url", reason: "missingUrl" }));
			}
			const branch = raw("branch");
			if (branch === null) return Result.fail(invalid("branch", branch));
			const update = raw("update");
			if (update === null) return Result.fail(invalid("update", update));
			let shallow: boolean | undefined;
			const shallowRaw = raw("shallow");
			if (shallowRaw !== undefined) {
				const decoded = decodeGitBoolean(shallowRaw ?? undefined);
				if (O.isNone(decoded)) return Result.fail(invalid("shallow", shallowRaw));
				shallow = decoded.value;
			}
			let ignore: GitmodulesEntry["ignore"];
			const ignoreRaw = raw("ignore");
			if (ignoreRaw !== undefined) {
				if (ignoreRaw === null) return Result.fail(invalid("ignore", ignoreRaw));
				const folded = ignoreRaw.toLowerCase();
				if (!isSubmoduleIgnore(folded)) return Result.fail(invalid("ignore", ignoreRaw));
				ignore = folded;
			}
			let fetchRecurse: GitmodulesEntry["fetchRecurseSubmodules"];
			const fetchRaw = raw("fetchrecursesubmodules");
			if (fetchRaw !== undefined) {
				if (fetchRaw !== null && fetchRaw.toLowerCase() === "on-demand") {
					fetchRecurse = "on-demand";
				} else {
					const decoded = decodeGitBoolean(fetchRaw ?? undefined);
					if (O.isNone(decoded)) return Result.fail(invalid("fetchRecurseSubmodules", fetchRaw));
					fetchRecurse = decoded.value;
				}
			}
			entries.push(
				GitmodulesEntry.make({
					name,
					path,
					url,
					...O.getSomesStruct({ branch: O.fromUndefinedOr(branch) }),
					...O.getSomesStruct({ shallow: O.fromUndefinedOr(shallow) }),
					...O.getSomesStruct({ update: O.fromUndefinedOr(update) }),
					...O.getSomesStruct({ ignore: O.fromUndefinedOr(ignore) }),
					...O.getSomesStruct({ fetchRecurseSubmodules: O.fromUndefinedOr(fetchRecurse) }),
				}),
			);
		}
		return Result.succeed(Gitmodules.make({ entries }));
	}

	/**
	 * Parses `.gitmodules` text into the typed view — the pure, synchronous
	 * primitive over {@link GitConfig.parseResult} plus
	 * {@link Gitmodules.fromConfigResult}.
	 *
	 * **Example** (Parse a submodule synchronously)
	 *
	 * ```ts
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const modules = Result.getOrThrow(Gitmodules.parseResult(text))
	 * console.log(modules.entries[0]?.path) // lib
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(text: string): Result.Result<Gitmodules, GitmodulesParseError> {
		const config = GitConfig.parseResult(text);
		if (Result.isFailure(config)) return Result.fail(config.failure);
		return Gitmodules.fromConfigResult(config.success);
	}

	/**
	 * Parses `.gitmodules` text into the typed view.
	 *
	 * **Details**
	 *
	 * Defined in terms of {@link Gitmodules.parseResult} — synchronous callers
	 * can use that variant directly.
	 *
	 * **Example** (Run the submodule parser)
	 *
	 * ```ts
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import * as Effect from "effect/Effect"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const modules = Effect.runSync(Gitmodules.parse(text))
	 * console.log(modules.entries[0]?.url) // ../lib.git
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("Gitmodules.parse")((text: string) =>
		Effect.fromResult(Gitmodules.parseResult(text)),
	);

	/**
	 * Renders the entries as a canonical `.gitmodules` document.
	 *
	 * **Gotchas**
	 *
	 * This is a fresh, canonical rendering — one section per entry, tabs, a
	 * fixed field order — NOT a lossless round-trip of any source document.
	 * To mutate an existing `.gitmodules` while preserving its formatting,
	 * compile entry-level mutations into {@link GitConfig} edits instead
	 * ({@link Gitmodules.setUrl} and friends).
	 *
	 * **Example** (Render canonical submodule text)
	 *
	 * ```ts
	 * import { Gitmodules, GitmodulesEntry } from "@beep/scratchpad/effected/git/Gitmodules"
	 *
	 * const modules = Gitmodules.make({
	 *   entries: [GitmodulesEntry.make({ name: "lib", path: "lib", url: "../lib.git" })]
	 * })
	 * console.log(JSON.stringify(modules.stringify())) // "[submodule \"lib\"]\n\tpath = lib\n\turl = ../lib.git\n"
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	stringify(): string {
		return render(this);
	}

	/**
	 * Schema transformation between `.gitmodules` text and the typed view:
	 * decoding parses (and fails on the first undecodable entry), encoding
	 * renders the canonical document per {@link Gitmodules.stringify}.
	 *
	 * **Example** (Decode submodule text with a codec)
	 *
	 * ```ts
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import * as S from "effect/Schema"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const modules = S.decodeUnknownSync(Gitmodules.FromString)(text)
	 * console.log(modules.entries[0]?.name) // lib
	 * ```
	 *
	 * @category codecs
	 * @since 0.0.0
	 */
	static readonly FromString: S.Codec<Gitmodules, string> = S.String.pipe(
		S.decodeTo(
			Gitmodules,
			// The type parameters are pinned to the ENCODED side explicitly:
			// `decodeTo` unifies the transformation against the target's Encoded
			// type, which no longer satisfies the method-bearing instance type
			// once the class carries `stringify`.
			SchemaTransformation.transformEffect<(typeof Gitmodules)["Encoded"], string>({
				decode: (text: string) => {
					const result = Gitmodules.parseResult(text);
					return Result.isSuccess(result)
						? Effect.succeed(result.success)
						: Effect.fail(new SchemaIssue.InvalidValue({ message: result.failure.message }, text));
				},
				encode: (fields) => Effect.succeed(render(fields)),
			}),
		),
	);

	/**
	 * Rewrites `submodule.<name>.url` in the document — a surgical
	 * {@link GitConfig.set}, so git's own formatting survives.
	 *
	 * **Example** (Rewrite a submodule URL)
	 *
	 * ```ts
	 * import * as O from "effect/Option"
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const edited = Result.getOrThrow(Gitmodules.setUrl(config, "lib", "../new.git"))
	 * console.log(O.getOrNull(edited.get("submodule", "lib", "url"))) // ../new.git
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static setUrl(config: GitConfig, name: string, url: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.set("submodule", name, "url", url);
	}

	/**
	 *  Rewrites `submodule.<name>.path` in the document, surgically. 
	 *
	 * **Example** (Rewrite a submodule path)
	 *
	 * ```ts
	 * import * as O from "effect/Option"
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const edited = Result.getOrThrow(Gitmodules.setPath(config, "lib", "vendor/lib"))
	 * console.log(O.getOrNull(edited.get("submodule", "lib", "path"))) // vendor/lib
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static setPath(config: GitConfig, name: string, path: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.set("submodule", name, "path", path);
	}

	/**
	 * Records (or, with `branch` omitted, removes) `submodule.<name>.branch`,
	 * surgically.
	 *
	 * **Example** (Record a tracking branch)
	 *
	 * ```ts
	 * import * as O from "effect/Option"
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const edited = Result.getOrThrow(Gitmodules.setBranch(config, "lib", "main"))
	 * console.log(O.getOrNull(edited.get("submodule", "lib", "branch"))) // main
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static setBranch(config: GitConfig, name: string, branch?: string): Result.Result<GitConfig, GitConfigEditError> {
		return branch === undefined
			? config.unset("submodule", name, "branch")
			: config.set("submodule", name, "branch", branch);
	}

	/**
	 * Records (or, with `shallow` omitted, removes) `submodule.<name>.shallow`,
	 * surgically.
	 *
	 * **Example** (Record shallow cloning)
	 *
	 * ```ts
	 * import * as O from "effect/Option"
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const edited = Result.getOrThrow(Gitmodules.setShallow(config, "lib", true))
	 * console.log(O.getOrNull(edited.get("submodule", "lib", "shallow"))) // true
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static setShallow(config: GitConfig, name: string, shallow?: boolean): Result.Result<GitConfig, GitConfigEditError> {
		return shallow === undefined
			? config.unset("submodule", name, "shallow")
			: config.set("submodule", name, "shallow", shallow ? "true" : "false");
	}

	/**
	 * Adds a whole entry as a new `[submodule "<name>"]` section at the end of
	 * the document, field by field through the surgical editor.
	 *
	 * **Example** (Append a submodule entry)
	 *
	 * ```ts
	 * import { Gitmodules, GitmodulesEntry } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 * import * as O from "effect/Option"
	 *
	 * const config = Result.getOrThrow(GitConfig.parseResult(""))
	 * const entry = GitmodulesEntry.make({ name: "lib", path: "lib", url: "../lib.git" })
	 * const edited = Result.getOrThrow(Gitmodules.add(config, entry))
	 * console.log(O.getOrNull(edited.get("submodule", "lib", "path"))) // lib
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static add(config: GitConfig, entry: GitmodulesEntry): Result.Result<GitConfig, GitConfigEditError> {
		let result = config.addSection("submodule", entry.name);
		const steps: ReadonlyArray<readonly [string, string | undefined]> = [
			["path", entry.path],
			["url", entry.url],
			["branch", entry.branch],
			["shallow", entry.shallow === undefined ? undefined : entry.shallow ? "true" : "false"],
			["update", entry.update],
			["ignore", entry.ignore],
			[
				"fetchRecurseSubmodules",
				entry.fetchRecurseSubmodules === undefined
					? undefined
					: entry.fetchRecurseSubmodules === "on-demand"
						? "on-demand"
						: entry.fetchRecurseSubmodules
							? "true"
							: "false",
			],
		];
		for (const [key, value] of steps) {
			if (Result.isFailure(result) || value === undefined) continue;
			result = result.success.set("submodule", entry.name, key, value);
		}
		return result;
	}

	/**
	 *  Removes every `[submodule "<name>"]` section from the document, surgically. 
	 *
	 * **Example** (Remove all sections for a submodule)
	 *
	 * ```ts
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const edited = Result.getOrThrow(Gitmodules.remove(config, "lib"))
	 * console.log(edited.stringify() === "") // true
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static remove(config: GitConfig, name: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.removeSection("submodule", name);
	}

	/**
	 * Renames the submodule's section header(s) from `oldName` to `newName`,
	 * leaving every field line untouched.
	 *
	 * **Gotchas**
	 *
	 * This renames the `.gitmodules` section ONLY. A full submodule rename is
	 * a multi-step sequence (worktree move, `.git/modules` move, gitdir
	 * pointer, `core.worktree`, index restage) that belongs to the caller.
	 *
	 * **Example** (Rename a submodule section)
	 *
	 * ```ts
	 * import * as O from "effect/Option"
	 * import { Gitmodules } from "@beep/scratchpad/effected/git/Gitmodules"
	 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig"
	 * import * as Result from "effect/Result"
	 *
	 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
	 * const config = Result.getOrThrow(GitConfig.parseResult(text))
	 * const edited = Result.getOrThrow(Gitmodules.rename(config, "lib", "library"))
	 * console.log(O.getOrNull(edited.get("submodule", "library", "path"))) // lib
	 * ```
	 *
	 * @category setters
	 * @since 0.0.0
	 */
	static rename(config: GitConfig, oldName: string, newName: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.renameSection("submodule", oldName, "submodule", newName);
	}
}
