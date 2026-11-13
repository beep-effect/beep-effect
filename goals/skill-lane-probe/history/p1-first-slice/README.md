# First slice, 2026-11-13

**Pilot data. This decides nothing and is not evidence for the verdict.**
It checks the report change of P1 against the first probe's committed
laws-prompt pilot records
([`runs.jsonl`](../../../skill-effect-probe/history/p1-laws-pilot/runs.jsonl),
2 runs per task and cell, 48 runs). No output of this check is committed as
a finding.

```sh
bun run beep agent-effectiveness evals probe report \
  --records goals/skill-effect-probe/history/p1-laws-pilot/runs.jsonl \
  --preflight goals/skill-effect-probe/history/preflight.json \
  --primary lane-fraction --pilot
```

| Check | Result |
| --- | --- |
| Prints `D`, the p-value and the interval | yes: `difference`, `test.pValue`, `difference.lower`/`upper` |
| Three tasks match a hand calculation | yes: `sfv4-fn-schema-001`, `sfv4-fn-schema-002` and `sfv4-normalization-003`, cell means, `D_t` and `SE` recomputed from the raw records with `jq` |
| Same seed, same p-value twice | yes: two runs printed byte-identical JSON |
| Labelled pilot, no verdict | yes: `data: "pilot"`, `verdict: null` |

The seeded test also gives the same p-value on Node and Bun: the unit test
pins it on a hand fixture and runs on both runtimes.
