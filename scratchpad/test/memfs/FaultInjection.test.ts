// The fault-injection kit extension: a delegate-by-default wrapper over a real
// volume. Only registered methods are intercepted; a handler that declines
// (returns undefined) — and every unregistered method — reaches the wrapped
// filesystem. This is the capability downstream hand-rolled with layerNoop's
// deny-by-default and an empty tree (savvy-web-systems round-1 request).

import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Fiber, FileSystem, Layer, PlatformError, Sink, Stream } from "effect";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { denied } from "./helpers.ts";

// The downstream lockdown shape: a real tree the walk must recurse into.
const tree = {
	"/repos/blocked/src/a.ts": "export {}\n",
	"/repos/blocked/src/b.ts": "export {}\n",
} as const;

describe("MemoryFileSystem.layerFaulty", () => {
	it.effect("an empty fault map is a transparent passthrough over the volume", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			assert.strictEqual(yield* fs.readFileString("/repos/blocked/src/a.ts"), "export {}\n");
			yield* fs.writeFileString("/scratch.txt", "written");
			assert.strictEqual(yield* fs.readFileString("/scratch.txt"), "written");
			assert.isTrue(yield* fs.exists("/repos/blocked"));
			assert.deepStrictEqual((yield* fs.readDirectory("/repos/blocked/src")).sort(), ["a.ts", "b.ts"]);
		}).pipe(Effect.provide(MemoryFileSystem.layerFaulty({}).pipe(Layer.provide(MemoryFileSystem.layerWith(tree))))),
	);

	it.effect("delegates unregistered methods to the wrapped volume over a seeded tree", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;

			// None of these methods carry a fault handler: all must reach the volume.
			assert.deepStrictEqual((yield* fs.readDirectory("/repos/blocked/src")).sort(), ["a.ts", "b.ts"]);
			assert.strictEqual(yield* fs.readFileString("/repos/blocked/src/a.ts"), "export {}\n");
			yield* fs.writeFileString("/repos/blocked/src/c.ts", "export const c = 1;\n");
			assert.strictEqual(yield* fs.readFileString("/repos/blocked/src/c.ts"), "export const c = 1;\n");
			assert.strictEqual((yield* fs.stat("/repos/blocked")).type, "Directory");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith(tree, {
					faults: {
						chmod: (path, mode) => (mode === 0o555 || mode === 0o444 ? Effect.fail(denied("chmod", path)) : undefined),
					},
				}),
			),
		),
	);

	it.effect("hands the handler the real call arguments — chmod fails on 0o555/0o444, succeeds on 0o755", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;

			// The unlock pass (0o755) must delegate and be recorded by the volume.
			yield* fs.chmod("/repos/blocked", 0o755);
			assert.strictEqual((yield* fs.stat("/repos/blocked")).mode & 0o7777, 0o755);

			// The relock pass (0o555/0o444) must fail typed — same code path.
			const relock = yield* Effect.flip(fs.chmod("/repos/blocked", 0o555));
			assert.strictEqual(relock._tag, "PlatformError");
			assert.strictEqual(relock.reason._tag, "PermissionDenied");
			if (relock.reason._tag === "PermissionDenied") {
				assert.strictEqual(relock.reason.method, "chmod");
				assert.strictEqual(relock.reason.pathOrDescriptor, "/repos/blocked");
			}
			const relockFile = yield* Effect.flip(fs.chmod("/repos/blocked/src/a.ts", 0o444));
			assert.strictEqual(relockFile.reason._tag, "PermissionDenied");

			// The failed relock changed nothing, and delegation still works after.
			assert.strictEqual((yield* fs.stat("/repos/blocked")).mode & 0o7777, 0o755);
			yield* fs.chmod("/repos/blocked/src/a.ts", 0o644);
		}).pipe(
			// The layerFaulty ∘ Layer.provide(volume) composition from the request.
			Effect.provide(
				MemoryFileSystem.layerFaulty({
					chmod: (path, mode) => (mode === 0o555 || mode === 0o444 ? Effect.fail(denied("chmod", path)) : undefined),
				}).pipe(Layer.provide(MemoryFileSystem.layerWith(tree))),
			),
		),
	);

	it.effect("a handler can key on the path, faulting one file while its siblings delegate", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const error = yield* Effect.flip(fs.readFileString("/repos/blocked/src/a.ts"));
			assert.strictEqual(error.reason._tag, "PermissionDenied");
			assert.strictEqual(yield* fs.readFileString("/repos/blocked/src/b.ts"), "export {}\n");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith(tree, {
					faults: {
						readFileString: (path) =>
							path === "/repos/blocked/src/a.ts" ? Effect.fail(denied("readFileString", path)) : undefined,
					},
				}),
			),
		),
	);

	it.effect("a fault on a core method propagates into the members derived from it", () =>
		Effect.gen(function* () {
			const base = yield* MemoryFileSystem.makeWith({ "/data.bin": "payload" });
			const faulty = MemoryFileSystem.makeFaulty(base, {
				readFile: (path) => Effect.fail(denied("readFile", path)),
				access: (path) =>
					Effect.fail(
						PlatformError.systemError({
							_tag: "NotFound",
							module: "FileSystem",
							method: "access",
							pathOrDescriptor: path,
						}),
					),
			});

			// readFileString is derived from readFile: the fault flows through.
			const derived = yield* Effect.flip(faulty.readFileString("/data.bin"));
			assert.strictEqual(derived.reason._tag, "PermissionDenied");
			// exists is derived from access: an injected NotFound reads as false.
			assert.isFalse(yield* faulty.exists("/data.bin"));
			// The wrapped volume itself is untouched.
			assert.strictEqual(yield* base.readFileString("/data.bin"), "payload");
		}),
	);

	it.effect("makeFaulty wraps a hand-built filesystem value directly", () =>
		Effect.gen(function* () {
			const base = yield* MemoryFileSystem.makeWith({ "/kept.txt": "kept" });
			const faulty = MemoryFileSystem.makeFaulty(base, {
				remove: (path) => Effect.fail(denied("remove", path)),
			});
			const error = yield* Effect.flip(faulty.remove("/kept.txt"));
			assert.strictEqual(error.reason._tag, "PermissionDenied");
			assert.strictEqual(yield* faulty.readFileString("/kept.txt"), "kept");
		}),
	);

	it.effect(
		"every member FileSystem.make derives is directly interceptable — the fault fires on the member itself",
		() =>
			Effect.gen(function* () {
				// FileSystem.make derives exactly five members (exists, readFileString,
				// stream, sink, writeFileString). A fault registered on any of them
				// must fire on that member — never be silently bypassed by the
				// re-derivation from an unfaulted primitive.
				const base = yield* MemoryFileSystem.makeWith({ "/f.txt": "content" });
				const faulty = MemoryFileSystem.makeFaulty(base, {
					exists: (path) => Effect.fail(denied("exists", path)),
					readFileString: (path) => Effect.fail(denied("readFileString", path)),
					writeFileString: (path) => Effect.fail(denied("writeFileString", path)),
					stream: (path) => Stream.fail(denied("stream", path)),
					sink: (path) => Sink.fail(denied("sink", path)),
				});

				assert.strictEqual((yield* Effect.flip(faulty.exists("/f.txt"))).reason._tag, "PermissionDenied");
				assert.strictEqual((yield* Effect.flip(faulty.readFileString("/f.txt"))).reason._tag, "PermissionDenied");
				assert.strictEqual((yield* Effect.flip(faulty.writeFileString("/f.txt", "x"))).reason._tag, "PermissionDenied");
				assert.strictEqual(
					(yield* Effect.flip(Stream.runCollect(faulty.stream("/f.txt")))).reason._tag,
					"PermissionDenied",
				);
				const sinkError = yield* Effect.flip(Stream.make(new Uint8Array([1])).pipe(Stream.run(faulty.sink("/f.txt"))));
				assert.strictEqual(sinkError.reason._tag, "PermissionDenied");
				// The primitives beneath them are untouched: readFile still answers.
				assert.deepStrictEqual(yield* faulty.readFile("/f.txt"), new TextEncoder().encode("content"));
			}),
	);

	it.effect("watch is interceptable — a handler can replace or delegate the event stream", () =>
		Effect.gen(function* () {
			const base = yield* MemoryFileSystem.makeWith({ "/watched/real.txt": "x" });
			const faulty = MemoryFileSystem.makeFaulty(base, {
				watch: (path) =>
					path === "/synthetic" ? Stream.make({ _tag: "Create", path: "/synthetic/event" } as const) : undefined,
			});

			// Replacement: the canned stream, no volume involvement.
			assert.deepStrictEqual(yield* Stream.runCollect(faulty.watch("/synthetic")), [
				{ _tag: "Create", path: "/synthetic/event" },
			]);

			// Delegation (undefined): a real watch on the volume still delivers
			// real events. The yield parks the parent behind the forked child so
			// the subscription registers before the mutation publishes.
			const events = yield* faulty
				.watch("/watched")
				.pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
			yield* Effect.yieldNow;
			yield* faulty.writeFileString("/watched/new.txt", "y");
			assert.deepStrictEqual(Array.from(yield* Fiber.join(events)), [{ _tag: "Create", path: "/watched/new.txt" }]);
		}),
	);

	it("type-enforces genuine PlatformError faults and confines failTimes to the Effect-returning methods", () => {
		const rejectsBareError = MemoryFileSystem.layerFaulty({
			// @ts-expect-error -- a bare Error is not a PlatformError
			readFileString: () => Effect.fail(new Error("nope")),
		});
		const rejectsTransientOnLazy = MemoryFileSystem.layerFaulty({
			// @ts-expect-error -- watch returns a Stream; a transient Effect fault cannot replace it
			watch: MemoryFileSystem.failTimes(1, denied("watch", "/w")),
		});
		assert.isDefined(rejectsBareError);
		assert.isDefined(rejectsTransientOnLazy);
	});
});

