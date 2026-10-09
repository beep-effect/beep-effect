// The structured cause a version-gate failure carries, plus the predicate that
// narrows to it.
//
// A leaf module on purpose: `internal/shared.ts` builds the value and must not
// import `Lockfile.ts` (noImportCycles), so the shape lives here where both the
// internals and the public entry point can reach it.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/lockfiles/UnsupportedLockfileVersion");
const GatedFormat = LiteralKit(["npm", "pnpm"]).annotate($I.annote("GatedFormat", { description: "Lockfile formats with a minimum supported version" }));

/**
 * The cause a {@link LockfileParseError} carries when a lockfile predates the
 * supported format version.
 *
 * **Details**
 *
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
const UnsupportedLockfileVersion = S.TaggedStruct("UnsupportedLockfileVersion", {
	format: GatedFormat.annotateKey({ description: "Gated npm or pnpm format that rejected the recorded version" }),
	// Non-finite recorded versions fail boundary validation before the version gate.
	lockfileVersion: S.Union([S.String, S.Finite]).annotateKey({ description: "Recorded format version, preserved verbatim before gating or string conversion" }),
	// Supported minimum versions are finite domain numbers.
	minimumSupported: S.Finite.annotateKey({ description: "Lowest format version supported by the rejecting parser" }),
	message: S.String.annotateKey({ description: "Human-readable explanation of the unsupported version" }),
}).annotate($I.annote("UnsupportedLockfileVersion", { description: "Complete structural cause for a rejected npm or pnpm lockfile version" }));
export type UnsupportedLockfileVersion = typeof UnsupportedLockfileVersion.Type;
const isVersionFailure = S.is(UnsupportedLockfileVersion);

/**
 * Whether a `LockfileParseError.cause` is an {@link UnsupportedLockfileVersion}.
 *
 * **Details**
 *
 * `LockfileParseError.cause` is deliberately `Schema.Defect` — it has to carry
 * whatever the delegated jsonc/yaml/JSON engines throw, which is genuinely
 * open. Widening that field to a union would not make it closed, and would
 * misrepresent an open channel as an exhaustive one. So the *type* is exported
 * and narrowing is a predicate, which is the honest tool for an intentionally
 * open value.
 *
 * **Example** (Distinguish unsupported lockfile versions from malformed input)
 *
 * ```ts
 * import { Lockfile, isUnsupportedLockfileVersion } from "./index.ts";
 * import * as Effect from "effect/Effect";
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
 * @public
 */
export const isUnsupportedLockfileVersion = (cause: unknown): cause is UnsupportedLockfileVersion =>
	P.isObjectKeyword(cause) &&
	!P.isFunction(cause) &&
	// A foreign throwable inheriting the tag is not this record; all remaining
	// required fields are validated structurally by the schema.
	"_tag" in cause &&
	R.has(cause, "_tag") &&
	isVersionFailure(cause);
