# Live Phoenix and dankserver audit

Observed 2026-10-27 CDT, approximately 21:10–21:30 (2026-10-28 UTC in machine receipts). Read-only GraphQL queries, OpenAPI/schema introspection, SSH configuration/service metadata and aggregated Prometheus queries. No trace ingestion, dataset/evaluator creation, project deletion, service changes or deployments occurred.

## What the screenshot counts mean

The original screenshot uses seven days. At the retained query window in `phoenix-window-and-coverage.json`, Phoenix returned:

| Project | Seven-day spans | Seven-day traces | Seven-day sessions | All retained spans | All retained traces | All retained sessions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| harness-otel | 359,130 | 6,687 | 285 | 564,966 | 11,043 | 393 |
| default | 0 | 0 | 0 | 1 | 1 | 0 |
| beep-agent-effectiveness | 0 | 0 | 0 | 0 | 0 | 0 |

The screenshot's 6,674 versus the query's 6,687 traces is consistent with continuing ingestion, not an unexplained discrepancy requiring invented missing data. Spans, traces and sessions are different populations. A session groups traces; it is not a count of all processes, tasks, users or source files. A session-window inclusion can include overlap rather than only starts. These counts are not a fleet census.

All three projects use the default **14-day** trace retention rule, scheduled weekly (`0 0 * * 0`). A 30-day UI range does not restore expired data. The cleanup schedule means a maximum-age rule is not necessarily an exact continuous cutoff. “All retained” is not lifetime history.

Live Phoenix reports **20.23.0**, healthy, and `insufficientStorage=false`. It reports **0 datasets, 0 prompts and 0 custom evaluators**; no project returns span/trace/session annotation names. Dataset count zero also leaves no current dataset-backed experiments to compare.

## Arriving data versus useful semantics

Separate, fixed-window queries returned approximately 359,131 spans. Queries are not transactionally snapshot-isolated: late arrivals can slightly change counts even with fixed start/end. Keep exact per-query receipts rather than reconciling them as a single immutable population.

| Predicate / measure | Observed result | Meaning |
| --- | ---: | --- |
| Claude-named spans | 359,131 | All spans in that name-count query use the allowed Claude prefix |
| Exact `handle_responses` | 0 | No span on the collector's named Codex route in that window |
| `ai_metrics.*` | 0 | No derived forwarder-named spans in that window |
| Recognized LLM-kind spans | 91,803 | LLM kind exists even though usage mapping is absent |
| Native `input_tokens` / `output_tokens` | 91,499 each | Native usage is present; missing Phoenix totals do not mean no tokens were consumed |
| `llm.token_count.prompt` / `.total` present | 0 | Missing normalized token fields |
| Phoenix total/prompt/completion token aggregate | 0 / 0 / 0 | Not a credible measure of actual consumption with the mapping gap |
| Phoenix computed total cost | null | Not zero actual spend |
| `llm.model_name` present | 91,803 | Model attribution exists for the LLM subset |
| `beep.repo` present | 37,616 | About 10.5% of spans in that query carry repo attribution |
| `session.id` present | 359,131 | Session metadata is widespread; this does not establish task lineage or unique user work |
| `service.name=claude-code-desktop` | 314,198 | Positive self-reported Code desktop runtime evidence, not proof of all ordinary Desktop/Cowork conversations |
| ERROR status | 1,617 | Operation-level errors, not necessarily failed tasks |
| Has parent ID but no stored parent | 1,562 | Orphan spans; counts alone do not identify their causes |

The latest-300 convenience sample identifies 291 spans as `claude-code-desktop`, non-interactive, first-party deployment; 9 carry terminal `ghostty`. Sample model values include Opus 5.5 and Haiku 5.5. It is a convenience sample, not a provider mix estimate. No Muse delivery or absence claim follows from it.

A separate 100-span attribute-key sample exposes native input/output/cache token keys, model and effort, but no normalized `llm.token_count.*`. The deployed collector has no token normalization transform. Correct mapping must preserve provider cache accounting and must not double-count cache tokens.

The sample also contains account/user identifiers, process owner, output-value and user-prompt **field names**. Field presence does not establish that the value contains unredacted content: contents were not printed or retained. Local content switches are not a guarantee about every desktop/remote producer. A future metadata-only pipeline needs a positive attribute/payload allowlist, not email removal alone.

