# Cloud Agent Readiness — Sources & Provenance

- **Source exploration:** no `explorations/` packet precedes this one. It was
  authored directly on 2026-10-01 from a cloud-session probe, consulting the
  in-repo corpus in §1 and the external sources in §3; the primary ledger is
  [`2026-10-01-container-probe.md`](./2026-10-01-container-probe.md) in this
  directory.
- **Provenance:** operator request (2026-10-01) to make the repo
  cloud-agent friendly, raised while sizing goal packets for cloud sessions.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `probe-2026-10-01` | Container probe findings F1–F15 | this repo | `goals/cloud-agent-readiness/research/2026-10-01-container-probe.md` | what breaks in a fresh cloud container | primary evidence |
| `ci-setup` | Known-good bun provisioning and frozen install with retry | this repo | `.github/actions/setup-monorepo-ci/action.yml:160-300` | toolchain bootstrap recipe | reuse (mirror the retry and the digest comparison) |
| `bun-pins` | Pinned bun version and release-archive digest | this repo | `.bun-version`, `.bun-linux-x64.sha256`, `package.json` (`packageManager`), `mise.toml` | pins the script must honor | reuse, read-only |
| `effect-snapshot` | Effect 4.0.0 snapshot served from `pkg.pr.new` (34 lockfile entries) | this repo | `package.json:22-27`, `bun.lock:3238-3239`, PR #1368 | the denied registry | reference (non-goal to move) |
| `hooks` | SessionStart / Stop hook wiring and the desktop notifier knob | this repo | `.claude/settings.json:205-240`, `.claude/hooks/hook-pulse.sh`, `.claude/hooks/packet-projections.sh`, `.claude/helpers/graft-hooks.cjs` | host-aware guards | extend |
| `mcp` | Project MCP servers, several workstation-only | this repo | `.mcp.json` | expected-failing servers in the cloud | reference (D7) |
| `pools` | Pool-order doctrine and meters | this repo | `AGENTS.md` (Volume pools), `docs/runbooks/agent-pools.md` | where the fourth meter and the cloud section belong | extend |
| `op-shim` | Exit-code convention for a missing agent credential (`78`) | this repo | `AGENTS.md` (1Password) | preflight exit-code convention | reuse |
| `effect-ref` | Reference workspace provisioning | this repo | `scripts/setup-effect-ref.sh`, `scripts/references.json` | optional cloud extension | reference |

**How these inform implementation:** the setup script copies CI's shape
(version file → setup → frozen install with three attempts) but replaces the
`setup-bun` action with a release-archive download verified against the tracked
digest, because the installer host is denied in the cloud. Hooks gain one
explicit guard variable rather than host heuristics. The runbook and `AGENTS.md`
section are extensions of the pool runbook, not a new prompt surface.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `oven-sh/bun` | MIT | reference-only | the release-archive URL shape `releases/download/bun-v<ver>/bun-linux-x64.zip` (verified by download on 2026-10-01) and the `bun` npm package as a fallback route |

## 3. External research sources

- Claude Code on the web environments (network access levels, setup scripts,
  environment variables): <https://code.claude.com/docs/en/claude-code-on-the-web>
- bun 1.4.2 release archive (downloaded and version-checked 2026-10-01):
  <https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip>
- bun installer (denied with HTTP 403 by the default cloud network policy on
  2026-10-01): <https://bun.sh/install>

## 4. In-repo capability references

| Brick | Path | Use |
|-------|------|-----|
| CI monorepo setup action | `.github/actions/setup-monorepo-ci/action.yml` | reuse (recipe) |
| Hook pulse writer and `HookPulseV1` | `packages/tooling/library/ai-metrics/src/hook-pulse.ts`, `.claude/hooks/hook-pulse.sh` | extend only if a `cloud` host literal is needed (D3) |
| Yeet operator | `packages/tooling/tool/cli` (`beep yeet`), skill `yeet` | reference; closeout stays operator-side (D4) |
| Goals doctor | `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts` | packet hygiene gate |
| Cloud session setup script | `scripts/cloud-session-setup.sh` | NET-NEW |
| Cloud sessions runbook | `cloud-sessions.md` under `docs/runbooks/` | NET-NEW |

## 5. Cross-links & provenance

- Roadmap: `docs/ROADMAP.md` Lane 3 (accelerator row lands in P4).
- Pool doctrine: `goals/agent-pool-doctrine` (meters and seat map; this packet
  adds the cloud-credits meter, D6).
- Evidence loop: `goals/coding-agent-effectiveness-evidence-loop` (pulse rows
  from cloud hosts, D3).
- Proof certainty: `goals/time-to-certainty` (cloud sessions are a consumer of
  cheap-gates-first ordering once they can run gates at all).
