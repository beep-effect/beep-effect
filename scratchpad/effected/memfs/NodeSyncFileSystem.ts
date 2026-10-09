// This adapter preserves synchronous Node filesystem throws and errno metadata; Effect FileSystem is asynchronous.
// @effect-diagnostics nodeBuiltinImport:skip-file
/**
 * A read-only, synchronous `FileSystem` over `node:fs`'s sync API, for
 * programs that must run under `Effect.runSync` — a config loader called from
 * a synchronous entry point, a build-script shim — yet still take
 * `FileSystem.FileSystem` from context.
 *
 * Deliberately a separate subpath (`@effected/memfs/node-sync`): the main
 * entry imports nothing from `node:*`, and this module is the one place that
 * does. Import it only where Node's filesystem is the platform you mean.
 *
 * @packageDocumentation
 */

import * as NFS from "node:fs";
import type * as PlatformErrorNs from "effect/PlatformError";
import * as BI from "effect/BigInt";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";
import { errnoTag } from "./internal/errno.ts";

type PlatformErrorType = PlatformErrorNs.PlatformError;

// Mirrors @effect/platform-node-shared's `handleErrnoException`: the tag comes
// from the code through the shared `errnoTag` mapping (anything unmapped,
// including node's `ERR_*` argument codes, is Unknown) and the node error rides
// as `cause`.
const errnoException = (method: string, path: string, err: unknown): PlatformErrorType => {
	const error = err as NodeJS.ErrnoException | undefined;
	return PlatformError.systemError({
		_tag: errnoTag(error?.code),
		module: "FileSystem",
		method,
		pathOrDescriptor: path,
		syscall: error?.syscall,
		cause: error,
	});
};

// Mirrors the adapter's `effectify(…, handleErrnoException, handleBadArgument)`
// split: a failure from the syscall itself (it carries a numeric `errno` or a
// `syscall`) is a system error; anything node throws BEFORE the syscall — its
// argument validation, whose errors also carry string codes such as
// ERR_INVALID_ARG_VALUE (a NUL byte) or ERR_INVALID_ARG_TYPE — is BadArgument.
const fail = (method: string, path: string, err: unknown): PlatformErrorType => {
	const error = err as NodeJS.ErrnoException | undefined;
	return typeof error?.errno === "number" || error?.syscall !== undefined
		? errnoException(method, path, err)
		: PlatformError.badArgument({
				module: "FileSystem",
				method,
				description: error?.message ?? String(err),
			});
};

const attempt = <A>(method: string, path: string, f: () => A): Effect.Effect<A, PlatformErrorType> =>
	Effect.try({ try: f, catch: (err) => fail(method, path, err) });

const bigintToNumber = (value: bigint, field: string): number => {
	const number = Number(value);
	if (!Number.isSafeInteger(number)) {
		throw new RangeError(`${field} exceeds the safe integer range: ${value}`);
	}
	return number;
};

const bigintToNumberOption = (value: bigint | undefined): O.Option<number> =>
	O.flatMap(O.fromNullishOr(value), BI.toNumber);

// The node adapter's `makeFileInfo`, field for field.
const fileInfo = (stat: NFS.BigIntStats): FileSystem.File.Info => ({
	type: stat.isFile()
		? "File"
		: stat.isDirectory()
			? "Directory"
			: stat.isSymbolicLink()
				? "SymbolicLink"
				: stat.isBlockDevice()
					? "BlockDevice"
					: stat.isCharacterDevice()
						? "CharacterDevice"
						: stat.isFIFO()
							? "FIFO"
							: stat.isSocket()
								? "Socket"
								: "Unknown",
	mtime: O.fromNullishOr(stat.mtime),
	atime: O.fromNullishOr(stat.atime),
	birthtime: O.fromNullishOr(stat.birthtime),
	dev: bigintToNumber(stat.dev, "dev"),
	rdev: bigintToNumberOption(stat.rdev),
	ino: bigintToNumberOption(stat.ino),
	mode: bigintToNumber(stat.mode, "mode"),
	nlink: bigintToNumberOption(stat.nlink),
	uid: bigintToNumberOption(stat.uid),
	gid: bigintToNumberOption(stat.gid),
	size: ByteSize.bytes(stat.size),
	blksize: stat.blksize !== undefined ? O.some(ByteSize.bytes(stat.blksize)) : O.none(),
	blocks: bigintToNumberOption(stat.blocks),
});

// Every member outside the read set is a DEFECT, never a typed failure: a
// program handed this filesystem that tries to write has a wiring bug, and a
// typed failure (what `FileSystem.makeNoop` answers) could be caught and
// silently absorbed as "not found".
const readOnly = (member: string) => new Error(`NodeSyncFileSystem is read-only: ${member} is not supported`);
const unsupported = (member: string) => () => Effect.die(readOnly(member));

