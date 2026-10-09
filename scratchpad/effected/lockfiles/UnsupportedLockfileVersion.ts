// The structured cause a version-gate failure carries, plus the predicate that
// narrows to it.
//
// A leaf module on purpose: `internal/shared.ts` builds the value and must not
// import `Lockfile.ts` (noImportCycles), so the shape lives here where both the
// internals and the public entry point can reach it.

/**
 * The cause a {@link LockfileParseError} carries when a lockfile predates the
 * supported format version.
 *
 * @remarks
 * `@effected/lockfiles` parses pnpm `lockfileVersion` 9+ and npm
 * `lockfileVersion` 3+. An older format fails typed at `stage: "validation"`,
 * and the failure carries this record rather than an engine error, so a
 * consumer can tell **"your lockfile is too old" from "your lockfile is
 * malformed" without parsing prose**.
 *
 * `message` is for humans and its wording is not contract; discriminate on
 * `_tag` — through {@link isUnsupportedLockfileVersion}, which is why that
 * predicate exists.
 *
 * bun and yarn are ungated (neither records a comparable format-version line),
 * so `format` is narrowed to the two that are.
 *
 * @public
 */
export interface UnsupportedLockfileVersion {
	/** Discriminant. */
	readonly _tag: "UnsupportedLockfileVersion";
	/** The gated format that rejected the input. */
	readonly format: "npm" | "pnpm";
	/** The `lockfileVersion` found, verbatim — a number or a string like `"6.0"`. */
	readonly lockfileVersion: number | string;
	/** The lowest format version this package parses for that format. */
	readonly minimumSupported: number;
	/** A human-readable summary. Not contract — narrow on `_tag` instead. */
	readonly message: string;
}

/**
 * Whether a `LockfileParseError.cause` is an {@link UnsupportedLockfileVersion}.
 *
 * @remarks
 * `LockfileParseError.cause` is deliberately `Schema.Defect` — it has to carry
 * whatever the delegated jsonc/yaml/JSON engines throw, which is genuinely
 * open. Widening that field to a union would not make it closed, and would
 * misrepresent an open channel as an exhaustive one. So the *type* is exported
 * and narrowing is a predicate, which is the honest tool for an intentionally
 * open value.
 *
 * @example
 * ```ts
 * import { Lockfile, isUnsupportedLockfileVersion } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const parsed = Lockfile.parse(text, { format: "npm" }).pipe(
 *   Effect.catchTag("LockfileParseError", (error) =>
 *     isUnsupportedLockfileVersion(error.cause)
 *       ? Effect.fail(`upgrade: ${error.cause.format} needs lockfileVersion ${error.cause.minimumSupported}+`)
 *       : Effect.fail("malformed lockfile"),
 *   ),
 * );
 * ```
 *
 * @param cause - the `cause` of a `LockfileParseError`, or any unknown value
 * @returns `true` when `cause` is the version-gate record
 *
 * @public
 */
export const isUnsupportedLockfileVersion = (cause: unknown): cause is UnsupportedLockfileVersion =>
	typeof cause === "object" &&
	cause !== null &&
	// The discriminant is read as an OWN property: a foreign throwable that
	// inherits a `_tag` from its prototype is not this record, and treating one
	// as if it were would tell a consumer to upgrade their package manager over
	// what is actually a malformed file. The remaining checks are value checks
	// — identity is already settled by this line.
	Object.hasOwn(cause, "_tag") &&
	"_tag" in cause &&
	cause._tag === "UnsupportedLockfileVersion" &&
	"format" in cause &&
	typeof cause.format === "string" &&
	"minimumSupported" in cause &&
	typeof cause.minimumSupported === "number";
