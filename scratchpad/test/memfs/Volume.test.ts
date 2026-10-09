// The volume-inspection kit extension (effected#383): an opt-in second service
// publishing a synchronous, read-only view of the SAME volume backing the
// FileSystem, so write-path tests can assert on what a program wrote without
// routing every assertion through an Effect read.

import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as internal from "../../effected/memfs/internal/volume.ts";
import { denied } from "./helpers.ts";

const encoder = new TextEncoder();

describe("MemoryFileSystem.layer — Volume", () => {
	it.effect("THE INVARIANT: within one build, Volume inspects the same volume backing FileSystem", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;

			// A write through the FileSystem service is immediately visible to
			// the inspection service — one underlying volume, two views.
			yield* fs.makeDirectory("/managed", { recursive: true });
			yield* fs.writeFileString("/managed/output.txt", "written through fs");
			assert.strictEqual(volume.text("/managed/output.txt"), "written through fs");
			assert.isTrue(volume.has("/managed"));

			// And the view is live, not a copy taken at build: a removal shows.
			yield* fs.remove("/managed/output.txt");
			assert.isUndefined(volume.text("/managed/output.txt"));
			assert.isFalse(volume.has("/managed/output.txt"));
		}).pipe(Effect.provide(MemoryFileSystem.layer)),
	);

	it.effect("per-build semantics hold — two provides are two volumes, each pair internally consistent", () =>
		Effect.gen(function* () {
			const probe = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const volume = yield* MemoryFileSystem.Volume;
				// The other build's write must not be here (fresh volume)…
				assert.isFalse(volume.has("/scratch.txt"));
				// …and this build's own write must be (consistent pair).
				yield* fs.writeFileString("/scratch.txt", "mine");
				assert.strictEqual(volume.text("/scratch.txt"), "mine");
			});

			yield* probe.pipe(Effect.provide(MemoryFileSystem.layer));
			yield* probe.pipe(Effect.provide(MemoryFileSystem.layer));
		}),
	);
});

