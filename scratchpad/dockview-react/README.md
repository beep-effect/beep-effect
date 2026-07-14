# Dockview React adapter

This module renders the headless `scratchpad/dockview/poc` atom graph as React DOM. The host creates and disposes
the graph; the adapter only provides its exact registry and submits typed operations.

Adapter state is cached by graph identity at module scope. Each graph gets one container atom, focused-group atom,
geometry graph, and stable `HTMLElement` portal target per panel; moving a panel reparents that target instead of
retargeting its portal, preserving the mounted React subtree.

Run the proofs from the repository root:

```sh
bunx tsgo -p scratchpad/dockview-react/tsconfig.json --pretty false
(cd scratchpad/dockview-react && bunx biome check --config-path biome.json .)
npx vitest run --config scratchpad/dockview-react/vitest.config.ts
bunx tsgo -p scratchpad/dockview/tsconfig.json --pretty false
```
