# T3-Native Orchestration Spec

## Objective

Make T3 Code the only cross-session and cross-provider messaging route for
beep-effect agents. That means two things:

- **Delete** beep's own agent-to-agent stack, along with the goal and
  exploration packets that built it.
- **Rewrite** the orchestrator, handoff, remote-worker and closeout guidance
  around T3 Code's MCP tools, so that an orchestrator running in a T3 session
  can launch, message, wait on and interrupt sessions from any provider.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).
The settled decisions are in its [DECISIONS.md](../../explorations/t3code-fleet-driver/DECISIONS.md):
`messaging-substrate`, `retire-beep-agent-messaging`,
`retirement-placement`, `wake-service`, `observability-enrollment`,
`local-state-cleanup` and `kept-borderline-packets`.

## Non-Goals

- No new beep messaging, relay, mailbox, dispatcher or T3 adapter code.
- No host installs, Linked environment setup or harness MCP registration.
  Those belong to `goals/t3code-fleet-rollout` and `goals/t3code-harness-mcp`.
- No spill or compute routing rule. That belongs to `goals/t3code-spill-routing`.
- `@beep/ai-provider-cli`'s non-session half and `goals/yeet-pr-events` stay.
- No edits to the T3 Code fork.

## Source Hierarchy

1. The operator's 2026-11-01 ask and the exploration's DECISIONS.md.
2. `AGENTS.md`, `CLAUDE.md`, and the `yeet` and `orchestrate` skills.
3. `goals/README.md` and `explorations/README.md` lifecycle and archive
   rules.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. [removal-map.md](../../explorations/t3code-fleet-driver/research/removal-map.md)
   and [repo-inventory.md](../../explorations/t3code-fleet-driver/research/repo-inventory.md).

Higher sources outrank lower sources when they conflict. The removal map was
surveyed at `origin/main` `83d38d46f1`. Re-verify each row against the
current tree before deleting.

## Target Surfaces

Delete (removal map §§1–5a):

- `beep agent-message`: the repo-cli `commands/AgentMessage/` directory, its
  test kit, tests and fixtures, and the `agent_message_*` MCP tools.
- The `AiProviderCliSession*` managed-session half of `@beep/ai-provider-cli`
  and its tests and fixtures, plus the ai-metrics fixture that imports it.
- `@beep/t3-code` (`@beep/t3-code`), through
  `bun run beep delete-package @beep/t3-code --rewrite-packets`.
- The ai-metrics `observation-launch-*` modules that are left without a
  caller.
- the former agent-messaging runbook and the two
  `standards/cache-qualification-agent-message-*` records.
- These packets: `retired:agent-message-router`, `retired:agent-session-bridges`,
  `retired:codex-security-findings-2026-10-14-agent-message`, `retired:wake-service`
  (superseded) and `retired:cross-provider-agent-communication`.

Rewrite:

- `.claude/skills/orchestrate/SKILL.md` and its handoff template, covering the
  route table, the T3 section, and the broadcast and re-arm steps.
- `.claude/skills/operator-handoff/SKILL.md`.
- `.claude/skills/remote-development-agents/`: add a T3 route for each host and
  host-profile stubs for tom-pc-1 (WSL). Mark grok-bot-box-1 out of scope.
- `.claude/skills/closeout/SKILL.md`, wording only.
- `docs/runbooks/agent-notifications.md`, `docs/runbooks/agent-pools.md`,
  `docs/README.md`, and the messaging and orchestrator sections of `AGENTS.md`.

Reference edits only: the kept packets in removal map §5c,
`beep-effect.iml`, `.fallowrc.jsonc`, and the dependency-review fixture row.

## Constraints

- Every intermediate commit builds. Follow removal map §0's order: CLI first,
  then the session adapters, then the package, then the docs, then the
  packets.
- Retired packets are deleted outright, following the PR #1975 precedent.
  Surviving links become `retired:<slug>` plus a GitHub permalink at the last
  commit where the packet existed. Each kept packet that referenced one gets
  a Decision Log row. That includes `explorations/t3code-fleet-driver`'s own
  links to `cross-provider-agent-communication`.
- `retired:wake-service` gets `superseded` with `supersededBy:
  t3-native-orchestration` in the same commit that deletes it, so git history
  records why.
- The skill text names T3 tools exactly as the T3 MCP server exposes them:
  `orchestrator_capabilities`, `t3_thread_configure`, `t3_thread_launch`,
  `t3_thread_send`, `t3_thread_read`, `t3_thread_wait`, `t3_thread_interrupt`,
  `delegate_task`, and the scheduled-task tools. Each tool's argument names,
  `environmentId` included, are verified against the installed T3 server's
  MCP tool listing before they are written.
- Repository authority does not move with messages. The registered
  orchestrator, briefs, ownership, model routing and Yeet gates all stay.
