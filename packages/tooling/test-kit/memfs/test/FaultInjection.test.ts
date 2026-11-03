// The fault-injection kit extension: a delegate-by-default wrapper over a real
// volume. Only registered methods are intercepted; a handler that declines
// (returns undefined) — and every unregistered method — reaches the wrapped
// filesystem. This is the capability downstream hand-rolled with layerNoop's
// deny-by-default and an empty tree (savvy-web-systems round-1 request).

import { MemoryFileSystem } from "@beep/memfs";
import { InvalidFaultCountError } from "@beep/memfs/MemoryFileSystem";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
import { denied } from "./helpers.ts";
import type { MemoryFileSystemFaults, MemoryFileSystemTransientFault } from "@beep/memfs/MemoryFileSystem";

// The downstream lockdown shape: a real tree the walk must recurse into.
const tree = {
  "/repos/blocked/src/a.ts": "export {}\n",
  "/repos/blocked/src/b.ts": "export {}\n",
} as const;

describe("MemoryFileSystem.layerFaulty", () => {
  it.layer(MemoryFileSystem.layerFaulty({}).pipe(Layer.provide(MemoryFileSystem.layerWith(tree))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("an empty fault map is a transparent passthrough over the volume", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const readFileString1 = yield* fs.readFileString("/repos/blocked/src/a.ts");
        assert.strictEqual(readFileString1, "export {}\n");
        yield* fs.writeFileString("/scratch.txt", "written");
        const readFileString2 = yield* fs.readFileString("/scratch.txt");
        assert.strictEqual(readFileString2, "written");
        const exists3 = yield* fs.exists("/repos/blocked");
        assert.isTrue(exists3);
        assert.deepStrictEqual((yield* fs.readDirectory("/repos/blocked/src")).sort(), ["a.ts", "b.ts"]);
      })
    );
  });

  it.layer(
    MemoryFileSystem.layerWith(tree, {
      faults: {
        chmod: (path, mode) => (mode === 0o555 || mode === 0o444 ? Effect.fail(denied("chmod", path)) : undefined),
      },
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("delegates unregistered methods to the wrapped volume over a seeded tree", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;

        // None of these methods carry a fault handler: all must reach the volume.
        assert.deepStrictEqual((yield* fs.readDirectory("/repos/blocked/src")).sort(), ["a.ts", "b.ts"]);
        const readFileString4 = yield* fs.readFileString("/repos/blocked/src/a.ts");
        assert.strictEqual(readFileString4, "export {}\n");
        yield* fs.writeFileString("/repos/blocked/src/c.ts", "export const c = 1;\n");
        const readFileString5 = yield* fs.readFileString("/repos/blocked/src/c.ts");
        assert.strictEqual(readFileString5, "export const c = 1;\n");
        assert.strictEqual((yield* fs.stat("/repos/blocked")).type, "Directory");
      })
    );
  });

  it.layer(
    MemoryFileSystem.layerFaulty({
      chmod: (path, mode) => (mode === 0o555 || mode === 0o444 ? Effect.fail(denied("chmod", path)) : undefined),
    }).pipe(Layer.provide(MemoryFileSystem.layerWith(tree))),
    { timeout: "30 seconds" }
  )((it) => {
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
      })
    );
  });

  it.layer(
    MemoryFileSystem.layerWith(tree, {
      faults: {
        readFileString: (path) =>
          path === "/repos/blocked/src/a.ts" ? Effect.fail(denied("readFileString", path)) : undefined,
      },
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a handler can key on the path, faulting one file while its siblings delegate", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const error = yield* Effect.flip(fs.readFileString("/repos/blocked/src/a.ts"));
        assert.strictEqual(error.reason._tag, "PermissionDenied");
        const readFileString6 = yield* fs.readFileString("/repos/blocked/src/b.ts");
        assert.strictEqual(readFileString6, "export {}\n");
      })
    );
  });

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
            })
          ),
      });

      // readFileString is derived from readFile: the fault flows through.
      const derived = yield* Effect.flip(faulty.readFileString("/data.bin"));
      assert.strictEqual(derived.reason._tag, "PermissionDenied");
      // exists is derived from access: an injected NotFound reads as false.
      const exists7 = yield* faulty.exists("/data.bin");
      assert.isFalse(exists7);
      // The wrapped volume itself is untouched.
      const readFileString8 = yield* base.readFileString("/data.bin");
      assert.strictEqual(readFileString8, "payload");
    })
  );

  it.effect("makeFaulty wraps a hand-built filesystem value directly", () =>
    Effect.gen(function* () {
      const base = yield* MemoryFileSystem.makeWith({ "/kept.txt": "kept" });
      const faulty = MemoryFileSystem.makeFaulty(base, {
        remove: (path) => Effect.fail(denied("remove", path)),
      });
      const error = yield* Effect.flip(faulty.remove("/kept.txt"));
      assert.strictEqual(error.reason._tag, "PermissionDenied");
      const readFileString9 = yield* faulty.readFileString("/kept.txt");
      assert.strictEqual(readFileString9, "kept");
    })
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
          (yield* faulty.stream("/f.txt").pipe(Stream.runCollect, Effect.flip)).reason._tag,
          "PermissionDenied"
        );
        const sinkError = yield* Effect.flip(Stream.make(new Uint8Array([1])).pipe(Stream.run(faulty.sink("/f.txt"))));
        assert.strictEqual(sinkError.reason._tag, "PermissionDenied");
        // The primitives beneath them are untouched: readFile still answers.
        const readFile10 = yield* faulty.readFile("/f.txt");
        assert.deepStrictEqual(readFile10, new TextEncoder().encode("content"));
      })
  );

  it.effect("watch is interceptable — a handler can replace or delegate the event stream", () =>
    Effect.gen(function* () {
      const base = yield* MemoryFileSystem.makeWith({ "/watched/real.txt": "x" });
      const faulty = MemoryFileSystem.makeFaulty(base, {
        watch: (path) =>
          path === "/synthetic" ? Stream.make({ _tag: "Create", path: "/synthetic/event" } as const) : undefined,
      });

      // Replacement: the canned stream, no volume involvement.
      const resultCollect = yield* Stream.runCollect(faulty.watch("/synthetic"));
      assert.deepStrictEqual(resultCollect, [{ _tag: "Create", path: "/synthetic/event" }]);

      // Delegation (undefined): a real watch on the volume still delivers
      // real events. The yield parks the parent behind the forked child so
      // the subscription registers before the mutation publishes.
      const events = yield* faulty
        .watch("/watched")
        .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      yield* faulty.writeFileString("/watched/new.txt", "y");
      const join11 = yield* Fiber.join(events);
      assert.deepStrictEqual(Array.from(join11), [{ _tag: "Create", path: "/watched/new.txt" }]);
    })
  );

  it("type-enforces genuine PlatformError faults and confines failTimes to the Effect-returning methods", () => {
    // Conditional types fail compilation if either forbidden fault becomes assignable.
    const acceptsBareError: (() => Effect.Effect<never, Error>) extends MemoryFileSystemFaults["readFileString"]
      ? true
      : false = false;
    const acceptsTransientWatch: MemoryFileSystemTransientFault extends MemoryFileSystemFaults["watch"] ? true : false =
      false;
    assert.isFalse(acceptsBareError);
    assert.isFalse(acceptsTransientWatch);
    const rejectsBareError = MemoryFileSystem.layerFaulty({
      readFileString: () => Effect.fail(deliberatelyInvalid<PlatformError.PlatformError>(new Error("nope"))),
    });
    const rejectsTransientOnLazy = MemoryFileSystem.layerFaulty({
      watch: deliberatelyInvalid<never>(MemoryFileSystem.failTimes(1, denied("watch", "/w"))),
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

  it.layer(
    MemoryFileSystem.layerWith(
      { "/config.json": "{}" },
      { faults: { readFileString: MemoryFileSystem.failTimes(2, busy) } }
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("fails exactly N intercepted calls, then delegates to the volume", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;

        const first = yield* Effect.flip(fs.readFileString("/config.json"));
        assert.strictEqual(first.reason._tag, "Busy");
        const second = yield* Effect.flip(fs.readFileString("/config.json"));
        assert.strictEqual(second.reason._tag, "Busy");

        // Third call delegates — and keeps delegating.
        const readFileString12 = yield* fs.readFileString("/config.json");
        assert.strictEqual(readFileString12, "{}");
        const readFileString13 = yield* fs.readFileString("/config.json");
        assert.strictEqual(readFileString13, "{}");
      })
    );
  });

  it.effect("re-arms its counter on each layer build — one bound layer const, two builds", () =>
    Effect.gen(function* () {
      const Flaky = MemoryFileSystem.layerWith(
        { "/config.json": "{}" },
        { faults: { readFileString: MemoryFileSystem.failTimes(1, busy) } }
      );
      const probe = Effect.fnUntraced(function* (layer: typeof Flaky) {
        const build14 = yield* Layer.build(layer);
        const fs = Context.get(build14, FileSystem.FileSystem);
        const first = yield* Effect.flip(fs.readFileString("/config.json"));
        assert.strictEqual(first.reason._tag, "Busy");
        const readFileString15 = yield* fs.readFileString("/config.json");
        assert.strictEqual(readFileString15, "{}");
      });

      // Layer memoization is per-build: each build arms a fresh counter.
      yield* probe(Flaky);
      yield* probe(Flaky);
      // Layer.fresh likewise builds fresh — its real role is per-consumer
      // isolation WITHIN one graph; across builds there is nothing to
      // isolate, as the two bare builds above already showed.
      yield* probe(Flaky.pipe(Layer.fresh));
    })
  );

  it.layer(
    MemoryFileSystem.layerWith(
      { "/config.json": "{}" },
      { faults: { readFileString: MemoryFileSystem.failTimes(2, busy) } }
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("counts executions, not invocations — Effect.retry attempts consume failures", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // ONE effect value, retried: each attempt re-consults the fault, so a
        // retry policy outlasts the transient failure window.
        const value = yield* fs.readFileString("/config.json").pipe(Effect.retry({ times: 2 }));
        assert.strictEqual(value, "{}");
      })
    );
  });

  it.effect("each makeFaulty call arms its own counter over the same base volume", () =>
    Effect.gen(function* () {
      const base = yield* MemoryFileSystem.makeWith({ "/config.json": "{}" });
      const faults = { readFileString: MemoryFileSystem.failTimes(1, busy) };

      const one = MemoryFileSystem.makeFaulty(base, faults);
      const two = MemoryFileSystem.makeFaulty(base, faults);

      assert.strictEqual((yield* Effect.flip(one.readFileString("/config.json"))).reason._tag, "Busy");
      const readFileString16 = yield* one.readFileString("/config.json");
      assert.strictEqual(readFileString16, "{}");
      // `two` was armed independently and still owes its failure.
      assert.strictEqual((yield* Effect.flip(two.readFileString("/config.json"))).reason._tag, "Busy");
    })
  );

  it("rejects a negative or fractional count at construction — a wiring bug, not runtime input", () => {
    assert.throws(() => MemoryFileSystem.failTimes(-1, busy), InvalidFaultCountError);
    assert.throws(() => MemoryFileSystem.failTimes(1.5, busy), InvalidFaultCountError);
    assert.throws(() => MemoryFileSystem.failTimes(Number.NaN, busy), InvalidFaultCountError);
  });

  it.effect("failTimes(0) never fails — it delegates from the first call", () =>
    Effect.gen(function* () {
      const base = yield* MemoryFileSystem.makeWith({ "/config.json": "{}" });
      const faulty = MemoryFileSystem.makeFaulty(base, {
        readFileString: MemoryFileSystem.failTimes(0, busy),
      });
      const readFileString17 = yield* faulty.readFileString("/config.json");
      assert.strictEqual(readFileString17, "{}");
    })
  );
});

