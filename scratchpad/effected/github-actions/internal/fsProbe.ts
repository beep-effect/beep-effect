// "Is there a file / a directory at this path?" — the probe the installers
// ask before deciding whether to reinstall, skip or fail typed.

import type * as FileSystem from "effect/FileSystem";
import * as Effect from "effect/Effect";
import * as Function from "effect/Function";

/**
 * The entry's type, or `undefined` when nothing readable is there. Absence
 * and unreadability collapse together on purpose: every caller's next move
 * (reinstall, write the shim, fail `layoutUnexpected`) is the same for both.
 *
 * @internal
 */
export const typeAt: {
	(fs: FileSystem.FileSystem, path: string): Effect.Effect<FileSystem.File.Type | undefined>;
	(path: string): (fs: FileSystem.FileSystem) => Effect.Effect<FileSystem.File.Type | undefined>;
} = Function.dual(2, (fs: FileSystem.FileSystem, path: string): Effect.Effect<FileSystem.File.Type | undefined> =>
	Effect.map(Effect.option(fs.stat(path)), (info) => (info._tag === "Some" ? info.value.type : undefined)));

/**
 * Whether a thrown value is a Node errno error with the given code — the
 * platform's `SystemError` keeps the raw exception as its `cause`, and codes
 * it maps to no named tag (`EXDEV`, `ESRCH`) are only recoverable from there.
 *
 * @internal
 */
export const isErrno: {
	(cause: unknown, code: string): boolean;
	(code: string): (cause: unknown) => boolean;
} = Function.dual(2, (cause: unknown, code: string): boolean =>
	typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === code);