describe("MemoryFileSystem.layerWith — Volume", () => {
	const Seeded = MemoryFileSystem.layerWith({
		"/repo/package.json": `{ "name": "fixture" }`,
		"/repo/bin/run.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
		"/repo/empty": MemoryFileSystem.directory(),
		"/repo/latest": MemoryFileSystem.symlink("/repo/package.json"),
		"/repo/dangling": MemoryFileSystem.symlink("/repo/absent"),
	});

	it.effect("seed parity with layerWith — every entry kind lands, inspectable and readable", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;

			// Seeded files answer through both views.
			assert.strictEqual(volume.text("/repo/package.json"), `{ "name": "fixture" }`);
			assert.strictEqual(yield* fs.readFileString("/repo/package.json"), `{ "name": "fixture" }`);
			assert.strictEqual((yield* fs.stat("/repo/bin/run.sh")).mode & 0o777, 0o755);

			// has(): files, directories and symlinks all count as present —
			// the symlink itself, its target never consulted.
			assert.isTrue(volume.has("/repo/package.json"));
			assert.isTrue(volume.has("/repo/empty"));
			assert.isTrue(volume.has("/repo/latest"));
			assert.isTrue(volume.has("/repo/dangling"));
			assert.isFalse(volume.has("/repo/absent"));

			// The literal view: a symlink has no content of its own (reading
			// THROUGH it is the FileSystem API's job), a directory neither.
			assert.isUndefined(volume.text("/repo/latest"));
			assert.isUndefined(volume.bytes("/repo/empty"));
			assert.strictEqual(yield* fs.readFileString("/repo/latest"), `{ "name": "fixture" }`);
		}).pipe(Effect.provide(Seeded)),
	);

	it.effect("snapshot and paths list regular files only — seeded AND written, sorted, no dirs or symlinks", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;

			yield* fs.writeFileString("/repo/written.txt", "later");

			const snapshot = volume.snapshot();
			assert.deepStrictEqual(Object.keys(snapshot).sort(), [
				"/repo/bin/run.sh",
				"/repo/package.json",
				"/repo/written.txt",
			]);
			assert.deepStrictEqual(snapshot["/repo/written.txt"], encoder.encode("later"));

			// paths() is exactly snapshot's key set, sorted lexicographically.
			assert.deepStrictEqual(volume.paths(), ["/repo/bin/run.sh", "/repo/package.json", "/repo/written.txt"]);
		}).pipe(Effect.provide(Seeded)),
	);

	it.effect("honest absence — undefined for absent paths, '' only for a genuinely empty file", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;

			// THE #249 CONTRACT, carried to the sync view: absence is undefined,
			// never a fabricated "".
			assert.isUndefined(volume.text("/absent/changesets/config.json"));
			assert.isUndefined(volume.bytes("/absent.bin"));

			// "" round-trips for a real empty file — distinguishable from absent.
			yield* fs.writeFileString("/empty.txt", "");
			assert.strictEqual(volume.text("/empty.txt"), "");
			assert.deepStrictEqual(volume.bytes("/empty.txt"), new Uint8Array());
		}).pipe(Effect.provide(MemoryFileSystem.layer)),
	);

	it.effect("queries normalize lexically — '//', '.', '..' and relative paths resolve, symlinks stay literal", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;
			yield* fs.makeDirectory("/a/b", { recursive: true });
			yield* fs.writeFileString("/a/b/c.txt", "found");

			assert.strictEqual(volume.text("/a//b/./c.txt"), "found");
			assert.strictEqual(volume.text("/a/x/../b/c.txt"), "found");
			// Relative paths resolve from the virtual root, matching the engine.
			assert.strictEqual(volume.text("a/b/c.txt"), "found");
			// Symlinks stay literal — never followed, not even mid-path: the link
			// itself is present, but nothing lives "under" it in this view.
			yield* fs.symlink("/a/b", "/link");
			assert.isTrue(volume.has("/link"));
			assert.isFalse(volume.isDirectory("/link"));
			assert.isFalse(volume.has("/link/c.txt"));
			assert.isUndefined(volume.text("/link/c.txt"));
			assert.isUndefined(volume.readDirectory("/link"));
		}).pipe(Effect.provide(MemoryFileSystem.layer)),
	);

	it.effect("returned byte arrays are defensive copies — mutating them cannot corrupt the volume", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;
			yield* fs.writeFileString("/data.bin", "abc");

			const stolen = volume.bytes("/data.bin");
			assert.isDefined(stolen);
			stolen?.fill(0);
			assert.strictEqual(volume.text("/data.bin"), "abc");
			assert.strictEqual(yield* fs.readFileString("/data.bin"), "abc");
		}).pipe(Effect.provide(MemoryFileSystem.layer)),
	);

	it.effect("a contradictory seed dies — a wiring bug, mirroring layerWith", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				Effect.gen(function* () {
					const volume = yield* MemoryFileSystem.Volume;
					return volume.paths();
				}).pipe(Effect.provide(MemoryFileSystem.layerWith({ "/a": "file", "/a/b": "child" }))),
			);
			assert.isTrue(exit._tag === "Failure");
		}),
	);
});

describe("inspection composed under fault injection", () => {
	it.effect("delegated writes land in the volume; a faulted write does not", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const volume = yield* MemoryFileSystem.Volume;

			// The delegating branch really writes — the spy pattern's guarantee.
			yield* fs.writeFileString("/allowed.txt", "landed");
			assert.strictEqual(volume.text("/allowed.txt"), "landed");

			// The faulted branch fails typed AND leaves no trace in the volume.
			const error = yield* Effect.flip(fs.writeFileString("/blocked.txt", "never"));
			assert.strictEqual(error.reason._tag, "PermissionDenied");
			assert.isFalse(volume.has("/blocked.txt"));
			assert.deepStrictEqual(volume.paths(), ["/allowed.txt", "/seed.txt"]);
		}).pipe(
			// provideMerge: the decorated FileSystem wins the key; Volume survives.
			Effect.provide(
				MemoryFileSystem.layerFaulty({
					writeFileString: (path) =>
						path === "/blocked.txt" ? Effect.fail(denied("writeFileString", path)) : undefined,
				}).pipe(Layer.provideMerge(MemoryFileSystem.layerWith({ "/seed.txt": "seeded" }))),
			),
		),
	);
});

describe("the templates-fixture acceptance sketch", () => {
	it.effect("write-then-read-back assertions become vol.text(path)", () =>
		Effect.gen(function* () {
			// The downstream shape: code under test writes a managed file; the
			// test asserts on final content synchronously — previously
			// `fs.files.get(p)` on a hand-rolled Map double.
			const fs = yield* FileSystem.FileSystem;
			const vol = yield* MemoryFileSystem.Volume;

			const path = "/repo/.github/workflows/release.yml";
			yield* fs.makeDirectory("/repo/.github/workflows", { recursive: true });
			yield* fs.writeFileString(path, "# BEGIN managed\njobs: {}\n# END managed\n");

			assert.strictEqual(vol.text(path), "# BEGIN managed\njobs: {}\n# END managed\n");
			assert.isTrue(vol.has("/repo/.github"));
			assert.deepStrictEqual(vol.paths(), [path]);
		}).pipe(Effect.provide(MemoryFileSystem.layer)),
	);
});

