# Decisions

## 2026-09-25: Resume trigger moves to harness-evidence-ledger

**Decision:** Replace the resume trigger. The packet resumes when
[`goals/harness-evidence-ledger`](../../goals/harness-evidence-ledger/SPEC.md)
ships `bun run beep harness-ledger prune-proposals`. Status stays `parked`.

**Rationale:** That goal now owns retention-side pruning proposals for skills,
hooks, and MCP servers, driven by hook-pulse surface touches (its decisions D7
to D9). It is the real pruning-proposal consumer this packet waited for.
Knowledge-surface-automation Workstream C is no longer the trigger.

**Supersedes:** the 2026-08-13 resume trigger below. Decide the A/B
guidance-degraded-session question at unpark, as before.

## 2026-08-13 — Park the empirical arm

**Decision:** Park context-rent telemetry.

**Rationale:** The experiment needs a real pruning-proposal consumer before its
measurement design earns implementation work.

**Resume trigger:** Knowledge-surface-automation Workstream C ships its
pruning-proposal machinery. Decide the A/B guidance-degraded-session question
at unpark.
