import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { RuntimeContext } from "alchemy/RuntimeContext";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";

// An in-process Durable Object host for `@alchemy.run/domain/DurableObjects`, trimmed from
// upstream's `packages/integration-tests/test/Domain/DurableObjects.test.ts` at 33c10dd. Each
// instance has its own sorted storage, an exclusive section, background work in its own scope,
// and one alarm driven by `Effect.sleep`, so a test's `TestClock` decides when callbacks fire.
// Calls cross a JSON boundary, as Workers RPC does.

/** What a test reads back from the host: how often each instance read each lease key. */
export interface SimHost {
  readonly host: DurableObjects.Host;
  /** Reads of `key` by instance `id` so far. */
  readonly reads: (id: string, key: string) => number;
  /** Every instance id built so far. */
  readonly ids: () => ReadonlyArray<string>;
  /** Writes rows into a built instance's storage, as another event on it would. */
  readonly write: (id: string, entries: Readonly<Record<string, unknown>>) => Effect.Effect<void>;
  /** Interrupts every instance's background work and alarm. */
  readonly close: Effect.Effect<void>;
}

const readKey = (id: string, key: string) => `${id}#${key}`;
const endsWithLease = Str.endsWith("lease");

/** Sorted key-value storage that counts reads of every key ending in `lease`. */
const makeStorage = (id: string, reads: MutableHashMap.MutableHashMap<string, number>): DurableObjects.ObjectStorage => {
  let data = MutableHashMap.empty<string, unknown>();
  const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));
  const sortedKeys = () => A.sort(A.fromIterable(MutableHashMap.keys(data)), Order.String);
  const count = (key: string) => {
    if (!endsWithLease(key)) return;
    MutableHashMap.modifyAt(reads, readKey(id, key), (n) => O.some(O.getOrElse(n, () => 0) + 1));
  };
  return {
    get: <T>(key: string) =>
      Effect.sync(() => {
        count(key);
        return clone(O.getOrUndefined(MutableHashMap.get(data, key)) as T | undefined);
      }),
    put: ((keyOrEntries: string | Readonly<Record<string, unknown>>, value?: unknown) =>
      Effect.sync(() => {
        if (typeof keyOrEntries === "string") MutableHashMap.set(data, keyOrEntries, clone(value));
        else for (const [key, entry] of Object.entries(keyOrEntries)) MutableHashMap.set(data, key, clone(entry));
      })) as DurableObjects.ObjectStorage["put"],
    delete: ((keyOrKeys: string | ReadonlyArray<string>) =>
      Effect.sync(() => {
        const remove = (key: string) => {
          const had = MutableHashMap.has(data, key);
          MutableHashMap.remove(data, key);
          return had;
        };
        return typeof keyOrKeys === "string" ? remove(keyOrKeys) : A.filter(keyOrKeys, remove).length;
      })) as DurableObjects.ObjectStorage["delete"],
    list: <T>(options: DurableObjects.ListOptions = {}) =>
      Effect.sync(() => {
        let keys = A.filter(
          sortedKeys(),
          (key) =>
            (options.prefix === undefined || Str.startsWith(options.prefix)(key)) &&
            (options.start === undefined || key >= options.start) &&
            (options.startAfter === undefined || key > options.startAfter) &&
            (options.end === undefined || key < options.end),
        );
        if (options.reverse) keys = A.reverse(keys);
        if (options.limit !== undefined) keys = A.take(keys, options.limit);
        // The storage contract returns a native Map.
        return new Map(A.map(keys, (key) => [key, clone(O.getOrUndefined(MutableHashMap.get(data, key)) as T)] as const));
      }),
    // Writes inside commit together: a failure restores what was there before.
    transaction: (effect) =>
      Effect.suspend(() => {
        const before = MutableHashMap.fromIterable(data);
        return effect.pipe(
          Effect.onExit((exit) =>
            Exit.isFailure(exit)
              ? Effect.sync(() => {
                  data = before;
                })
              : Effect.void,
          ),
        );
      }),
  };
};

/**
 * An in-process host. `seed` gives each instance's storage rows to start with, when it is first
 * built, from its id and the clock's time: a test writes a lease that a dead instance left there.
 *
 * **Example** (A host whose aggregate starts with a held outbox lease)
 *
 * ```ts
 * import { makeSimHost } from "./SimHost.ts";
 *
 * const sim = makeSimHost((id, now) => (id === "Books.Ledger/main" ? { "outbox-lease": now + 60_000 } : {}));
 * console.log(sim.ids());
 * ```
 */
