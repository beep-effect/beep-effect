# Wake Service — Sources & Provenance

- **Source exploration:** `explorations/expiring-repo-facts` — primary ledger:
  [`explorations/expiring-repo-facts/research/SOURCES.md`](../../../explorations/expiring-repo-facts/research/SOURCES.md).
  The full cited report is
  [`research/prior-art-report-2026-10-22.md`](../../../explorations/expiring-repo-facts/research/prior-art-report-2026-10-22.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `skulk-condition` | Check classification | kitlangton/skulk | `src/condition.ts` (`evaluate`) | probe safety | port-with-attribution |
| `skulk-watch` | `Condition`, `Watch`, `Limits` | kitlangton/skulk | `src/watch.ts` | wake model | port-with-attribution (as schemas) |
| `skulk-engine` | `Delivery` port and backoff | kitlangton/skulk | `src/engine.ts:10-45` | delivery | port-with-attribution |
| `skulk-builtin` | gh-run, pr-checks and npm triggers | kitlangton/skulk | `src/builtin.ts` | triggers | port-with-attribution |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [kitlangton/skulk](https://github.com/kitlangton/skulk) | MIT (checked 2026-10-27) | port-with-attribution | daemon design, conditions, guardrails |

## 3. External research sources

See section 3 of the exploration's `research/SOURCES.md`. This goal adds no
new external sources at graduation.

## 4. In-repo capability references

- Agent-message router — `packages/tooling/tool/cli/src/commands/AgentMessage/` (reuse for delivery)
- Provider sessions — `@beep/ai-provider-cli`, `packages/drivers/ai-provider-cli/src/AiProviderCliSession.*.service.ts` (reuse)
- systemd unit rendering — `packages/tooling/tool/cli/src/commands/Research/`, `docs/runbooks/systemd-timers.md` (extend)
- Agent-pool pins — `docs/runbooks/agent-pools.md` (follow)
- The wake library, reconciler, dispatcher and dead-man workflow — NET-NEW

## 5. Cross-links & provenance

- Exploration: [`explorations/expiring-repo-facts`](../../../explorations/expiring-repo-facts/README.md)
  ([`BRIEF.md`](../../../explorations/expiring-repo-facts/BRIEF.md),
  [`DECISIONS.md`](../../../explorations/expiring-repo-facts/DECISIONS.md),
  [`MAP.md`](../../../explorations/expiring-repo-facts/MAP.md)).
- Sibling goal: [`goals/hold-ledger`](../../hold-ledger/README.md).
