---
name: atom-reactivity-specialist
description: >
  Specialist skill for Effect Atom + Reactivity frontend state management.
  Use when building React components, managing client/server state, creating
  atoms, wiring frontend services via Atom.runtime, replacing React hooks,
  implementing mutations with reactivity key invalidation, or reviewing
  frontend code for Atom compliance. Covers effect/unstable/reactivity and
  @effect/atom-react.
version: 0.1.0
status: active
---

# Atom + Reactivity Specialist

Use this skill for all frontend state management in this repository.
React hooks are banned in new code. All state flows through Effect Atom.
If there is any conflict with this skill, repository laws win.

## When to Activate

- Adding or modifying React components that manage state
- Creating atoms for client, server, URL, or persisted state
- Wiring frontend services via `Atom.runtime` and `Layer`
- Implementing mutations with reactivity key invalidation
- Replacing legacy `useState`, `useEffect`, `useCallback`, `useMemo` code
- Reviewing frontend code for Atom compliance
- Working with `AsyncResult` lifecycle rendering or `AtomRpc` clients

## Non-Negotiable Laws

### Banned React Hooks

| Banned Hook | Replacement |
|-------------|-------------|
| `React.useState` | `Atom.make(value)` or `useAtom(writableAtom)` |
| `React.useEffect` (for subscriptions) | `useAtomSubscribe(atom, fn)` |
| `React.useEffect` (for data fetching) | `runtime.atom(effect)` + `useAtomValue` |
| `React.useCallback` | Define atom or function outside component |
| `React.useMemo` | `Atom.readable(get => ...)` or `Atom.map(atom, fn)` |
| `React.useRef` (for mutable state) | `Atom.make(value)` with `useAtom` |
| `React.useContext` | `RegistryProvider` + atom composition |

Exception: `React.useRef` for DOM element refs (not state) is permitted.

### Required Patterns

1. All state through `Atom.make`, `Atom.readable`, `Atom.writable`, `runtime.atom()`, or `runtime.fn()`.
2. Frontend services as `Context.Service` classes, implementations as `Layer`, provided to `Atom.runtime(layer)`.
3. `exactOptionalPropertyTypes: true` -- optional props typed as `undefined | T`.
4. `factory.addGlobalLayer()` for logging and tracing in all runtimes.
5. Server state uses `runtime.atom(effect)` with `AsyncResult` lifecycle.
6. Mutations use `runtime.fn<Arg>()(effect)` with reactivity key invalidation.
7. Client-only state uses `Atom.make(value)` (returns `Writable<A>`).
8. URL state uses `Atom.searchParam("key")` with optional Schema parsing.
9. Persisted state uses `Atom.kvs({ runtime, key, schema, defaultValue })`.
10. Never call `Effect.runSync` / `Effect.runPromise` / `Effect.runFork` in component code. Atoms handle execution.

## State Category Decision Tree

```
Is this state...
  |
  +-- From the server? (API call, database, RPC)
  |     |
  |     +-- One-shot fetch? --> runtime.atom(effect)
  |     +-- Mutation? -------> runtime.fn<Arg>()(effect, { reactivityKeys })
  |     +-- Realtime stream? -> runtime.pull(stream) or runtime.atom(stream)
  |     +-- RPC group? ------> AtomRpc.Service
  |
  +-- Client-only? (UI state, toggles, form values)
  |     |
  |     +-- Simple value? ---> Atom.make(initialValue)
  |     +-- Derived? --------> Atom.readable(get => ...) or Atom.map(atom, fn)
  |     +-- Per-key? --------> Atom.family(key => Atom.make(value))
  |
  +-- URL search param? -----> Atom.searchParam("key", { schema? })
  |
  +-- Persisted to storage? -> Atom.kvs({ runtime, key, schema, defaultValue })
  |
  +-- Component-scoped? -----> ScopedAtom.make(() => Atom.make(value))
```

## References (load on demand)

- `references/api-reference.md` -- full API: Atom constructors/combinators, AtomContext, AtomRuntime, AsyncResult, Reactivity, AtomRpc, @effect/atom-react hooks/provider/ScopedAtom/SSR
- `references/service-pattern.md` -- 5-step canonical frontend service pattern; canonical in-repo example is `packages/iam/client/src/core/atoms.ts`
- `references/examples-antipatterns.md` -- 10 Always/Never examples, anti-pattern table, extended verification greps

## Escalation

- `effect-first-development` when the task is broader than frontend state.
- `schema-first-development` for schema modeling within atoms.
- `effect-v4-services` for service and layer wiring patterns.
- `effect-error-handling` for typed error recovery outside atom rendering.

## Source References

- `.repos/effect/packages/effect/src/unstable/reactivity/{Atom,Reactivity,AtomRpc,AsyncResult}.ts`
- `node_modules/@effect/atom-react/src/{Hooks,RegistryContext,ScopedAtom,ReactHydration}.ts`

## Verification

```bash
# 1. Banned React hooks in new frontend code
rg -n "React\.useState|React\.useEffect|React\.useCallback|React\.useMemo" packages/*/client packages/*/ui apps

# 2. Raw hook imports (not from @effect/atom-react)
rg -n "import.*\{.*(useState|useEffect|useCallback|useMemo).*\}.*from ['\"]react['\"]" packages/*/client packages/*/ui apps

# 3. Effect.run* in component files
rg -n "Effect\.run(Sync|Promise|Fork)\(" packages/*/client packages/*/ui apps --glob "*.tsx"

# 4. Missing reactivity keys on mutations
rg -n "runtime\.fn" packages/*/client packages/*/ui apps -A3
```

Extended checks: `references/examples-antipatterns.md`.
