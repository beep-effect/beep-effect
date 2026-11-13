# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

All paths are under `packages/tooling/tool/cli/src/commands/` in
`@beep/repo-cli`.

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `session-route-resolver` | Any agent runs one command with a PR, branch, lane or checkout and gets the owning session, its routes, their liveness and the send call. | none | extends `Session/Session.schemas.ts` (`SessionLedgerRow`, `openSessionRows`), `Session/SessionLedger.service.ts` (harness identity reader), `Yeet/internal/Provenance.ts` (`PrProvenanceEntrypoint`, `PrProvenanceHarness`, live-index evidence), `internal/state/JsonLinesStore.ts` (`newestPerKey`), `.claude/hooks/session-ledger.sh`, `.codex/hooks.json`. NET-NEW: `SessionRoute`, `SessionPresence`, `RouteLiveness`, the resolver service, the Codex thread-table reader, the `t3` CLI reader. |
| `session-open-liveness` | `session open` shows which rows have a live owner and stops listing dead ones as work in progress. | `session-route-resolver` | reuses its liveness service; extends `Session/Session.command.ts`, `Worktree/Reap.service.ts`. Nothing net-new. |
| `orchestrator-register-routes` | The orchestrator register and the merge gate name owners by route, and the orchestrate skill resolves instead of asking. | `session-route-resolver` | extends `Session/Register.schemas.ts` (`RegisterRow.address`), `Session/Handoff.ts`, the `orchestrate` and `yeet` skills. Nothing net-new. |

## Sequencing

1. `session-route-resolver` now. It carries every decision in
   [`DECISIONS.md`](./DECISIONS.md) and is the only candidate that removes
   today's manual lookup.
2. `session-open-liveness` is gated on the resolver having run for a week on
   this workstation: its liveness table needs real misses before it is
   allowed to hide rows.
3. `orchestrator-register-routes` is gated on the first orchestrator hand-off
   that uses `session resolve`, so the register change follows observed use.

Candidates 2 and 3 stay here as re-entry points. A fired gate reopens this
packet at `decompose`.

## First Vertical Slice

Inside `session-route-resolver`, in this order:

1. Schemas: `SessionRoute`, `SessionPresence`, `RouteLiveness`,
   `SessionResolution`, and the two widened literal domains.
2. Capture: the identity reader also returns routes; `session note` and the
   SessionStart hooks append presence.
3. `session resolve` over ledger, presence and the Claude live index only.

Proof, on this workstation: `bun run beep session resolve 3172` (or whichever
PR a Desktop session then owns) prints that session's current name and
`live`; resolving a PR owned by a T3-hosted session prints a `t3_thread_send`
call with both ids; resolving a PR with no local row prints the per-environment
search plan. Tests use fixture index files and a fixture ledger, never the
real home directory. Gate: `bun run beep quality package-verify @beep/repo-cli`.

The Codex thread-table reader and the `t3` CLI reader follow in the same
packet and are the first things cut if the appetite runs out.

## Open Risks Inherited From The Brief

- A CLI worker launched from a Claude shell records its parent's session id;
  slice one keeps that as the `via-parent` answer.
- Whether a T3-hosted Codex session sees `T3CODE_THREAD_ID` is unverified.
- `t3 thread list` is per project with no environment flag and may be slow.
- T3 thread ids are opaque and can exceed 300 characters; never parse them.
- Harness index files are undocumented; every reader degrades to `unknown`.
- Presence is written by sessions that own nothing; it is never a claim.