describe("MemoryFileSystem.failTimes", () => {
	const busy = PlatformError.systemError({
		_tag: "Busy",
		module: "FileSystem",
		method: "readFileString",
		pathOrDescriptor: "/config.json",
	});

	it.effect("fails exactly N intercepted calls, then delegates to the volume", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;

			const first = yield* Effect.flip(fs.readFileString("/config.json"));
			assert.strictEqual(first.reason._tag, "Busy");
			const second = yield* Effect.flip(fs.readFileString("/config.json"));
			assert.strictEqual(second.reason._tag, "Busy");

			// Third call delegates — and keeps delegating.
			assert.strictEqual(yield* fs.readFileString("/config.json"), "{}");
			assert.strictEqual(yield* fs.readFileString("/config.json"), "{}");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith(
					{ "/config.json": "{}" },
					{ faults: { readFileString: MemoryFileSystem.failTimes(2, busy) } },
				),
			),
		),
	);

	it.effect("re-arms its counter on each layer build — one bound layer const, two provides", () =>
		Effect.gen(function* () {
			const Flaky = MemoryFileSystem.layerWith(
				{ "/config.json": "{}" },
				{ faults: { readFileString: MemoryFileSystem.failTimes(1, busy) } },
			);
			const probe = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const first = yield* Effect.flip(fs.readFileString("/config.json"));
				assert.strictEqual(first.reason._tag, "Busy");
				assert.strictEqual(yield* fs.readFileString("/config.json"), "{}");
			});

			// Layer memoization is per-build: each provide arms a fresh counter.
			yield* probe.pipe(Effect.provide(Flaky));
			yield* probe.pipe(Effect.provide(Flaky));
			// Layer.fresh likewise builds fresh — its real role is per-consumer
			// isolation WITHIN one graph; across provides there is nothing to
			// isolate, as the two bare provides above already showed.
			yield* probe.pipe(Effect.provide(Layer.fresh(Flaky)));
		}),
	);

	it.effect("counts executions, not invocations — Effect.retry attempts consume failures", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			// ONE effect value, retried: each attempt re-consults the fault, so a
			// retry policy outlasts the transient failure window.
			const value = yield* fs.readFileString("/config.json").pipe(Effect.retry({ times: 2 }));
			assert.strictEqual(value, "{}");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith(
					{ "/config.json": "{}" },
					{ faults: { readFileString: MemoryFileSystem.failTimes(2, busy) } },
				),
			),
		),
	);

	it.effect("each makeFaulty call arms its own counter over the same base volume", () =>
		Effect.gen(function* () {
			const base = yield* MemoryFileSystem.makeWith({ "/config.json": "{}" });
			const faults = { readFileString: MemoryFileSystem.failTimes(1, busy) };

			const one = MemoryFileSystem.makeFaulty(base, faults);
			const two = MemoryFileSystem.makeFaulty(base, faults);

			assert.strictEqual((yield* Effect.flip(one.readFileString("/config.json"))).reason._tag, "Busy");
			assert.strictEqual(yield* one.readFileString("/config.json"), "{}");
			// `two` was armed independently and still owes its failure.
			assert.strictEqual((yield* Effect.flip(two.readFileString("/config.json"))).reason._tag, "Busy");
		}),
	);

	it("rejects a negative or fractional count at construction — a wiring bug, not runtime input", () => {
		assert.throws(() => MemoryFileSystem.failTimes(-1, busy), RangeError);
		assert.throws(() => MemoryFileSystem.failTimes(1.5, busy), RangeError);
		assert.throws(() => MemoryFileSystem.failTimes(Number.NaN, busy), RangeError);
	});

	it.effect("failTimes(0) never fails — it delegates from the first call", () =>
		Effect.gen(function* () {
			const base = yield* MemoryFileSystem.makeWith({ "/config.json": "{}" });
			const faulty = MemoryFileSystem.makeFaulty(base, {
				readFileString: MemoryFileSystem.failTimes(0, busy),
			});
			assert.strictEqual(yield* faulty.readFileString("/config.json"), "{}");
		}),
	);
});

