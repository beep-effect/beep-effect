# @beep/ontology-config

Typed server configuration for the `ontology` slice.

`ONTOLOGY_WORKSPACE_ROOT` is a required, non-empty server setting. The live
layer resolves it through Effect `Config` and preserves `ConfigError` so the
application boundary owns final startup policy.

## Boundary exports

- `@beep/ontology-config/server` exposes the typed server contract and service.
- `@beep/ontology-config/layer` exposes ambient `ConfigProvider` resolution.
- `@beep/ontology-config/test` exposes a static test-layer constructor.
