# Session Route Resolver — Sources & Provenance

- **Cluster / origin:** direct probes of one workstation and its five linked
  T3 environments on 2026-11-12, plus targeted reads of `@beep/repo-cli`.
- **Provenance:** [`RESEARCH.md`](../../../explorations/session-addressing/RESEARCH.md). No mined corpus and no

The primary ledger is the exploration's
[`research/SOURCES.md`](../../../explorations/session-addressing/research/SOURCES.md);
this file reproduces what an implementing agent needs. Sections 1 and 2 of
the template are dropped: there is no mined corpus and no upstream repository.

## 3. External research sources

None. No external URL appears in this packet. Each claim is carried by the
section of the exploration RESEARCH.md named here:

| Claim area | RESEARCH.md section | Probe |
| --- | --- | --- |
| Claude live index fields and counts | Session Census, 1 and 2 | read of `~/.claude/sessions/*.json`; `ListAgents` |
| T3 address readable from the environment | Session Census, 3 | process environment; `t3_thread_read`; the `environment-id` file in T3's userdata directory |
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

- Source exploration: [`explorations/session-addressing`](../../../explorations/session-addressing/README.md)
  ([`RESEARCH.md`](../../../explorations/session-addressing/RESEARCH.md),
  [`DECISIONS.md`](../../../explorations/session-addressing/DECISIONS.md),
  [`BRIEF.md`](../../../explorations/session-addressing/BRIEF.md),
  [`MAP.md`](../../../explorations/session-addressing/MAP.md)).
- Doctrine this packet stays inside: `AGENTS.md`, Autonomy, "The repo ships no
  mailbox, relay or dispatcher of its own".
