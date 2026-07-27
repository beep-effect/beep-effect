# @beep/epistemic-config

Typed server configuration for the `epistemic` slice's execution-authority
boundary.

Two settings, both optional, both fail-closed when absent:

- `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST` — comma-separated destinations
  governed egress may reach. Unset or empty means the empty allowlist, which
  denies every destination. A present-but-malformed entry stays a typed
  `ConfigError` rather than being silently dropped.
- `EPISTEMIC_POLICY_REVISION` — the revision every grant and execution record is
  pinned to. Defaults to `1.0.0`.

The live layer preserves `ConfigError` so the application boundary owns final
startup policy.

## Audience is resolved, never configured

Sink audience is derived from the destination by `resolveSinkAudience`, not
read from configuration and never declared by the caller. A caller that could
name its own audience could name the friendlier one. The rule is loopback
versus not: a destination resolving to the local host is observable only by the
local workspace; everything else, including anything unparseable, is treated as
external network.

## Boundary exports

- `@beep/epistemic-config/server` — typed server contract, service, and the
  audience resolver.
- `@beep/epistemic-config/layer` — ambient `ConfigProvider` resolution.
- `@beep/epistemic-config/test` — static test-layer constructors and the
  deterministic grant fixtures.
- `@beep/epistemic-config/public` and `/secrets` are intentionally empty: no
  setting here is browser-safe, and v1 holds no secret.

## Grant fixtures are a contract, not a convenience

`fixtureFrozenGrantSet` is sealed at a pinned instant with a pinned expiry and
pinned destinations, so its digest is byte-stable across runs. The acceptance
test chains ledger rows against that digest; a fixture that drifted between
runs would make the chain unreproducible. `test/Config.test.ts` asserts the
stability directly.
