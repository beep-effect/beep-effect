// Decode-free canonical sort and format. Two entry points over the same
// ordering rules, carried as statics on `PackageJsonFormat`:
// `sortValue` for value→value hosts and `formatToString` for bytes→bytes
// hosts, mirroring the two shapes `sort-package-json` offers.
//
// The class shape and the `formatToString` name are the kit formatter
// convention, already spelled the same way by `JsoncFormatter`, `YamlFormat`
// and `TomlFormat` — a consumer who has met one kit formatter has met all
// four. `sortValue` carries the value→value shape that only this package
// needs.
//
// This is a capability distinct from `Package.toJsonString`, not a weakening of
// it — the strict path keeps its guarantees exactly, and a caller picks between
// them by name at the call site. Nothing here decodes, so nothing here can
// normalize: field encodings that the model would canonicalize (string-form
// `author` shorthand above all) survive untouched because they are never
// looked at.

import { $ScratchpadId } from "@beep/identity/packages";
import type { JsoncPath } from "../jsonc/index.ts";
import { JsoncEdit, JsoncModifier } from "../jsonc/index.ts";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { detectIndent, renderJson, resolveIndent, sortKeys } from "./internal/format.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/package-json/PackageJsonFormat");

const Json = S.fromJsonString(S.Unknown);

/**
 * Indicates that a text input could not be treated as a package.json document:
 * either it is not valid JSON (`"invalid-json"`, carrying the schema
 * decoding error on `cause`) or it parsed to something other than a JSON object
 * (`"not-an-object"` — an array, a scalar or `null`).
 *
 * Raised by {@link PackageJsonFormat.formatToString}. This is a *syntactic*
 * failure only; it says nothing about whether the document is a valid package
 * manifest, which the decode-free path deliberately does not check.
 *
 * @public
 */
