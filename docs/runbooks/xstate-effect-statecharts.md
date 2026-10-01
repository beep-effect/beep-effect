# XState and @xstate/effect statecharts

## Purpose

How statecharts are written, tested, inspected, and visualised in this repo. The reference
implementation is document intake in `apps/professional-desktop/src/intake`; the shared wiring is
the `@beep/xstate` driver in `packages/drivers/xstate`.

## Versions

| Package | Pin | Note |
| --- | --- | --- |
| `xstate` | `6.0.0-alpha.63` | v6 alpha: inline transition functions, `schemas`, state contracts. |
| `@xstate/effect` | `0.1.0-alpha.5` | Peers `effect ^4.0.0-rc.115`; runs on the repo's Effect 4.0.0 snapshot. |
| `@xstate/test` | `2.0.0-alpha.1` | Model-based testing. Peers vitest 3; works on the repo's vitest. |
| `@statelyai/sdk` | `0.37.2` | Inspector client. `@statelyai/inspect` peers xstate v5 and is not used. |
| `statelyai` | `0.12.3` | CLI, root dev dependency. |

All five are catalog entries in the root `package.json`. No Effect version change was needed.

## File roles

| File | Role |
| --- | --- |
| `*.models.ts` | Schemas first: input, context, per-state context, state input, events, emitted events. |
| `*.machine.ts` | One `setupEffect(...).createMachine(...)` per file, plus pure snapshot projections. |
| `*.atoms.ts` | `createActorAtoms(runtime, machine, { input })` and the UI-facing surface atom. |
| `*.inspection.ts` | Opt-in inspector attachment for one actor. |

A machine file must import something from `"xstate"` (a type import is enough). The Stately CLI
only recognises `setupEffect(...).createMachine` in files that do.

## The reference statechart

`documentIntakeMachine` is a parallel machine with two regions. `intakeBatchMachine` is spawned
once per drop, so overlapping drops each get their own actor.

```mermaid
stateDiagram-v2
  state intake {
    state vault {
      [*] --> watching
      state watching {
        [*] --> loading
        loading --> unconfigured: VAULT_CONFIG_RESOLVED (no root)
        loading --> configured: VAULT_CONFIG_RESOLVED (root)
        unconfigured --> configured: VAULT_CONFIG_RESOLVED (root)
        configured --> unconfigured: VAULT_CONFIG_RESOLVED (no root)
        state unconfigured {
          state "idle" as onboardingIdle
          [*] --> onboardingIdle
          onboardingIdle --> picker: CHOOSE_VAULT
          picker --> awaitingConfig: saved
          picker --> failed: failed
          picker --> manual: manual
          picker --> onboardingIdle: cancelled
          manual --> awaitingConfig: saved
          manual --> onboardingIdle: cancelled
          failed --> picker: CHOOSE_VAULT
        }
        state configured {
          state "idle" as intakeIdle
          [*] --> intakeIdle
          intakeIdle --> dragging: DRAG_ENTER
          dragging --> intakeIdle: DRAG_LEAVE / DROP
        }
      }
      watching --> loadFailed: feed error
      loadFailed --> watching: after configRetry / RETRY_CONFIG
    }
    --
    state batches {
      state "idle" as batchesIdle
      [*] --> batchesIdle
      batchesIdle --> busy: BATCH_REQUESTED
      busy --> batchesIdle: BATCH_SETTLED (last batch)
    }
  }
```

`picker` and `manual` are compound states with final children; their `output` decides the parent
transition. `picker` starts in a `choice` state that routes to the Tauri dialog or the sidecar RPC.

Features in use, by location:

| Feature | Where |
| --- | --- |
| Parallel regions, compound states, `choice`, final states with `output` | `DocumentIntake.machine.ts` |
| State contracts (`setup({ states })`), per-state context, state input | both machines |
| `fromEffectStream` + `onSnapshot` (reactive feed) | `vaultConfigFeed` |
| `fromEffect` tasks with schema-typed input | pickers, `persistVaultRoot`, `readFile`, `submitFile` |
| Named guards, named delay with backoff, `after` | `hasVaultRoot`, `configRetry`, `loadFailed` |
| Internal events and `enq.raise` | `VAULT_CONFIG_RESOLVED`, `BATCH_REQUESTED` |
| `enq.spawn`, `enq.listen`, `enq.subscribeTo` | `batches` region |
| Emitted events | `vault.outcome`, `batch.settled`, `file.result` |
| Effect actions | `logIntakeCause` |
| `createActorAtoms` | `Intake.atoms.ts` |

## Tests

```bash
cd apps/professional-desktop && bun run test
```

