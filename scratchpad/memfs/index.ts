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
 * `MemoryFileSystem.layerFaulty`, a delegate-by-default wrapper over any
 * `FileSystem` implementation.
 *
 * For write-path assertions, the opt-in `MemoryFileSystem.layerInspectable` /
 * `layerInspectableWith` additionally publish `MemoryFileSystem.Volume` — a
 * synchronous, read-only view (`snapshot`/`text`/`bytes`/`has`/`paths`) of the
 * same volume backing the `FileSystem`, so what a program wrote can be read
 * back without an `Effect`.
 *
 * The engine is a vendored port with attribution of Effect-TS/effect PR #6573
 * (pinned `c0528bd5`); see the package design doc for the adaptation ledger.
 * The seeding, fault-injection and volume-inspection APIs are kit extensions.
 *
 * @packageDocumentation
 */

export {
	MemoryFileSystem,
	type MemoryFileSystemFaultHandler,
	type MemoryFileSystemFaultMethod,
	type MemoryFileSystemFaults,
	type MemoryFileSystemInspectable,
	type MemoryFileSystemSeed,
	type MemoryFileSystemSeedDirectory,
	type MemoryFileSystemSeedEntry,
	type MemoryFileSystemSeedFile,
	type MemoryFileSystemSeedSymlink,
	type MemoryFileSystemSyncFileSystem,
	type MemoryFileSystemTransientFault,
	type MemoryFileSystemVolume,
} from "./MemoryFileSystem.ts";
