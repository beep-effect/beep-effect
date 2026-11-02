# Decisions

## 2026-10-27 — D1: Collection depth

**Question:** What collection depth should the redesign use?

**Operator answer:** “Metadata + curated examples (recommended).”

**Decision:** Collect useful metadata and outcome annotations across supported harness routes. Dataset/experiment content is explicitly curated and sanitized. Broad automatic capture of prompts, responses, tool bodies or private corpus is not part of the default.

**Rationale:** This supports coverage, timing, reliability and outcome analysis without converting all agent work into a content archive. Rejected defaults: metadata-only forever (cannot support representative content-dependent examples), and broad content capture (unnecessary for most measurement).

## 2026-10-27 — D2: Design direction and scope of this session

**Question:** Adopt coverage ledger, bounded durable collector, task/outcome annotations and curated experiments, starting with one host and CLI/desktop proof then all requested harnesses?

**Operator answer:** “Adopt this direction and prepare implementation packets (recommended).”

**Decision:** Adopt [BRIEF.md](./BRIEF.md), including independent-review refinements. Prepare three linked implementation packets, authored but not started. This session completes research and packet preparation; it does not execute a production rewrite, unmask collection, replay historical data or run experiments.

**Rationale:** The audit supports replacement of brittle discovery/projection behavior and better measurement contracts. It also finds useful existing identity, privacy and delivery components. A bounded vertical proof preserves those assets and makes defects reproducible before broad rollout. Rejected default: immediate big-bang replacement.

## 2026-10-27 — D3: Project disposition

**Question:** Is `harness-otel` the only used project, allowing removal of `default` and `beep-agent-effectiveness`?

**Evidence-based decision:** No deletion during the audit. `default` receives an active deployment canary. `beep-agent-effectiveness` is an implemented derived-export/effectiveness destination whose local scheduled writer is intentionally held. The user's conditional removal criterion is not established.

**Next action:** Give synthetic probes an explicit destination and document project writers. The implementation packet may retire genuinely superseded projects after producer migration, minimal backup/export, reference cleanup and verification. Do not recreate empty confusing projects by leaving their writers unchanged.

## 2026-10-27 — D4: Preserve safety and source boundaries

The workstation's recovery hold remains in force. Its stated Bun-thread swap/VMA corruption trigger is historical evidence, not a proved root cause. Keep production and historical archives intact; implementation must qualify resource integrity and bounded synthetic replay before replacing the held route. OpenClaw remains retired and is not revived for observability.

Upstream Phoenix currently declares Elastic License 2.0. Treat it as reference/API integration only; this packet vendors no Phoenix implementation. Codex and OTel license checks returned Apache-2.0; any future port still requires attribution and the actual file's license check. No external code was copied into project implementation.

## 2026-10-27 — D5: Measurement truth

Use distinct definitions for repository/clone/worktree/task/attempt/session/turn/trace/span/event. Configuration, native arrival, normalized completeness and task quality are independent evidence. Known-root counts are not session denominators. Unknown, excluded, unsupported, failed and idle remain distinct. Preserve original event times and unavailable duration; count money only with its explicit basis.

## Deferred engineering decisions

- Exact journal storage backend, disk budget and metadata-retention periods: foundation packet must decide using synthetic load/recovery evidence, existing repository capabilities and measured volume.
- Worker-account and other remote-host enrollment: a dedicated worker-login follow-up found no Codex OTEL keys and no Claude user settings; harness packet must still qualify effective runtime/environment/system overrides and delivered route evidence.
- Closed desktop/cloud adapter availability: capability investigation first; unsupported is an acceptable truthful state, not a reason to scrape protected content.
- Dataset expansion and judging budget: experiment packet begins with five curated examples and deterministic rubrics; broader runs require a bounded resource contract and existing authorized subscriptions.

These are explicit implementation proof tasks. They do not block preparation of the three packets and do not imply implementation success.
