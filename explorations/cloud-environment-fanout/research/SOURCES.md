# Cloud Environment Fanout — Sources & Provenance

- **Cluster / origin:** 2026-10-05 research sweep (vendor docs via web fetch,
  local CLI probes, repo PRs) for the operator ask captured in `CAPTURE.md`.
- **Provenance:** this packet's `RESEARCH.md`; the shipped Cursor environment
  PRs #885 and #887; `explorations/cursor-agent-pool` for the Cursor lane
  doctrine this packet extends.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `cursor-install` | Cursor Cloud Agent bootstrap | beep-effect (this repo) | `.cursor/install.sh` (pre-packet revision, PRs #885/#887) | toolchain bootstrap | port → generalized into `scripts/cloud/bootstrap.sh` |
| `ci-install` | CI dependency install retry loop | beep-effect (this repo) | `.github/actions/setup-monorepo-ci/action.yml:281` | install resilience | pattern reused |

**How these inform this packet:** the Cursor installer already proved the exact
toolchain a VM needs (pinned Bun, Node 24, portless, verified `op`,
`--ignore-scripts` + explicit `prepare`); the bootstrap keeps that contract and
adds vendor detection, parallel downloads, PATH persistence, and a lockfile
stamp. The CI retry loop is copied because the Claude proxy makes `bun install`
flaky.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| beep-effect (own) | repo license | n/a | the Cursor installer |
| openai/codex-universal | MIT (reference image) | reference-only | preinstalled runtime facts |

## 3. External research sources

- Claude — Configure cloud environments: https://code.claude.com/docs/en/cloud-environments
- Claude — Use Claude Code in the cloud: https://code.claude.com/docs/en/claude-code-on-the-web
- Codex — Cloud environment configuration (legacy page): https://learn.chatgpt.com/docs/environments/cloud-environment
- Codex — Cloud environments: setup scripts, caching, secrets, codex-universal (2026-05-31): https://codex.danielvaughan.com/2026/05/31/codex-cloud-environments-setup-scripts-caching-secrets-codex-universal/
- Codex — reusable cloud environments announcement (2026-09-29): https://siliconangle.com/2026/09/29/openais-codex-gets-reusable-cloud-environments-that-follow-developers-across-devices/
- Cursor — Cloud environment setup: https://cursor.com/docs/cloud-agent/setup
- Local probe: `codex --version` → codex-cli 0.160.1; `codex cloud --help` lists `exec|status|list|apply|diff`; `claude --version` → 2.1.289 with `--cloud` and `--teleport` (RESEARCH.md § Codex cloud).
- Credit observations (screenshots described in CAPTURE.md, not stored): Claude Settings → Usage, 2026-10-05.

## 4. In-repo capability references

See the inventory table in `RESEARCH.md` § In-Repo Capability Inventory:
`.cursor/install.sh` (extend), toolchain pins (reuse), CI install recipe
(reuse), Turbo remote-cache quad (reuse), repo SessionStart hooks (reuse),
agent-pool doctrine (reuse), `scripts/cloud/bootstrap.sh` and
`docs/runbooks/cloud-environments.md` (NET-NEW).

## 5. Cross-links & provenance

- This packet: `RESEARCH.md`, `DECISIONS.md`, `CAPTURE.md`.
- Sibling: `explorations/cursor-agent-pool` → `goals/agent-pool-doctrine`
  (pool order and Cursor lane recipe this packet's cloud lanes slot under).
- Runbook of record: `docs/runbooks/cloud-environments.md`.
