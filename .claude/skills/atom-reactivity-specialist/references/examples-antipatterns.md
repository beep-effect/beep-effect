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

```ts
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

```ts
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
    onSuccess: (r) => <ul>{r.value.map(u => <li key={u.id}>{u.name}</li>)}</ul>
  })
}
```

## 3) Mutation with invalidation

```ts
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
const cachedUsersAtom = Atom.swr(usersAtom, {
  staleTime: Duration.minutes(5),
  revalidateOnMount: true,
  revalidateOnFocus: true,
  focusSignal: Atom.windowFocusSignal  // Required for revalidateOnFocus to work
})
```

## 7) Debounced search

```ts
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

```ts
const optimisticTodos = Atom.optimistic(todosAtom)

function TodoItem({ todo }: { readonly todo: Todo }) {
  const [, setOptimistic] = useAtom(optimisticTodos)

  const handleToggle = () => {
    // Show optimistic value immediately, revert if mutation fails
    setOptimistic(
      todoRuntime.atom(
        TodoService.use((_) => _.toggle(todo.id))
      )
    )
  }

  return <div onClick={handleToggle}>{todo.title}</div>
}
```

## 10) Reactivity keys with factory.withReactivity

```ts
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
