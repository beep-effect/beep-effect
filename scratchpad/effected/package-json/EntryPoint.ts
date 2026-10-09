import { Result, Schema } from "effect";

/**
 * Options for {@link resolveEntryPoint}.
 *
 * @public
 */
export interface ResolveEntryPointOptions {
	/**
	 * The export conditions to honour, in priority order.
	 *
	 * @remarks
	 * The first condition present in the manifest wins, so the order is the
	 * policy — `["require", "import"]` and `["import", "require"]` resolve the
	 * same manifest to different files, on purpose.
	 *
	 * @defaultValue `["import", "default"]`
	 */
	readonly conditions?: ReadonlyArray<string>;
}

/**
 * Raised when a manifest resolves no root entry point.
 *
 * @remarks
 * The reason is discriminated rather than a bare "not found" because the three
 * shapes call for different responses, and a caller needs to know which one it
 * hit.
 *
 * @public
 */
export class UnresolvedEntryPointError extends Schema.TaggedError<UnresolvedEntryPointError>()(
	"UnresolvedEntryPointError",
	{
		/**
		 * `noRootExport` — `exports` is a subpath map with no `"."` entry, so the
		 * package exports subpaths but no root. `noConditionMatched` — a root
		 * entry exists but none of the requested conditions are present, e.g. a
		 * `require`-only package read with `["import"]`.
		 * `unsupportedExportsForm` — an array fallback list, or another shape this
		 * resolver does not implement.
		 */
		reason: Schema.Literals(["noRootExport", "noConditionMatched", "unsupportedExportsForm"]),
		/** The conditions that were tried, for `noConditionMatched`. */
		conditions: Schema.optionalKey(Schema.Array(Schema.String)),
	},
) {
	override get message(): string {
		switch (this.reason) {
			case "noRootExport":
				return 'The manifest\'s "exports" declares subpaths but no "." entry, so it has no root entry point';
			case "noConditionMatched":
				return `The manifest's "exports" matched none of the conditions ${JSON.stringify(this.conditions ?? [])}`;
			default:
				return 'The manifest\'s "exports" uses a form this resolver does not implement';
		}
	}
}

/**
 * The manifest fields entry resolution reads.
 *
 * @remarks
 * Deliberately structural rather than the full {@link PackageManifest}, so a
 * caller can resolve an entry point from any object carrying these two fields —
 * a manifest parsed straight from a tarball, for instance, with nothing else
 * validated yet.
 *
 * @public
 */
export interface EntryPointManifest {
	/** The `exports` field, in any of its legal shapes. */
	readonly exports?: unknown;
	/** The `main` field; consulted only when `exports` is absent. */
	readonly main?: unknown;
}

const DEFAULT_CONDITIONS: ReadonlyArray<string> = ["import", "default"];

/** A plain object — not an array, not `null`. */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Is this `exports` object a conditions map rather than a subpath map?
 *
 * @remarks
 * Node's rule: the two forms cannot be mixed, and a subpath map is identified
 * by keys starting with `"."`. So an object with no `"."`-prefixed key is
 * conditions-only sugar for the `"."` subpath. An empty object is neither — it
 * exports nothing.
 */
const isRootConditions = (exportsObject: Record<string, unknown>): boolean => {
	const keys = Object.keys(exportsObject);
	return keys.length > 0 && !keys.some((key) => key.startsWith("."));
};

/**
 * Resolve a conditions object to a file, honouring `conditions` in order.
 *
 * @remarks
 * Recurses, because conditions nest: `{ "import": { "node": "./n.js" } }` is
 * legal and a non-recursive reader answers an object where a path belongs.
 */
const resolveConditions = (
	conditionsObject: Record<string, unknown>,
	conditions: ReadonlyArray<string>,
): string | undefined => {
	for (const condition of conditions) {
		const matched = conditionsObject[condition];
		if (typeof matched === "string") {
			return matched;
		}
		if (isPlainObject(matched)) {
			const nested = resolveConditions(matched, conditions);
			if (nested !== undefined) {
				return nested;
			}
		}
	}
	return undefined;
};

