# @beep/xstate

XState v6 and @xstate/effect driver: Stately inspector wiring, machine serialization, and model-based test bridges

## Installation

```bash
bun add @beep/xstate
```

## Usage

```ts
import { StatelyInspector, toMachineJson } from "@beep/xstate"
import { createMachine } from "xstate"

const machine = createMachine({ id: "toggle", initial: "off", states: { off: {}, on: {} } })
console.log(toMachineJson(machine).id) // "toggle"

// `StatelyInspector.layer` reads STATELY_INSPECT* from the environment; attach
// an `@xstate/effect` actor with `inspectActor` inside a scoped program.
console.log(StatelyInspector.layer)
```

Model-based testing bridges (`arbitraryFromSchema`, `eventsFromSchemas`,
`effectActorSut`) live under `@beep/xstate/test`. The runbook is
`docs/runbooks/xstate-effect-statecharts.md`.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/xstate` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
