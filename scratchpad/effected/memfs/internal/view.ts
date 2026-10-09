// KIT EXTENSION (volume inspection). The synchronous, literal view behind
// `MemoryFileSystem.Volume`. Point queries go through the engine's O(depth)
// literal lookup (which also owns case folding); only `snapshot` and `paths`
// walk the whole tree, because that is what they answer.

import type { MemoryFileSystemVolume } from "../MemoryFileSystem.ts";
import { normalizeAbsolute } from "./seed.ts";
import type { InspectableFileSystem } from "./volume.ts";

const decoder = new TextDecoder();

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
			engine
				.entries()
				.filter((entry) => entry.data !== undefined)
				.map((entry) => entry.path)
				.sort(),
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