describe("MemoryFileSystem.die", () => {
	const unstubbed = new Error("makeDirectory is not stubbed");

	// The whole point: a defect is not a failure, so the defensive `Effect.catch`
	// a caller writes around a read cannot absorb it. A typed fault would pass
	// through that catch, and a test written with one would pass while the real
	// code path dies.
	it.effect("fails the member as a defect that Effect.catch cannot absorb", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const exit = yield* Effect.exit(
				fs.makeDirectory("/new", { recursive: true }).pipe(Effect.catch(() => Effect.void)),
			);
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.isTrue(Cause.hasDies(exit.cause));
				assert.isFalse(Cause.hasFails(exit.cause));
				assert.strictEqual(Cause.squash(exit.cause), unstubbed);
			}
		}).pipe(
			Effect.provide(MemoryFileSystem.layerWith({}, { faults: { makeDirectory: MemoryFileSystem.die(unstubbed) } })),
		),
	);

	it.effect("dies with exactly the defect it was given, and leaves other members delegating", () =>
		Effect.gen(function* () {
			const defect = new Error("readDirectory is not stubbed");
			const base = yield* MemoryFileSystem.makeWith(tree);
			const fs = MemoryFileSystem.makeFaulty(base, { readDirectory: MemoryFileSystem.die(defect) });
			const exit = yield* Effect.exit(fs.readDirectory("/repos/blocked/src"));
			assert.isTrue(Exit.isFailure(exit) && Cause.squash(exit.cause) === defect);
			assert.strictEqual(yield* fs.readFileString("/repos/blocked/src/a.ts"), "export {}\n");
		}),
	);
});