export class PackageJsonSyntaxError extends S.TaggedError<PackageJsonSyntaxError>($I`PackageJsonSyntaxError`)("PackageJsonSyntaxError", {
	/** Which syntactic precondition failed. */
	reason: S.Literals(["invalid-json", "not-an-object"]).annotateKey({ description: "Which syntactic precondition failed." }),
	/** The schema decoding error for `"invalid-json"`, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The schema decoding error for `\"invalid-json\"`, preserved structurally." }),
}, $I.annote("PackageJsonSyntaxError", { description: "Indicates that a text input could not be treated as a package.json document: either it is not valid JSON (`\"invalid-json\"`, carrying the schema decoding error on `cause`) or it parsed to something other than a JSON object (`\"not-an-object\"` — an array, a scalar or `null`)." })) {
	override get message(): string {
		return this.reason === "invalid-json"
			? "package.json text is not valid JSON"
			: "package.json text is not a JSON object";
	}
}

/**
 * Options for {@link PackageJsonFormat.formatToString}.
 *
 * Deliberately not `PackageFormatOptions`: there is no `sourceText` member,
 * because the text being formatted *is* the source text, and the defaults for
 * `indent` and `stripEmpty` differ — see each member.
 *
 * @public
 */
export interface PackageFormatTextOptions {
	/**
	 * Indentation: a spaces count, `"tab"`, or `"preserve"`. Defaults to
	 * `"preserve"` — unlike `Package.toJsonString`, this path always has the
	 * original text in hand, and reformatting a file in place should not
	 * silently restyle its indentation.
	 */
	readonly indent?: number | "tab" | "preserve";
	/** Order top-level keys canonically and alphabetize dependency maps (default `true`). */
	readonly sort?: boolean;
	/**
	 * Strip dependency-map keys whose value is an empty object (default
	 * `false`). The strict path defaults this on because the model materializes
	 * absent maps as empty ones; here an empty map is a key the author actually
	 * wrote, and removing it would be a silent edit rather than a format.
	 */
	readonly stripEmpty?: boolean;
	/** Append a trailing newline (default `true`). */
	readonly newline?: boolean;
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
	P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value);

/**
 * Indicates that a surgical modification could not be applied: the value on
 * the navigation path is not the container kind the next path segment
 * requires. The underlying `@effected/jsonc` `JsoncModificationError` —
 * which names the expected container and the 1-based depth of the mismatch —
 * is preserved on the structured `cause` field, never stringified.
 *
 * Raised by {@link PackageJsonFormat.modify} and
 * {@link PackageJsonFormat.modifyToString}.
 *
 * @public
 */
export class PackageJsonModifyError extends S.TaggedError<PackageJsonModifyError>($I`PackageJsonModifyError`)("PackageJsonModifyError", {
	/** The field path whose navigation failed. */
	path: S.Array(S.Union([S.String, S.Finite])).annotateKey({ description: "The field path whose navigation failed." }),
	/** The underlying `JsoncModificationError`, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying `JsoncModificationError`, preserved structurally." }),
}, $I.annote("PackageJsonModifyError", { description: "Indicates that a surgical modification could not be applied: the value on the navigation path is not the container kind the next path segment requires. The underlying `@effected/jsonc` `JsoncModificationError` — which names the expected container and the 1-based depth of the mismatch — is preserved on the structured `cause` field, never stringified." })) {
	override get message(): string {
		return `Failed to modify package.json at path [${this.path.join(", ")}]`;
	}
}

/**
 * Decode-free canonical sort and format statics. Not instantiable.
 *
 * @remarks
 * The guarantee both statics make is that they are **source-preserving**:
 * neither decodes into a `Package`, so neither can normalize a field encoding.
 * String-form `author` shorthand, unknown fields, unusual value shapes and
 * empty maps all survive untouched, because they are never looked at. Key
 * order, indentation and the trailing newline are the only things that change.
 *
 * That is what makes this usable as a lint-hook handler where the strict path
 * is not: any syntactically valid JSON object formats, including the
 * version-less workspace roots and `{"private": true}` manifests that
 * `Package.decode` rejects. Reach for `Package.decode` +
 * `Package.toJsonString` instead when the job needs the validated model and an
 * invalid manifest should fail loudly.
 *
 * @public
 */
export class PackageJsonFormat {
	private constructor() {}

	/**
	 * Order a package.json object's keys canonically **without decoding it into
	 * a `Package`**: known top-level keys in `sort-package-json`'s order, then
	 * unknown public keys alphabetically, then `_`-prefixed keys, with the
	 * dependency maps and `scripts` / `engines` / `bin` alphabetized.
	 *
	 * Value in, value out — for hosts that already hold parsed JSON and never
	 * want a string. {@link PackageJsonFormat.formatToString} is the same
	 * ordering for hosts holding file text. Pure and total.
	 *
	 * Returns a new object; nested values are shared by reference rather than
	 * cloned, except the maps whose own keys are reordered. A value that is not
	 * a JSON object (an array, a scalar, `null`) is returned unchanged rather
	 * than mangled, so a mistyped `Json` union cannot silently lose data.
	 *
	 * Reordering keys is the whole of it — **no key is ever added or removed**,
	 * which is what lets the return type be the input type `T` and makes this a
	 * drop-in. Use {@link PackageJsonFormat.formatToString} with `stripEmpty`
	 * when removing empty maps is wanted; it returns a string and so carries no
	 * such obligation.
	 *
	 * @param value - the parsed package.json object
	 * @returns a new object with canonically ordered keys
	 *
	 * @example
	 * ```ts
	 * import { PackageJsonFormat } from "./index.ts";
	 *
	 * const sorted = PackageJsonFormat.sortValue({ version: "1.0.0", name: "p" });
	 * // => { name: "p", version: "1.0.0" }
	 * ```
	 */
	static sortValue<T extends { readonly [k: string]: unknown }>(value: T): T;
	static sortValue(value: { readonly [k: string]: unknown }): { readonly [k: string]: unknown } {
		if (!isJsonObject(value)) return value;
		return sortKeys(value);
	}

	/**
	 * Sort and format package.json text **without decoding it into a
	 * `Package`**. Text in, text out — for hosts that hold file contents and
	 * cannot afford a decode. {@link PackageJsonFormat.sortValue} is the same
	 * ordering for hosts that already hold parsed JSON.
	 *
	 * Any syntactically valid JSON object formats, whatever it contains: a
	 * version-less root, `{"private": true}`, a malformed `packageManager`
	 * integrity. Nothing is decoded, so nothing is normalized — string-form
	 * `author` shorthand, unknown fields, unusual value shapes and empty maps
	 * all survive byte-for-byte. Only key order, indentation and the trailing
	 * newline change.
	 *
	 * Pure and synchronous: it returns a `Result` rather than an `Effect`, so
	 * synchronous hosts can call it directly. Lift it with `Effect.fromResult`.
	 *
	 * @param source - the package.json file contents
	 * @param options - formatting options; see {@link PackageFormatTextOptions}
	 * @returns the formatted text, or a {@link PackageJsonSyntaxError}
	 *
	 * @example
	 * ```ts
	 * import { PackageJsonFormat } from "./index.ts";
	 * import * as Effect from "effect/Effect";
	 * import * as Result from "effect/Result";
	 *
	 * const formatted = PackageJsonFormat.formatToString('{"private": true}');
	 * if (Result.isSuccess(formatted)) console.log(formatted.success);
	 *
	 * // In an Effect program:
	 * const program = Effect.fromResult(PackageJsonFormat.formatToString('{"private": true}'));
	 * ```
	 */
	static formatToString(
		source: string,
		options?: PackageFormatTextOptions,
	): Result.Result<string, PackageJsonSyntaxError> {
		// Shares `sortKeys` with `sortValue` via `renderJson`, so the two entry
		// points cannot drift in ordering.
		const decoded = S.decodeResult(Json)(source);
		if (Result.isFailure(decoded)) {
			return Result.fail(PackageJsonSyntaxError.make({ reason: "invalid-json", cause: decoded.failure }));
		}
		const parsed = decoded.success;
		if (!isJsonObject(parsed)) {
			return Result.fail(PackageJsonSyntaxError.make({ reason: "not-an-object" }));
		}
		return Result.succeed(
			renderJson(parsed, {
				indent: resolveIndent(options?.indent ?? "preserve", source),
				sort: options?.sort ?? true,
				stripEmpty: options?.stripEmpty ?? false,
				newline: options?.newline ?? true,
			}),
		);
	}

	/**
	 * Compute the surgical edits that set, replace or delete the value at
	 * `path` **without decoding, sorting or reformatting anything else**. The
	 * opposite posture to {@link PackageJsonFormat.formatToString}: where the
	 * formatter's job is the canonical order, the mutator's job is to leave
	 * every untouched byte untouched — key order, indentation, line endings and
	 * the trailing newline all survive, because only the edited span changes.
	 * That is what makes the result reviewable when a tool commits a one-field
	 * change to someone else's repository.
	 *
	 * Built on `@effected/jsonc`'s scanner-based edit engine. Inserted content
	 * matches the source's own style: indentation (tab vs N spaces) is detected
	 * from the first indented line and the line ending from the first `\r\n`.
	 *
	 * Passing `value === undefined` deletes the target key (including its
	 * comma) — the `@effected/jsonc` / `@effected/yaml` modify convention. A
	 * missing insertion target appends after the last key of its container.
	 *
	 * @param source - the package.json file contents (strict JSON — npm does
	 *   not accept comments, and neither does this)
	 * @param path - the field path, e.g. `["packageManager"]` or
	 *   `["devEngines", "runtime", "version"]`
	 * @param value - the plain JSON value to write, or `undefined` to delete
	 * @returns the edits to apply via `JsoncEdit.applyAll` — or use
	 *   {@link PackageJsonFormat.modifyToString} for the applied text in one step
	 */
	static readonly modify = Effect.fn("PackageJsonFormat.modify")(function* (
		source: string,
		path: JsoncPath,
		value: unknown,
	) {
		// package.json is strict JSON; a syntactic precondition keeps garbage
		// input a typed failure instead of undefined scanner behavior.
		const parsed = yield* S.decodeEffect(Json)(source).pipe(
			Effect.mapError((cause) => PackageJsonSyntaxError.make({ reason: "invalid-json", cause })),
		);
		if (!isJsonObject(parsed)) {
			return yield* PackageJsonSyntaxError.make({ reason: "not-an-object" });
		}
		const indent = detectIndent(source);
		const formattingOptions = {
			insertSpaces: indent !== "\t",
			tabSize: indent === undefined || indent === "\t" ? 2 : indent.length,
			eol: source.includes("\r\n") ? "\r\n" : "\n",
		};
		return yield* JsoncModifier.modify(source, path, value, { formattingOptions }).pipe(
			Effect.catchTag("JsoncModificationError", (cause) => PackageJsonModifyError.make({ path, cause })),
		);
	});

	/**
	 * Modify `source` and apply the resulting edits in one step
	 * (`JsoncEdit.applyAll` composed over {@link PackageJsonFormat.modify}).
	 * Text in, text out; every byte outside the edited span is preserved.
	 * Inherits the modify error channel: {@link PackageJsonSyntaxError} when
	 * the source is not a JSON object, {@link PackageJsonModifyError} when the
	 * path cannot be navigated.
	 *
	 * @example
	 * ```ts
	 * import { PackageJsonFormat } from "./index.ts";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = PackageJsonFormat.modifyToString(
	 *   '{\n  "private": true,\n  "packageManager": "pnpm@11.2.0"\n}\n',
	 *   ["packageManager"],
	 *   "pnpm@11.3.0",
	 * ); // only the packageManager value changes; every other byte survives
	 * ```
	 */
	static readonly modifyToString = Effect.fn("PackageJsonFormat.modifyToString")(function* (
		source: string,
		path: JsoncPath,
		value: unknown,
	) {
		const edits = yield* PackageJsonFormat.modify(source, path, value);
		return JsoncEdit.applyAll(source, edits);
	});
}
