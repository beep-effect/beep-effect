// KIT EXTENSION (errno fidelity). One module owns
// errno for the whole package: the engine, the sync/promises ports and the
// NodeSyncFileSystem subpath all build and classify failures here.
//
// - Where the errno lives: an Effect failure carries it on `reason.cause.code`
//   (the `cause` is an `ErrnoException`) — `reason` itself has no `code`
//   field, exactly as with @effect/platform-node, whose adapter puts node's
//   own error on `cause`.
// - Which errno: where Linux and macOS report different codes for the same
//   call, the Linux one is modelled (the engine's POSIX profile is Linux's).
// - Which tag: `errnoTag` mirrors the node adapter's `handleErrnoException`
//   code → tag switch case for case, so matching on `_tag` behaves the same
//   against either implementation.
// - Thrown errors (the ports, `makeSync`): `nodeErrno` builds what a sync
//   `node:fs` call throws — `code`, `syscall`, and `path` when the syscall is
//   path-based — with node's message format.
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";
import type { PlatformError, SystemErrorTag } from "effect/PlatformError";
import { systemError } from "effect/PlatformError";
import type { MemoryFileSystemErrnoError } from "../MemoryFileSystem.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/memfs/internal/errno");

/**
 * Defines the errno codes produced by the memory filesystem engine.
 *
 * **Example** (Validate a missing-file errno)
 *
 * ```ts
 * import { ErrnoCode } from "@beep/scratchpad/effected/memfs/internal/errno";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ErrnoCode)("ENOENT")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ErrnoCode = LiteralKit([
 "EACCES", "EBADF", "EBUSY", "EEXIST", "EINVAL", "EISDIR", "ELOOP", "ENOENT",
 "ENOTDIR", "ENOTEMPTY", "EPERM", "ERR_FS_CP_DIR_TO_NON_DIR", "ERR_FS_CP_EINVAL",
 "ERR_FS_CP_NON_DIR_TO_DIR", "ERR_FS_EISDIR",
]).pipe($I.annoteSchema("ErrnoCode", { description: "The upstream memory filesystem errno codes." }));
/**
 * An errno code accepted by the memory filesystem engine.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrnoCode = typeof ErrnoCode.Type;

/**
 * Supplies the Node-compatible description for each supported errno code.
 *
 * **Example** (Look up the missing-file description)
 *
 * ```ts
 * import { errnoMessages } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * console.log(errnoMessages.ENOENT); // no such file or directory
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const errnoMessages: { readonly [Code in ErrnoCode]: string } = {
	EACCES: "permission denied",
	EBADF: "bad file descriptor",
	EBUSY: "resource busy or locked",
	EEXIST: "file already exists",
	EINVAL: "invalid argument",
	EISDIR: "illegal operation on a directory",
	ELOOP: "too many symbolic links encountered",
	ENOENT: "no such file or directory",
	ENOTDIR: "not a directory",
	ENOTEMPTY: "directory not empty",
	EPERM: "operation not permitted",
	ERR_FS_CP_DIR_TO_NON_DIR: "cannot overwrite non-directory with directory",
	ERR_FS_CP_EINVAL: "invalid src or dest",
	ERR_FS_CP_NON_DIR_TO_DIR: "cannot overwrite directory with non-directory",
	ERR_FS_EISDIR: "path is a directory",
};

// Mirrors `handleErrnoException` in @effect/platform-node-shared: only these
// codes map to a specific tag, everything else is "Unknown".
/**
 * Classifies an errno code with the same system-error tag as the Node adapter.
 *
 * **Details**
 *
 * Only the codes recognized by `handleErrnoException` in
 * `@effect/platform-node-shared` map to a specific tag; everything else is
 * `Unknown`.
 *
 * **Example** (Classify missing and unmapped codes)
 *
 * ```ts
 * import { errnoTag } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * console.log(errnoTag("ENOENT")); // NotFound
 * console.log(errnoTag("EINVAL")); // Unknown
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const errnoTag = Match.type<string | undefined>().pipe(
	Match.when("ENOENT", (): SystemErrorTag => "NotFound"),
	Match.when("EACCES", (): SystemErrorTag => "PermissionDenied"),
	Match.when("EEXIST", (): SystemErrorTag => "AlreadyExists"),
	Match.whenOr("EISDIR", "ENOTDIR", "ELOOP", (): SystemErrorTag => "BadResource"),
	Match.when("EBUSY", (): SystemErrorTag => "Busy"),
	Match.orElse((): SystemErrorTag => "Unknown"),
);

// The code to REPORT for a failure that carries no errno of its own (an
// injected fault, a model limit). NOT the inverse of `errnoTag`, which is
// many-to-one (EISDIR/ENOTDIR/ELOOP all map to BadResource): only the three
// tags with one obvious code get it, and everything else is `EIO`.
/**
 * Chooses a reportable errno for a failure that carries no errno of its own.
 *
 * **Details**
 *
 * Injected faults and model limits can lack an errno. This is not the inverse
 * of `errnoTag`, which is many-to-one: `EISDIR`, `ENOTDIR` and `ELOOP` all map
 * to `BadResource`. Only the three tags with one obvious code get it, and
 * everything else is `EIO`.
 *
 * **Example** (Choose fallback errno codes)
 *
 * ```ts
 * import { fallbackErrnoForTag } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * console.log(fallbackErrnoForTag("NotFound")); // ENOENT
 * console.log(fallbackErrnoForTag("BadResource")); // EIO
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const fallbackErrnoForTag = Match.type<string>().pipe(
	Match.when("NotFound", () => "ENOENT"),
	Match.when("AlreadyExists", () => "EEXIST"),
	Match.when("PermissionDenied", () => "EACCES"),
	Match.orElse(() => "EIO"),
);

/**
 * Provides the `cause` of an errno-backed failure: an `Error` carrying Node's
 * `code` and, for path operations, `path`.
 *
 * **Example** (Construct a path-based errno cause)
 *
 * ```ts
 * import { ErrnoException } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = ErrnoException.from("ENOENT", "/missing");
 * console.log(error.message); // ENOENT: no such file or directory, '/missing'
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ErrnoException extends S.TaggedError<ErrnoException>($I`ErrnoException`)(
 "ErrnoException",
 {
  code: ErrnoCode.pipe($I.annoteKey("ErrnoException.code", { description: "The filesystem errno code." })),
  path: S.UndefinedOr(S.String).pipe($I.annoteKey("ErrnoException.path", { description: "The path, or undefined for a descriptor." })),
  message: S.String.pipe($I.annoteKey("ErrnoException.message", { description: "The upstream errno message." })),
 },
 $I.annoteError<ErrnoException>("ErrnoException", { description: "The typed cause of an errno-backed platform failure." }),
) {
/**
 * Preserves Node's generic `Error` name for errno failures.
 *
 * **Example** (Inspect the ErrnoException error name)
 *
 * ```ts
 * import { ErrnoException } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = ErrnoException.from("ENOENT", "/missing");
 * console.log(error.name); // Error
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
 override readonly name = "Error";

/**
 * Builds an errno cause with a path suffix only for string path arguments.
 *
 * **Example** (Construct a descriptor-based errno cause)
 *
 * ```ts
 * import { ErrnoException } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = ErrnoException.from("EBADF", 3);
 * console.log(error.message); // EBADF: bad file descriptor
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
 static readonly from = (code: ErrnoCode, pathOrDescriptor: string | number | undefined): ErrnoException =>
 ErrnoException.make({
  message: `${code}: ${errnoMessages[code]}${P.isString(pathOrDescriptor) ? `, '${pathOrDescriptor}'` : ""}`,
  code,
  path: P.isString(pathOrDescriptor) ? pathOrDescriptor : undefined,
 });

}

// Keep description explicit (undefined when absent): three string arguments
// would otherwise be ambiguous between direct and pipeable calls.
/**
 * Builds a typed filesystem platform failure while retaining its errno cause.
 *
 * **Details**
 *
 * Pass an explicit description, using `undefined` when absent. Three string
 * arguments would otherwise be ambiguous between direct and pipeable calls.
 *
 * **Example** (Inspect a missing-file platform failure)
 *
 * ```ts
 * import { errnoError } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = errnoError("readFile", "/missing", "ENOENT", undefined);
 * console.log(error.reason._tag); // NotFound
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const errnoError: {
 (pathOrDescriptor: string | number, code: ErrnoCode, description: string | undefined): (method: string) => PlatformError;
 (method: string, pathOrDescriptor: string | number, code: ErrnoCode, description: string | undefined): PlatformError;
} = dual(4, (
 method: string,
 pathOrDescriptor: string | number,
 code: ErrnoCode,
 description: string | undefined,
): PlatformError => systemError({
 module: "FileSystem", _tag: errnoTag(code), method, pathOrDescriptor, description,
 cause: ErrnoException.from(code, pathOrDescriptor),
}));

// Node's POSIX errno values are negative. Its ERR_FS_* application codes
// carry no numeric errno; retain that absence instead of inventing one.
const nodeErrnos: Readonly<Record<ErrnoCode | "EIO", number | undefined>> = {
 EACCES: -13, EBADF: -9, EBUSY: -16, EEXIST: -17, EINVAL: -22, EISDIR: -21,
 ELOOP: -40, ENOENT: -2, ENOTDIR: -20, ENOTEMPTY: -39, EPERM: -1, EIO: -5,
 ERR_FS_CP_DIR_TO_NON_DIR: undefined, ERR_FS_CP_EINVAL: undefined,
 ERR_FS_CP_NON_DIR_TO_DIR: undefined, ERR_FS_EISDIR: undefined,
};

/**
 * Represents a Node-compatible synchronous filesystem failure with syscall
 * and optional path metadata.
 *
 * **Example** (Inspect a descriptor syscall failure)
 *
 * ```ts
 * import { NodeErrno } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = NodeErrno.make({
 *   message: "EBADF: bad file descriptor, read",
 *   code: "EBADF",
 *   errno: -9,
 *   syscall: "read",
 * });
 * console.log(error.syscall); // read
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NodeErrno extends S.TaggedError<NodeErrno>($I`NodeErrno`)(
 "NodeErrno",
 {
  message: S.String.pipe($I.annoteKey("NodeErrno.message", { description: "The Node-compatible error message." })),
  code: S.String.pipe($I.annoteKey("NodeErrno.code", { description: "The Node errno or application code." })),
  errno: S.UndefinedOr(S.Finite).pipe($I.annoteKey("NodeErrno.errno", { description: "The numeric POSIX errno, when the code has one." })),
  syscall: S.String.pipe($I.annoteKey("NodeErrno.syscall", { description: "The failing Node syscall." })),
  path: S.optionalKey(S.String).pipe($I.annoteKey("NodeErrno.path", { description: "The path, omitted for descriptor syscalls." })),
 },
 $I.annoteError<NodeErrno>("NodeErrno", { description: "A tagged Node-compatible synchronous filesystem failure." }),
) {
/**
 * Preserves Node's generic `Error` name for errno failures.
 *
 * **Example** (Inspect the NodeErrno error name)
 *
 * ```ts
 * import { nodeErrno } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = nodeErrno("EBADF", "read", undefined);
 * console.log(error.name); // Error
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
 override readonly name = "Error";
}

/**
 * Builds what a synchronous `node:fs` call throws: Node's message format
 * (`"<CODE>: <description>, <syscall> '<path>'"`) and `code`/`syscall`/`path`
 * properties.
 *
 * **Details**
 *
 * A descriptor-based syscall (`read`) has no path, and neither does its
 * error — pass `undefined`. An unmapped code's description is `"error"`.
 *
 * **Example** (Format a missing-file syscall error)
 *
 * ```ts
 * import { nodeErrno } from "@beep/scratchpad/effected/memfs/internal/errno";
 *
 * const error = nodeErrno("ENOENT", "open", "/missing");
 * console.log(error.message); // ENOENT: no such file or directory, open '/missing'
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const nodeErrno: {
 (syscall: string, path: string | undefined): (code: string) => MemoryFileSystemErrnoError;
 (code: string, syscall: string, path: string | undefined): MemoryFileSystemErrnoError;
} = dual(3, (code: string, syscall: string, path: string | undefined): MemoryFileSystemErrnoError => {
 const messages: Readonly<Record<string, string | undefined>> = errnoMessages;
 const codes: Readonly<Record<string, number | undefined>> = nodeErrnos;
 const description = O.getOrUndefined(R.get(messages, code)) ?? "error";
 const message = `${code}: ${description}, ${syscall}${path === undefined ? "" : ` '${path}'`}`;
 return NodeErrno.make({ message, code, errno: O.getOrUndefined(R.get(codes, code)), syscall,
  ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
 });
});
