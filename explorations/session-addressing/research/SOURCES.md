# Session Addressing — Sources & Provenance

- **Cluster / origin:** direct probes of one workstation and its five linked
  T3 environments on 2026-11-12, plus targeted reads of `@beep/repo-cli`.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md). No mined corpus and no
  upstream repository, so sections 1 and 2 of the template are dropped.

## 3. External research sources

None. No external URL appears in this packet. Each claim is carried by the
RESEARCH.md section named here:

| Claim area | RESEARCH.md section | Probe |
| --- | --- | --- |
| Claude live index fields and counts | Session Census, 1 and 2 | read of `~/.claude/sessions/*.json`; `ListAgents` |
| T3 address readable from the environment | Session Census, 3 | process environment; `t3_thread_read`; `~/.t3/userdata/environment-id` |
| Thread counts, id shapes, PR links per environment | Session Census, 4 and 5 | `t3_environment_links`; `t3_thread_list` and `t3_thread_search` per environment |
| Children have no address | Session Census, 6 | `SendMessage` tool contract |
| Codex thread table and originators | Session Census, 7 | read-only `sqlite3` on `~/.codex/state_5.sqlite` |
| Cursor, Grok, Junie layouts | Session Census, summary rows 8 to 10 | directory listings only; files not opened |
| Ledger row counts and ages | Session Ledger State | aggregate over the workstation ledger file |

## 4. In-repo capability references

All under `packages/tooling/tool/cli/src/commands/` (`@beep/repo-cli`).

| Brick | Path | Use |
| --- | --- | --- |
| `SessionLedgerRow`, `openSessionRows`, `sessionOrchestrator` | `Session/Session.schemas.ts` | reuse |
| harness identity reader, row stamping | `Session/SessionLedger.service.ts` | extend |
| `PrProvenanceEntrypoint`, `PrProvenanceHarness`, `ProvenanceSessionEvidence` | `Yeet/internal/Provenance.ts` | extend |
| `RegisterRow` | `Session/Register.schemas.ts` | extend (gated candidate) |
| `newestPerKey` | `internal/state/JsonLinesStore.ts` | reuse |
| `WorktreeSessionMarker`, `sessionRootOf` | `Worktree/Worktree.schemas.ts`, `internal/repo-run/ProcessAttachment.ts` | reuse |
| SessionStart hooks | `.claude/hooks/session-ledger.sh`, `.codex/hooks.json` | extend |
| `SessionRoute`, `SessionPresence`, `RouteLiveness`, resolver service, Codex and `t3` readers | — | NET-NEW |

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md),
  [`../DECISIONS.md`](../DECISIONS.md), [`../BRIEF.md`](../BRIEF.md), [`../MAP.md`](../MAP.md).
- Doctrine it stays inside: `AGENTS.md`, Autonomy, "The repo ships no mailbox,
  relay or dispatcher of its own".
- Earlier packets on neighbouring ground (archived tombstones):
  `explorations/fleet-coordination`, `explorations/t3code-fleet-driver`,
  `explorations/pr-event-awareness`.
