// KIT EXTENSION (ports). The read-only `node:fs` sync port and `node:fs/promises`
// port over the literal inspection view, the path resolver they share, the
// fault wrapper, and the synchronous-run helpers behind `makeSync`. Failure is
// a node-shaped error built by `nodeErrno` — the only channel a synchronous
// signature has.

import { dual } from "effect/Function";
import type * as PlatformError from "effect/PlatformError";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type {
	MemoryFileSystemDirent,
	MemoryFileSystemPortStats,
	MemoryFileSystemPromisesFileSystem,
	MemoryFileSystemReadFileEncoding,
	MemoryFileSystemSyncFileSystem,
	MemoryFileSystemVolume,
	MemoryFileSystemVolumeStat,
} from "../MemoryFileSystem.ts";
import { fallbackErrnoForTag, nodeErrno } from "./errno.ts";
import { assertKnownFaultKeys } from "./faults.ts";
import * as R from "effect/Record";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";

// The port is defined in `stat` terms, so it FOLLOWS symbolic links — unlike
// the literal inspection view it is built on. `MAX_LINK_HOPS` mirrors the
// ELOOP guard a real filesystem applies; the budget is ONE counter shared by
// the whole resolution (recursive target walks included), so a cycle spread
// across nested link targets terminates as ELOOP.
const MAX_LINK_HOPS = 40;

const $I = $ScratchpadId.create("effected/memfs/internal/ports");
const ResolutionErrno = LiteralKit(["ENOENT", "ENOTDIR", "ELOOP"]).pipe(
 $I.annoteSchema("ResolutionErrno", { description: "Failures of component-wise path resolution." }),
);
export const StatKind = LiteralKit(["file", "directory", "symlink"]).pipe(
 $I.annoteSchema("StatKind", { description: "The literal volume entry kinds." }),
);
export type StatKind = typeof StatKind.Type;
const MutationMethod = LiteralKit(["writeFile", "makeDirectory", "remove", "symlink"]).pipe(
 $I.annoteSchema("MutationMethod", { description: "The synchronous handle mutation methods." }),
);
type MutationMethod = typeof MutationMethod.Type;
export const Resolved = S.TaggedUnion({
 Success: { path: S.String.pipe($I.annoteKey("Resolved.Success.path", { description: "The resolved absolute path." })) },
 Failure: { code: ResolutionErrno.pipe($I.annoteKey("Resolved.Failure.code", { description: "The resolution errno." })) },
}).pipe($I.annoteSchema("Resolved", { description: "A resolved path or the exact resolution failure." }));
type Resolved = typeof Resolved.Type;

interface HopBudget {
	hops: number;
}

const walk = (volume: MemoryFileSystemVolume, path: string, followFinal: boolean, budget: HopBudget): Resolved => {
	// Resolution is per COMPONENT, not just the final one: `/links/pkg/a.json`
	// has to follow the link at `/links/pkg` before it can see `a.json`, exactly
	// as a real filesystem walks a path.
	let current = "";
	const parts = path.split("/").filter((part) => part !== "" && part !== ".");
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part === "..") {
			// `..` under a non-directory is ENOTDIR, as the kernel reports it.
			const here = volume.lstat(current === "" ? "/" : current);
			if (here !== undefined && here.kind !== "directory") return Resolved.cases.Failure.make({ code: "ENOTDIR" });
			// Applied to the RESOLVED location, so ".." after a link ascends from
			// the target rather than from the link's own parent.
			current = current.slice(0, Math.max(0, current.lastIndexOf("/")));
			continue;
		}
		// A component under something that is not a directory is ENOTDIR, not absence.
		const parent = volume.lstat(current === "" ? "/" : current);
		if (parent !== undefined && parent.kind !== "directory") return Resolved.cases.Failure.make({ code: "ENOTDIR" });
		let candidate = `${current}/${part}`;
		if (i < parts.length - 1 || followFinal) {
			for (;;) {
				const target = volume.readLink(candidate);
				if (target === undefined) break;
				budget.hops += 1;
				if (budget.hops > MAX_LINK_HOPS) return Resolved.cases.Failure.make({ code: "ELOOP" });
				const resolved = walk(volume, target.startsWith("/") ? target : `${current}/${target}`, true, budget);
				if (Resolved.guards.Failure(resolved)) return resolved;
				candidate = resolved.path;
			}
		}
		if (volume.lstat(candidate) === undefined) return Resolved.cases.Failure.make({ code: "ENOENT" });
		current = candidate;
	}
	return Resolved.cases.Success.make({ path: current === "" ? "/" : current });
};

