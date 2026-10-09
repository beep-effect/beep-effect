import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type { GitConfigEditError, GitConfigParseError } from "./GitConfig.ts";
import { GitConfig } from "./GitConfig.ts";
import { serializeHeader, serializeValue } from "./internal/config.ts";

/**
 * One `[submodule "<name>"]` entry of a `.gitmodules` document, decoded into
 * typed fields.
 *
 * @public
 */
export class GitmodulesEntry extends S.Class<GitmodulesEntry>("GitmodulesEntry")({
	/**
	 * The submodule's logical name — the section's subsection, case-sensitive.
	 *
	 * @remarks
	 * Constrained to exclude newline, carriage return and NUL: `render` quotes
	 * and escapes header names for `"` and `\` only (git's subsection grammar
	 * has no newline escape), so an unconstrained name could serialize a
	 * document that does not re-parse to the same entries. The parse side can
	 * never produce such a name — the scanner refuses a header broken across
	 * lines — so the check bites only on hand-built entries, matching
	 * `GitConfig.addSection`'s refusal of `[\n\r\0]` subsections.
	 */
	name: S.String.check(S.isPattern(/^[^\n\r\0]*$/u)),
	/** The submodule's path relative to the superproject root (`submodule.<name>.path`). */
	path: S.String,
	/** The submodule's remote URL (`submodule.<name>.url`). */
	url: S.String,
	/** The branch the submodule tracks (`submodule.<name>.branch`), when recorded. */
	branch: S.optionalKey(S.String),
	/** Whether the submodule clones shallow (`submodule.<name>.shallow`), when recorded. */
	shallow: S.optionalKey(S.Boolean),
	/**
	 * The update strategy (`submodule.<name>.update`), when recorded. Kept as a
	 * raw string deliberately: beyond `checkout`/`rebase`/`merge`/`none` git
	 * accepts arbitrary `!command` values, so a literal union would reject
	 * valid documents.
	 */
	update: S.optionalKey(S.String),
	/** The status-ignore policy (`submodule.<name>.ignore`), when recorded. */
	ignore: S.optionalKey(S.Literals(["all", "dirty", "untracked", "none"])),
	/** Whether fetch recurses into the submodule (`submodule.<name>.fetchRecurseSubmodules`), when recorded. */
	fetchRecurseSubmodules: S.optionalKey(S.Union([S.Boolean, S.Literal("on-demand")])),
}) {}

/**
 * A `[submodule]` section could not be decoded into a {@link GitmodulesEntry}.
 *
 * @public
 */
