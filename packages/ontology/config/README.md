# @beep/ontology-config

Typed server configuration for the `ontology` slice.

`ONTOLOGY_WORKSPACE_ROOT` is a required, non-empty server setting. The live
layer resolves it through Effect `Config` and preserves `ConfigError` so the
application boundary owns final startup policy.

`ONTOLOGY_MCP_MUTATIONS_ENABLED` decides whether the three ontology mutation
tools are registered on the MCP surface at all. It defaults to `false`, and it
is deliberately a *separate* service (`OntologyMcpConfig`) from the filesystem
authority contract: `workspaceRoot` bounds what a write may touch, while this
flag decides whether the write tools are advertised.

Registration is not authorization. Enabling the flag makes the tools visible in
`tools/list`; every call is still dispatched through `TierGate` and still fails
closed without an approved tool policy.

## Boundary exports

- `@beep/ontology-config/server` exposes the typed server contracts and services.
- `@beep/ontology-config/layer` exposes ambient `ConfigProvider` resolution.
- `@beep/ontology-config/test` exposes static test-layer constructors.

## Consumers

- `apps/professional-desktop/server/OntologyMcpTransport.ts` requires
  `OntologyMcpConfig` and resolves the registration branch inside
  `Layer.unwrap`, so the layer-shape decision stays where the layer is built.
- `apps/professional-desktop/server/main.ts` provides `OntologyMcpConfigLive`
  into the MCP branch and reads `OntologyMcpMutationsEnabledConfig` directly for
  the boot log annotation — the IPC transport mounts no MCP surface, so
  requiring the service there would infect a transport that has none.