/**
 * Resolves `path` the way `stat` (or, with `followFinal: false`, `lstat`) does,
 * reporting WHY it is absent: `ENOENT`, `ENOTDIR` (a component under a
 * non-directory) or `ELOOP` (too many links).
 */
export const resolvePath: {
 (path: string, followFinal?: boolean): (volume: MemoryFileSystemVolume) => Resolved;
 (volume: MemoryFileSystemVolume, path: string, followFinal?: boolean): Resolved;
} = dual((args) => P.isObject(args[0]), (volume: MemoryFileSystemVolume, path: string, followFinal = true): Resolved => {
	// A trailing slash asserts "this is a directory", as on node: the final
	// link is followed even for `lstat`, and a resolved non-directory is
	// ENOTDIR — never the file itself (which `walk`, dropping the empty
	// segment, would otherwise answer).
	const trailingSlash = path.length > 1 && path.endsWith("/");
	const r = walk(volume, path, followFinal || trailingSlash, { hops: 0 });
	if (trailingSlash && Resolved.guards.Success(r) && volume.lstat(r.path)?.kind !== "directory") return Resolved.cases.Failure.make({ code: "ENOTDIR" });
	return r;
});

const portStats = (s: MemoryFileSystemVolumeStat): MemoryFileSystemPortStats => ({
	isFile: () => StatKind.is.file(s.kind),
	isDirectory: () => StatKind.is.directory(s.kind),
	isSymbolicLink: () => StatKind.is.symlink(s.kind),
	mtimeMs: s.mtimeMs,
	size: s.size,
});

const resolvedPath = (resolved: Resolved, syscall: string, path: string): string =>
 Resolved.match(resolved, {
  Failure: ({ code }) => { throw nodeErrno(code, syscall, path); },
  Success: ({ path }) => path,
 });

const statOf = (volume: MemoryFileSystemVolume, path: string, syscall: "stat" | "lstat", follow: boolean) => {
	const resolved = resolvedPath(resolvePath(volume, path, follow), syscall, path);
	const s = volume.lstat(resolved);
	if (s === undefined) throw nodeErrno("ENOENT", syscall, path);
	return portStats(s);
};

const isEncoded = (options: unknown): boolean =>
	P.isString(options) ||
	(P.isObjectOrArray(options) && P.hasProperty(options, "encoding") && P.isString(options.encoding));

const settle = <A>(f: () => A): Promise<Awaited<A>> => {
	try {
		return Promise.resolve(f());
	} catch (e) {
		return Promise.reject(e);
	}
};

/**
 * Wraps each named member of `port` so its handler runs first: a handler may
 * throw, return a replacement, or return `undefined` to delegate. An unknown
 * member name throws `UnknownFaultKeyError` at construction. With `async`, the whole
 * interception runs inside `settle`, so a handler that throws synchronously
 * REJECTS — as a real `fs/promises` call does — instead of throwing.
 */