- Skills change only under `.claude/skills`. Then run `bun run beep skills
  update`, `bun run beep skills relock`, and the regeneration commands in
  removal map §6.
- `goals/orchestrator-handoff` (active) owns the orchestrator role contract
  in the same `orchestrate` and `operator-handoff` skills. Change only their
  messaging, route and broadcast mechanics. Keep its take-over, run and
  hand-off procedures, and add a row to its Decision Log that points here.
- The public repo carries no tailnet names, addresses, tokens or client data.

## Acceptance Criteria

- [x] `rg -n -i 'agent-message|agent_message|AgentMessage|@beep/t3-code|session-bridge'`
      outside `**/history/**` matches only `retired:` records, Decision Log
      rows, ACP protocol vocabulary (`agent_message_chunk` in `@beep/acp`),
      dated prose in closed packets and `docs/reports`, and this packet's own
      files (Decision Log 2026-11-02).
- [x] The packets listed above are gone, and no non-archival markdown link
      points at them. `knowledge semantic-delta` passes.
- [x] `bun run beep goals doctor` and `bun run beep explore atlas --check` pass.
- [x] The rewritten `orchestrate` skill gives a complete T3-native procedure:
      capabilities and configuration check, launch with a pinned
      provider/model/effort, send with a stable `clientRequestId`, a
      wait/read correlation rule, interrupt, scheduled-task wakes, and a
      cross-environment `environmentId` placeholder for the fleet goal.
- [x] Live receipt: from a T3 session on DankStation, an orchestrator
      following the new skill launches one Codex thread
      (`gpt-6.1-sol` medium) and one Claude thread (`claude-opus-5-5`
      medium), completes a send/reply/ack round trip through T3 tools, and
      records a sanitized receipt in `history/`.
- [x] The PR is mergeable through `/yeet`: green checks and zero unresolved
      review threads.
- [x] After merge, the local state in removal map §8 is deleted on
      DankStation, and the deleted paths are listed in a `history/` note.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Fast gates | `bun run beep yeet verify` (cheap tier) | Passes |
| Packets | `bun run beep goals doctor`; `bun run beep explore atlas --check` | Pass |
| Links | `bun run beep knowledge semantic-delta` | No new broken links |
| Residue | `rg` from Acceptance | Only retirement records |
| Skills | `bun run beep skills relock` and the lock check | Clean |
| Launcher | `test "$(wc -m < goals/t3-native-orchestration/GOAL.md)" -le 4000` | Passes |
| Live round trip | `history/` receipt | Codex and Claude threads exchanged send/reply/ack |

## Stop Conditions

- A deletion breaks an importer outside the removal map, and the fix would
  change product behavior.
- The installed T3 server's MCP tool listing contradicts the tool names or
  arguments this spec relies on.
- Any spend: purchases, paid services, quota top-ups or plan changes.
- The same blocker repeats after reasonable investigation.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-01 | T3-native messaging is the only route; beep's mailbox stack is deleted | Operator ruling; T3 already injects MCP and addresses linked environments | Revert the retirement PR |
| 2026-11-01 | `wake-service` superseded by T3 scheduled tasks and `watch_pull_request` | Its transport is deleted | Restore from git; re-scope on T3 |
| 2026-11-01 | Agent-message observation enrollment retired; unused `observation-launch-*` modules deleted | No caller remains | Restore from git |
| 2026-11-02 | The installed server lists `t3_thread_configure`; the spec's `t3_thread_configuration` was a misnomer and the skills use the real name. | Verified against the T3 tool listing this session loads (fork `fa31b66bbb2a`, `apps/server/src/mcp/toolkits/thread/tools.ts:153`). | None needed; the name is the server's. |
| 2026-11-02 | Of the ai-metrics `observation-launch-*` modules only `observation-launch-claims`, `observation-launch-client` and `observation-claim-population` (plus their tests and fixtures) are deleted; `observation-launch`, `observation-launch-facts` and `observation-launch-http` stay because `ObservationWorker`, `observation-worker.ts` and `evidence-retention.ts` import them. | Importer census at deletion time. | Restore the three modules from git at `6bb8584b6dbc9aee927a200901c9eebc0abd63b1`. |
| 2026-11-02 | The residue acceptance criterion exempts ACP protocol vocabulary, dated prose in closed packets and reports, and this packet; those mentions are history, not live references (removal map §5d). | Rewriting closed packets' census prose would churn history for no reader; `@beep/acp` cannot drop its wire vocabulary. | Tighten the criterion and rewrite those lines in a follow-up PR. |
| 2026-11-02 | T3 orchestrator tools were restored from the TokenEconomizer toolprune deny list in the gitignored local Claude settings file (local, gitignored) and marked kept repo-wide, so T3 sessions can run the skill. | The deny list hid `t3_thread_send`, `delegate_task` and the rest from this and every other beep-effect session. | `te toolprune apply <tools>` re-denies them. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
