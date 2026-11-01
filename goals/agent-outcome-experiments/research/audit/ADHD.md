# ADHD exploration: from activity counts to trustworthy improvement

2026-10-27. Brief: redesign agent observability across clones, worktrees, hosts and harnesses so collection is measurable and resulting information improves agent work.

## Method

Five isolated generator frames: logistics (L), regulator (R), biology (B), 3am on-call (O), inversion (I). Each produced six ideas without criticism or access to another generator's output. Native concurrency allowed only three child workers, so generation used overlapping waves of three and two rather than five simultaneous calls; isolation was preserved. All workers used gpt-6.1-sol / medium. Criticism and scoring began after generation. Scores are design judgments, not measured experimental evidence.

## Wide set

Weighted score = 0.35 novelty + 0.40 viability + 0.25 fit. Duplicates remain visible because independent convergence is evidence about the idea space, not thirty distinct implementations.

### Prove the population

| ID | Idea | Scores | Weighted | Trap / qualification |
| --- | --- | --- | ---: | --- |
| L1 | Run shipment manifests | [N8 V8 F10] | 8.50 | — |
| R1 | Coverage certificate for the selected sources and window | [N9 V9 F10] | 9.25 | — |
| O3 | Publish unresolved coverage gaps with every result | [N8 V8 F10] | 8.50 | — |
| I1 | Declare expected evidence before a run can disappear | [N8 V8 F10] | 8.50 | — |
| I2 | Display an explicit unknown population | [N8 V9 F9] | 8.65 | — |
| R5 | Content-free receipts for intentional exclusion | [N8 V8 F9] | 8.25 | — |

### Deliver and recover

| ID | Idea | Scores | Weighted | Trap / qualification |
| --- | --- | --- | ---: | --- |
| L2 | Chain-of-custody receipts across each boundary | [N8 V8 F9] | 8.25 | — |
| L3 | Repair depot for malformed, duplicate and orphan records | [N8 V8 F9] | 8.25 | — |
| O2 | Bounded durable host flight recorder | [N8 V9 F10] | 8.90 | — |
| O4 | One repair operation with verified replay receipts | [N7 V7 F9] | 7.50 | Trap if blind repair releases recovery holds or replays unbounded history |
| L6 | Marked canary shipments through each route | [N7 V9 F9] | 8.30 | — |
| O5 | Tiny synthetic journeys with automatic retirement | [N7 V8 F9] | 7.90 | — |
| I6 | A recognizable clone-worktree-host journey | [N7 V8 F9] | 7.90 | — |

### Preserve lineage and explanation

| ID | Idea | Scores | Weighted | Trap / qualification |
| --- | --- | --- | ---: | --- |
| O1 | Telemetry passport across hosts and retries | [N8 V8 F9] | 8.25 | — |
| B2 | Branching lineage of tasks, sessions and changes | [N8 V8 F9] | 8.25 | — |
| I3 | One work identity across clones and machines | [N7 V8 F10] | 8.15 | — |
| R3 | Reproducible evidence package for each number | [N8 V7 F9] | 7.85 | Trap if every chart recomputes full raw histories |
| I4 | Receipts for filters, clocks and deduplication decisions | [N7 V9 F9] | 8.30 | — |

### Measure useful work and friction

| ID | Idea | Scores | Weighted | Trap / qualification |
| --- | --- | --- | ---: | --- |
| L4 | Measure the last mile from agent completion to user value | [N8 V8 F9] | 8.25 | — |
| L5 | Worktree dwell time split by waiting cause | [N8 V7 F9] | 7.85 | — |
| B1 | Time/token/tool receipt linked to useful artifacts | [N8 V8 F9] | 8.25 | — |
| B3 | Measure context freshness and feedback delay | [N9 V6 F9] | 7.80 | — |
| B4 | Adaptive instrumentation near recurring friction | [N9 V4 F7] | 6.50 | Trap: uncontrolled detail escalation can violate the metadata boundary |
| B5 | Successful repository navigation trails | [N9 V6 F8] | 7.55 | Trap: survivorship bias and content/path privacy without curated provenance |
| B6 | Result maturity from exploration to accepted benefit | [N8 V8 F9] | 8.25 | — |
| O6 | Completed-run outcome and experience receipts | [N9 V8 F10] | 8.85 | — |
| I5 | Measure repair burden left for collaborators | [N8 V7 F10] | 8.10 | — |
| R4 | Audit retries, abandoned work, repairs and reversions | [N7 V8 F10] | 8.15 | — |