export const withFaults: {
 <Port extends object>(faults: Partial<Record<keyof Port, (...args: never) => unknown>> | undefined, subject: string, async?: boolean): (port: Port) => Port;
 <Port extends object>(port: Port, faults: Partial<Record<keyof Port, (...args: never) => unknown>> | undefined, subject: string, async?: boolean): Port;
} = dual((args) => P.isString(args[1]) === false, <Port extends object>(
	port: Port,
	faults: Partial<Record<keyof Port, (...args: never) => unknown>> | undefined,
	subject: string,
	async = false,
): Port => {
	if (faults === undefined) return port;
	assertKnownFaultKeys(faults, port, subject);
 const entries: ReadonlyArray<readonly [string, unknown]> = R.toEntries(faults);
 const intercepted = R.fromEntries(A.flatMap(entries, ([name, handler]) => {
  if (!P.hasProperty(port, name)) return [];
  const original = port[name];
  if (!P.isFunction(handler) || !P.isFunction(original)) return [];
  const intercept = (...args: ReadonlyArray<unknown>): unknown => {
   const replaced: unknown = handler(...args);
   return replaced === undefined ? original(...args) : replaced;
  };
  return [[name, async ? (...args: ReadonlyArray<unknown>) => settle(() => intercept(...args)) : intercept] as const];
 }));
 return { ...port, ...intercepted };
});

const decoder = new TextDecoder();

// `readFileSync(path)`: the bytes of the regular file `path` resolves to, or
// node's error — never fabricated content.
const readBytes = (volume: MemoryFileSystemVolume, path: string): Uint8Array => {
	const resolved = resolvedPath(resolvePath(volume, path), "open", path);
	const bytes = volume.bytes(resolved);
	if (bytes === undefined) {
		// Reading a directory as a file is EISDIR in `readFileSync`; anything
		// else that is not a regular file is ENOTDIR. `read` works on a
		// descriptor, so node's EISDIR carries no path.
		throw volume.isDirectory(resolved) ? nodeErrno("EISDIR", "read", undefined) : nodeErrno("ENOTDIR", "open", path);
	}
	return bytes;
};

// The `syscall` on each thrown error is the one node reports for the same call:
// `open` for readFile (`read` when the target is a directory), `scandir` for
// readDirectory, `stat`/`lstat` for the stat pair.
export const makeSyncFileSystem = (volume: MemoryFileSystemVolume): MemoryFileSystemSyncFileSystem => ({
	exists: (path) => Resolved.match(resolvePath(volume, path), { Failure: () => false, Success: () => true }),
	readFile: (path) => decoder.decode(readBytes(volume, path)),
	readDirectory: (path) => {
		const resolved = resolvedPath(resolvePath(volume, path), "scandir", path);
		const names = volume.readDirectory(resolved);
		if (names === undefined) throw nodeErrno("ENOTDIR", "scandir", path);
		return names;
	},
	isDirectory: (path) => {
		const r = resolvePath(volume, path);
		return Resolved.match(r, { Failure: () => false, Success: ({ path }) => volume.isDirectory(path) });
	},
	stat: (path) => statOf(volume, path, "stat", true),
	lstat: (path) => statOf(volume, path, "lstat", false),
});

