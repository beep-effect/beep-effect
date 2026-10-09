/**
 * In-memory implementation of Effect's `FileSystem` service: an isolated
 * virtual POSIX filesystem for tests and programs that need filesystem
 * behavior without host filesystem IO.
 *
 * Provide `MemoryFileSystem.layer` — or `MemoryFileSystem.layerWith` with a
 * seed describing files, directories, symlinks and initial modes — in place of
 * a host-backed filesystem, and any program requiring `FileSystem.FileSystem`
 * runs against it unchanged. Reads of paths nothing seeded fail typed with
 * `NotFound`; the volume never fabricates content. Permission modes are
 * recorded and readable via `stat` but never enforced on any operation — to
 * exercise permission-failure paths, inject faults with
 * `MemoryFileSystem.layerWith(seed, { faults })` — or `layerFaulty`, a
 * delegate-by-default wrapper over any `FileSystem` implementation.
 *
 * For write-path assertions, every memory layer also publishes
 * `MemoryFileSystem.Volume` — a
 * synchronous, read-only view (`snapshot`/`text`/`bytes`/`has`/`paths`) of the
 * same volume backing the `FileSystem`, so what a program wrote can be read
 * back without an `Effect`. `MemoryFileSystem.makeHandle` (inside `Effect`)
 * and `makeSync` (at describe scope) return every view over one volume at
 * once, plus a layer pinned to it.
 *
 * The `@effected/memfs/node-sync` subpath is the one module that touches the
 * real disk: a read-only, synchronous `FileSystem` over `node:fs`. This main
 * entry imports nothing from `node:*`.
 *
 * The engine is a vendored port, with attribution, of the `MemoryFileSystem`
 * proposed in Effect-TS/effect PR #6573. The seeding, fault-injection and
 * volume-inspection APIs are extensions beyond it.
 *
 * @packageDocumentation
 */

export {
	MemoryFileSystem,
	type MemoryFileSystemDirent,
	type MemoryFileSystemErrnoError,
	type MemoryFileSystemFaultHandler,
	type MemoryFileSystemFaultMethod,
	type MemoryFileSystemFaults,
	type MemoryFileSystemFaultsFactory,
	type MemoryFileSystemHandle,
	type MemoryFileSystemOptions,
	type MemoryFileSystemPortOptions,
	type MemoryFileSystemPortStats,
	type MemoryFileSystemPromisesFaults,
	type MemoryFileSystemPromisesFileSystem,
	type MemoryFileSystemReadFileEncoding,
	type MemoryFileSystemSeed,
	type MemoryFileSystemSeedDirectory,
	type MemoryFileSystemSeedEntry,
	type MemoryFileSystemSeedFile,
	type MemoryFileSystemSeedSymlink,
	type MemoryFileSystemSyncFaults,
	type MemoryFileSystemSyncFileSystem,
	type MemoryFileSystemTransientFault,
	type MemoryFileSystemVolume,
	type MemoryFileSystemVolumeStat,
} from "./MemoryFileSystem.ts";
