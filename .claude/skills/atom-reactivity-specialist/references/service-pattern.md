# Canonical Frontend Service Pattern

Canonical in-repo example: `packages/agents/client/src/Chat.atoms.ts`. Prefer
reading and mirroring that file over the prose below — it is the living
reference for runtime creation, query atoms, and `runtime.fn` mutation atoms
in this repo.

## Table of Contents

- [Step 1: Define the service](#step-1-define-the-service)
- [Step 2: Create the Layer](#step-2-create-the-layer)
- [Step 3: Create the runtime](#step-3-create-the-runtime)
- [Step 4: Create atoms](#step-4-create-atoms)
- [Step 5: Use in React](#step-5-use-in-react)

Every frontend feature follows this exact sequence.

## Step 1: Define the service

```ts
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpBody from "effect/http/HttpBody";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;

class TodoService extends Context.Service<TodoService, {
  readonly list: Effect.Effect<ReadonlyArray<Todo>, HttpClientError.HttpClientError | S.SchemaError>
  readonly create: (title: string) => Effect.Effect<Todo, HttpClientError.HttpClientError | HttpBody.HttpBodyError | S.SchemaError>
}>()($I`TodoService`) {}
```

## Step 2: Create the Layer

```ts
import { $SchemaId } from "@beep/identity/packages";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpBody from "effect/http/HttpBody";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
const $I = $SchemaId.create("examples");
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;
class TodoService extends Context.Service<TodoService, { readonly list: Effect.Effect<ReadonlyArray<Todo>, HttpClientError.HttpClientError | S.SchemaError>; readonly create: (title: string) => Effect.Effect<Todo, HttpClientError.HttpClientError | HttpBody.HttpBodyError | S.SchemaError> }>()($I`TodoService`) {}
const TodoServiceLive = Layer.effect(TodoService, Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  return TodoService.of({
  list: client.get("/api/todos").pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(S.Array(Todo)))
  ),
  create: (title) => HttpBody.json({ title }).pipe(
    Effect.flatMap((body) => client.post("/api/todos", { body })),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
  )
  })
}))
```

## Step 3: Create the runtime

```ts
import * as Atom from "effect/reactivity/Atom";
import * as Layer from "effect/Layer";
import { $SchemaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpBody from "effect/http/HttpBody";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
const $I = $SchemaId.create("examples");
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;
class TodoService extends Context.Service<TodoService, {
  readonly list: Effect.Effect<ReadonlyArray<Todo>, HttpClientError.HttpClientError | S.SchemaError>
  readonly create: (title: string) => Effect.Effect<Todo, HttpClientError.HttpClientError | HttpBody.HttpBodyError | S.SchemaError>
}>()($I`TodoService`) {}
declare const TodoServiceLive: Layer.Layer<TodoService, never, HttpClient.HttpClient>;
declare const LoggingLayer: Layer.Layer<never>;
declare const TracingLayer: Layer.Layer<never>;
const todoRuntime = Atom.runtime(
  TodoServiceLive.pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.merge(LoggingLayer),
    Layer.merge(TracingLayer)
  )
)
```

Or with a shared factory:

```ts
import * as Atom from "effect/reactivity/Atom";
import * as Layer from "effect/Layer";
import { $SchemaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpBody from "effect/http/HttpBody";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
const $I = $SchemaId.create("examples");
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;
class TodoService extends Context.Service<TodoService, {
  readonly list: Effect.Effect<ReadonlyArray<Todo>, HttpClientError.HttpClientError | S.SchemaError>
  readonly create: (title: string) => Effect.Effect<Todo, HttpClientError.HttpClientError | HttpBody.HttpBodyError | S.SchemaError>
}>()($I`TodoService`) {}
declare const TodoServiceLive: Layer.Layer<TodoService, never, HttpClient.HttpClient>;
declare const LoggingLayer: Layer.Layer<never>;
class UserService extends Context.Service<UserService, { readonly currentUser: Effect.Effect<string> }>()($I`UserService`) {}
declare const UserServiceLive: Layer.Layer<UserService, never, HttpClient.HttpClient>;
const factory = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })
factory.addGlobalLayer(LoggingLayer)

const todoRuntime = factory(TodoServiceLive.pipe(Layer.provide(FetchHttpClient.layer)))
const userRuntime = factory(UserServiceLive.pipe(Layer.provide(FetchHttpClient.layer)))
```

## Step 4: Create atoms

Register the query with the same runtime factory and key that the mutation
invalidates. `reactivityKeys` does not discover queries automatically. Using
`todoRuntime.factory` also keeps this registration in the shared factory's
reactivity context when using the alternative runtime setup above.

```ts
import * as Atom from "effect/reactivity/Atom";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import { $SchemaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpBody from "effect/http/HttpBody";
const $I = $SchemaId.create("examples");
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;
class TodoService extends Context.Service<TodoService, { readonly list: Effect.Effect<ReadonlyArray<Todo>, HttpClientError.HttpClientError | S.SchemaError>; readonly create: (title: string) => Effect.Effect<Todo, HttpClientError.HttpClientError | HttpBody.HttpBodyError | S.SchemaError> }>()($I`TodoService`) {}
declare const todoRuntime: Atom.AtomRuntime<TodoService>;
// Query: auto-fetches when runtime resolves
const todosAtom = todoRuntime.atom(
  TodoService.use((_) => _.list)
).pipe(todoRuntime.factory.withReactivity(["todos"]))

// Mutation: invoked on write
const createTodoFn = todoRuntime.fn<string>()(
  (title) => TodoService.use((_) => _.create(title)),
  { reactivityKeys: ["todos"] }
)
```

## Step 5: Use in React

```tsx
import * as Atom from "effect/reactivity/Atom";
import * as Cause from "effect/Cause";
import * as A from "effect/Array";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useAtom } from "@effect/atom-react";
import { useAtomValue } from "@effect/atom-react";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpBody from "effect/http/HttpBody";
import * as S from "effect/Schema";
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;
type TodoError = HttpClientError.HttpClientError | S.SchemaError;
declare const todosAtom: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<Todo>, TodoError>>;
declare const Spinner: () => React.ReactNode;
declare const createTodoFn: Atom.AtomResultFn<string, Todo, TodoError | HttpBody.HttpBodyError>;
declare const Error: (props: { readonly cause: Cause.Cause<TodoError> }) => React.ReactNode;
function TodoList() {
  const result = useAtomValue(todosAtom)
  const [createResult, create] = useAtom(createTodoFn)

  return AsyncResult.match(result, {
    onInitial: () => <Spinner />,
    onFailure: (r) => <Error cause={r.cause} />,
    onSuccess: (r) => (
      <ul>
        {A.map(r.value, todo => <li key={todo.id}>{todo.title}</li>)}
        <button onClick={() => create("New todo")}>Add</button>
      </ul>
    )
  })
}
```

Or with Suspense:

```tsx
import * as Atom from "effect/reactivity/Atom";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as A from "effect/Array";
import { Suspense } from "react";
import { useAtomSuspense } from "@effect/atom-react";
import * as HttpClientError from "effect/http/HttpClientError";
import * as S from "effect/Schema";
const Todo = S.Struct({ id: S.String, title: S.String });
type Todo = typeof Todo.Type;
type TodoError = HttpClientError.HttpClientError | S.SchemaError;
declare const todosAtom: Atom.Atom<AsyncResult.AsyncResult<ReadonlyArray<Todo>, TodoError>>;
declare const Spinner: () => React.ReactNode;
declare const ErrorBoundary: (props: { readonly children: React.ReactNode }) => React.ReactNode;
function TodoList() {
  const result = useAtomSuspense(todosAtom)
  // result is guaranteed Success here
  return (
    <ul>
      {A.map(result.value, todo => <li key={todo.id}>{todo.title}</li>)}
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