export const makePromisesFileSystem = (volume: MemoryFileSystemVolume): MemoryFileSystemPromisesFileSystem => {
	const sync = makeSyncFileSystem(volume);
	function readdir(path: string): Promise<ReadonlyArray<string>>;
	function readdir(
		path: string,
		options: { readonly withFileTypes: true },
	): Promise<ReadonlyArray<MemoryFileSystemDirent>>;
	function readdir(
		path: string,
		options?: { readonly withFileTypes?: boolean },
	): Promise<ReadonlyArray<string> | ReadonlyArray<MemoryFileSystemDirent>> {
		return settle(() => {
			const names = sync.readDirectory(path);
			if (options?.withFileTypes !== true) return names;
			const r = resolvePath(volume, path);
			const base = Resolved.match(r, { Failure: () => path, Success: ({ path }) => path });
			return names.map((name): MemoryFileSystemDirent => {
				// Literal: a link is reported as a link, as `readdir` dirents do.
				const kind = volume.lstat(`${base === "/" ? "" : base}/${name}`)?.kind;
				return {
					name,
					isFile: () => kind === "file",
					isDirectory: () => kind === "directory",
					isSymbolicLink: () => kind === "symlink",
				};
			});
		});
	}
	// node's overloads: bytes without an encoding, a string with one.
	function readFile(path: string): Promise<Uint8Array>;
	function readFile(path: string, encoding: MemoryFileSystemReadFileEncoding): Promise<string>;
	function readFile(path: string, encoding?: MemoryFileSystemReadFileEncoding): Promise<Uint8Array | string> {
		// Only a string encoding, or `{ encoding: string }`, selects the string
		// form — as node does; `{ flag: "r" }`, `null` or `undefined` read bytes.
		return settle(() => (isEncoded(encoding) ? sync.readFile(path) : readBytes(volume, path)));
	}
	return {
		readdir,
		stat: (path) => settle(() => sync.stat(path)),
		lstat: (path) => settle(() => sync.lstat(path)),
		readFile,
	};
};

// The syscall node reports for the `FileSystem` method a handle mutator or a
// seed step runs — the thrown error carries it, never the Effect method name.
// `rmSync` fails in the `lstat` it opens with (host-probed), not in "rm".
const methodSyscall: { readonly [method: string]: string | undefined } = {
	writeFile: "open",
	makeDirectory: "mkdir",
	symlink: "symlink",
	chmod: "chmod",
	utimes: "utime",
	remove: "lstat",
};

/** node's syscall for a `FileSystem` method; a method with no node twin (the seed's own `root` check) keeps its name. */
export const syscallForMethod = (method: string): string => methodSyscall[method] ?? method;

/**
 * Runs an effect synchronously. A typed `PlatformError` failure is rethrown as
 * the node-shaped error a `node:fs` call would throw (`code`, `syscall`,
 * `path`) — never a `FiberFailure` wrapper — and a defect is rethrown
 * unchanged, never converted into an errno. The code is the failure's own
 * errno when it carries one, else derived from its tag (`BadArgument` is
 * `EINVAL`).
 */
export const runNode: {
 (describe: (error: PlatformError.PlatformError) => { readonly syscall: string; readonly path: string }): <A>(effect: Effect.Effect<A, PlatformError.PlatformError>) => A;
 <A>(effect: Effect.Effect<A, PlatformError.PlatformError>, describe: (error: PlatformError.PlatformError) => { readonly syscall: string; readonly path: string }): A;
} = dual(2, <A>(
	effect: Effect.Effect<A, PlatformError.PlatformError>,
	describe: (error: PlatformError.PlatformError) => { readonly syscall: string; readonly path: string },
): A => {
	const exit = Effect.runSyncExit(effect);
	if (Exit.isSuccess(exit)) return exit.value;
	const error = Cause.findErrorOption(exit.cause);
	if (O.isNone(error)) throw Cause.squash(exit.cause);
	const reason = error.value.reason;
	const code =
		reason._tag === "BadArgument"
			? "EINVAL"
			: (P.hasProperty(reason.cause, "code") && P.isString(reason.cause.code)
				? reason.cause.code
				: fallbackErrnoForTag(reason._tag));
	const { syscall, path } = describe(error.value);
	throw nodeErrno(code, syscall, path);
});

/** {@link runNode} for a handle mutator: node's syscall for the `FileSystem` method and the CALLER's path. */
export const runMutation: {
 (method: MutationMethod, path: string): (effect: Effect.Effect<void, PlatformError.PlatformError>) => void;
 (effect: Effect.Effect<void, PlatformError.PlatformError>, method: MutationMethod, path: string): void;
} = dual(3, (
	effect: Effect.Effect<void, PlatformError.PlatformError>,
	method: MutationMethod,
	path: string,
): void => runNode(effect, () => ({ syscall: syscallForMethod(method), path })));