export class GitmodulesDecodeError extends S.TaggedError<GitmodulesDecodeError>()("GitmodulesDecodeError", {
	/** The submodule name (the section's subsection) that failed to decode. */
	name: S.String,
	/** The field the failure is about, when it is field-specific. */
	field: S.optionalKey(S.String),
	/** The offending raw value, when there was one. */
	value: S.optionalKey(S.String),
	/** What went wrong. */
	reason: S.Literals(["missingPath", "missingUrl", "invalidValue"]),
}) {
	/** Renders the failing submodule and field into a one-line message. */
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
 */
export type GitmodulesParseError = GitConfigParseError | GitmodulesDecodeError;

/** git's boolean vocabulary. `undefined` (a bare key) is boolean true. */
const parseBool = (value: string | undefined): boolean | undefined => {
	if (value === undefined) return true;
	const folded = value.toLowerCase();
	if (folded === "true" || folded === "yes" || folded === "on" || folded === "1") return true;
	if (folded === "" || folded === "false" || folded === "no" || folded === "off" || folded === "0") return false;
	return undefined;
};

const IGNORE_VALUES = ["all", "dirty", "untracked", "none"] as const;

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
 * @remarks
 * This class is the READ side. The write side deliberately does not go
 * through it: entry-level mutations ({@link Gitmodules.setUrl} and friends)
 * take a {@link GitConfig} document and compile into its surgical edits, so
 * git's own formatting — comments, ordering, indentation — survives a
 * mutation. Use `stringify`/`FromString`'s encode direction only when a
 * canonical, freshly-rendered document is wanted (there is no source
 * formatting to preserve).
 *
 * @public
 */
export class Gitmodules extends S.Class<Gitmodules>("Gitmodules")({
	/** The decoded submodule entries, in first-appearance order. */
	entries: S.Array(GitmodulesEntry),
}) {
	/**
	 * Decodes an already-parsed git-config document into submodule entries —
	 * the pure, synchronous primitive.
	 *
	 * @remarks
	 * Sections named `submodule` (case-insensitively) with a subsection are
	 * decoded; duplicate sections for one name merge with git's last-wins
	 * read semantics. An entry missing `path` or `url`, or carrying an
	 * undecodable `shallow`/`ignore`/`fetchRecurseSubmodules` value, fails
	 * typed.
	 */
	static fromConfigResult(config: GitConfig): Result.Result<Gitmodules, GitmodulesDecodeError> {
		interface Collected {
			readonly name: string;
			/** key (lowercased) → raw value; `null` marks git's bare boolean-true shorthand. */
			readonly fields: Map<string, string | null>;
		}
		const byName = new Map<string, Collected>();
		for (const section of config.sections) {
			if (section.name.toLowerCase() !== "submodule" || section.subsection === undefined) continue;
			const collected = byName.get(section.subsection) ?? { name: section.subsection, fields: new Map() };
			for (const entry of section.entries) {
				collected.fields.set(entry.key.toLowerCase(), entry.value ?? null);
			}
			byName.set(section.subsection, collected);
		}
		const entries: Array<GitmodulesEntry> = [];
		for (const { name, fields } of byName.values()) {
			const raw = (key: string): string | null | undefined => fields.get(key);
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
				shallow = parseBool(shallowRaw ?? undefined);
				if (shallow === undefined) return Result.fail(invalid("shallow", shallowRaw));
			}
			let ignore: GitmodulesEntry["ignore"];
			const ignoreRaw = raw("ignore");
			if (ignoreRaw !== undefined) {
				if (ignoreRaw === null) return Result.fail(invalid("ignore", ignoreRaw));
				const folded = ignoreRaw.toLowerCase();
				const matched = IGNORE_VALUES.find((candidate) => candidate === folded);
				if (matched === undefined) return Result.fail(invalid("ignore", ignoreRaw));
				ignore = matched;
			}
			let fetchRecurse: GitmodulesEntry["fetchRecurseSubmodules"];
			const fetchRaw = raw("fetchrecursesubmodules");
			if (fetchRaw !== undefined) {
				if (fetchRaw !== null && fetchRaw.toLowerCase() === "on-demand") {
					fetchRecurse = "on-demand";
				} else {
					fetchRecurse = parseBool(fetchRaw ?? undefined);
					if (fetchRecurse === undefined) return Result.fail(invalid("fetchRecurseSubmodules", fetchRaw));
				}
			}
			entries.push(
				GitmodulesEntry.make({
					name,
					path,
					url,
					...(branch !== undefined ? { branch } : {}),
					...(shallow !== undefined ? { shallow } : {}),
					...(update !== undefined ? { update } : {}),
					...(ignore !== undefined ? { ignore } : {}),
					...(fetchRecurse !== undefined ? { fetchRecurseSubmodules: fetchRecurse } : {}),
				}),
			);
		}
		return Result.succeed(Gitmodules.make({ entries }));
	}

	/**
	 * Parses `.gitmodules` text into the typed view — the pure, synchronous
	 * primitive over {@link GitConfig.parseResult} plus
	 * {@link Gitmodules.fromConfigResult}.
	 */
	static parseResult(text: string): Result.Result<Gitmodules, GitmodulesParseError> {
		const config = GitConfig.parseResult(text);
		if (Result.isFailure(config)) return Result.fail(config.failure);
		return Gitmodules.fromConfigResult(config.success);
	}

	/**
	 * Parses `.gitmodules` text into the typed view.
	 *
	 * @remarks
	 * Defined in terms of {@link Gitmodules.parseResult} — synchronous callers
	 * can use that variant directly.
	 */
	static readonly parse = Effect.fn("Gitmodules.parse")((text: string) =>
		Effect.fromResult(Gitmodules.parseResult(text)),
	);

	/**
	 * Renders the entries as a canonical `.gitmodules` document.
	 *
	 * @remarks
	 * This is a fresh, canonical rendering — one section per entry, tabs, a
	 * fixed field order — NOT a lossless round-trip of any source document.
	 * To mutate an existing `.gitmodules` while preserving its formatting,
	 * compile entry-level mutations into {@link GitConfig} edits instead
	 * ({@link Gitmodules.setUrl} and friends).
	 */
	stringify(): string {
		return render(this);
	}

	/**
	 * Schema transformation between `.gitmodules` text and the typed view:
	 * decoding parses (and fails on the first undecodable entry), encoding
	 * renders the canonical document per {@link Gitmodules.stringify}.
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
	 */
	static setUrl(config: GitConfig, name: string, url: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.set("submodule", name, "url", url);
	}

	/** Rewrites `submodule.<name>.path` in the document, surgically. */
	static setPath(config: GitConfig, name: string, path: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.set("submodule", name, "path", path);
	}

	/**
	 * Records (or, with `branch` omitted, removes) `submodule.<name>.branch`,
	 * surgically.
	 */
	static setBranch(config: GitConfig, name: string, branch?: string): Result.Result<GitConfig, GitConfigEditError> {
		return branch === undefined
			? config.unset("submodule", name, "branch")
			: config.set("submodule", name, "branch", branch);
	}

	/**
	 * Records (or, with `shallow` omitted, removes) `submodule.<name>.shallow`,
	 * surgically.
	 */
	static setShallow(config: GitConfig, name: string, shallow?: boolean): Result.Result<GitConfig, GitConfigEditError> {
		return shallow === undefined
			? config.unset("submodule", name, "shallow")
			: config.set("submodule", name, "shallow", shallow ? "true" : "false");
	}

	/**
	 * Adds a whole entry as a new `[submodule "<name>"]` section at the end of
	 * the document, field by field through the surgical editor.
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

	/** Removes every `[submodule "<name>"]` section from the document, surgically. */
	static remove(config: GitConfig, name: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.removeSection("submodule", name);
	}

	/**
	 * Renames the submodule's section header(s) from `oldName` to `newName`,
	 * leaving every field line untouched.
	 *
	 * @remarks
	 * This renames the `.gitmodules` section ONLY. A full submodule rename is
	 * a multi-step sequence (worktree move, `.git/modules` move, gitdir
	 * pointer, `core.worktree`, index restage) that belongs to the caller.
	 */
	static rename(config: GitConfig, oldName: string, newName: string): Result.Result<GitConfig, GitConfigEditError> {
		return config.renameSection("submodule", oldName, "submodule", newName);
	}
}
