# Coding Agent Effectiveness Evidence Loop — Sources & Provenance

- **Source exploration:** `explorations/agent-effectiveness-pulse` — primary
  ledger: `explorations/agent-effectiveness-pulse/research/SOURCES.md`.
- **Provenance:** This packet is the wave-2 graduation of that exploration.
  Its plan was authored in a Codex (GPT-5.6 Sol) audit session (2026-07-30/31,
  user-archived transcript; key numbers reproduced in
  `2026-07-31-adhd-amendments.md`), grilled via `grill-with-docs` inside that
  session, then amended through a five-frame ADHD divergent-ideation run and a
  two-round user interview on 2026-07-31 (this repo, Claude Fable session).
  All amendment decisions and dispositions:
  [`2026-07-31-adhd-amendments.md`](./2026-07-31-adhd-amendments.md).

## 1. Mined source corpus

In-repo evidence bricks (live at packet creation):

| Source | Title | Location | Theme | Disposition |
|--------|-------|----------|-------|-------------|
| `yeet-verdict` | Yeet verdict model (permits exhibit-less failure) | `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts` | P3 target | extend |
| `yeet-proof` | Per-lane proof records "keyed by command and tree fingerprint" | `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:42` | P3 target | extend |
| `yeet-status` | Existing verdict.json reader | `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts` | P3 `yeet doctor` sibling | reference |
| `ai-metrics` | v1 metrics library (forwarder, ingest, derived storage, scorecard) | `packages/tooling/library/ai-metrics/src/` | P0/P2/P4 target | extend |
| `hooks-live` | Only hook currently wired: PostToolUse → law-pulse | `.claude/settings.json` + `.claude/hooks/law-pulse.sh` | P1 baseline | extend |
| `p7f` | Declared forwarder-durability blocker this packet consumes | `goals/ai-metrics-stack/PLAN.md:224` | dependency | consume |
| `wf-spike` | Durable-execution boundary this packet must not duplicate | `goals/effect-v4-workflow-engine-spike/SPEC.md` | P6 boundary | depend |
| `dock-reducer` | Existing Schema-reducer pattern (spike baseline A) | `packages/foundation/ui-system/dock/src/DockEngine.service.ts` | P6 | reference |

## 2. External citations

All URLs below were gathered and used in the source audit session; none are
fabricated here.

| Source | Why it matters | Where used |
|--------|----------------|-----------|
| https://opentelemetry.io/docs/specs/otlp/ | OTLP delivery semantics (legitimate resend ⇒ storage-level dedup required) | P4 gates |
| https://opentelemetry.io/docs/specs/semconv/gen-ai/ | Evolving GenAI conventions — pin version, bounded `coding_agent.*` extensions | P2 |
| https://code.claude.com/docs/en/monitoring-usage | Claude native telemetry separates `tool.blocked_on_user` from execution | P2 |
| https://code.claude.com/docs/en/hooks | Notification/idle_prompt/permission_prompt hook events; async hooks not deduplicated | P1 |
| https://docs.ntfy.sh/publish/ | JSON POST publishing, topic secrecy, priorities, and bearer authentication | P1 notifier transport |
| https://docs.ntfy.sh/subscribe/phone/ | Phone subscription and topic configuration requirements | P1 phone-delivery gate |
| https://developers.openai.com/codex/app-server/ | Codex app-server v2 request/resolution lifecycles | P2 |
| https://developers.openai.com/codex/config-reference | Codex `notify` external command | P1 |
| https://stately.ai/docs/promise-actors, https://stately.ai/docs/persistence | XState restoration restarts invoked work (at-least-once) — the P6 boundary reason | P6 |
| https://stately.ai/docs/inspection, https://stately.ai/docs/testing | XState inspection + model-based path tests (candidate advantages) | P6 |
| https://www.npmjs.com/package/xstate | 5.32.5 current stable; v6 alpha | P6 pin |
| https://github.com/Effect-TS/effect/pull/6429 | Effect declined merging effect-machine; external incubation requested | P6 |
| https://github.com/DietrichGebert/ponytail | Installed skills byte-identical to upstream `16f2980`; plugin/hooks not installed | P7 treatment |
| https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | Agent-eval methodology | P5 |
| https://openai.com/index/separating-signal-from-noise-coding-evaluations/ | Benchmark-validity concerns ⇒ public benchmarks are calibration only | P5 |
| https://playwright.dev/docs/best-practices | Real-browser proof practices | P7 browser lane |
| https://sre.google/workbook/canarying-releases/ | Concurrent-control canarying + rollback principles | P8 |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle | MCP task lifecycle immaturity ⇒ adapters, not hard dependency | P2/P6 |

## 3. Audit findings carried as evidence

Headline measurements from the source audit (60-day Codex corpus, 7-day
Claude window, nine-clone fleet scan; full numbers in the amendments report):
polling 3.4x tool-execution time; plan-approval waits p95 105.5 min;
user-input waits p95 14 min; 80.35% duplicate derived rows; 74.8% of
fleet Claude sessions unscanned; 10.5x turn-row inflation; 12/23 Yeet
failures without a failed lane; a byte-identical 17-minute proof rerun after
publish interruption; Codex 1Password auth 56/58 failure with 20
identical-argument retries; config snapshot scanning 9,570 nested-worktree
files of 9,799 total.