### Make improvement claims testable

| ID | Idea | Scores | Weighted | Trap / qualification |
| --- | --- | --- | ---: | --- |
| R2 | Refuse comparisons when evidence is insufficient | [N8 V8 F10] | 8.50 | — |
| R6 | Predeclare predicted effects, guardrails and rollback | [N8 V8 F10] | 8.50 | — |

## Converge

1. **R1 — coverage certificates (9.25).** Establish what each chart can honestly claim; separate known inventory, manifested runs and delivered events.
2. **O2 — bounded host flight recorder (8.90).** Preserve useful metadata across outages, restarts and worktree retirement, with fair progress and explicit delivery evidence.
3. **★ O6 — outcome and experience receipts (8.85).** The non-obvious viable move is to make an accepted task and its repair burden the learning unit; traces become explanatory evidence rather than the product's main score.

These are complementary layers, not rival products. Prune adaptive collection until a privacy-safe contract exists. Keep navigation-path studies curated and comparative. Reject blind auto-repair, full-history recomputation per chart, raw-token productivity rankings and a wholesale trace-filter removal.

## Focus: coverage certificates

Build an expected-source inventory from declared hosts, Git registrations and launch routes independently of collector output. An entry proves a route exists, not that work occurred. Instrumented launches emit an opaque run manifest with root, surface, harness, configured route and schema version; observed provider identity remains a separate claim. Preserve birth, retirement, last-seen and lease-expiry events so disappearing roots cannot erase historic gaps. Reconcile fresh manifests and known expected IDs against journal and backend evidence. Publish unsupported, excluded, stale, failed and inventory-unknown populations explicitly.

**Load-bearing risk:** the inventory becomes a false denominator if uninstrumented launches are invisible or expired leases erase failures.

**First step:** a metadata-only certificate over the existing inventory that visibly reports the masked collector, unsupported harnesses and missing desktop attribution.

**Child ideas:** separate capability/run/event denominators; append-only retirement; privacy exclusion declarations; configured-versus-observed proxy identity; content-free route canaries.

## Focus: durable flight recorder

Persist sanitized events in a bounded host journal before delivery and preserve producing surface, source time and adapter version. Reuse stable export identities and salt guards while distinguishing logical events from file occurrences. Receipts record local persistence, collector acceptance and backend visibility as separate facts, with one derived current state per event. Enforce disk, memory, retry and retention limits and expose incomplete coverage on exhaustion. A fair persistent cursor replaces repeated newest-N selection. Qualify native OTLP intake explicitly; the old direct native route does not gain journal durability automatically. Admit replay through a bounded manifest of stable IDs and destination checks.

**Load-bearing risk:** treating acknowledgment as durable storage loses data; retaining everything forever awaiting proof exhausts storage.

**First step:** a transport-free synthetic journal/crash fixture, followed by local intake/partial-ack/disposable-backend proof. Keep the historical recovery hold intact.

**Child ideas:** receipt transitions with evidence; fair source offsets; bounded replay admission; historical-time projection; outage canary and safe reclamation.

## Focus: outcome receipts and experiments

Attach a compact outcome record to completed or abandoned work: intent category, artifact, validation, human correction and missing evidence. Normalize provider/surface identities without erasing their original semantics. Curate representative tasks with pinned starting states and typed deterministic evaluators. Compare harness changes through repeated matched tasks, recording model/configuration, tool versions, execution order and environment. Report paired differences, failures and uncertainty rather than a universal ranking. Preserve human acceptance and evaluator corrections as versioned judgments. Organize the user view around task results, confidence, friction and experiments, with trace drill-down for explanation.

**Load-bearing risk:** polished receipts can make incomplete evidence, benchmark overfitting and unreliable evaluators appear authoritative.

**First step:** five manually curated, sanitized examples and one deterministic evaluator before automated grading or large runs.

**Child ideas:** facts/judgments separated; versioned difficulty/work-type strata; evaluator calibration examples; paired experiment cards; recurring friction linked to improvement proposals.

## Provocation

What if the main dashboard showed only three questions—**What useful work was accepted? What made it harder? What evidence are we missing?**—and every trace existed to explain one of those answers?

The adopted [brief](../../../../explorations/agent-observability-rebuild/BRIEF.md) combines the shortlisted ideas; [MAP.md](../../../../explorations/agent-observability-rebuild/MAP.md) turns them into three bounded implementation packets.
