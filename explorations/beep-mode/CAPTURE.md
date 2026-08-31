# Capture

<!-- Stage 0. Append-only dump. Never interrogated. -->

## 2026-08-29 — operator ask

- Added pstack (cursor/plugins, MIT, rev `68836dd`, plugin v0.14.5) with
  `/add-plugin pstack`. Do not want Cursor lock-in: want it for Codex, Grok,
  and Claude too.
- Want it tailored to this repo and carrying "my principles".
- A local checkout of the upstream pstack plugin was used for reference.

## 2026-08-29 — facts found while scouting

- `.claude/skills` is the source of truth. `.agents/skills -> ../.claude/skills`
  serves Codex; `.codex/config.toml` `[[skills.config]]` enumerates enabled
  skills and `bun run beep skills update` keeps lock + config + mirror in sync
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts`).
- Grok CLI scans `.claude/skills` and `.agents/skills` at repo tier, according
  to the locally installed Grok skills guide. Cursor scans `.agents/skills`,
  `.cursor/skills`, `.claude/skills`, and its Codex-specific skills directory
  (cursor.com/docs/context/skills).
  So one vendored tree reaches all four harnesses with no extra plumbing.
- pstack: 157 files, ~560 KB markdown. 33 skill dirs (21 `principle-*`),
  `poteto-mode` with 22 playbooks plus its TypeScript orchestration and PR
  watcher scripts, 2 agents (`poteto-agent`, `Comment Sicko`),
  `automations/benny` (Slack triage), and a 10-page guide.
- Name collisions with repo skills: `unslop` (repo copy is a softened edit of
  pstack's), `teach` (repo = mattpocock teaching-workspace skill; pstack =
  how+why explainer), `reflect` (repo = goal-packet reflection artifact;
  pstack = transcript review routed to skill edits).
- Adjacent repo machinery: `adhd` (~arena), `grilling`/`grill-me`/
  `grill-with-docs`, `quality-review-fix-loop` (~interrogate),
  `yeet` (~babysit/shipping/opening-a-pr; Graphite is not used here),
  `browser-qa-loop` + `qa-session-ops` (~create-verification-skill/control-ui),
  `explore` (~figure-it-out/multi-phase-plan), `law-pulse.sh` hook
  (principle re-surfacing every 5th edit), `skillopt-training-pilot` (skill
  eval harness), `skill-contract-kernel` (`@beep/skill-contract`).
- `explorations/INBOX.md` already holds `agent-config-canonicalization`
  (one manifest compiled to Claude/Codex/Grok/t3code configs). This packet is
  a concrete instance, kept separate.
- Operator routing doctrine (`~/.claude/CLAUDE.md`): Fable = judgment/prose,
  GPT-5.6 Sol = precisely specified implementation, Grok 4.6 = fast
  mechanical + x-search, Luna = default children. Direct `claude` sessions
  cannot route non-Anthropic models; `claudex`/`claudeg` proxy sessions can.
