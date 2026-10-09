// KIT EXTENSION (fault injection). The delegate-by-default wrapper behind
// `makeFaulty`, `layerFaulty` and `options.faults`: handlers run first, and a
// handler answering `undefined` delegates to the wrapped filesystem.

import { dual } from "effect/Function";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import type {
	MemoryFileSystemFaults,
	MemoryFileSystemFaultsFactory,
	MemoryFileSystemTransientFault,
} from "../MemoryFileSystem.ts";
import * as R from "effect/Record";

/**
 * Throws a `RangeError` naming any fault key that is not a function-valued
 * member of `target`. A misspelled key would otherwise be ignored silently and
 * the test would pass without its fault ever firing — a wiring bug, surfaced at
 * construction like `failTimes`' invalid counts.
 */
export const assertKnownFaultKeys: {
	(target: object, subject: string): (faults: object) => void;
	(faults: object, target: object, subject: string): void;
} = dual(3, (faults: object, target: object, subject: string): void => {
	const members = new Set(
		R.keys(target).filter((key) => P.hasProperty(target, key) && P.isFunction(target[key])),
	);
	const unknown = R.keys(faults).filter((key) => !members.has(key));
	if (unknown.length > 0) {
		throw new RangeError(
			`${subject}: unknown fault key(s) ${unknown.map((key) => `"${key}"`).join(", ")}; expected one of ${[...members].sort().join(", ")}`,
		);
	}
});

export const wrapFaulty: {
	(registration: MemoryFileSystemFaults | MemoryFileSystemFaultsFactory): (base: FileSystem.FileSystem) => FileSystem.FileSystem;
	(base: FileSystem.FileSystem, registration: MemoryFileSystemFaults | MemoryFileSystemFaultsFactory): FileSystem.FileSystem;
} = dual(2, (
	base: FileSystem.FileSystem,
	registration: MemoryFileSystemFaults | MemoryFileSystemFaultsFactory,
): FileSystem.FileSystem => {
	const faults = Object.assign({}, P.isFunction(registration) ? registration(base) : registration);
	assertKnownFaultKeys(faults, base, "MemoryFileSystem faults");
	// Each wrapper keeps its method's arguments, success and environment types.
	// Transient state is armed once here, then consulted on every execution.
	const intercept = <Args extends ReadonlyArray<unknown>, Value, Requirements>(
		target: (...args: Args) => Effect.Effect<Value, PlatformError.PlatformError, Requirements>,
		fault: ((...args: Args) => Effect.Effect<Value, PlatformError.PlatformError, Requirements> | undefined)
			| MemoryFileSystemTransientFault | undefined,
	): ((...args: Args) => Effect.Effect<Value, PlatformError.PlatformError, Requirements>) => {
		if (fault === undefined) return target;
		let remaining = P.isFunction(fault) ? 0 : fault.times;
		return (...args) => Effect.suspend(() => {
			if (P.isFunction(fault)) return fault(...args) ?? target(...args);
			if (remaining <= 0) return target(...args);
			remaining -= 1;
			return Effect.fail(fault.error);
		});
	};
	// Streams and sinks carry their own laziness; consult these handlers at call time.
	const interceptLazy = <Args extends ReadonlyArray<unknown>, Value>(
		target: (...args: Args) => Value,
		fault: ((...args: Args) => Value | undefined) | undefined,
	): ((...args: Args) => Value) => fault === undefined ? target : (...args) => fault(...args) ?? target(...args);
	// Rebuilding through FileSystem.make re-derives `exists`, `readFileString`,
	// `writeFileString`, `stream` and `sink` from the intercepted core methods,
	// so a fault registered on e.g. `readFile` or `open` propagates coherently
	// into the members derived from it — exactly as an OS-level failure would.
	// The five derived members are destructured out of the spread so the
	// contract is explicit rather than relying on `make` to overwrite them.
	const {
		exists: _exists,
		readFileString: _readFileString,
		sink: _sink,
		stream: _stream,
		writeFileString: _writeFileString,
		...primitives
	} = base;
	const core = FileSystem.make({
		...primitives,
		access: intercept(base.access, faults.access),
		chmod: intercept(base.chmod, faults.chmod),
		chown: intercept(base.chown, faults.chown),
		copy: intercept(base.copy, faults.copy),
		copyFile: intercept(base.copyFile, faults.copyFile),
		glob: intercept(base.glob, faults.glob),
		link: intercept(base.link, faults.link),
		makeDirectory: intercept(base.makeDirectory, faults.makeDirectory),
		makeTempDirectory: intercept(base.makeTempDirectory, faults.makeTempDirectory),
		makeTempDirectoryScoped: intercept(base.makeTempDirectoryScoped, faults.makeTempDirectoryScoped),
		makeTempFile: intercept(base.makeTempFile, faults.makeTempFile),
		makeTempFileScoped: intercept(base.makeTempFileScoped, faults.makeTempFileScoped),
		open: intercept(base.open, faults.open),
		readDirectory: intercept(base.readDirectory, faults.readDirectory),
		readFile: intercept(base.readFile, faults.readFile),
		readLink: intercept(base.readLink, faults.readLink),
		realPath: intercept(base.realPath, faults.realPath),
		remove: intercept(base.remove, faults.remove),
		rename: intercept(base.rename, faults.rename),
		stat: intercept(base.stat, faults.stat),
		symlink: intercept(base.symlink, faults.symlink),
		truncate: intercept(base.truncate, faults.truncate),
		utimes: intercept(base.utimes, faults.utimes),
		watch: interceptLazy(base.watch, faults.watch),
		writeFile: intercept(base.writeFile, faults.writeFile),
	});
	return {
		...core,
		exists: intercept(core.exists, faults.exists),
		readFileString: intercept(core.readFileString, faults.readFileString),
		sink: interceptLazy(core.sink, faults.sink),
		stream: interceptLazy(core.stream, faults.stream),
		writeFileString: intercept(core.writeFileString, faults.writeFileString),
	};
});
