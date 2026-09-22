---
"@beep/repo-cli": minor
---

Add the read-only `beep models` command group (`check`, `catalog`, `init`): a role-by-surface
routing manifest at `$HOME/.config/beep/models.yaml` checked against a layered model catalog
(the upstream CLIProxyAPI manifest plus the Codex, Grok, Cursor, and proxy availability
overlays), with per-locator drift findings for repo doctrine, skills, code defaults, and
operator dotfiles. No target is written in this slice; the catalog ledger lives under
`$HOME/.local/state/beep/models/`.