- `intake-machine.test.ts`: the actor under `createEffectActor`, with `TestClock` for the retry
  backoff. Emitted events are asserted through a queue because listeners run after the snapshot
  that produced them.
- `intake-batch.test.ts`: the batch machine alone.
- `intake-model.test.ts`: `@xstate/test`. Shortest paths and random sequences check invariants on
  the pure model; a third run drives the Effect-hosted actor through `effectActorSut` and asserts
  it agrees with the pure model.
- `intake-atoms.test.ts`: the surface atom through an `AtomRegistry`.

`@beep/xstate/test` supplies `arbitraryFromSchema`, `eventsFromSchemas`, and `effectActorSut`.

Suites that share a process global (the Tauri `invoke` mock, `import.meta.env`, spies) need
`describe(name, { concurrent: false }, ...)`: the repo runs test cases concurrently.

## Inspector

In the desktop app, opt in per dev session:

```bash
cd apps/professional-desktop && VITE_STATELY_INSPECT=1 bun run dev
```

The intake actor then streams to the Stately inspector and logs the inspector URL. It is off in
production builds and when the variable is unset.

Outside the browser, `StatelyInspector.layer` reads `STATELY_INSPECT`, `STATELY_INSPECT_LAUNCH`
(`none` or `browser`), `STATELY_INSPECT_URL`, and `STATELY_INSPECT_NAME`; `inspectActor(actor)`
attaches an actor for the lifetime of the current scope.

## CLI

```bash
bunx statelyai scan
```

```bash
bunx statelyai open apps/professional-desktop/src/intake/DocumentIntake.machine.ts
```

`scan` and `status` need no account. `statelyai.json` at the repo root sets the discovery globs
(`**/src/**/*.machine.ts`) and `defaultXStateVersion: 6`. `open` starts a local visual editor;
`push`, `pull`, and Studio links need `statelyai login`. `toMachineJsonText(machine)` from
`@beep/xstate` produces the same serialised definition in code.

## MCP

`.mcp.json` registers the hosted server `stately` at `https://mcp.stately.ai/mcp`. It needs a
Stately sign-in the first time it is used, and it must be listed in `enabledMcpjsonServers` in
`.claude/settings.json` to load in Claude Code sessions.

## Alpha behaviours to know

These were found while building the reference machine. Re-check them on each alpha bump.

1. `@xstate/effect/atom` imports `effect/unstable/reactivity`, which Effect 4.0.0 ships as
   `effect/reactivity`. `patches/@xstate%2Feffect@0.1.0-alpha.5.patch` rewrites the import.
2. `@xstate/test/effect-schema` calls `Schema.toArbitrary`, which Effect 4.0.0 does not have.
   Use `eventsFromSchemas` from `@beep/xstate/test`, built on `effect/Arbitrary`.
3. An event that crosses an actor boundary cannot be an internal event. That covers events from
   `fromEffectEventStream` and events mapped by `enq.listen` or `enq.subscribeTo`: they are dropped
   as `internalEvent` dead letters. Raise the internal event from the parent (`onSnapshot` +
   `enq.raise`), or declare the relayed event in `schemas.events`.
4. `EffectActor.send` does not apply the internal-event check at runtime. Internal events are
   excluded from the type of `send`, which is the only protection for a root actor.
5. With nested state contracts, transition targets must be declared siblings or descendants. `#id`
   targets are not expressible, so shape the chart with compound states and final-state outputs.
6. `@xstate/test` rejects a machine that declares `schemas.emitted` at the type level. Assign it to
   `AnyStateMachine` first.
7. `testPaths` synthesises an invoked actor's done event without its output. Stop traversal with
   `stopWhen` before states whose `onDone` reads `event.output`, and pass `serializeState` when
   context grows without bound.
8. The SDK's own `inspector.inspect` hook reports duplicate session ids under `@xstate/effect`.
   `StatelyInspector.attach` forwards the v6 inspection events by hand instead.
9. `join(actor)` types its failure as `unknown`. Wait for `snapshot.status === "done"` and read
   `snapshot.output` where the repo's lint forbids an untyped error channel.
10. Effect actions are branded with an unexported unique symbol, so declaration emit fails with
    TS4023 for any exported machine that declares `actions`. The same patch replaces the symbol key
    with a string key in the two typings that use it. The brand is type-only; no runtime changes.

## Adding a machine

1. Write the schemas in `<Name>.models.ts`: input, context, event payload record, emitted events.
2. Write `<Name>.machine.ts` with `setupEffect`. Keep Effects in named actors and actions; keep
   transition functions pure.
3. Export pure projections from snapshot to view model next to the machine.
4. Test the actor with `createEffectActor`, then add a model-based test.
5. Run `bunx statelyai scan` and confirm the machine is listed.