describe("MemoryFileSystem.die", () => {
  const unstubbed = new Error("makeDirectory is not stubbed");

  // The whole point: a defect is not a failure, so the defensive `Effect.catch`
  // a caller writes around a read cannot absorb it. A typed fault would pass
  // through that catch, and a test written with one would pass while the real
  // code path dies.
  it.layer(MemoryFileSystem.layerWith({}, { faults: { makeDirectory: MemoryFileSystem.die(unstubbed) } }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("fails the member as a defect that Effect.catch cannot absorb", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const exit = yield* Effect.exit(fs.makeDirectory("/new", { recursive: true }).pipe(Effect.ignore));
        assertExitFailure(exit, Cause.die(unstubbed));
        assert.isTrue(Cause.hasDies(exit.cause));
        assert.isFalse(Cause.hasFails(exit.cause));
        assert.strictEqual(Cause.squash(exit.cause), unstubbed);
      })
    );
  });

  it.effect("dies with exactly the defect it was given, and leaves other members delegating", () =>
    Effect.gen(function* () {
      const defect = new Error("readDirectory is not stubbed");
      const base = yield* MemoryFileSystem.makeWith(tree);
      const fs = MemoryFileSystem.makeFaulty(base, { readDirectory: MemoryFileSystem.die(defect) });
      const exit = yield* Effect.exit(fs.readDirectory("/repos/blocked/src"));
      assertExitFailure(exit, Cause.die(defect));
      const readFileString18 = yield* fs.readFileString("/repos/blocked/src/a.ts");
      assert.strictEqual(readFileString18, "export {}\n");
    })
  );
});

