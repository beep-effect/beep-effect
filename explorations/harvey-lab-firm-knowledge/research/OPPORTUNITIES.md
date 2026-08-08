# Friction Ledger

Receipts for friction encountered while working this packet — what was being
done, the evidence, what would have prevented it.

## 2026-08-08 — Workflow StructuredOutput retry cap swallowed a completed report

- **Doing:** 12-agent opus-5 mining workflow (`harvey-lab-gold-mining`,
  run `wf_a5fc6146-2f4`); Verify phase, completeness-critic agent.
- **Evidence:** harness reported `parallel[1] failed: agent({schema}):
  StructuredOutput retry cap (5) exceeded — 5 failed calls with no valid
  output` and "Verify phase done: 1/2" — yet the agent's actual deliverable
  (`research/verify-completeness.md`, 618 lines) was fully written to disk
  before the return-channel failure. The orchestrator's result object simply
  lacked its summary; nothing needed re-running.
- **Cost:** ~10 min of triage (journal + disk inspection) to establish the
  "failure" was return-channel-only; a naive reaction would have re-run a
  ~200k-token opus agent for nothing.
- **Prevention:** durable on-disk handoffs (each agent writes its report
  before returning) is what made this a non-event — keep that pattern
  mandatory in workflow prompts. Harness-side wish: when a schema'd agent has
  already produced file writes, surface the last write path in the failure
  message so triage starts at the deliverable, not the retry log.

## 2026-08-08 — WebFetch cannot mine SPA job boards or 403-walled press

- **Doing:** external landscape sweep for `research/harvey-landscape-architecture.md`;
  brief explicitly asked for "job postings mentioning retrieval/knowledge-graph/
  ontology work" and for verified funding numbers.
- **Evidence:** `https://www.harvey.ai/careers` returned a page whose job region
  is literally `Loading jobs...` (client-side render, nothing to extract);
  `https://www.harvey.ai/company/careers/<uuid>` URLs render the generic company
  page instead of the JD; `https://www.cnbc.com/2026/06/23/...` and
  `https://www.cnbc.com/2026/03/25/...` and citybiz all returned
  `HTTP 403 Forbidden`. Net effect: the job-posting question is answerable only
  from third-party aggregator snapshots (Built In NYC, Welcome to the Jungle),
  which is weak negative evidence, and two funding figures had to ship marked
  `[UNVERIFIED]`.
- **Cost:** ~4 wasted fetches (~2 min) plus a permanently weaker section of the
  report; the alternative tool (`firecrawl-scrape`, which renders JS) was
  available as a skill the whole time.
- **Prevention:** in research briefs that name SPA-backed sources (careers
  pages, dashboards, app-shell sites) or major-press paywalls, route to
  `firecrawl-scrape` / `firecrawl-search` **first** rather than discovering the
  block via WebFetch. Worth encoding as a line in the research-agent brief
  template: "WebFetch for static docs; firecrawl for anything that renders
  client-side or 403s."

## 2026-08-08 — New lint subcommand silently swallowed by bin-main fast-path allowlist

- **Doing:** shipping `beep lint judge-rubric` (the QaLens↔judge-prompt drift
  gate from this packet's mining findings).
- **Evidence:** `bun run beep lint judge-rubric` ran the turbo lint aggregate
  with `judge-rubric` forwarded as a turbo arg (`bunx turbo run lint … judge-rubric`,
  exit 1) instead of the new subcommand. Cause:
  `packages/tooling/tool/cli/src/bin-main.ts:12` keeps a hand-maintained
  `LINT_POLICY_SUBCOMMANDS` allowlist gating which `lint` subcommands reach the
  effect CLI; unlisted ones fall into the quality-task fast path. Registered
  subcommands `identity-registry` and `goal-packets` are also absent from the
  list and appear identically unreachable.
- **Correction (same day, follow-up):** `identity-registry`/`goal-packets` are
  NOT unreachable — a second, schema-backed copy of the allowlist
  (`LintPolicySubcommand`, Quality.schemas.ts) gates
  `parseQualityTaskInvocation`, so entries it knows fall through to the full
  CLI (verified live: `beep lint identity-registry` runs the real lint). The
  actual bug class is "in NEITHER copy" — which is what bit `judge-rubric` —
  plus three hand-maintained surfaces that must agree. Fixed by deriving
  bin-main's list from the LiteralKit and binding the LiteralKit to the
  registered subcommands with a test (`lint-subcommand-allowlist.test.ts`).
- **Cost:** ~30 min of misattribution (a cold-start timeout, a backgrounded
  run, and a false lead toward stale-build theories) before reading bin-main.
- **Prevention:** the irony is exact — the fix for one hand-duplicated list
  (QaLens vs judge prompt) was blocked by another hand-duplicated list
  (subcommand registry vs fast-path allowlist). Same cure: a test or lint
  binding `LINT_POLICY_SUBCOMMANDS` to `lintCommand`'s registered subcommand
  names. Follow-up chip filed from this session.
