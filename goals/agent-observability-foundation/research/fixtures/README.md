# Synthetic declared inventory

`declared-inventory.synthetic.json` is a deterministic fixture, not workstation enrollment or a live inventory. The population window is one fixed synthetic hour, [2026-10-27T11:00:00Z, 2026-10-27T12:00:00Z). All seven requested harnesses are declared with unknown capability, heartbeat, launch population and expected-event population. The native OTLP transport entries are hypothetical routes for testing; they do not assert that any product supports that transport. IDs derive only from public synthetic labels. There are no real hostnames, paths, source sessions, prompts or credentials.

Run the read-only report:

```sh
bun run beep ai-metrics inventory report --input goals/agent-observability-foundation/research/fixtures/declared-inventory.synthetic.json
```

Add `--json` for the typed report containing the evidence manifest, separate population counts, evaluation time and per-route status. Unknown populations remain explicit even when the known subset contains zero IDs. This fixture never starts collection or performs discovery.

## Root producer fixture

`declared-roots.synthetic.json` declares one synthetic retired path; it is never accessed. Run it with a synthetic-only hash salt:

```sh
BEEP_AI_METRICS_HASH_SALT=synthetic-fixture-salt bun run beep ai-metrics inventory probe-roots --input goals/agent-observability-foundation/research/fixtures/declared-roots.synthetic.json --json
```

The JSON envelope contains `inventory` and `rootReceipts`; keep both for evidence. The `inventory` member alone is accepted by `inventory report`. For actual local observations, prepare a private declaration outside version control, use the existing approved hash-salt environment, and mark only explicitly retired paths `retired`; other declared roots use `inspect`. A stable host key must be unique per host. Changing the host key or salt changes identity. Neither that declaration nor its raw paths/host key belongs in published evidence. The output keeps identity and availability separate from harness capabilities, which remain unknown until independently qualified.
