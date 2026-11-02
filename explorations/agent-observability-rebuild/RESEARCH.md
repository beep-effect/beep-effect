# Agent observability audit and redesign research

Audit: **2026-10-27, America/Chicago**. Main source revision: `e2e021ef75b975573dfaa04eab2f9a7f4e62aab9`. Scope: beep-effect main and numbered/private clones, their registered worktrees, local harness configuration, dankserver deployment source and live services, Phoenix aggregates/schema, Prometheus metric inventory, and primary documentation. Implementation/configuration/deployment changes are not claimed.

## Verdict

**The concern is substantiated: this is an incomplete and weakly interpreted observability system.** Phoenix is healthy and receives substantial traffic, but the repository's scheduled collector is disabled, coverage varies by harness, most incoming spans lack repo attribution, native usage is not normalized for Phoenix, and no outcome annotations/datasets/experiments turn activity into improvement evidence.

The seven-day total itself is not proof of loss. The live window had **6,687 traces / 285 sessions / 359,130 spans** in `harness-otel`, close to the screenshot's 6,674 traces. Retained totals were **11,043 traces / 393 sessions / 564,966 spans**. These are filtered, retained observations, not expected fleet activity. Fourteen-day retention further limits what a 30-day UI view can show. [Live audit and exact receipts](./research/LIVE-AUDIT.md).

## Findings in priority order

| Priority | Finding and evidence | Practical consequence / repair direction |
| --- | --- | --- |
| P1 | Forwarder service **and timer masked**, plus a separate recovery hold; status/registry/database last updated September 15. [Fleet audit](./research/FLEET-AUDIT.md) | Derived collection has no active scheduled path. Investigate the resource-integrity quarantine and qualify a bounded replacement; do not simply unmask and replay history. |
| P1 | Claude transcript discovery selects one current-root project directory; Codex selects global active sessions and writes current-root/config attribution. [Source audit §1](./research/SOURCE-AUDIT.md) | Missing sibling Claude roots and potentially wrong Codex repository/config associations. Discover independently of ingestion cwd; preserve source-root provenance and unknowns. |
| P1 | 24 primary clones and 201 linked roots versus **3 roots** in the metrics registry. Primary-clone Claude directories contain 5,351 files; these are not unique session counts. [Fleet inventory](./research/fleet-inventory.json) | Registry enrollment is far below known physical-root inventory. Build an explicit coverage denominator without equating checkouts/files with activity. |
| P1 | Native token fields on 91,499 spans; **zero normalized token-count fields**, zero Phoenix token totals and null cost. Only ~10.5% carry `beep.repo`. [Live semantic audit](./research/LIVE-AUDIT.md) | Usage and repo comparisons are currently misleading. Normalize and version the contract; expose completeness alongside the metrics. |
| P1 | Codex shared config omits `trace_exporter`; version-matched 0.165.0 source defaults it to none. Native metrics are arriving, no recognized Codex spans observed. [Independent review](./research/REVIEW.md) | CLI tracing under this config is off absent overrides. Desktop/process effective settings remain unverified. Treat logs, metrics and traces as separate routes. |
| P1 | Grok/Cursor have no transcript adapters; desktop/proxy identity is not preserved end to end. [Harness matrix](./research/HARNESS-COVERAGE.md) | Enum entries, installations and configured model routes do not establish observation. Add per-surface capability contracts and canary qualification. |
| P1 | Reconstructed spans use export-time start=end; newest-N rescans lack eventual progress. [Source audit §2–3](./research/SOURCE-AUDIT.md) | Backfill would appear current and zero-latency; older sources can remain omitted. Preserve event time and measured duration; use fair persistent offsets. |
| P1 | Live label-collision transform missing from Ansible source. [Deployment audit](./research/DEPLOYMENT-AUDIT.md) | Next template reconciliation could regress working metric exports. Preserve the live repair in owned source before deploying. |
| P2 | No persistent collector spool configured; backup scripts interrupt receiving/backend service; no observed collector self-metrics in Prometheus. [Live/deployment audits](./research/LIVE-AUDIT.md) | Crash/outage recovery and detection are unproven. Add durable queues, explicit resource bounds, backlog/drop/refusal metrics and route canaries. No actual loss count was measured. |
| P2 | Discovery errors can become empty success; path-based identity can duplicate moved/copied sessions; timestamps are lexically ordered. [Source audit](./research/SOURCE-AUDIT.md) | Silent unknowns and inaccurate comparisons. Keep occurrence versus logical identity separate; surface incomplete discovery and parse instants. |
| P2 | Health checks bypass collector/tailnet; retention verifies first policy rather than intended assignment; backup gauges conflate snapshot success/recovery. [Deployment audit](./research/DEPLOYMENT-AUDIT.md) | Green checks are weaker than end-to-end collection proof. Add read-back receipts and identify exact policy and recovery state. |

