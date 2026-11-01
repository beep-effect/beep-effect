Primary provenance: [source exploration ledger](../../../explorations/agent-observability-rebuild/research/SOURCES.md). Sanitized research corpus is reproduced in `audit/`; it is an October27 snapshot, not live truth. No screenshots or raw trace bodies are copied.

# Source and provenance ledger

2026-10-27, America/Chicago. Primary ledger for this exploration and its graduated packets. Use local live evidence for deployment claims; source configuration is not runtime proof. All upstream material is reference-only in this audit. No upstream implementation was vendored.

## Local evidence and composed capabilities

| ID | Repository / source | Location | Disposition |
| --- | --- | --- | --- |
| B1 | beep-effect, main `e2e021ef75b975573dfaa04eab2f9a7f4e62aab9` | `packages/tooling/library/ai-metrics/src/internal/transcript-utils.ts:56–67` | Current-root Claude/global Codex source selection; replace attribution assumptions |
| B2 | beep-effect | `packages/tooling/library/ai-metrics/src/forwarder.ts:1297–1343,1485–1515,1644–1653` | Newest-N selection and current-root write context; fair cursor and provenance needed |
| B3 | beep-effect | `packages/tooling/library/ai-metrics/src/internal/jsonl-discovery.ts:20–65` | Error-to-empty discovery behavior; retain explicit incomplete states |
| B4 | beep-effect | `packages/tooling/library/ai-metrics/src/otlp.ts:540–555,792,821–892,989–1017,1145–1155` | Reuse deterministic IDs/chunk acknowledgment/watermark; replace export-time projection; existing project owner |
| B5 | beep-effect | `packages/tooling/library/ai-metrics/src/derived-storage.ts:1498–1597,1763–1767,1842–1847` | Attribution mutation and occurrence-bound identity; explicit logical correlation required |
| B6 | beep-effect | `packages/tooling/library/ai-metrics/src/identity-registry.ts:608–634` | Reuse clone/worktree identity with new independent route inventory |
| B7 | beep-effect | `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:1484`; package README; existing `goals/agent-effectiveness-loop` | Reconcile existing effectiveness bundles and goals; do not create a second unrelated meaning for outcomes |
| B8 | beep-effect | `packages/drivers/ai-provider-cli/src/profile.service.ts:29–44` | Managed launch environment boundary; inherited OTEL cannot be presumed |
| B9 | beep-effect | `packages/drivers/phoenix/src/Phoenix.service.ts`, `Phoenix.models.ts`, `Phoenix.config.ts`, `index.ts` | Existing API driver and package boundary; extend against deployed schema |
| B10 | beep-effect | `standards/architecture/12-observability.md:1–90` | Static names, bounded metric fields, architecture boundary alignment |
| D1 | dankserver | `ansible/roles/monitoring/templates/otel-config.yaml.j2:15–32,58–81` | Native allowlist, metrics/trace fanout, queue/self-observation gaps |
| D2 | dankserver | `ansible/roles/phoenix/tasks/main.yml:312–408` | Deployment canary bypass and retention-policy identity verification |
| D3 | dankserver | `ansible/roles/phoenix_backup/templates/dankserver-phoenix-backup.sh.j2:63–104` | Snapshot-versus-recovery reporting distinction |
| D4 | dankserver | `ansible/group_vars/all.yml:949–1024`, `docs/phoenix.md`, monitoring/backup role files | Pinned deployment,14-day retention, backup schedules, privacy/access policy |
| L1 | local filesystem/systemd | `fleet-inventory.json`, `fleet-collector-status.json`, `fleet-agent-surfaces.json` | Allowlisted config/status/stat metadata; no raw transcripts or secrets |
| L2 | live Phoenix | `phoenix-window-and-coverage.json`, `phoenix-semantic-coverage.json`, `phoenix-surface-counts.json` | Fixed-window query/count evidence; not snapshot-isolated |
| L3 | live Phoenix | `phoenix-attribute-key-sample.json`, `phoenix-safe-producer-sample.json` | Key-only and safe categorical convenience samples, not representative percentages |
| L4 | live dankserver/Prometheus | `dankserver-live-receipt.txt`, `dankserver-producer-settings.json`, `prometheus-metric-inventory.json` | Read-only deployed versions/config/service windows and aggregate metric names |
| V1 | independent review | `REVIEW.md`; four synthetic existing tests | 4 passed/81 skipped; no full-suite or end-to-end mutation proof |
| V2 | independent design review | `DESIGN-REVIEW.md` | Incorporated native intake, receipt overlap, timing, annotation target and retention refinements |

