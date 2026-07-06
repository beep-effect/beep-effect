# Atom + Reactivity Core API Reference

## Table of Contents

- [Atom constructors](#atom-effectunstablereactivityatom)
- [Combinators](#combinators)
- [URL and Persistence](#url-and-persistence)
- [Effect Interop](#effect-interop)
- [AtomContext](#atomcontext-available-inside-readablewritable-read-functions)
- [AtomRuntime](#atomruntime)
- [AsyncResult](#asyncresult-effectunstablereactivityasyncresult)
- [Reactivity](#reactivity-effectunstablereactivityreactivity)
- [AtomRpc](#atomrpc-effectunstablereactivityatomrpc)
- [React Integration (@effect/atom-react)](#react-integration-effectatom-react)

## Atom (`effect/unstable/reactivity/Atom`)

Import as:

```ts
import { Atom } from "effect/unstable/reactivity"
// or
import * as Atom from "effect/unstable/reactivity/Atom"
```

### Constructors

| Constructor | Signature | Returns | Purpose |
|-------------|-----------|---------|---------|
| `Atom.make(value)` | `<A>(value: A) => Writable<A>` | Mutable state atom | Client-only state (replaces `useState`) |
| `Atom.make(effect)` | `<A, E>(effect: Effect<A, E>) => Atom<AsyncResult<A, E>>` | Async result atom | Server state from Effect |
| `Atom.make(stream)` | `<A, E>(stream: Stream<A, E>) => Atom<AsyncResult<A, E \| Cause.NoSuchElementError>>` | Stream-backed atom | Realtime data |
| `Atom.make(fn)` | `<A>((get: AtomContext) => A) => Atom<A>` | Computed atom | Derived state |
| `Atom.readable(read, refresh?)` | `(read: (get: AtomContext) => A) => Atom<A>` | Read-only atom | Immutable computed |
| `Atom.writable(read, write, refresh?)` | Full control | Read+write atom | Custom read/write logic |
| `Atom.family(fn)` | `<Arg, T>((arg: Arg) => T) => (arg: Arg) => T` | Parameterized factory | Atom-per-key (memoized with WeakRef) |
| `Atom.fn<Arg>()(effect)` | See source | `AtomResultFn<Arg, A, E>` | Non-runtime mutation atom |
| `Atom.fnSync<Arg>()(fn)` | See source | `Writable<Option<A>, Arg>` | Synchronous function atom |
| `Atom.pull(stream)` | See source | `Writable<PullResult<A, E>, void>` | Paginated stream consumption |
| `Atom.subscriptionRef(ref)` | See source | `Writable<AsyncResult<A, E>, A>` | SubscriptionRef bridge |

### Combinators

| Combinator | Purpose |
|------------|---------|
| `Atom.map(atom, fn)` | Derived value (preserves writability) |
| `Atom.mapResult(atom, fn)` | Map over `AsyncResult.Success` value |
| `Atom.transform(atom, fn)` | Full transform with `AtomContext` access |
| `Atom.debounce(atom, duration)` | Debounce value changes |
| `Atom.withRefresh(atom, duration)` | Auto-refresh on interval |
| `Atom.swr(atom, { staleTime, ... })` | Stale-while-revalidate pattern |
| `Atom.withFallback(atom, fallbackAtom)` | Use fallback while initial |
| `Atom.keepAlive(atom)` | Prevent auto-disposal |
| `Atom.autoDispose(atom)` | Revert keepAlive (default behavior) |
| `Atom.setIdleTTL(atom, duration)` | Custom idle time-to-live |
| `Atom.setLazy(atom, boolean)` | Control lazy evaluation |
| `Atom.withLabel(atom, name)` | Debug label |
| `Atom.serializable(atom, { key, schema })` | SSR serialization support |
| `Atom.withServerValue(atom, read)` | Override server-side read |
| `Atom.withServerValueInitial(atom)` | Server value as `AsyncResult.initial(true)` |
| `Atom.optimistic(atom)` | Optimistic update wrapper |
| `Atom.batch(fn)` | Batch multiple writes |
| `Atom.Reset` | Symbol: write to an `AtomResultFn` to reset it to initial state |
| `Atom.Interrupt` | Symbol: write to an `AtomResultFn` to cancel the in-flight effect |
| `Atom.windowFocusSignal` | `Atom<number>` that increments on window focus events |
| `Atom.refreshOnWindowFocus(atom)` | Auto-refresh an atom when the window regains focus |

### URL and Persistence

```ts
// URL search param state
const filterAtom = Atom.searchParam("filter")
// => Writable<string> that syncs with ?filter=...

// With schema parsing
const pageAtom = Atom.searchParam("page", { schema: S.NumberFromString })
// => Writable<Option<number>> that decodes/encodes via schema

// Persisted state (localStorage/IDB via KeyValueStore)
const themeAtom = Atom.kvs({
  runtime: appRuntime,          // AtomRuntime with KeyValueStore
  key: "user-theme",
  schema: ThemeSchema,
  defaultValue: () => "system",
  mode: "sync"                  // "sync" for synchronous reads, "async" for AsyncResult
})
```

### Effect Interop

```ts
// Read atom value as Effect
Atom.get(atom)                              // Effect<A, never, AtomRegistry>
Atom.getResult(asyncAtom)                   // Effect<A, E, AtomRegistry>
Atom.set(atom, value)                       // Effect<void, never, AtomRegistry>
Atom.update(atom, fn)                       // Effect<void, never, AtomRegistry>
Atom.modify(atom, fn)                       // Effect<A, never, AtomRegistry>
Atom.refresh(atom)                          // Effect<void, never, AtomRegistry>
Atom.mount(atom)                            // Effect<void, never, AtomRegistry | Scope>
Atom.toStream(atom)                         // Stream<A, never, AtomRegistry>
Atom.toStreamResult(asyncAtom)              // Stream<A, E, AtomRegistry>
```

### AtomContext (available inside `readable`/`writable` read functions)

```ts
Atom.readable((get) => {
  const value = get(someAtom)                      // Read another atom (tracks dependency)
  const value2 = get.get(someAtom)                 // Same as get(someAtom)
  const value3 = get.once(someAtom)                // Read without tracking (no re-render on change)
  const result = get.result(asyncAtom)             // Effect<A, E> from AsyncResult atom
  get.mount(someAtom)                              // Ensure atom stays mounted
  get.refresh(someAtom)                            // Trigger re-evaluation
  get.refreshSelf()                                // Re-evaluate this atom
  get.self<A>()                                    // Option<A> of current value
  get.setSelf(newValue)                            // Set own value (for async callbacks)
  get.set(writableAtom, value)                     // Write to another atom
  get.addFinalizer(() => cleanup())                // Cleanup on unmount
  get.subscribe(atom, (value) => { ... })          // Side-effect on dependency change
  get.stream(atom)                                 // Stream<A> from atom
  get.streamResult(asyncAtom)                      // Stream<A, E> from async atom
  get.resultOnce(asyncAtom)                        // Effect<A, E> from AsyncResult atom (no tracking)
  get.setResult(asyncAtom, asyncResult)            // Directly set an AsyncResult value
  get.some(asyncAtom)                              // Option<A> from AsyncResult (tracks dependency)
  get.someOnce(asyncAtom)                          // Option<A> from AsyncResult (no tracking)
  return value
})
```

## AtomRuntime

The runtime bridges Effect services into the atom world. Services are shared
via a `MemoMap` across all atoms created from the same runtime.

```ts
import { Atom } from "effect/unstable/reactivity"

// Default runtime (uses Atom.defaultMemoMap)
const myAtom = Atom.runtime(MyServiceLayer)

// Custom factory with shared MemoMap
const factory = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })
const runtime1 = factory(ServiceLayer1)
const runtime2 = factory(ServiceLayer2)
// Services are shared across runtime1 and runtime2
```

### `AtomRuntime` interface

| Method | Signature | Purpose |
|--------|-----------|---------|
| `runtime.atom(effect)` | `Effect<A, E, R> => Atom<AsyncResult<A, E \| ER>>` | Async query atom with service access |
| `runtime.atom(fn)` | `((get: AtomContext) => Effect<A, E, R>) => Atom<AsyncResult<A, E \| ER>>` | Computed async atom |
| `runtime.fn<Arg>()(effect, options?)` | `(arg: Arg, get) => Effect => AtomResultFn<Arg, A, E \| ER>` | Mutation atom |
| `runtime.fn(effect, options?)` | `(arg: void, get) => Effect => AtomResultFn<void, A, E \| ER>` | Zero-arg mutation |
| `runtime.pull(stream)` | `Stream<A, E, R> => Writable<PullResult<A, E \| ER>, void>` | Paginated stream |
| `runtime.subscriptionRef(ref)` | `Effect<SubscriptionRef<A>> => Writable<AsyncResult<A, E>, A>` | SubscriptionRef |

Note: The `reactivityKeys` option is only available on `runtime.fn`, not on the standalone `Atom.fn`. Use `runtime.fn` when you need automatic reactivity key invalidation after mutations.

### `RuntimeFactory` interface

| Property | Purpose |
|----------|---------|
| `factory(layer)` | Create a new `AtomRuntime` from a `Layer` |
| `factory.memoMap` | Shared `Layer.MemoMap` across all runtimes |
| `factory.addGlobalLayer(layer)` | Inject layer into all runtimes (logging, tracing) |
| `factory.withReactivity(keys)` | Attach reactivity key invalidation to any atom |

## AsyncResult (`effect/unstable/reactivity/AsyncResult`)

The lifecycle type for all async atoms.

```ts
type AsyncResult<A, E = never> = Initial<A, E> | Success<A, E> | Failure<A, E>
```

| Variant | Properties | Meaning |
|---------|-----------|---------|
| `Initial` | `_tag: "Initial"`, `waiting: boolean` | Not yet resolved |
| `Success` | `_tag: "Success"`, `value: A`, `waiting: boolean`, `timestamp: number` | Resolved with value |
| `Failure` | `_tag: "Failure"`, `cause: Cause<E>`, `waiting: boolean`, `previousSuccess: Option<Success<A, E>>` | Failed with cause |

The `waiting` flag on `Success` indicates an in-flight re-fetch (stale data displayed while refreshing).

### Key operations

```ts
import { AsyncResult } from "effect/unstable/reactivity"

AsyncResult.match(result, {
  onInitial: (r) => "loading...",
  onFailure: (r) => `error: ${Cause.squash(r.cause)}`,
  onSuccess: (r) => `data: ${r.value}`
})

AsyncResult.map(result, (a) => transform(a))
AsyncResult.value(result)                      // Option<A>
AsyncResult.getOrElse(result, () => fallback)
AsyncResult.getOrThrow(result)
AsyncResult.isInitial(result)
AsyncResult.isSuccess(result)
AsyncResult.isFailure(result)
AsyncResult.isWaiting(result)
AsyncResult.toExit(result)
```

## Reactivity (`effect/unstable/reactivity/Reactivity`)

Key-based invalidation service. Mutations invalidate keys, queries
re-execute when their keys are invalidated.

```ts
import { Reactivity } from "effect/unstable/reactivity"

// In service code
Reactivity.mutation(effect, ["users"])         // Invalidate "users" key after effect
Reactivity.invalidate(["users", "posts"])      // Manual invalidation
Reactivity.query(fetchEffect, ["users"])       // Re-run on "users" invalidation (data-first)
Reactivity.stream(fetchEffect, ["users"])      // Stream of re-executions (data-first)
// withBatch is a method on the Reactivity service instance, not a module export:
// const reactivity = yield* Reactivity
// reactivity.withBatch(effect)                 // Defer invalidations until completion
```

Keys can be arrays or records for namespaced invalidation:

```ts
// Array keys: invalidate all matching handlers
Reactivity.mutation(effect, ["users"])

// Record keys: namespaced invalidation
Reactivity.mutation(effect, { users: [userId], posts: [postId] })
```

## AtomRpc (`effect/unstable/reactivity/AtomRpc`)

Typed RPC service atoms bridging `RpcGroup` to the atom world.

```ts
import { AtomRpc } from "effect/unstable/reactivity"

class TodoClient extends AtomRpc.Service<TodoClient>()(
  "TodoClient",
  {
    group: TodoRpcGroup,
    protocol: HttpRpcProtocolLayer
  }
) {}

// Query atom (auto-cached, with optional reactivity + TTL)
const todosAtom = TodoClient.query("ListTodos", { limit: 50 }, {
  reactivityKeys: ["todos"],
  timeToLive: Duration.minutes(5)
})

// Mutation atom (function-based, with reactivity invalidation)
const createTodoFn = TodoClient.mutation("CreateTodo")
// Usage: set(createTodoFn, { payload: { title: "New" }, reactivityKeys: ["todos"] })
```

## React Integration (`@effect/atom-react`)

### Provider

```tsx
import { RegistryProvider } from "@effect/atom-react"

function App() {
  return (
    <RegistryProvider>
      <MyApp />
    </RegistryProvider>
  )
}
```

`RegistryProvider` options:

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `initialValues` | `Iterable<[Atom, any]>` | -- | Pre-seed atom values |
| `scheduleTask` | `(f: () => void) => () => void` | React scheduler | Custom task scheduling |
| `timeoutResolution` | `number` | -- | Timeout granularity (ms) |
| `defaultIdleTTL` | `number` | `400` | Default idle TTL for atom disposal (ms) |

### Hooks

| Hook | Signature | Replaces | Purpose |
|------|-----------|----------|---------|
| `useAtomValue(atom)` | `<A>(atom: Atom<A>) => A` | `useState` (read) | Read atom value |
| `useAtomValue(atom, f)` | `<A, B>(atom: Atom<A>, f: A => B) => B` | `useMemo` | Read with selector |
| `useAtom(atom)` | `<R, W>(atom: Writable<R, W>) => readonly [R, setter]` | `useState` | Read + write tuple |
| `useAtom(atom, { mode: "promise" })` | Returns `[R, (W) => Promise<A>]` | -- | Await mutation result |
| `useAtom(atom, { mode: "promiseExit" })` | Returns `[R, (W) => Promise<Exit>]` | -- | Await mutation exit |
| `useAtomSuspense(atom)` | `Atom<AsyncResult<A, E>> => Success \| throws` | Suspense boundary | Suspense-aware read |
| `useAtomSuspense(atom, { includeFailure: true })` | Returns `Success \| Failure` | -- | Handle failure in component |
| `useAtomSuspense(atom, { suspendOnWaiting: true })` | -- | -- | Also suspend during re-fetch |
| `useAtomSubscribe(atom, fn)` | `(atom, (A) => void) => void` | `useEffect` | Side-effect on change |
| `useAtomSet(atom)` | `Writable<R, W> => setter` | -- | Write-only access |
| `useAtomRefresh(atom)` | `Atom<A> => () => void` | -- | Manual refresh trigger |
| `useAtomMount(atom)` | `Atom<A> => void` | -- | Mount without reading |
| `useAtomInitialValues(entries)` | `Iterable<[Atom, any]> => void` | -- | Set initial values |

All hooks use `useSyncExternalStore` internally for React concurrent-mode safety.

### ScopedAtom

For component-scoped atom instances (replaces `React.createContext` + `useState`):

```tsx
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"

const Counter = ScopedAtom.make(() => Atom.make(0))

function CounterView() {
  const atom = Counter.use()
  const [count, setCount] = useAtom(atom)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

function App() {
  return (
    <Counter.Provider>
      <CounterView />
    </Counter.Provider>
  )
}
```

With input:

```tsx
const UserAtom = ScopedAtom.make((name: string) => Atom.make(name))

// <UserAtom.Provider value="Ada"><UserName /></UserAtom.Provider>
```

### HydrationBoundary (SSR)

```tsx
import { HydrationBoundary } from "@effect/atom-react"

function Page({ dehydratedState }) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <Content />
    </HydrationBoundary>
  )
}
```