P1 here means high-impact corrective work in the proposed program, not a claim of an active security incident. Operational risks, proven source behavior, and measured runtime facts remain separately labeled in the detailed reports.

## Requested harnesses

| Harness/surface | Evidence today | Remaining qualification |
| --- | --- | --- |
| Claude Code CLI | Native telemetry enabled; terminal-style spans observed; transcript fallback currently masked | Per-clone, per-host and per-run completeness |
| Claude Code in Desktop | 314,198 spans self-report `claude-code-desktop` in a fixed seven-day query | This is positive runtime evidence, not proof of every ordinary Claude Desktop/Cowork chat |
| Ordinary Claude Desktop/Cowork | App present; no dedicated adapter established | Supported export source and explicit surface identity |
| Codex CLI | Live Prometheus metrics; inspected config defaults native tracing to none; local transcript path exists but scheduled parser is masked | Versioned trace route, allowlist compatibility and safe launch/receipt proof |
| ChatGPT/Codex Desktop | App installed; possible shared Codex home/app-server behavior | Actual runtime overrides, remote/cloud sources and desktop-specific delivery |
| Grok | Installed; source adapter NOT FOUND | Managed result/usage adapter or documented native exporter |
| Muse via `claudem` | Shell proxy route through Claude exists | Requested route versus reported/verified model identity; no dedicated delivered coverage proof |
| cursor-agent | Installed; partial hook vocabulary, no full transcript/forwarder adapter | Explicit managed-launch/result adapter and delivered evidence |

The native collector allows only `claude_code.*`, `ai_metrics.*`, and exact `handle_responses`. New names from other tools can be dropped even when they successfully emit OTLP. Do not remove the filter wholesale: its origin was a documented flood of irrelevant runtime spans. Replace a fragile name-only policy with tested producer/schema-specific signal contracts.

## What to do with the projects

Keep `harness-otel`. `default` has an active deployment-health writer; first give it an explicit canary destination. `beep-agent-effectiveness` is implemented in both the derived OTLP sender and effectiveness bundle code; its emptiness is part of the failure evidence. The condition “harness-otel is the only one used” is not satisfied at the producer-contract level. **No project was deleted.** Retire superseded projects as a migration step with data/producer inventory and rollback, not as cosmetic cleanup that hides missing data.

## Recommended direction

Adopt the [proposed brief](./BRIEF.md): coverage ledger + bounded durable host collector + normalized task/outcome evidence, with Phoenix as the investigation and experiment surface. Reuse existing working pieces. A first-principles redesign is justified; a wholesale replacement of every component is not yet justified by the evidence.

The operator selected **metadata plus curated sanitized examples**. The proposed experiment program begins with deterministic checks and human acceptance, then a pinned representative task dataset, controlled paired experiments, and calibrated supplemental judge scores. Do not rank agent productivity by span count, token count, or a single opaque quality score.

Phoenix already offers sessions, annotations, datasets/experiments, model/cost views and programmatic access. We are mainly missing trustworthy inputs and an outcome model. See [capability matrix](./research/PHOENIX-CAPABILITIES.md), [ADHD exploration](./research/ADHD.md), [implementation map](./MAP.md), and [provenance ledger](./research/SOURCES.md).

## Verification and limits

- Read-only live HTTP/GraphQL, schema, SSH service/configuration and aggregated Prometheus evidence retained in the packet.
- Independent review verified critical source mechanics and corrected an early Codex exporter interpretation. Four existing synthetic fixture tests passed; 81 unrelated tests were skipped, 3.52 seconds. No complete package/runtime proof is claimed. [Review and exact test command](./research/REVIEW.md).
- No raw transcript content, prompt/output payloads or credentials retained; telemetry attribute inspection reduced to approved key/count/model/surface summaries. No production probes or mutations were sent.
- The dedicated worker login verified Codex has no OTEL keys and Claude user settings are absent; other remote hosts and every active process override, exact historical lost volume and full per-harness end-to-end coverage remain unknown. Physical-root inventory and file mtimes are not session/event denominators.
- Public Phoenix docs are rolling; capabilities must be checked against deployed 20.23.0 before use. The supplied `llms.txt` could not be retrieved (web timeout, direct HTTP error); primary feature pages, upstream versioned source and live schema provided the evidence instead.

## Research completion

The operator adopted the design and requested implementation packets. The exploration is graduated to three paused, authored-but-not-started packets in [MAP.md](./MAP.md). No implementation goal is active and no repair is claimed deployed. [DECISIONS.md](./DECISIONS.md) records the choices. Findings are implementation work, not resolved defects.