export const makeSimHost = (seed: (id: string, now: number) => Readonly<Record<string, unknown>>): SimHost => {
  const classes = MutableHashMap.empty<string, DurableObjects.ObjectImpl>();
  const instances = MutableHashMap.empty<string, Effect.Effect<Record<string, unknown>>>();
  const reads = MutableHashMap.empty<string, number>();
  const scopes = MutableHashMap.empty<string, Scope.Closeable>();
  const storages = MutableHashMap.empty<string, DurableObjects.ObjectStorage>();

  const build = (cls: string, id: string): Effect.Effect<Record<string, unknown>> => {
    const storage = makeStorage(id, reads);
    MutableHashMap.set(storages, id, storage);
    const gate = Semaphore.makeUnsafe(1);
    const scope = Scope.makeUnsafe();
    MutableHashMap.set(scopes, id, scope);
    return Effect.gen(function* () {
      yield* storage.put(seed(id, yield* Clock.currentTimeMillis));
      let timer: { readonly at: number; readonly fiber: Fiber.Fiber<void> } | undefined;
      const callbacks = DurableObjects.alarmCallbacks(storage, {
        get: Effect.sync(() => timer?.at ?? null),
        set: (at) =>
          Effect.gen(function* () {
            const previous = timer;
            const now = yield* Clock.currentTimeMillis;
            const fiber = yield* Effect.sleep(Math.max(0, at - now)).pipe(
              Effect.andThen(
                Effect.suspend(() => {
                  timer = undefined;
                  return callbacks.fire;
                }),
              ),
              Effect.forkIn(scope),
            );
            timer = { at, fiber };
            if (previous) yield* Fiber.interrupt(previous.fiber);
          }),
      });
      const state = {
        storage,
        exclusive: (effect) => gate.withPermits(1)(effect),
        waitUntil: (effect) => Effect.asVoid(Effect.forkIn(effect, scope)),
      } satisfies DurableObjects.ObjectStateShape;
      const runtime = {
        Type: "Sim",
        id,
        env: {},
        get: () => Effect.undefined,
        set: (key: string) => Effect.succeed(key),
        makeCallback: callbacks.makeCallback,
      } as unknown as RuntimeContext["Service"];
      const impl = O.getOrThrow(MutableHashMap.get(classes, cls));
      const record = yield* impl.pipe(
        Effect.provideService(DurableObjects.ObjectState, state),
        Effect.provideService(RuntimeContext, runtime),
        Effect.provideService(Scope.Scope, scope),
      );
      // Each call runs as its own event, with the instance's runtime.
      const methods: Record<string, unknown> = {};
      for (const [method, value] of Object.entries(record)) {
        methods[method] =
          typeof value === "function"
            ? (...args: ReadonlyArray<unknown>) => {
                const result = (value as (...args: ReadonlyArray<unknown>) => unknown)(...args);
                return Effect.isEffect(result)
                  ? Effect.scoped(
                      (result as Effect.Effect<unknown, unknown, RuntimeContext>).pipe(
                        Effect.provideService(RuntimeContext, runtime),
                      ),
                    )
                  : result;
              }
            : value;
      }
      return methods;
    }).pipe(Effect.cached, Effect.runSync);
  };

  const instance = (cls: string, name: string) => {
    const id = `${cls}/${name}`;
    return O.getOrElse(MutableHashMap.get(instances, id), () => {
      const built = build(cls, id);
      MutableHashMap.set(instances, id, built);
      return built;
    });
  };

  const namespace = (cls: string): DurableObjects.Namespace => ({
    getByName: (name) =>
      new Proxy({} as DurableObjects.Stub, {
        get:
          (_, method: string) =>
          (...args: ReadonlyArray<unknown>) =>
            Effect.flatMap(instance(cls, name), (methods) => {
              const call = methods[method] as (...args: ReadonlyArray<unknown>) => Effect.Effect<unknown, unknown>;
              return call(...structuredClone(args)).pipe(
                Effect.map((result) => (result === undefined ? result : structuredClone(result))),
              );
            }),
      }),
  });

  return {
    host: {
      declare: (model, cls, impl) =>
        Effect.sync(() => {
          const name = DurableObjects.className(model.modelName, cls);
          MutableHashMap.set(classes, name, impl);
          return namespace(name);
        }),
      lookup: (model, cls) => namespace(DurableObjects.className(model.modelName, cls)),
      claimKey: Effect.sync(() => ({})),
    },
    reads: (id, key) => O.getOrElse(MutableHashMap.get(reads, readKey(id, key)), () => 0),
    ids: () => A.fromIterable(MutableHashMap.keys(instances)),
    write: (id, entries) =>
      Effect.flatMap(Effect.fromOption(MutableHashMap.get(storages, id)).pipe(Effect.orDie), (storage) =>
        storage.put(entries),
      ),
    close: Effect.forEach(A.fromIterable(MutableHashMap.values(scopes)), (scope) => Scope.close(scope, Exit.void), {
      discard: true,
    }),
  };
};
