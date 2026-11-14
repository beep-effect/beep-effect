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
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";

// An in-process Durable Object host for `@alchemy.run/domain/DurableObjects`, trimmed from
// upstream's `packages/integration-tests/test/Domain/DurableObjects.test.ts` at 33c10dd. Each
// instance has its own sorted storage, an exclusive section, background work in its own scope,
// and one alarm driven by `Effect.sleep`, so a test's `TestClock` decides when callbacks fire.
// Calls cross a JSON boundary, as Workers RPC does. Phase 9: an instance can run on more than one
// "runner" over one storage, as two cluster runners do while a shard moves (`serveFrom`).
// Phase 10: the shard's ownership can fence commits (`fenced`), and calls can carry their
// arguments as the Effect Cluster transport does (`args`).

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
  /**
   * Which runner serves the calls made from now on (0 at first). Each runner builds its own copy
   * of an instance, with its own exclusive section, over the instance's one storage; a call
   * already running stays on the runner that took it.
   */
  readonly serveFrom: (runner: number) => void;
  /** An instance's storage, once any runner built it. */
  readonly storageOf: (id: string) => O.Option<DurableObjects.ObjectStorage>;
  /** The runner of each transaction on an instance that completed, in order. */
  readonly committers: (id: string) => ReadonlyArray<number>;
}

/**
 * How a host runs (phase 10). `fenced`: a transaction completes only if its runner still owns
 * the instance (serves its calls) when it commits, as Effect Cluster's commit fence does;
 * otherwise it is rolled back and dies with `ShardLost`. `args`: how a call's arguments cross:
 * `clone` (structured clone, as Workers RPC does), `json` (as Effect Cluster's transport did:
 * `JSON.stringify`), or `cluster` (its transport with patch 5's `encodeCallArgs`).
 */
export interface SimHostOptions {
  readonly fenced?: boolean;
  readonly args?: "clone" | "json" | "cluster";
}

const JsonArgs = Schema.fromJsonString(Schema.Unknown.pipe(Schema.Array));
const decodeArgs = Schema.decodeUnknownEffect(JsonArgs);
const encodeArgs = Schema.encodeEffect(JsonArgs);

/** A call's arguments as they arrive, per `SimHostOptions.args`. */
const crossArgs = (mode: NonNullable<SimHostOptions["args"]>, args: ReadonlyArray<unknown>): Effect.Effect<ReadonlyArray<unknown>> =>
  (mode === "clone"
    ? Effect.sync(() => structuredClone(args))
    : Effect.flatMap(mode === "json" ? encodeArgs(args) : Effect.sync(() => DurableObjects.encodeCallArgs(args)), decodeArgs)
  ).pipe(Effect.orDie);

const readKey = (id: string, key: string) => `${id}#${key}`;

/**
 * An instance method's call, as the library builds every one (`DurableObjects.ts`): wrapped in
 * `reportDefects`, so it fails with nothing, and run with the instance's runtime and a scope. The
 * library's types are loose here because `ObjectImpl` returns `Record<string, unknown>` and `Stub`
 * types a call as `Effect<unknown, unknown>`.
 */
const isInstanceCall = (value: unknown): value is Effect.Effect<unknown, never, RuntimeContext | Scope.Scope> =>
  Effect.isEffect(value);

/** A method of a built instance: called with JSON arguments, it answers with its JSON result. */
type Method = (...args: ReadonlyArray<unknown>) => Effect.Effect<unknown>;
const endsWithLease = Str.endsWith("lease");

