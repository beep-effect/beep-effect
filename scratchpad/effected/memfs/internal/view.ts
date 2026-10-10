// KIT EXTENSION (volume inspection). The synchronous, literal view behind
// `MemoryFileSystem.Volume`. Point queries go through the engine's O(depth)
// literal lookup (which also owns case folding); only `snapshot` and `paths`
// walk the whole tree, because that is what they answer.

import * as A from "effect/Array";
import * as Order from "effect/Order";
import type { MemoryFileSystemVolume } from "../MemoryFileSystem.ts";
import { normalizeAbsolute } from "./seed.ts";
import type { InspectableFileSystem } from "./volume.ts";

const decoder = new TextDecoder();

/**
 * Adapts an inspectable engine into synchronous queries of its committed volume.
 *
 * **Details**
 *
 * Point queries normalize absolute paths and use the engine's literal lookup,
 * including its case-folding policy. Snapshots and byte reads copy file data;
 * `paths` lists file paths in string order. Directory reads retain stored names.
 *
 * **Gotchas**
 *
 * Symbolic links are inspected literally rather than followed, including links
 * in intermediate path components. Missing entries return `undefined` from
 * value queries and `false` from presence predicates.
 *
 * **Example** (Read a file through the synchronous view)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeVolumeService } from "@beep/scratchpad/effected/memfs/internal/view"
 * import { makeInspectableWith } from "@beep/scratchpad/effected/memfs/internal/volume"
 *
 * const engine = Effect.runSync(makeInspectableWith({ caseSensitive: true }))
 * Effect.runSync(engine.fileSystem.writeFileString("/greeting.txt", "hello"))
 * const view = makeVolumeService(engine)
 * console.log(view.text("/greeting.txt")) // hello
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeVolumeService = (engine: InspectableFileSystem): MemoryFileSystemVolume => {
	const at = (path: string) => engine.lookup(normalizeAbsolute(path));
	return {
		snapshot: () => {
			const record: Record<string, Uint8Array> = {};
			for (const entry of engine.entries()) {
				if (entry.data !== undefined) {
					record[entry.path] = entry.data.slice();
				}
			}
			return record;
		},
		text: (path) => {
			const data = at(path)?.data;
			return data === undefined ? undefined : decoder.decode(data);
		},
		bytes: (path) => at(path)?.data?.slice(),
		has: (path) => at(path) !== undefined,
		paths: () =>
			A.sort(
				engine
					.entries()
					.filter((entry) => entry.data !== undefined)
					.map((entry) => entry.path),
				Order.String,
			),
		// Names under the MATCHED entry, so a folded query lists stored spellings.
		readDirectory: (path) => engine.list(normalizeAbsolute(path)),
		isDirectory: (path) => at(path)?.type === "Directory",
		mtime: (path) => at(path)?.mtime,
		readLink: (path) => {
			const entry = at(path);
			return entry?.type === "SymbolicLink" ? entry.target : undefined;
		},
		lstat: (path) => {
			const entry = at(path);
			if (entry === undefined) return undefined;
			const kind = entry.type === "File" ? "file" : entry.type === "Directory" ? "directory" : "symlink";
			return { kind, mtimeMs: entry.mtime, size: entry.size };
		},
	};
};