const make: FileSystem.FileSystem = FileSystem.make({
	access: (path, options) =>
		attempt("access", path, () => {
			let mode = NFS.constants.F_OK;
			if (options?.readable === true) mode |= NFS.constants.R_OK;
			if (options?.writable === true) mode |= NFS.constants.W_OK;
			NFS.accessSync(path, mode);
		}),
	stat: (path) =>
		Effect.flatMap(
			attempt("stat", path, () => NFS.statSync(path, { bigint: true })),
			(stat) =>
				Effect.try({
					try: () => fileInfo(stat),
					catch: (err) =>
						PlatformError.badArgument({ module: "FileSystem", method: "stat", description: (err as Error).message }),
				}),
		),
	// The adapter's own value: node's Buffer (a Uint8Array), not a copy. A
	// non-string path never reaches `readFileSync`, which would read it as a
	// file DESCRIPTOR; the adapter's async `readFile` rejects it in its callback,
	// so it surfaces there as a system error (Unknown, ERR_INVALID_ARG_TYPE).
	readFile: (path) =>
		typeof path === "string"
			? attempt("readFile", path, () => NFS.readFileSync(path))
			: Effect.fail(
					errnoException(
						"readFile",
						path,
						Object.assign(new TypeError(`The "path" argument must be of type string. Received ${typeof path}`), {
							code: "ERR_INVALID_ARG_TYPE",
						}),
					),
				),
	// The adapter wraps `readdir` in `Effect.tryPromise` whose catch is
	// `handleErrnoException` alone, so EVERY failure — argument errors too — is
	// a system error (an `ERR_*` code maps to Unknown). Matched here ON PURPOSE:
	// a NUL byte or non-string path is `Unknown`/`ERR_INVALID_ARG_*` for
	// readDirectory but `BadArgument` for every other member, exactly as on the
	// adapter. Do not "fix" it: it is the parity with the adapter.
	readDirectory: (path, options) =>
		Effect.try({
			try: () => NFS.readdirSync(path, { encoding: "utf8", recursive: options?.recursive === true }),
			catch: (err) => errnoException("readDirectory", path, err),
		}),
	readLink: (path) => attempt("readLink", path, () => NFS.readlinkSync(path)),
	// The JS `realpathSync`, NOT `.native`: the node adapter wraps the JS
	// `fs.realpath`, which resolves links but never canonicalizes case.
	realPath: (path) => attempt("realPath", path, () => NFS.realpathSync(path)),
	copy: unsupported("copy"),
	copyFile: unsupported("copyFile"),
	chmod: unsupported("chmod"),
	chown: unsupported("chown"),
	glob: unsupported("glob"),
	link: unsupported("link"),
	makeDirectory: unsupported("makeDirectory"),
	makeTempDirectory: unsupported("makeTempDirectory"),
	makeTempDirectoryScoped: unsupported("makeTempDirectoryScoped"),
	makeTempFile: unsupported("makeTempFile"),
	makeTempFileScoped: unsupported("makeTempFileScoped"),
	open: unsupported("open"),
	remove: unsupported("remove"),
	rename: unsupported("rename"),
	symlink: unsupported("symlink"),
	truncate: unsupported("truncate"),
	utimes: unsupported("utimes"),
	watch: () => Stream.die(readOnly("watch")),
	writeFile: unsupported("writeFile"),
});

/**
 * A read-only, synchronous `FileSystem` over `node:fs`.
 *
 * @remarks
 * Every read member (`access`, `exists`, `stat`, `readFile`,
 * `readFileString`, `readDirectory`, `readLink`, `realPath`) calls `node:fs`'s
 * sync API, so a program using only those runs under `Effect.runSync`.
 * Successes and failures match `@effect/platform-node`'s `NodeFileSystem`:
 * the same `File.Info`, the same error tag, method and errno (on `cause`).
 * `realPath` resolves links but keeps the queried case, as the node adapter
 * does. The adapter's quirks are copied too: an invalid path argument (a NUL
 * byte, a non-string) is `BadArgument` for every member EXCEPT
 * `readDirectory`, which reports it as `Unknown` carrying node's
 * `ERR_INVALID_ARG_*` code, because that is what the adapter does. Every
 * other member — writes, `open` and the streams built on it, `glob`, `watch`,
 * temp files — is a defect (`Effect.die`), not a typed failure: this
 * filesystem never writes, and a caller that tries has a wiring bug
 * `Effect.catch` must not absorb.
 *
 * @example
 * ```ts
 * import { NodeSyncFileSystem } from "./NodeSyncFileSystem.ts";
 * import { Effect, FileSystem } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem;
 *   return yield* fs.readFileString("package.json");
 * });
 *
 * const text = Effect.runSync(program.pipe(Effect.provide(NodeSyncFileSystem.layer)));
 * ```
 *
 * @public
 */
export class NodeSyncFileSystem {
	/**
	 * The filesystem itself, for code that takes a `FileSystem` argument. A
	 * plain value (not an `Effect`, unlike `MemoryFileSystem.make`): there is no
	 * volume to build.
	 */
	static readonly fileSystem: FileSystem.FileSystem = make;

	/** The filesystem as a layer providing `FileSystem.FileSystem`. */
	static readonly layer: Layer.Layer<FileSystem.FileSystem> = Layer.succeed(FileSystem.FileSystem, make);

	private constructor() {}
}
