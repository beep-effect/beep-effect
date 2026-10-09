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
import { Data } from "effect";
import { dual } from "effect/Function";
import type { PlatformError, SystemErrorTag } from "effect/PlatformError";
import { systemError } from "effect/PlatformError";
import type { MemoryFileSystemErrnoError } from "../MemoryFileSystem.ts";

export type ErrnoCode =
	| "EACCES"
	| "EBADF"
	| "EBUSY"
	| "EEXIST"
	| "EINVAL"
	| "EISDIR"
	| "ELOOP"
	| "ENOENT"
	| "ENOTDIR"
	| "ENOTEMPTY"
	| "EPERM"
	| "ERR_FS_CP_DIR_TO_NON_DIR"
	| "ERR_FS_CP_EINVAL"
	| "ERR_FS_CP_NON_DIR_TO_DIR"
	| "ERR_FS_EISDIR";

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
export const errnoTag = (code: string | undefined): SystemErrorTag => {
	switch (code) {
		case "ENOENT":
			return "NotFound";
		case "EACCES":
			return "PermissionDenied";
		case "EEXIST":
			return "AlreadyExists";
		case "EISDIR":
		case "ENOTDIR":
		case "ELOOP":
			return "BadResource";
		case "EBUSY":
			return "Busy";
		default:
			return "Unknown";
	}
};

// The code to REPORT for a failure that carries no errno of its own (an
// injected fault, a model limit). NOT the inverse of `errnoTag`, which is
// many-to-one (EISDIR/ENOTDIR/ELOOP all map to BadResource): only the three
// tags with one obvious code get it, and everything else is `EIO`.
export const fallbackErrnoForTag = (tag: string): string => {
	switch (tag) {
		case "NotFound":
			return "ENOENT";
		case "AlreadyExists":
			return "EEXIST";
		case "PermissionDenied":
			return "EACCES";
		default:
			return "EIO";
	}
};

/** The `cause` of an errno-backed failure: an `Error` carrying node's `code` (and `path` for path operations). */
export class ErrnoException extends Data.TaggedError("ErrnoException")<{ readonly code: ErrnoCode; readonly path: string | undefined; readonly message: string }> {
	constructor(code: ErrnoCode, pathOrDescriptor: string | number | undefined) {
		super({
			message: `${code}: ${errnoMessages[code]}${typeof pathOrDescriptor === "string" ? `, '${pathOrDescriptor}'` : ""}`,
			code,
			path: typeof pathOrDescriptor === "string" ? pathOrDescriptor : undefined,
		});
		this.name = "Error";
	}
}

// String paths overlap method strings, and the optional description makes the two call forms ambiguous.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const errnoError = (
	method: string,
	pathOrDescriptor: string | number,
	code: ErrnoCode,
	description?: string,
): PlatformError =>
	systemError({
		module: "FileSystem",
		_tag: errnoTag(code),
		method,
		pathOrDescriptor,
		description,
		cause: new ErrnoException(code, pathOrDescriptor),
	});

/**
 * What a synchronous `node:fs` call throws: node's message format
 * (`"<CODE>: <description>, <syscall> '<path>'"`), and `code`/`syscall`/`path`
 * properties. A descriptor-based syscall (`read`) has no path, and neither does
 * its error — pass `undefined`. An unmapped code's description is `"error"`.
 */
export const nodeErrno: {
	(syscall: string, path: string | undefined): (code: string) => MemoryFileSystemErrnoError;
	(code: string, syscall: string, path: string | undefined): MemoryFileSystemErrnoError;
} = dual(3, (code: string, syscall: string, path: string | undefined): MemoryFileSystemErrnoError => {
	const description = (errnoMessages as Record<string, string | undefined>)[code] ?? "error";
	const message = `${code}: ${description}, ${syscall}${path === undefined ? "" : ` '${path}'`}`;
	return Object.assign(new Error(message), { code, syscall }, path === undefined ? {} : { path });
});
