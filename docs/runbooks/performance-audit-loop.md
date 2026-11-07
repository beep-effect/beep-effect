# Sequential performance audit

Use this workflow alongside ongoing implementation when the operator requests a
performance audit loop. It does not install a background service or create a new
scheduler. The orchestrator owns implementation, validation and Yeet publication.

## Reviewer sequence and completion

For the November 2026 performance effort, the operator assigned:

1. Claude Fable 5.1, xhigh.
2. Claude Opus 5.5, xhigh.
3. GPT-6.1 Sol, xhigh.

These are explicit review assignments, not changes to ordinary worker defaults.
Use existing authorized subscriptions and capture the model and effort at launch.
Run one auditor at a time in its own session. Implementation and hosted CI may
continue alongside it in separately owned files or worktrees. Reviewers return
findings; they do not start further providers, push or merge.

After each report, independently reproduce each candidate, reject duplicates or
unsupported claims with a reason, implement valid changes, and run the relevant
controls before handing the updated evidence to the next reviewer. Batch fixes
per push and retain previous findings. A new reviewer should inspect at least one
previously uncovered surface rather than repeat the same broad repository scan.

Repeat the sequence until a complete three-reviewer round reports no new
validated actionable opportunity in the declared scope. A timeout, access failure,
missing data or uninspected surface does not count as a clean review. Record those
limits explicitly. This stopping condition establishes diminishing returns in the
inspected scope; it cannot establish that the repository has no possible further
optimization. Stop an individual audit at its stated time/read budget and retain
partial evidence instead of allowing silent, unbounded exploration.

## Evidence sources

| Source | Look for | Interpretation limits |
| --- | --- | --- |
| GitHub Actions job and step timestamps, completed failed-job logs | Critical path, queue/setup waste, retry patterns, longest shards | Compare matching test populations and base/toolchain; separate runner loss from source failures |
| Vitest per-file durations and coverage artifacts | Skew, repeated fixture/process startup, uncovered changed code | Preserve every file, assertion, corpus case and coverage floor |
| Turbo run summaries under `.turbo/runs/` | Cache misses, expensive dependency chains, repeated tasks | Distinguish remote/local hits, cold/warm state and environment invalidation |
| Yeet `.beep/yeet/` receipts, jobs, status and inbox | Duplicate proofs, repeated clean installs, overlapping monitors, stale results | Match head/base/inputs; only a fresh remote snapshot describes current readiness |
| Sanitized AI metrics reports and derived aggregates | Tokens, repeated tools, elapsed time per completed outcome, context reloads | Missing measurements are unknown; raw conversations and credentials do not belong in reviewer packets |
| Relevant `goals/*/research/OPPORTUNITIES.md` and reflections | Recurring friction, interrupted proofs, conflicts and abandoned verification | Historical proposals must be checked against current source and merged PRs |
| Session ownership, PR history and merge-conflict receipts | Duplicate owners, long-lived branches, repeated base repairs | Preserve unrelated work; merge the base into published branches rather than rewriting them |
| Current configuration and implementations | Overbroad selection, serialized independent work, unnecessary process boundaries | Source inspection suggests a mechanism; measurements establish its cost |

Start with compact aggregates and a source index. Read only the specific log/file
slices needed to validate a claim. Do not feed entire histories or all goal packets
into each reviewer. Keep private paths, machine/session identifiers, credentials
and raw transcripts out of public reports.

Useful existing entrypoints include `beep session open --json`, Yeet job/status
artifacts, and `beep ai-metrics inventory report --input <manifest.json> --json`.
Check actual data coverage before using an AI scorecard. On 2026-11-06 the local
weekly report for October 29 through November 6 had no tasks, labels or benchmark
runs, and no scored cost, model-call or tool-invocation metrics. Its score list was
empty. The current `ai-metrics benchmark compare --json` reports readiness for
derived tables; it does not perform a measured comparison. Neither is evidence of
an agent-efficiency gain. Hosted logs and direct command receipts remain usable.

## Validation principles

- Measure end-to-end critical-path time and the component changed. Never sum
  parallel job durations or add overlapping percentage savings.
- Count avoided work and preserved populations. Removing tests, assertions or
  required review is not a performance improvement.
- Label controlled measurements, local observations, hosted observations,
  scheduling estimates and hypotheses separately. Record cold/warm cache state,
  source revision, toolchain and runner class when available.
- Reuse only successful proof with matching source, head, base, command and real
  execution inputs. Failed, skipped, partial and live-external checks are not
  reusable passes. Bookkeeping-only identifiers must not poison that identity.
- Share pure setup within a scope, preserve real process boundaries where they
  matter, and isolate stateful tests. Bound concurrency and inspect memory.
- Unknown/new inputs must retain conservative coverage. A scheduling plan is not
  a test allowlist.
- Use one owner and one remote monitor per operation. Consume fresh receipts;
  make targeted live reads for failures, reviews and the final merge gate.
- Prefer existing helpers and receipt formats. Retain reversal paths and publish
  through Yeet; hosted checks remain the authoritative PR proof.

## Reviewer packet and findings ledger

Each packet contains the objective, exact source revisions, prior accepted and
rejected findings, pending changes, principles above, compact baseline evidence,
and inspected/uninspected source lists. Request at most a few high-value findings
per pass, with file/line or log references and explicit uncertainty.

For every finding record: stable ID; source; observed cost; proposed mechanism;
existing-work overlap; independent reproduction; accepted/rejected/blocked state;
validation preserving behavior; implementation PR; measured result; reversal.
A blocked idea remains visible but does not become an invented performance win.

Keep detailed local receipts under `.beep/` and publish a sanitized outcome report
under `docs/reports/`. If a goal packet owns the work, its active friction ledger
and generated research manifest remain the canonical packet records.