/** Sorted key-value storage that counts reads of every key ending in `lease`. */
const makeStorage = (id: string, reads: MutableHashMap.MutableHashMap<string, number>): DurableObjects.ObjectStorage => {
  let data = MutableHashMap.empty<string, unknown>();
  const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));
  const sortedKeys = () => data.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Order.String));
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
        else for (const [key, entry] of R.toEntries(keyOrEntries)) MutableHashMap.set(data, key, clone(entry));
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
        if (options.reverse === true) keys = A.reverse(keys);
        if (options.limit !== undefined) keys = A.take(keys, options.limit);
        // The storage contract returns a native Map.
        return new Map(A.map(keys, (key) => [key, clone(O.getOrUndefined(MutableHashMap.get(data, key)) as T)] as const));
      }),
    // Writes inside commit together: a failure restores what was there before.
    transaction: (effect) =>
      Effect.suspend(() => {
        const before = MutableHashMap.fromIterable(data);
        return effect.pipe(
          Effect.onError(() =>
            Effect.sync(() => {
              data = before;
            }),
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
export const makeSimHost = (seed: (id: string, now: number) => Readonly<Record<string, unknown>>): SimHost =>
  makeSimHostWith({})(seed);

/**
 * An in-process host run per `options` (phase 10): fenced commits, or arguments crossing as the
 * Effect Cluster transport carries them.
 *
 * **Example** (A host that fences commits on the serving runner)
 *
 * ```ts
 * import { makeSimHostWith } from "./SimHost.ts";
 *
 * const sim = makeSimHostWith({ fenced: true })(() => ({}));
 * sim.serveFrom(1);
 * ```
 */
export const makeSimHostWith = (options: SimHostOptions) => (seed: (id: string, now: number) => Readonly<Record<string, unknown>>): SimHost => {
  const classes = MutableHashMap.empty<string, DurableObjects.ObjectImpl>();
  const instances = MutableHashMap.empty<string, Effect.Effect<Record<string, Method>>>();
  const reads = MutableHashMap.empty<string, number>();
  const scopes = MutableHashMap.empty<string, Scope.Closeable>();
  const storages = MutableHashMap.empty<string, DurableObjects.ObjectStorage>();
  const commits = MutableHashMap.empty<string, ReadonlyArray<number>>();
  let serving = 0;

  /** The storage a runner sees: its transactions are logged, and fenced when the host is. */
  const runnerStorage = (storage: DurableObjects.ObjectStorage, id: string, runner: number): DurableObjects.ObjectStorage => ({
    ...storage,
    transaction: (effect) =>
      storage
        .transaction(
          effect.pipe(
            Effect.tap(() =>
              options.fenced === true && serving !== runner
                ? Effect.die(new DurableObjects.ShardLost({ id, shard: `sim:${runner}` }))
                : Effect.void,
            ),
          ),
        )
        .pipe(
          Effect.tap(() =>
            Effect.sync(() =>
              MutableHashMap.modifyAt(commits, id, (log) => O.some(A.append(O.getOrElse(log, A.empty<number>), runner))),
            ),
          ),
        ),
  });

  const build = (cls: string, id: string, runner: number): Effect.Effect<Record<string, Method>> => {
    // One storage per instance, whichever runner builds it; seeded by the first.
    const existing = MutableHashMap.get(storages, id);
    const storage = O.getOrElse(existing, () => makeStorage(id, reads));
    MutableHashMap.set(storages, id, storage);
    const gate = Semaphore.makeUnsafe(1);
    const scope = Scope.makeUnsafe();
    MutableHashMap.set(scopes, `${runner}|${id}`, scope);
    return Effect.gen(function* () {
      const builtAt = yield* Clock.currentTimeMillis;
      if (O.isNone(existing)) yield* storage.put(seed(id, builtAt));
      let timer: { readonly at: number; readonly fiber: Fiber.Fiber<void> } | undefined;
      const callbacks = DurableObjects.alarmCallbacks(storage, {
        get: Effect.sync(() => timer?.at ?? null),
        set: Effect.fn("set")(function* (at: number) {
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
          if (previous !== undefined) yield* Fiber.interrupt(previous.fiber);
        }),
      });
      const state = {
        storage: runnerStorage(storage, id, runner),
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
      const methods: Record<string, Method> = {};
      for (const [method, value] of R.toEntries(record)) {
        if (!P.isFunction(value)) continue;
        methods[method] = (...args) => {
          const result: unknown = value(...args);
          return isInstanceCall(result)
            ? Effect.scoped(result.pipe(Effect.provideService(RuntimeContext, runtime)))
            : Effect.die(`${id}.${method} returned no Effect`);
        };
      }
      return methods;
    }).pipe(Effect.cached, Effect.runSync);
  };

  const instance = (cls: string, name: string) => {
    const id = `${cls}/${name}`;
    const runner = serving;
    const key = `${runner}|${id}`;
    return O.getOrElse(MutableHashMap.get(instances, key), () => {
      const built = build(cls, id, runner);
      MutableHashMap.set(instances, key, built);
      return built;
    });
  };

  const namespace = (cls: string): DurableObjects.Namespace => ({
    getByName: (name) =>
      new Proxy({} as DurableObjects.Stub, {
        get:
          (_, method: string) =>
          (...args: ReadonlyArray<unknown>) =>
            // Routed when the call runs, not when it is built: a retry reaches whichever runner
            // serves the instance then, as a cluster call does.
            Effect.flatMap(
              Effect.suspend(() => instance(cls, name)),
              (methods) =>
                O.match(R.get(methods, method), {
                  onNone: () => Effect.die(`${cls}/${name} has no method ${method}`),
                  onSome: (call) =>
                    Effect.flatMap(crossArgs(options.args ?? "clone", args), (crossed) => call(...crossed)).pipe(
                      Effect.map((result) => (result === undefined ? result : structuredClone(result))),
                    ),
                }),
            ),
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
    ids: () => storages.pipe(MutableHashMap.keys, A.fromIterable),
    write: (id, entries) =>
      Effect.flatMap(Effect.fromOption(MutableHashMap.get(storages, id)).pipe(Effect.orDie), (storage) =>
        storage.put(entries),
      ),
    close: Effect.forEach(scopes.pipe(MutableHashMap.values, A.fromIterable), (scope) => Scope.close(scope, Exit.void), {
      discard: true,
    }),
    serveFrom: (runner) => {
      serving = runner;
    },
    storageOf: (id) => MutableHashMap.get(storages, id),
    committers: (id) => O.getOrElse(MutableHashMap.get(commits, id), A.empty<number>),
  };
};
