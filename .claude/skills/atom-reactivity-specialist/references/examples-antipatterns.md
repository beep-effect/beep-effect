# Always / Never Examples and Anti-Patterns

## Table of Contents

- [1) Client state (replaces useState)](#1-client-state-replaces-usestate)
- [2) Server state (replaces useEffect + useState fetch)](#2-server-state-replaces-useeffect--usestate-fetch)
- [3) Mutation with invalidation](#3-mutation-with-invalidation)
- [4) Derived state (replaces useMemo)](#4-derived-state-replaces-usememo)
- [5) Side-effect subscription (replaces useEffect)](#5-side-effect-subscription-replaces-useeffect)
- [6) Stale-while-revalidate](#6-stale-while-revalidate)
- [7) Debounced search](#7-debounced-search)
- [8) Parameterized atoms (family)](#8-parameterized-atoms-family)
- [9) Optimistic updates](#9-optimistic-updates)
- [10) Reactivity keys with factory.withReactivity](#10-reactivity-keys-with-factorywithreactivity)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Extended Verification Checklist](#extended-verification-checklist)

## 1) Client state (replaces useState)

```tsx
import * as Atom from "effect/reactivity/Atom";
import { useAtom } from "@effect/atom-react";
// NEVER:
// const [isOpen, setIsOpen] = React.useState(false)

// ALWAYS:
const isOpenAtom = Atom.make(false)

function Panel() {
  const [isOpen, setIsOpen] = useAtom(isOpenAtom)
  return <div onClick={() => setIsOpen(!isOpen)}>{isOpen ? "Open" : "Closed"}</div>
}
```

## 2) Server state (replaces useEffect + useState fetch)

```tsx
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
import * as Atom from "effect/reactivity/Atom";
import * as Effect from "effect/Effect";
import * as Cause from "effect/Cause";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useAtomValue } from "@effect/atom-react";
type User = { readonly id: string; readonly name: string };
class UserService extends Context.Service<UserService, { readonly list: Effect.Effect<ReadonlyArray<User>>; readonly getById: (id: string) => Effect.Effect<User> }>()($I`UserService`) {}
declare const appRuntime: Atom.AtomRuntime<UserService>;
declare const Spinner: () => React.ReactNode;
declare const ErrorView: (props: { readonly cause: Cause.Cause<never> }) => React.ReactNode;
// NEVER:
// const [users, setUsers] = React.useState([])
// React.useEffect(() => { fetch("/api/users").then(...).then(setUsers) }, [])

// ALWAYS:
const usersAtom = appRuntime.atom(
  UserService.use((_) => _.list)
)

function UserList() {
  const result = useAtomValue(usersAtom)
  return AsyncResult.match(result, {
    onInitial: () => <Spinner />,
    onFailure: (r) => <ErrorView cause={r.cause} />,
    onSuccess: (r) => <ul>{A.map(r.value, u => <li key={u.id}>{u.name}</li>)}</ul>
  })
}
```

## 3) Mutation with invalidation

```tsx
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
import * as Atom from "effect/reactivity/Atom";
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useAtom } from "@effect/atom-react";
type Todo = { readonly id: string; readonly title: string };
class TodoService extends Context.Service<TodoService, { readonly list: Effect.Effect<ReadonlyArray<Todo>>; readonly create: (title: string) => Effect.Effect<Todo>; readonly toggle: (id: string) => Effect.Effect<ReadonlyArray<Todo>> }>()($I`TodoService`) {}
declare const todoRuntime: Atom.AtomRuntime<TodoService>;
// NEVER:
// const handleCreate = React.useCallback(async () => {
//   await fetch("/api/todos", { method: "POST", body: ... })
//   refetch()
// }, [refetch])

// ALWAYS:
const createTodoFn = todoRuntime.fn<{ readonly title: string }>()(
  ({ title }) => TodoService.use((_) => _.create(title)),
  { reactivityKeys: ["todos"] }
)

function CreateButton() {
  const [result, create] = useAtom(createTodoFn)
  return (
    <button
      onClick={() => create({ title: "New" })}
      disabled={AsyncResult.isWaiting(result)}
    >
      Create
    </button>
  )
}
```

## 4) Derived state (replaces useMemo)

```ts
import * as Atom from "effect/reactivity/Atom";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as A from "effect/Array";
declare const itemsAtom: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<{ readonly active: boolean }>>>;
declare const usersAtom: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<string>>>;
declare const postsAtom: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<string>>>;
// NEVER:
// const filtered = React.useMemo(() => items.filter(i => i.active), [items])

// ALWAYS:
const activeItemsAtom = Atom.mapResult(itemsAtom, A.filter((i) => i.active))

// Or for cross-atom derivation:
const summaryAtom = Atom.readable((get) => {
  const users = get(usersAtom)
  const posts = get(postsAtom)
  return AsyncResult.match(users, {
    onInitial: () => AsyncResult.initial(),
    onFailure: (r) => r,
    onSuccess: (usersResult) =>
      AsyncResult.map(get(postsAtom), (posts) => ({
        userCount: usersResult.value.length,
        postCount: posts.length
      }))
  })
})
```

## 5) Side-effect subscription (replaces useEffect)

```ts
import * as Atom from "effect/reactivity/Atom";
import { useAtomSubscribe } from "@effect/atom-react";
const themeAtom = Atom.make("system");
declare const document: { readonly body: { readonly classList: { readonly toggle: (token: string, force: boolean) => boolean } } };
// NEVER:
// React.useEffect(() => {
//   if (theme === "dark") document.body.classList.add("dark")
//   else document.body.classList.remove("dark")
// }, [theme])

// ALWAYS:
function ThemeSync() {
  useAtomSubscribe(themeAtom, (theme) => {
    document.body.classList.toggle("dark", theme === "dark")
  }, { immediate: true })
  return null
}
```

## 6) Stale-while-revalidate

```ts
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Duration from "effect/Duration";
declare const usersAtom: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<string>>>;
const cachedUsersAtom = Atom.swr(usersAtom, {
  staleTime: Duration.minutes(5),
  revalidateOnMount: true,
  revalidateOnFocus: true,
  focusSignal: Atom.windowFocusSignal  // Required for revalidateOnFocus to work
})
```

## 7) Debounced search

```ts
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
import * as Context from "effect/Context";
import * as Atom from "effect/reactivity/Atom";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
class SearchService extends Context.Service<SearchService, { readonly search: (query: string) => Effect.Effect<ReadonlyArray<string>> }>()($I`SearchService`) {}
declare const appRuntime: Atom.AtomRuntime<SearchService>;
const searchInputAtom = Atom.make("")
const debouncedSearchAtom = Atom.debounce(searchInputAtom, Duration.millis(300))

const searchResultsAtom = appRuntime.atom((get) => {
  const query = get(debouncedSearchAtom)
  if (query.length === 0) return Effect.succeed([])
  return SearchService.use((_) => _.search(query))
})
```

## 8) Parameterized atoms (family)

```ts
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Atom from "effect/reactivity/Atom";
import { useAtomValue } from "@effect/atom-react";
type User = { readonly id: string; readonly name: string };
class UserService extends Context.Service<UserService, { readonly list: Effect.Effect<ReadonlyArray<User>>; readonly getById: (id: string) => Effect.Effect<User> }>()($I`UserService`) {}
declare const appRuntime: Atom.AtomRuntime<UserService>;
const userByIdAtom = Atom.family((userId: string) =>
  appRuntime.atom(
    UserService.use((_) => _.getById(userId))
  )
)

function UserCard({ userId }: { readonly userId: string }) {
  const result = useAtomValue(userByIdAtom(userId))
  // ...
}
```

## 9) Optimistic updates

`Atom.optimistic` displays a transition's waiting `Success` value. Supply the
local projection through `initialValue`; a pending mutation without that value
does not show an immediate optimistic change. Render from the optimistic atom,
not from the original query or a stale item snapshot.

Here `todosAtom` is the caller's resolved list-query atom: refreshing it must
reread the committed list after `toggle` succeeds. A failed transition rolls
back to the latest source value. This example covers one pending transition;
concurrent edits need an explicit reconciliation policy.

```tsx
import { $SchemaId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Atom from "effect/reactivity/Atom";
import { useAtom, useAtomValue } from "@effect/atom-react";
const $I = $SchemaId.create("examples");
const Todo = S.Struct({ id: S.String, title: S.String, completed: S.Boolean });
type Todo = typeof Todo.Type;
class ToggleError extends S.TaggedError<ToggleError, { readonly brand: unique symbol }>()("ToggleError", { message: S.String }) {}
class TodoService extends Context.Service<TodoService, {
  readonly list: Effect.Effect<ReadonlyArray<Todo>>;
  readonly toggle: (id: string) => Effect.Effect<ReadonlyArray<Todo>, ToggleError>;
}>()($I`TodoService`) {}
declare const todoRuntime: Atom.AtomRuntime<TodoService>;
declare const todosAtom: Atom.Atom<ReadonlyArray<Todo>>;
const optimisticTodos = Atom.optimistic(todosAtom)

function TodoItem({ todo }: { readonly todo: Todo }) {
  const [todos, setOptimistic] = useAtom(optimisticTodos)

  const handleToggle = () => {
    const initialValue: ReadonlyArray<Todo> = A.map(todos, (current) => Match.value(current).pipe(
      Match.when({ id: todo.id }, (item) => ({ ...item, completed: !item.completed })),
      Match.orElse(() => current)
    ))
    setOptimistic(
      todoRuntime.atom(
        TodoService.use((_) => _.toggle(todo.id)),
        { initialValue }
      )
    )
  }

  return <label><input type="checkbox" checked={todo.completed} onChange={handleToggle} />{todo.title}</label>
}

function TodoList() {
  const todos = useAtomValue(optimisticTodos)
  return <ul>{A.map(todos, (todo) => <li key={todo.id}><TodoItem todo={todo} /></li>)}</ul>
}
```

## 10) Reactivity keys with factory.withReactivity

```ts
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
import * as Atom from "effect/reactivity/Atom";
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
type Todo = { readonly id: string; readonly title: string };
class TodoService extends Context.Service<TodoService, { readonly list: Effect.Effect<ReadonlyArray<Todo>>; readonly create: (title: string) => Effect.Effect<Todo>; readonly toggle: (id: string) => Effect.Effect<ReadonlyArray<Todo>> }>()($I`TodoService`) {}
declare const appRuntime: Atom.AtomRuntime<TodoService>;
// Attach reactivity-based refresh to any atom
const todosAtom = appRuntime.atom(
  TodoService.use((_) => _.list)
).pipe(
  appRuntime.factory.withReactivity(["todos"])
)

// Now any Reactivity.mutation(effect, ["todos"]) will refresh todosAtom
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Is Wrong | Correct Alternative |
|-------------|-----------------|---------------------|
| `React.useState` for any state | Bypasses atom system, breaks reactivity | `Atom.make(value)` + `useAtom` |
| `React.useEffect` for fetching | No lifecycle management, no typed errors | `runtime.atom(effect)` |
| `Effect.runPromise` in component | Runs outside atom lifecycle, leaks fibers | `runtime.atom(effect)` or `runtime.fn` |
| Calling `runtime.atom` inside component body | Creates new atom on every render | Define atoms at module level |
| Using `useAtomValue` on a `Writable` when you need the setter | Discards write capability | Use `useAtom` for read+write |
| Ignoring `AsyncResult.isWaiting` | Shows stale UI without loading indicator | Check `waiting` flag for in-flight ops |
| Creating atoms without reactivity keys on mutations | Queries never invalidate after mutation | Pass `{ reactivityKeys: [...] }` |
| Importing from `react` for `useState`/`useEffect`/etc. | Violates repository law | Use `@effect/atom-react` hooks |
| Manual `JSON.parse`/`JSON.stringify` in atoms | Violates schema-first law | Use `Atom.serializable` with Schema |
| `useCallback` for event handlers | Unnecessary with atoms | Define handler atoms at module scope |

## Extended Verification Checklist

Beyond the four core greps in SKILL.md:

```bash
# Verify useAtomValue/useAtom imports come from @effect/atom-react
rg -n "useAtomValue|useAtom|useAtomSuspense|useAtomSubscribe" packages/*/client packages/*/ui apps --glob "*.tsx"

# Detect atoms defined inside component bodies (function scope)
rg -n "Atom\.make\(|Atom\.readable\(|runtime\.atom\(|runtime\.fn" packages/*/client packages/*/ui apps --glob "*.tsx" -A2

# Verify RegistryProvider exists in app shell
rg -n "RegistryProvider" apps

# Check factory.addGlobalLayer usage exists
rg -n "addGlobalLayer" packages apps

# Detect native fetch in frontend code (should use HttpClient or service)
rg -n "window\.fetch\(|globalThis\.fetch\(" packages/*/client packages/*/ui apps

# Check AsyncResult handling completeness (all three branches)
rg -n "AsyncResult\.match" packages/*/client packages/*/ui apps
```