describe("MemoryFileSystem fault factories", () => {
	// The case-insensitive-volume workaround effected#874 describes, as the
	// one-liner the factory form makes it: rewrite the argument, delegate to the
	// UNFAULTED base.
	it.effect("hands the factory the wrapped volume, so a handler can rewrite arguments and delegate", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			assert.strictEqual((yield* fs.stat("/Docs.json")).type, "File");
			assert.strictEqual(yield* fs.readFileString("/DOCS.JSON"), "{}");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith(
					{ "/docs.json": "{}" },
					{
						faults: (base) => ({
							stat: (path) => base.stat(path.toLowerCase()),
							readFileString: (path, encoding) => base.readFileString(path.toLowerCase(), encoding),
						}),
					},
				),
			),
		),
	);

	it.effect("the base the factory receives is unfaulted, so delegating to it cannot recurse", () =>
		Effect.gen(function* () {
			const base = yield* MemoryFileSystem.makeWith({ "/a.txt": "a" });
			const fs = MemoryFileSystem.makeFaulty(base, (inner) => ({
				readFileString: (path, encoding) =>
					path === "/alias.txt"
						? inner.readFileString("/a.txt", encoding)
						: Effect.fail(denied("readFileString", path)),
			}));
			assert.strictEqual(yield* fs.readFileString("/alias.txt"), "a");
			assert.strictEqual((yield* Effect.flip(fs.readFileString("/a.txt"))).reason._tag, "PermissionDenied");
		}),
	);

	it.effect("calls the factory once per build, so faults it creates are armed per build", () =>
		Effect.gen(function* () {
			let calls = 0;
			const flaky = MemoryFileSystem.layerFaulty(() => {
				calls += 1;
				return { readFileString: MemoryFileSystem.failTimes(1, denied("readFileString", "/config.json")) };
			}).pipe(Layer.provide(MemoryFileSystem.layerWith({ "/config.json": "{}" })));
			const readTwice = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				yield* Effect.flip(fs.readFileString("/config.json"));
				return yield* fs.readFileString("/config.json");
			});
			assert.strictEqual(yield* readTwice.pipe(Effect.provide(flaky)), "{}");
			assert.strictEqual(yield* readTwice.pipe(Effect.provide(flaky)), "{}");
			assert.strictEqual(calls, 2);
		}),
	);
});
