# Research and design-tool state

Verified 2026-08-27. This is a dated local-state record, not a reproducible
product dependency lock.

## Impeccable

| Harness | Verified state |
| --- | --- |
| Claude Desktop | The account-level Customize → Skills view lists the official `impeccable` skill and reports it updated. Its remote and local Desktop payloads use the forward-fixed 4.1.2 provider tree from commit `f86473b`. |
| Claude Code | The reinstalled user-scoped `impeccable@impeccable` plugin and this repository's Claude-native payload use the provider-correct tree from `f86473b`. The plugin is the sole Claude hook owner. |
| Codex Desktop | The user-level Codex-native payload at `~/.agents/skills/impeccable` uses the provider-correct tree from `f86473b`; the legacy `~/.codex/skills/impeccable` location resolves to that same tree. |
| Codex CLI | Fresh project discovery is routed away from the repository's Claude-native copy and to the same user-level Codex payload. Project hooks also resolve to that payload. |
| Grok | The official `pbakaus/impeccable#plugin` install uses `f86473b`. Grok ignores the Codex-native user tree and this repository's Claude-native aliases so the plugin is its sole Impeccable authority. |

The [website version endpoint](https://impeccable.style/api/version) and npm
updater still offered a generated 4.1.1 bundle while the official
[Skill 4.1.2 release](https://github.com/pbakaus/impeccable/releases/tag/skill-v4.1.2)
and native plugins reported 4.1.2. The Claude Desktop and Grok channels had
also advanced to [commit `f86473b`](https://github.com/pbakaus/impeccable/commit/f86473ba7d0512c18f39c4de9ecb51ab4efbeb8d)
without changing that version label. Those eleven post-tag commits add
security and correctness fixes, including decision-server session-key and
origin checks plus URL-credential handling. Downgrading those channels would
remove fixes, so every provider-specific tree was aligned forward to that
commit instead. The tagged Codex tree remains as a recoverable backup.

Do not run the website updater until its version endpoint catches up. Do not
force one provider's tree into another provider: Claude and Codex need their
own compiled variants and command-path conventions.

The [Impeccable agent index](https://impeccable.style/llms.txt) points to the
public documentation, but the installed forward-fixed 4.1.2 source is the
workflow authority for this handoff. In particular, its `init` flow never
writes or offers `DESIGN.md`; `shape` enters `new-work` only through direction
choice and returns before the direction contract, durable persistence, or
implementation.

The repository's `.codex/hooks.json` now targets the user-level Codex-native
payload. Both changed Impeccable hooks were reviewed and trusted in a fresh
Codex session; any later definition change will require another review.

## Firecrawl for Grok

- The xAI official Firecrawl Grok plugin is registered at version 1.1.0.
- Grok sessions in this exploration loaded the task-specific Firecrawl skills
  before collection.
- The Firecrawl CLI used stored authentication. No raw key or secret reference
  entered a prompt, output, or tracked file.

## Fable start condition

The existing `apps/todox` workspace has no Impeccable `PRODUCT.md`, `DESIGN.md`,
or surface brief. That is intentional in this research-only pass. Claude Fable
first runs `init` and confirms product truth, then runs `shape` for the
marketing homepage. Within `shape`, it uses `new-work` only through a
human-locked direction and returns the resulting brief before persistence or
implementation. The only permitted app-local writes in that handoff are the
confirmed `PRODUCT.md` and required `.impeccable/**` working artifacts.