// Modification time on the inspection view (effected#396 item 6): the piece a
// signature-diff test needs — "this file changed and that one did not" —
// expressible in a seed and readable synchronously.
describe("MemoryFileSystemVolume.mtime", () => {
	it.effect("a seeded mtime is readable, and distinct files keep distinct times", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/pkg/src/old.ts": MemoryFileSystem.file("old", { mtime: 1_000 }),
				"/pkg/src/new.ts": MemoryFileSystem.file("new", { mtime: 9_000 }),
			});
			assert.strictEqual(volume.mtime("/pkg/src/old.ts"), 1_000);
			assert.strictEqual(volume.mtime("/pkg/src/new.ts"), 9_000);
		}),
	);

	it.effect("HONEST ABSENCE: an absent path is undefined, never a 1970 timestamp", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/epoch.txt": MemoryFileSystem.file("at the epoch", { mtime: 0 }),
			});
			// 0 is a REAL modification time. A signature over mtimes must be able to
			// tell it apart from a file that is not there at all — conflating them
			// is the silent-green this contract exists to prevent.
			assert.strictEqual(volume.mtime("/epoch.txt"), 0);
			assert.strictEqual(volume.mtime("/absent.txt"), undefined);
		}),
	);

	it.effect("a write restamps the entry from the Effect Clock — which under test starts at the epoch", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
				"/tracked.txt": MemoryFileSystem.file("before", { mtime: 1_000 }),
			});
			assert.strictEqual(volume.mtime("/tracked.txt"), 1_000);

			// The volume stamps writes from the Effect `Clock`, not `Date.now()`.
			// That is what makes mtime drivable — but it also means the default
			// test clock sits at the EPOCH, so a write reads as 0 and a seeded
			// 1_000 looks like the FUTURE. A signature test that assumes writes
			// move time forward is a false green waiting to happen.
			yield* fileSystem.writeFileString("/tracked.txt", "after");
			assert.strictEqual(volume.mtime("/tracked.txt"), 0);

			// Advance the clock and the next write lands where it was moved to.
			yield* TestClock.adjust("5 seconds");
			yield* fileSystem.writeFileString("/tracked.txt", "later");
			assert.strictEqual(volume.mtime("/tracked.txt"), 5_000);
		}),
	);

	it.effect("utimes through the FileSystem is visible to the view", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
				"/a.txt": "contents",
			});
			// `utimes` reads a NUMBER as Unix seconds, so 5_000 there means
			// 5_000_000 ms — the unit trap the seed option converts away from.
			yield* fileSystem.utimes("/a.txt", 5_000, 5_000);
			assert.strictEqual(volume.mtime("/a.txt"), 5_000_000);
			// A Date is unambiguous and round-trips in milliseconds.
			const stamp = new Date(1_234_567);
			yield* fileSystem.utimes("/a.txt", stamp, stamp);
			assert.strictEqual(volume.mtime("/a.txt"), 1_234_567);
		}),
	);

	it.effect("mtime agrees with what stat reports through the FileSystem", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
				"/a.txt": MemoryFileSystem.file("contents", { mtime: 4_242 }),
			});
			const info = yield* fileSystem.stat("/a.txt");
			// One clock, two views — the sync accessor must not drift from `stat`.
			const fromStat = Option.getOrThrow(info.mtime).getTime();
			assert.strictEqual(volume.mtime("/a.txt"), fromStat);
		}),
	);

	it.effect("directories carry an mtime too", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/dir": MemoryFileSystem.directory(),
			});
			assert.isDefined(volume.mtime("/dir"));
		}),
	);
});

describe("engine snapshot size", () => {
	it.effect("reports file bytes, symlink target length and 0 for directories", () =>
		Effect.gen(function* () {
			const { fileSystem, entries } = yield* internal.makeInspectableWith({ caseSensitive: true });
			yield* fileSystem.makeDirectory("/d");
			yield* fileSystem.writeFileString("/d/f.txt", "héllo");
			yield* fileSystem.symlink("/d/f.txt", "/d/l");
			const byPath = new Map(entries().map((e) => [e.path, e]));
			assert.strictEqual(byPath.get("/d/f.txt")?.size, 6);
			assert.strictEqual(byPath.get("/d/l")?.size, 8);
			assert.strictEqual(byPath.get("/d")?.size, 0);
		}),
	);
});
