# Live Phoenix project ownership and count refresh

The live REST and GraphQL endpoints were read on 2026-10-28 at approximately
23:10 CDT. Queries were limited to project metadata and aggregate counters; no
span content or real prompts were retrieved. The deployed response identifies
Phoenix 20.23.0. Pagination completed for all three projects.

| Project | Unfiltered span records | Unfiltered traces | Unfiltered sessions | Rolling 7-day span records | Rolling 7-day traces | Rolling 7-day sessions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| harness-otel | 594,060 | 11,845 | 464 | 237,045 | 5,899 | 312 |
| default | 1 | 1 | 0 | 0 | 0 | 0 |
| beep-agent-effectiveness | 0 | 0 | 0 | 0 | 0 | 0 |

The precise UTC window and query capture times are retained in
`ops/live-phoenix-project-inventory.json`. Unfiltered means no explicit time filter
was sent; these are retained observations, not lifetime totals. Queries were made
separately and are not a cross-query transaction. A rolling window and retention
can change counts without proving collection loss. No expected fleet population
has been established, so these totals cannot produce a coverage percentage.

Source verification confirms the implemented project contracts:

- `harness-otel`: monitoring_otel_phoenix_project in dankserver configuration.
- `default`: the Phoenix role sends ansible-phoenix-health without a project
  attribute, using the default ingestion destination.
- `beep-agent-effectiveness`: named by the Beep OTLP exporter and effectiveness
  bundle; the historical scheduled local forwarder remains masked/inactive.

The condition for removing apparently unused projects is not established. The
single retained default trace is outside the current seven-day window, and the
empty effectiveness destination still has a named producer contract. Preserve
both through producer migration and recovery review.

## Deployed descriptions

All three project descriptions were updated through the deployed REST API and
verified with fresh project reads. Each description names its purpose and count
limitations. The effectiveness description explains the intentional historical
hold. Only description fields changed: no project deletion, trace mutation,
retention adjustment or collection restart occurred.

The prior values, intended values, per-project attempts and verified results are
in `ops/phoenix-project-description-update.json`. Reversal is a description-only
PUT with the recorded prior value followed by fresh read-back; it does not require
restoring trace data. Do not replay a mutation blindly after an uncertain result.

Dankserver now owns the same text in phoenix_project_descriptions and includes
project-descriptions.yml. The tasks read exact existing identities, update only a
changed description, then verify identity and content by fresh reads. The full
Phoenix playbook syntax check passed using the repository Ansible config.
Executing only these tasks against the already-updated live service reported
ok=5, changed=0, failed=0. This is metadata deployment parity, not evidence that the
full service/collector/retention rollout has been applied.
