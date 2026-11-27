/**
 * The typed cause a lockfile below its format's supported version fails
 * with.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $LockfilesId.create("UnsupportedLockfileVersion");
const GatedFormat = LiteralKit(["npm", "pnpm"]).pipe(
  $I.annoteSchema("GatedFormat", { description: "Lockfile formats with a minimum supported version" })
);

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
// decision: version-cause-leaf-module
const UnsupportedLockfileVersion = S.TaggedStruct("UnsupportedLockfileVersion", {
  format: GatedFormat.pipe(
    $I.annoteKey("UnsupportedLockfileVersion.format", {
      description: "Gated npm or pnpm format that rejected the recorded version",
    })
  ),
  lockfileVersion: S.Union([S.String, S.Finite]).pipe(
    $I.annoteKey("UnsupportedLockfileVersion.lockfileVersion", {
      description:
        "Recorded format version, preserved verbatim; a non-finite number fails boundary validation before the gate",
    })
  ),
  minimumSupported: S.Finite.pipe(
    $I.annoteKey("UnsupportedLockfileVersion.minimumSupported", {
      description: "Lowest format version supported by the rejecting parser",
    })
  ),
  message: S.String.pipe(
    $I.annoteKey("UnsupportedLockfileVersion.message", {
      description: "Human-readable explanation of the unsupported version",
    })
  ),
}).pipe(
  $I.annoteSchema("UnsupportedLockfileVersion", {
    description: "Complete structural cause for a rejected npm or pnpm lockfile version",
  })
);
/**
 * Structural version-gate cause distinguishing unsupported formats from malformed input.
 *
 * @see {@link isUnsupportedLockfileVersion} for narrowing an open parse-error cause.
 * @category type-level
 * @since 0.0.0
 */
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
 * **Gotchas**
 *
 * The `_tag` must be an own property: a foreign throwable that inherits the
 * tag from its prototype is not this record.
 *
 * **Example** (Distinguish unsupported lockfile versions from malformed input)
 *
 * ```ts
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 * import { isUnsupportedLockfileVersion } from "@beep/lockfiles/UnsupportedLockfileVersion";
 * import * as Effect from "effect/Effect";
 *
 * const text = '{"lockfileVersion":2,"packages":{}}';
 * const parsed = Lockfile.parse(text, { format: "npm" }).pipe(
 *   Effect.catchTag("LockfileParseError", (error) =>
 *     isUnsupportedLockfileVersion(error.cause)
 *       ? Effect.fail(`upgrade: ${error.cause.format} needs lockfileVersion ${error.cause.minimumSupported}+`)
 *       : Effect.fail("malformed lockfile"),
 *   ),
 * );
 *
 * console.log(Effect.runSync(Effect.flip(parsed))); // upgrade: npm needs lockfileVersion 3+
 * ```
 *
 * @param cause - the `cause` of a `LockfileParseError`, or an unknown value
 * @returns `true` when `cause` is the version-gate record
 * @public
 * @category predicates
 * @since 0.0.0
 */
export const isUnsupportedLockfileVersion = (cause: unknown): cause is UnsupportedLockfileVersion =>
  P.isObjectKeyword(cause) &&
  !P.isFunction(cause) &&
  "_tag" in cause &&
  R.has(cause, "_tag") &&
  isVersionFailure(cause);
