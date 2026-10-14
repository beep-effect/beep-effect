# Claude Code Mods for the Law Practice — Sources & Provenance

- **Cluster / origin:** a 2026-10-14 research pass for the Notion board item
  "Explore claude mods for law-practice use-case": the public mods docs, the
  `plugin-authoring` skill bundled with Claude Code 2.1.295, the locally
  synced `legal` plugin, and a read-only Codex inventory of this repo.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md) carries every claim;
  [`repo-inventory.md`](./repo-inventory.md) carries the in-repo citations.

## 1. Mined source corpus

None. No mod code was copied; the sample and built-in mods (R4, R5) are
reading material for a later build.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| `anthropics/knowledge-work-plugins` (`legal` plugin v1.3.0) | Apache-2.0 (LICENSE in the synced plugin) | port-with-attribution | skill ideas only, if any (personas do not cover patent prosecution) |
| `anthropics/claude-code-playground` (`claude-code/mods`) | UNVERIFIED | reference-only | `blast-radius` hold-and-confirm pattern |
| `anthropics/claude-code` (`mods/`) | UNVERIFIED | reference-only | `sec-default` policy-mod pattern, `agents-md` `userConfig` |

## 3. External research sources

| Id | Title | URL |
| --- | --- | --- |
| R1 | Mods overview | https://code.claude.com/docs/en/plugins/mods/overview |
| R2 | Manage mods for your organization | https://code.claude.com/docs/en/plugins/mods/admin |
| R3 | `plugin-authoring` skill reference (bundled with Claude Code 2.1.295; not on disk in the repo) | cited via [`../RESEARCH.md`](../RESEARCH.md) "What a mod can do" |
| R4 | Sample mods | https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods |
| R5 | Built-in mods source | https://github.com/anthropics/claude-code/tree/main/mods |
| R6 | `legal` plugin (Anthropic knowledge-work-plugins) | https://github.com/anthropics/knowledge-work-plugins |
| R7 | practice-kg-mcp goal packet and operator notes on the attorney's setup | `goals/practice-kg-mcp/` (in repo); operator notes are private |

## 4. In-repo capability references

See [`repo-inventory.md`](./repo-inventory.md) §3–§5 for the `@beep/*`
packages, MCP servers and CLI commands a mod would call (reuse), and
[`../RESEARCH.md`](../RESEARCH.md) for what is NET-NEW (the mod package
itself).

## 5. Cross-links & provenance

- Graduated goal: [`goals/practice-claude-mod`](../../../goals/practice-claude-mod/README.md)
  (its `research/SOURCES.md` reproduces this ledger).
- Board items: "Explore claude mods for law-practice use-case" (origin) and
  "Add claude-for-legal to dads claude setup" (neighbour, folded in by D2).
- Packet: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md),
  [`../DECISIONS.md`](../DECISIONS.md) (D1–D12).
