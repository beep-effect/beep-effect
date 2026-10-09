// KIT EXTENSION (seeding). The seed applier and the `root` option, kept out of
// the facade so every seeded constructor shares one path.
import { dual } from "effect/Function";
import type * as FileSystem from "effect/FileSystem";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import { badArgument } from "effect/PlatformError";
import type { MemoryFileSystemOptions, MemoryFileSystemSeed, MemoryFileSystemSeedEntry } from "../MemoryFileSystem.ts";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const encoder = new TextEncoder();

export const seedVolume = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, seed: MemoryFileSystemSeed) {
	for (const [path, entry] of R.toEntries(seed)) {
		const separator = path.lastIndexOf("/");
		const parent = separator <= 0 ? "/" : path.slice(0, separator);
		if (parent !== "/") {
			yield* fs.makeDirectory(parent, { recursive: true });
		}
		if (P.isString(entry) || entry instanceof Uint8Array) {
			yield* fs.writeFile(path, P.isString(entry) ? encoder.encode(entry) : entry);
			continue;
		}
		yield* Match.valueTags(entry, {
			MemoryFileSystemSeedFile: Effect.fnUntraced(function* (entry) {
				const data = P.isString(entry.content) ? encoder.encode(entry.content) : entry.content;
				yield* fs.writeFile(path, data, entry.mode !== undefined ? { mode: entry.mode } : undefined);
				// Applied after the write, which stamps the volume's clock. Both
				// times are set together because `utimes` takes the pair; a seed
				// that pins mtime without pinning atime would leave the two
				// disagreeing for no stated reason.
				//
				// A `Date`, NOT the bare number: `utimes` reads a numeric
				// argument as Unix SECONDS (as `fs.utimesSync` does), while this
				// option is epoch milliseconds — passing it through unconverted
				// silently multiplies every seeded time by 1000.
				if (entry.mtime !== undefined) {
					const stamp = DateTime.toDateUtc(DateTime.makeUnsafe(0));
					stamp.setTime(entry.mtime);
					yield* fs.utimes(path, stamp, stamp);
				}
			}),
			MemoryFileSystemSeedDirectory: Effect.fnUntraced(function* (entry) {
				yield* fs.makeDirectory(path, { recursive: true });
				// Applied via chmod rather than makeDirectory's mode option so the
				// mode also lands when the directory already exists — e.g. created
				// implicitly as an earlier entry's parent.
				if (entry.mode !== undefined) {
					yield* fs.chmod(path, entry.mode);
				}
			}),
			MemoryFileSystemSeedSymlink: (entry) => fs.symlink(entry.target, path),
		});
	}
});

// Lexical-only normalization shared by the seed root and the inspection view:
// collapses "//" and ".", applies "..", resolves relative paths from the
// virtual root — matching the engine's canonical "/a/b" spelling. Deliberately
// does NOT follow symlinks.
export const normalizeAbsolute = (path: string): string => {
	const segments: Array<string> = [];
	for (const segment of path.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return `/${segments.join("/")}`;
};

/** What was wrong with a seed's `root` or one of its keys: a description, and the offending root or key. */
export interface SeedRootError {
	readonly description: string;
	readonly subject: string;
}

/**
 * Re-keys a seed under `root`. The root is a JOIN BASE, not a jail: a
 * relative key is joined to it lexically (as `path.posix.join` does), so a key
 * with `..` may land outside it — `root: "/ws/repo"` with `"../extra/a.ts"` is
 * `/ws/extra/a.ts`. A relative root, or an absolute key alongside a root, is an
 * error naming the offending value.
 */
export const applyRoot: {
 (root: string | undefined): (seed: MemoryFileSystemSeed) => Result.Result<{ readonly seed: MemoryFileSystemSeed; readonly root: string | undefined }, SeedRootError>;
 (seed: MemoryFileSystemSeed, root: string | undefined): Result.Result<{ readonly seed: MemoryFileSystemSeed; readonly root: string | undefined }, SeedRootError>;
} = dual(2, (
	seed: MemoryFileSystemSeed,
	root: string | undefined,
): Result.Result<{ readonly seed: MemoryFileSystemSeed; readonly root: string | undefined }, SeedRootError> => {
	if (root === undefined) return Result.succeed({ seed, root: undefined });
	if (!root.startsWith("/")) return Result.fail({ description: `root must be absolute, got "${root}"`, subject: root });
	const base = normalizeAbsolute(root);
	const rooted: Record<string, MemoryFileSystemSeedEntry> = {};
	for (const [key, entry] of R.toEntries(seed)) {
		if (key.startsWith("/")) {
			return Result.fail({
				description: `seed key "${key}" is absolute but a root "${root}" was given`,
				subject: key,
			});
		}
		rooted[key === "" ? base : normalizeAbsolute(`${base}/${key}`)] = entry;
	}
	return Result.succeed({ seed: rooted, root: base });
});

/** Applies the root, creates it, then seeds. A root error is a typed `BadArgument`. */
export const seedWith = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	seed: MemoryFileSystemSeed,
	options: MemoryFileSystemOptions | undefined,
) {
	const applied = applyRoot(seed, options?.root);
	if (Result.isFailure(applied)) {
		return yield* badArgument({ module: "FileSystem", method: "seed", description: applied.failure.description });
	}
	if (applied.success.root !== undefined) {
		yield* fs.makeDirectory(applied.success.root, { recursive: true });
	}
	yield* seedVolume(fs, applied.success.seed);
});