/**
 * Resolve a package's root entry point from its manifest.
 *
 * @remarks
 * Answers "given a manifest, which file is the package's `"."` entry?". It is
 * pure and IO-free by design — nothing here touches a filesystem, so it works
 * on plain manifest objects with no package on disk, and it composes with a
 * directory that arrived by any route.
 *
 * All three legal `exports` spellings are honoured, because all three appear in
 * real published packages:
 *
 * - **String shorthand** — `"exports": "./index.js"`, sugar for `{ ".": … }`.
 * - **Subpath map** — `{ ".": "./index.js" }`, or `{ ".": { import, … } }`.
 * - **Root conditions** — `{ "import": "./index.js", "default": "./index.cjs" }`,
 *   conditions at the root with no `"."` key.
 *
 * **`exports` encapsulates the package.** When it is present but nothing
 * matches, the answer is a typed failure and `main` is **not** consulted — that
 * is Node's rule, and the lenient reading (falling through to `main`, then to
 * `index.js`) is the subtly wrong one: it answers a file the package
 * deliberately does not export, which loads and behaves plausibly instead of
 * failing. Only when `exports` is **absent** does `main`, and then the legacy
 * `index.js` default, apply.
 *
 * A failure is also the answer for an `exports` form this resolver does not
 * implement — an array fallback list, or a subpath map with no `"."` entry.
 * Both are honest "this resolver cannot tell you", never a guess, and each
 * carries its own {@link UnresolvedEntryPointError} reason so a caller can log
 * which shape a package actually had rather than a flat "could not resolve".
 *
 * @example
 * ```ts
 * import { resolveEntryPoint } from "./index.ts";
 *
 * resolveEntryPoint({ exports: { import: "./esm.js", require: "./cjs.js" } });
 * // Result.succeed("./esm.js")
 *
 * resolveEntryPoint({ exports: { require: "./cjs.js" } }, { conditions: ["require"] });
 * // Result.succeed("./cjs.js")
 *
 * resolveEntryPoint({ exports: { require: "./cjs.js" }, main: "./legacy.js" });
 * // Result.fail(UnresolvedEntryPointError { reason: "noConditionMatched" })
 * ```
 *
 * @param manifest - A package manifest, or any object carrying `exports`/`main`.
 * @param options - Which conditions to honour, in priority order.
 * @returns The entry path as written in the manifest, relative to the package
 *   root, or a typed {@link UnresolvedEntryPointError} naming which shape
 *   blocked resolution.
 *
 * @public
 */
export const resolveEntryPoint = (
	manifest: EntryPointManifest,
	options?: ResolveEntryPointOptions,
): Result.Result<string, UnresolvedEntryPointError> => {
	const conditions = options?.conditions ?? DEFAULT_CONDITIONS;
	const exportsField = manifest.exports;

	if (typeof exportsField === "string") {
		return Result.succeed(exportsField);
	}

	if (isPlainObject(exportsField)) {
		if (isRootConditions(exportsField)) {
			const resolved = resolveConditions(exportsField, conditions);
			return resolved === undefined
				? Result.fail(UnresolvedEntryPointError.make({ reason: "noConditionMatched", conditions }))
				: Result.succeed(resolved);
		}
		const dot = exportsField["."];
		if (typeof dot === "string") {
			return Result.succeed(dot);
		}
		if (isPlainObject(dot)) {
			const resolved = resolveConditions(dot, conditions);
			return resolved === undefined
				? Result.fail(UnresolvedEntryPointError.make({ reason: "noConditionMatched", conditions }))
				: Result.succeed(resolved);
		}
		// A subpath map with no usable "." entry exports no root entry point.
		return Result.fail(UnresolvedEntryPointError.make({ reason: "noRootExport" }));
	}

	// An array fallback list, or any other non-string non-object value, is an
	// `exports` this resolver does not implement — encapsulation still applies.
	if (exportsField !== undefined) {
		return Result.fail(UnresolvedEntryPointError.make({ reason: "unsupportedExportsForm" }));
	}

	return Result.succeed(typeof manifest.main === "string" && manifest.main !== "" ? manifest.main : "index.js");
};