describe("MemoryFileSystem fault factories", () => {
  // The case-insensitive-volume workaround effected#874 describes, as the
  // one-liner the factory form makes it: rewrite the argument, delegate to the
  // UNFAULTED base.
  it.layer(
    MemoryFileSystem.layerWith(
      { "/docs.json": "{}" },
      {
        faults: (base) => ({
          stat: (path) => base.stat(Str.toLowerCase(path)),
          readFileString: (path, encoding) => base.readFileString(Str.toLowerCase(path), encoding),
        }),
      }
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("hands the factory the wrapped volume, so a handler can rewrite arguments and delegate", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        assert.strictEqual((yield* fs.stat("/Docs.json")).type, "File");
        const readFileString19 = yield* fs.readFileString("/DOCS.JSON");
        assert.strictEqual(readFileString19, "{}");
      })
    );
  });

  it.effect("the base the factory receives is unfaulted, so delegating to it cannot recurse", () =>
    Effect.gen(function* () {
      const base = yield* MemoryFileSystem.makeWith({ "/a.txt": "a" });
      const fs = MemoryFileSystem.makeFaulty(base, (inner) => ({
        readFileString: (path, encoding) =>
          path === "/alias.txt"
            ? inner.readFileString("/a.txt", encoding)
            : Effect.fail(denied("readFileString", path)),
      }));
      const readFileString20 = yield* fs.readFileString("/alias.txt");
      assert.strictEqual(readFileString20, "a");
      assert.strictEqual((yield* Effect.flip(fs.readFileString("/a.txt"))).reason._tag, "PermissionDenied");
    })
  );

  it.effect("calls the factory once per build, so faults it creates are armed per build", () =>
    Effect.gen(function* () {
      let calls = 0;
      const flaky = MemoryFileSystem.layerFaulty(() => {
        calls += 1;
        return { readFileString: MemoryFileSystem.failTimes(1, denied("readFileString", "/config.json")) };
      }).pipe(Layer.provide(MemoryFileSystem.layerWith({ "/config.json": "{}" })));
      const readTwice = Effect.fnUntraced(function* () {
        const build21 = yield* Layer.build(flaky);
        const fs = Context.get(build21, FileSystem.FileSystem);
        yield* Effect.flip(fs.readFileString("/config.json"));
        return yield* fs.readFileString("/config.json");
      });
      const readTwice22 = yield* readTwice();
      assert.strictEqual(readTwice22, "{}");
      const readTwice23 = yield* readTwice();
      assert.strictEqual(readTwice23, "{}");
      assert.strictEqual(calls, 2);
    })
  );
});
