import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type { FileSystem } from "effect";
import { Layer, Path } from "effect";

/**
 * An in-memory fixture filesystem for the resolution suites. The map is
 * absolute file path -> file contents.
 *
 * The volume is `@effected/memfs`, a real virtual POSIX filesystem, rather than
 * a `FileSystem.layerNoop` answering the two methods the resolver happens to
 * call. The difference is not cosmetic: a stub implements only the semantics
 * its author remembered, and an unseeded read there returns whatever the stub
 * decided rather than failing — the exact shape that made a hand stub answering
 * `""` hide a real bug elsewhere in the kit. memfs fails an unseeded read typed
 * `NotFound` and never fabricates content.
 *
 * One deliberate behavior change comes with it: memfs creates parent
 * directories, so a directory path now *exists* where the old map-membership
 * stub reported it absent. That is more faithful, and harmless here — the
 * resolution engine probes config *files*, never directories.
 */
export const fixtureFs = (tree: ReadonlyMap<string, string>): Layer.Layer<FileSystem.FileSystem> =>
	MemoryFileSystem.layerWith(Object.fromEntries(tree));

/** The fixture filesystem merged with a POSIX `Path`, the layer every resolution suite provides. */
export const fixtureLayer = (tree: ReadonlyMap<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(fixtureFs(tree), Path.layer);