Detailed source excerpts, current line references and qualifications live in [SOURCE-AUDIT.md](./audit/SOURCE-AUDIT.md), [FLEET-AUDIT.md](./audit/FLEET-AUDIT.md), [HARNESS-COVERAGE.md](./audit/HARNESS-COVERAGE.md), [DEPLOYMENT-AUDIT.md](./audit/DEPLOYMENT-AUDIT.md) and [LIVE-AUDIT.md](./audit/LIVE-AUDIT.md). These references describe the audit revision, not an immutable future line mapping.

## External primary references

| ID | Source URL | Used for / limitation |
| --- | --- | --- |
| P1 | https://arize.com/docs/phoenix/llms.txt | Operator-supplied index; retrieval failed (web timeout/direct HTTP error), not substantive evidence |
| P2 | https://arize.com/docs/phoenix/tracing/how-to-tracing/filter-expressions | Filter syntax and silent unknown-field misses; validated against live nested-field controls |
| P3 | https://arize.com/docs/phoenix/tracing/how-to-tracing/cost-tracking | OpenInference usage/model fields and pricing; provider cache normalization still requires fixtures |
| P4 | https://arize.com/docs/phoenix/tracing/concepts-tracing/annotations-concepts | Typed human/programmatic annotations |
| P5 | https://arize.com/docs/phoenix/datasets-and-experiments/concepts-datasets | Versioned curated examples and metadata |
| P6 | https://arize-phoenix.readthedocs.io/projects/client/api/experiments.html | Phoenix experiment task/evaluation surface; client docs may lead server20.23.0 |
| P7 | https://arize.com/docs/phoenix/release-notes/07-2025/07-25-2025-project-dashboards | Native project dashboards predate deployed version |
| P8 | https://arize.com/docs/phoenix/tracing | Session/trace conceptual surface |
| P9 | https://github.com/Arize-ai/phoenix/blob/main/docs/phoenix/skill.md | Capability catalog, reference material only; external instructions not adopted |
| P10 | https://github.com/Arize-ai/phoenix/blob/main/packages/phoenix-client/docs/source/index.md | Programmatic traces/sessions/annotations/datasets/experiments |
| P11 | https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md | Version distinctions and session-window semantics; rolling source, verify deployment |
| O1 | https://opentelemetry.io/docs/collector/resiliency/ | In-memory retry versus persistent queues/WAL; not proof that current defaults lose each backup window |
| C1 | https://github.com/openai/codex/blob/rust-v0.165.0/codex-rs/core/src/config/otel.rs | Version-matched separate trace exporter default; line20 defaults missing value to None |

The old Phoenix run-experiments documentation route redirected to Arize AX and was excluded as Phoenix support evidence. No secondary-source claim is load-bearing. Web documentation never overrides local instructions or authorizes changes.

## Upstream repository license checks

Machine receipt: [upstream-license-checks.json](./audit/upstream-license-checks.json). License identification is provenance, not legal advice or a claim of unrestricted reuse.

| Repository / ref | Observed license | Disposition |
| --- | --- | --- |
| `Arize-ai/phoenix` / main | Elastic License 2.0 | Reference/API integration only; no implementation copying. https://raw.githubusercontent.com/Arize-ai/phoenix/main/LICENSE |
| `openai/codex` / rust-v0.165.0 | Apache-2.0 | Reference only here; future permitted ports require attribution/file-license review. https://raw.githubusercontent.com/openai/codex/rust-v0.165.0/LICENSE |
| `open-telemetry/opentelemetry-collector` / main | Apache-2.0 | Compose supported binary/config surfaces; no source port here. https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector/main/LICENSE |
| `open-telemetry/opentelemetry-collector-contrib` / main | Apache-2.0 | Same. https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/main/LICENSE |

## User evidence and adopted choices

Original and follow-up requests are append-only in `../CAPTURE.md`; three screenshots are in `../assets/`. Screenshots are evidence, not instructions. The metadata/curated-example choice and design adoption are recorded in `../DECISIONS.md`. Five isolated ADHD generator frames and three focus branches are summarized/scored in `ADHD.md`; their ideas are design proposals, not externally verified facts.

## Implementation research additions

- I1: [OpenTelemetry exporter helper](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md), Apache-2.0, main documentation accessed 2026-10-27. Queue/refusal/receipt boundary research; reference only, not version-qualified configuration.
- I2: [OpenTelemetry file storage](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/extension/storage/filestorage/README.md), Apache-2.0, main documentation accessed 2026-10-27. Disk bounds/fsync/corruption recovery research; reference only. The v0.163.1 raw paths returned 404. See [native intake notes](./NATIVE-INTAKE-NOTES.md).
