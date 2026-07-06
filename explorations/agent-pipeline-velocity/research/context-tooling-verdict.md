# Context-Tooling Verdicts (C5/C6, 2026-07-05)

Bounded research-spike verdicts per BRIEF rabbit-hole gates. Evidence:
deep-research-report.json findings 7 (headroom) and 9 (LSP).

## headroom (headroomlabs-ai/headroom) — PILOT AFTER THIS GOAL

Real and substantial (57k stars, v0.30.0 2026-07-03; 60–95% vendor-claimed
token cuts on tool outputs, accuracy-preservation evals published), but all
figures are vendor ceilings and gains are content-type-dependent (structured
JSON/logs at top of range; prose far lower). License UNVERIFIED as of
2026-07-05 → reference-only discipline until checked. Deployment for our
stack would be proxy or MCP-server mode — new moving parts mid-goal.
**Verdict: not in this PR. Pilot design (post-goal): measure on OUR dominant
tool-output mix (turbo/vitest/gh output via Bash results) against a fixed
task set before any adoption. Rollback-free (proxy sits outside the repo).**

## typescript-lsp plugin (claude-plugins-official) — DEFERRED TRIAL

Official, cheap, complements repo-symbol-discovery
(`/plugin install typescript-lsp@claude-plugins-official`). Known caveats
from Anthropic docs: language-server memory on large projects and monorepo
false-positive unresolved-import diagnostics; this repo runs tsgo (not tsc)
so diagnostic overlap needs a look.
**Verdict: not installed mid-goal — plugin installs change the cached tool
surface mid-session (violates the repo's own cache-prefix law). Trial recipe
for a fresh session: install, open 2–3 cross-package symbol tasks, compare
against rg+barrels flow, record keep/drop here.**
