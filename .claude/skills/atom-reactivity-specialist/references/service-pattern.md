# Canonical Frontend Service Pattern

Canonical in-repo example: `packages/iam/client/src/core/atoms.ts`. Prefer
reading and mirroring that file over the prose below — it is the living
reference for runtime creation, query atoms, and mutation atoms with toast
feedback in this repo.

## Table of Contents

- [Step 1: Define the service](#step-1-define-the-service)
- [Step 2: Create the Layer](#step-2-create-the-layer)
- [Step 3: Create the runtime](#step-3-create-the-runtime)
- [Step 4: Create atoms](#step-4-create-atoms)
- [Step 5: Use in React](#step-5-use-in-react)

Every frontend feature follows this exact sequence.

## Step 1: Define the service

```ts
import { Context } from "effect"

class TodoService extends Context.Service<TodoService, {
  readonly list: Effect.Effect<ReadonlyArray<Todo>>
  readonly create: (title: string) => Effect.Effect<Todo>
}>()("app/TodoService") {}
```

## Step 2: Create the Layer

```ts
const TodoServiceLive = Layer.succeed(TodoService, TodoService.of({
  list: HttpClient.get("/api/todos").pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(S.Array(Todo)))
  ),
  create: (title) => HttpClient.post("/api/todos").pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
  )
}))
```

## Step 3: Create the runtime

```ts
const todoRuntime = Atom.runtime(
  TodoServiceLive.pipe(
    Layer.merge(LoggingLayer),
    Layer.merge(TracingLayer)
  )
)
```

Or with a shared factory:

```ts
const factory = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })
factory.addGlobalLayer(LoggingLayer)

const todoRuntime = factory(TodoServiceLive)
const userRuntime = factory(UserServiceLive)
```

## Step 4: Create atoms

```ts
// Query: auto-fetches when runtime resolves
const todosAtom = todoRuntime.atom(
  TodoService.use((_) => _.list)
)

// Mutation: invoked on write
const createTodoFn = todoRuntime.fn<string>()(
  (title) => TodoService.use((_) => _.create(title)),
  { reactivityKeys: ["todos"] }
)
```

## Step 5: Use in React

```tsx
function TodoList() {
  const result = useAtomValue(todosAtom)
  const [createResult, create] = useAtom(createTodoFn)

  return AsyncResult.match(result, {
    onInitial: () => <Spinner />,
    onFailure: (r) => <Error cause={r.cause} />,
    onSuccess: (r) => (
      <ul>
        {r.value.map(todo => <li key={todo.id}>{todo.title}</li>)}
        <button onClick={() => create("New todo")}>Add</button>
      </ul>
    )
  })
}
```

Or with Suspense:

```tsx
function TodoList() {
  const result = useAtomSuspense(todosAtom)
  // result is guaranteed Success here
  return (
    <ul>
      {result.value.map(todo => <li key={todo.id}>{todo.title}</li>)}
    </ul>
  )
}

function TodoPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ErrorBoundary>
        <TodoList />
      </ErrorBoundary>
    </Suspense>
  )
}
```
