# Expiring Repo Facts — Sources & Provenance

- **Cluster / origin:** operator request of 2026-10-22, plus the deep-research
  and `/adhd` passes that ran that day, plus the skulk reference the operator
  added on 2026-10-27.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md),
  [`prior-art-report-2026-10-22.md`](./prior-art-report-2026-10-22.md),
  [`notes/`](./notes/), [`ideation-2026-10-22.md`](./ideation-2026-10-22.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `skulk-condition` | Check classification: a failed check is never a change | kitlangton/skulk | `src/condition.ts` (`evaluate`) | probe safety | port-with-attribution |
| `skulk-watch` | `Condition` union, `Watch` record, `Limits` | kitlangton/skulk | `src/watch.ts` | wake model | port-with-attribution (re-expressed as schemas) |
| `skulk-engine` | `Delivery` / `EngineDeps.deliver` port, delivery backoff | kitlangton/skulk | `src/engine.ts:10-45` | delivery adapters | port-with-attribution |
| `skulk-builtin` | gh-run, pr-checks and npm built-in triggers | kitlangton/skulk | `src/builtin.ts` | event triggers | port-with-attribution |

**How these inform this packet:** take the check classification, the
admission check at watch creation, the one-wake idempotent delivery and the
limits. Leave the OpenCode-only delivery and the plain-TypeScript types.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [kitlangton/skulk](https://github.com/kitlangton/skulk) | MIT (LICENSE checked 2026-10-27) | port-with-attribution | wake daemon design, conditions, guardrails |
| [sindresorhus/eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn) | not verified | reference only | condition syntax for expiring TODOs |
| [searls/todo_or_die](https://github.com/searls/todo_or_die) | not verified | reference only | `by:` + `if:` pairing |
| [github/gh-aw](https://github.github.com/gh-aw/introduction/architecture/) | not verified | reference only | safe-outputs PR pipeline |

## 3. External research sources

Every external URL is in
[`prior-art-report-2026-10-22.md`](./prior-art-report-2026-10-22.md) and the
three files under [`notes/`](./notes/). The load-bearing ones:

- [Renovate configuration options](https://docs.renovatebot.com/configuration-options/)
- [Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [Snyk .snyk file](https://docs.snyk.io/manage-risk/policies/the-.snyk-file)
- [OSV-Scanner configuration](https://google.github.io/osv-scanner/configuration/)
- [unicorn expiring-todo-comments](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md)
- [docs.rs todo-or-die](https://docs.rs/todo-or-die/latest/todo_or_die/)
- [Vault leases](https://developer.hashicorp.com/vault/docs/concepts/lease)
- [cert-manager Certificate](https://cert-manager.io/docs/usage/certificate/)
- [RFC 9773 (ACME ARI)](https://rfc-editor.org/rfc/rfc9773.html)
- [gh-aw PR safe outputs](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/)
- [gh-aw engines](https://github.github.com/gh-aw/reference/engines/)
- [Claude Code scheduled tasks](https://code.claude.com/docs/en/routines)
- [ACP agents](https://agentclientprotocol.com/overview/agents)
- [systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)

## 4. In-repo capability references

| Brick | Path | Use |
|-------|------|-----|
| Claim envelope | `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts` | reuse: the hold record |
| Research ledger laws | `research/README.md` | reuse: storage pattern |
| systemd timer rendering | `packages/tooling/tool/cli/src/commands/Research/` | extend: daemon or timer units |
| Session ledger | `packages/tooling/tool/cli/src/commands/Session/` | reference |
| Agent pool routes | `docs/runbooks/agent-pools.md` | reuse: adapter pins and fallback rules |
| GritQL rules | `@beep/lint-rules` | extend: `[hold:<id>]` anchors in test skips |
| Held-back deps | `syncpack.config.ts` | first consumer |
| Manual hold register | `goals/repository-simplification-residue/history/receipts/hold-register.md` | reference: consumers, failures, owners and exits (#1861/#1906) |
| Dated security exceptions | `osv-scanner.toml` | reference: enforced date expiries and links to the hold register |
| Schema-checked, machine-probed hold ledger | NOT FOUND | NET-NEW |
| Wake service | NOT FOUND | NET-NEW (port of skulk) |
| Delivery adapters with fallback | NOT FOUND | NET-NEW |

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md).
- No goals yet.