## Query correctness finding

Initial probes using `attributes["session.id"]` against nested stored attributes returned false zeros, while `session.id` and `attributes["session"]["id"]` matched the population. The same occurred for model and repo fields. These initial counts are explicitly marked invalid for semantic-coverage interpretation in `phoenix-filter-counts.json`; corrected queries are in `phoenix-semantic-coverage.json`. This is a practical audit lesson: validate known-positive and known-negative controls before treating a zero as absence. Phoenix documents that unknown attribute names can silently match nothing. [Official filter reference](https://arize.com/docs/phoenix/tracing/how-to-tracing/filter-expressions).

## Other live paths

An aggregate Prometheus metric-name query found **152 distinct Codex metric names**, **3 Claude metric names**, and **0 `otelcol_*` names** in that instant. This establishes live Codex metric series, not all-time inventory, unique sessions or tracing coverage. It is stored without series labels in `prometheus-metric-inventory.json`. The collector's application metrics endpoint is different from its self-observation metrics; absence of `otelcol_*` here is a monitoring gap, not proof the binary cannot expose them.

On dankserver, Docker showed healthy Phoenix 20.23.0 and collector 0.163.1. The deployed collector's trace name filter matches the repository policy. The deployed metrics pipeline also includes **`transform/prom-label-collisions`**, which preserves an inherited `os.version` under a distinct name when `os_version` exists. That transform is absent from the local Ansible template. Re-rendering that template could remove the live repair. See `dankserver-live-receipt.txt` and [deployment source audit](./DEPLOYMENT-AUDIT.md).

The most recent observed backup service windows were 2026-10-27 **03:45:08–03:45:31 UTC** for monitoring and **04:00:18–04:00:42 UTC** for Phoenix: **23 and 24 seconds**, both successful. In the user's timezone these ran October 26 at 22:45 and 23:00 CDT. These service durations are not precise receiver downtime measurements. The scripts stop components inside the runs; exact unavailable intervals and lost event counts were not measured. The runs did not overlap. They do not prove long outages, but the absent persistent queue remains a resilience risk.

The remote administrator's inspected Codex config has no OTEL keys and Claude settings have no telemetry enable/export switches. Worker-account files were unreadable through the administrator account. A final read-only probe through the repo-owned dedicated worker login succeeded: the worker Codex config exists but has no OTEL keys, and worker `~/.claude/settings.json` is absent. This verifies missing user-level enrollment, not absence of all runtime/environment/system overrides. The source provisioning path also does not establish telemetry enrollment. No permissions were changed.

## Project disposition

- **harness-otel:** the active native collector destination. Keep, enrich, document writer ownership and distinguish metadata quality from traffic.
- **default:** currently holds one `ansible-phoenix-health` synthetic trace. Its deployment check has no explicit project, so deleting it without changing the writer can recreate the same clutter. First route canaries explicitly and exclude them from outcome dashboards. Conditional request to remove unused projects is not met by a project with this active producer.
- **beep-agent-effectiveness:** zero current data, but implemented derived exporter and effectiveness bundle destination. Its empty state aligns with the disabled forwarder. Preserve its explicit owner during redesign; retire only if the replacement deliberately supersedes and migrates its writers. Empty does not mean unused by the system's contract.

## Evidence index and limits

Primary retained receipts: `phoenix-project-totals.json`, `phoenix-window-and-coverage.json`, `phoenix-filter-counts.json`, `phoenix-semantic-coverage.json`, `phoenix-surface-counts.json`, `phoenix-attribute-key-sample.json`, `phoenix-safe-producer-sample.json`, `dankserver-live-receipt.txt`, `dankserver-producer-settings.json`, `prometheus-metric-inventory.json` and the `phoenix-*-schema*.json` files. Aggregate queries are preserved in the applicable JSON evidence.

No raw prompts, response bodies, tool payloads or credentials were saved. Attribute inspection reduced values to key frequencies or a narrowly allowed service/model/surface vocabulary in memory. Other remote hosts, actual worker/process overrides, source transcript content, historic deleted telemetry and a complete source-to-destination denominator remain unverified. This audit cannot calculate a defensible percentage of all agent activity lost.
