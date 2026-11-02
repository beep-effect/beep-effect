# T3 Code Fleet Driver — Sources & Provenance

- **Cluster / origin:** Four read-only research sweeps on 2026-11-01, covering
  T3 Code, harness MCP surfaces, fleet hosts and the repo inventory, plus the
  operator's transcript of Theo's T3 Code video.
- **Provenance:** [RESEARCH.md](../RESEARCH.md) synthesizes the sweeps; each
  sweep's report lives beside this file.

No mined source corpus exists: nothing is ported or vendored. T3 Code is used
as an installed product and through its documented CLI and MCP surfaces, so
§1 is dropped.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `pingdotgg/t3code` (fork `beep-effect/t3code`, inspected at `fa31b66bbb`) | MIT (`LICENSE` in the fork checkout) | Use as a product. Fork patches live in the fork, not in beep-effect | MCP tool contract, the headless `t3` CLI, Linked environments, the WSL backend |

## 3. External research sources

- Theo - t3.gg, "T3 Code broke me", YouTube, uploaded 2026-10-29,
  https://www.youtube.com/watch?v=uLGxb4F3SyI. The operator supplied the
  auto-caption transcript out of repo in
  the operator's local context-packet folder. Only
  paraphrased with timestamps, in
  [t3code-capabilities.md](t3code-capabilities.md).
- T3 Code installer, https://t3.codes/install.sh, cited in
  [t3code-capabilities.md §2](t3code-capabilities.md#2-headless--server-deployment).
- Fork source citations (`path:line` at `fa31b66bbb`):
  [t3code-capabilities.md](t3code-capabilities.md) and
  [harness-mcp-surfaces.md](harness-mcp-surfaces.md).
- Harness CLI `--help` output (Claude Code, Codex 0.166, Grok 1.0.73,
  cursor-agent, Junie), captured in
  [harness-mcp-surfaces.md](harness-mcp-surfaces.md).
- Fleet facts are live read-only probes marked "probed 2026-11-01", repo
  docs, and private local receipts that are labelled as such and not
  published, all in [fleet-hosts.md](fleet-hosts.md).

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| Agent message router / mailbox (`beep agent-message`) | `goals/agent-message-router`, CLI under `packages/tooling` | reuse; retained as receipt layer (see DECISIONS) |
| T3 driver | `packages/drivers/t3-code` (`T3Code.service.ts`) | extend: remote URL, launch |
| Session bridges / `attach-t3` | `goals/agent-session-bridges` | extend: manifest-driven pins |
| Palantiri `host-pressure` parcel | `bun run beep palantiri parcel host-pressure` | reuse as spill signal |
| `@beep/ai-sync` config transforms | `packages/**/ai-sync` | extend or defer (harness MCP writer) |
| Skills: orchestrate, operator-handoff, remote-development-agents, closeout | `.claude/skills/*` | edit |
| Runbooks: agent-messaging, agent-notifications, agent-pools | `docs/runbooks/*` | edit |
| Models manifest / register kinds | `Models.manifest.schemas.ts`, `Register.schemas.ts` | extend |

Exact `path:line` citations: [repo-inventory.md](repo-inventory.md).

## 5. Cross-links & provenance

- Parent: [cross-provider-agent-communication](../../cross-provider-agent-communication/README.md):
  [T3CODE-QUALIFICATION.md](../../cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md)
  and its `MAP.md` queued cross-host and live-coordination candidates.
- Sibling: [cloud-environment-fanout](../../cloud-environment-fanout/README.md),
  which covers hosted cloud lanes, not tailnet hosts.
- This packet: [RESEARCH.md](../RESEARCH.md), [DECISIONS.md](../DECISIONS.md).
