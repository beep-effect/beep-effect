# Agent-to-agent comms removal map (beep-effect)

Surveyed 2026-11-01 in `the packet worktree`
(HEAD `83d38d46f1`, branch `explore/t3code-fleet-driver`; only untracked change is
`explorations/t3code-fleet-driver/`). Read-only; nothing was edited. One read-only probe was run:
`bun run beep delete-package @beep/t3-code --dry-run` (output summarized in section 6; the tree was
unchanged afterwards).

Legend: **delete** = remove; **edit-ref** = keep the file/packet, rewrite references;
**keep** = no action (historical capture or unrelated).

---

## 0. Recommended order (keeps every intermediate commit buildable)

1. Delete the `agent-message` CLI group and its tests/fixtures (section 1). This removes the only
   importer of `@beep/t3-code` and of `AiProviderCliSession`.
2. Remove the managed-session half of `@beep/ai-provider-cli` plus its ai-metrics fixture (section 2).
3. `bun run beep delete-package @beep/t3-code --rewrite-packets` (section 3). After step 1 its hard
   refusals clear, except for the dependency-review fixture row (section 3, risk R3).
4. Delete the docs, standards and packets (sections 4 and 5), then rewrite the surviving backlinks.
5. Regenerate everything in section 6, re-record the cache baseline on a new review basis, and relock skills.

Precedent: PR #1975 (`71d48a5c50`, "remove venice-ai, xai, firecrawl and face-detection").
It used `beep delete-package`, ran `--rewrite-packets` to tombstone names to `retired:<slug>` in goals,
explorations, research and docs, removed the completed packet together with its backlinks, deleted the
effect-vitest-canon per-package inventory, wrote Decision Log rows in the affected packets, kept
captured logs and sha-pinned reports byte-for-byte, and re-recorded the cache baseline on a new review basis.

---

## 1. `beep agent-message` CLI (repo-cli) — DELETE

17 subcommands: list, register, grant, send, reply, inbox, inspect, settlement, acknowledge,
resolve-ambiguity, recover, watch, tools (MCP stdio server for `agent_message_*`), serve, attach-t3,
peer {send, reply, acknowledge, inspect, inbox, discover}, observation {initialize, enroll, population, ...}.

| Path | Action | Notes |
| --- | --- | --- |
| `packages/tooling/tool/cli/src/commands/AgentMessage/` (14 files, ~4.7k LOC: attached.{command,schemas,service}, command, layer, models, observation{,.command}, peer.command, runtime, service, store, tools, index) | delete | The `agent_message_{send,reply,inbox,acknowledge,inspect,discover}` MCP tools are defined in `AgentMessage.tools.ts` and served by `agent-message tools`. No repo or user MCP config registers them (`.mcp.json`, `.codex/config.toml` and `.claude/settings.json` are clean). |
| `packages/tooling/tool/cli/src/test/AgentMessage.test-kit.ts` | delete | Test entry point that re-exports the group. |
| `packages/tooling/tool/cli/test/AgentMessage.{attached,command,layer,observation,runtime,tools}.test.ts`, `test/agent-message-models.test.ts`, `test/agent-message-store.test.ts` | delete | 8 test files |
| `packages/tooling/tool/cli/test/fixtures/agent-message/{process.ts,tsconfig.json}` | delete | |
| `packages/tooling/tool/cli/test/fixtures/managed-observation-command.ts` | delete | Imports the AgentMessage observation code, `@beep/ai-provider-cli`, and ai-metrics `observation-launch-*`. |
| `packages/tooling/tool/cli/src/commands/Root.ts:11,85` | edit | Drop the `agentMessageCommand` import and its registration. |
| `packages/tooling/tool/cli/src/internal/dispatch/Dispatch.manifest.ts:95-97` | edit | Drop the `agent-message` groupRoute. The knowledge doctor derives the documented command list from these literals. |
| `packages/tooling/tool/cli/package.json:80,157` | edit | Remove the `./commands/AgentMessage` export (src and dist). |
| `packages/tooling/tool/cli/package.json:189` (`@beep/ai-provider-cli`), `:235` (`@beep/t3-code`) | edit | Both are used only by AgentMessage (the other hits in `Ci/CiLanePartitions.ts` and `Quality/internal/CoverageScope.ts` are string literals). Keep `@beep/repo-ai-metrics`, which AIMetrics uses. |
| `packages/tooling/tool/cli/tsconfig.json:12,54`, `tsconfig.check.json:6,48` | edit (generated) | Project references to ai-provider-cli and t3-code. `tsconfig-sync` rewrites them from package.json. |
| `packages/tooling/tool/cli/test/tsconfig.json:5` | edit | `files: ["./fixtures/agent-message/process.ts"]` |
| root `tsconfig.json:2026-2030`, `vitest.aliases.generated.json:1863-1867` | edit (generated) | `@beep/repo-cli/commands/AgentMessage` and `@beep/t3-code` path aliases (tsconfig-sync / alias writer). |
| `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts:628-656` | keep | Uses `agent-message.test.ts` only as a synthetic filename for a detector case. Optionally rename the string. |
| `packages/tooling/tool/cli/test/refs-schemas.test.ts:47`, `setup-effect-ref.test.ts:104,130` | keep | The `t3code` upstream reference repo, which `@beep/acp` needs. |

Break-risk importers outside the delete set: none. Every `commands/AgentMessage` importer is
inside the set (Root, Dispatch manifest, test-kit, tests, fixtures).

## 2. Managed provider adapters in `@beep/ai-provider-cli` — DELETE (partial package)

Keep the package. `packages/agents/server` (`ProviderInstance.probe.ts`, `ProviderInstance.layer.ts`
and `test/ProviderInstance.integration.test.ts`) imports `AiProviderCli` and `AiProviderCliHome`.
Only the `AiProviderCliSession*` half belongs to the comms feature. PR #1571 added it; PR #2364 added `lifecycle.ts`.

| Path | Action | Notes |
| --- | --- | --- |
| `packages/drivers/ai-provider-cli/src/AiProviderCliSession.{claude,codex,cursor,grok}.service.ts`, `.errors.ts`, `.lifecycle.ts`, `.models.ts`, `.profile.service.ts`, `.service.ts`, `.stdio.service.ts`, `.wire.models.ts` | delete | 11 files. `wire.models.ts` hardcodes the `agent_message_*` `MessagingToolName` literals. |
| `packages/drivers/ai-provider-cli/test/AiProviderCliSession.test.ts`, `test/fixtures/{managed-acp-v1-peer,managed-claude-peer,managed-codex-peer,managed-cursor-peer,managed-grok-peer,session-options}.ts`, `test/fixtures/tsconfig.json` | delete | |
| `packages/drivers/ai-provider-cli/src/index.ts` | edit | Drop the 3 `AiProviderCliSession.*` re-exports and the lifecycle type export. |
| `packages/drivers/ai-provider-cli/package.json` | edit | Drop the 8 null-export entries for `./AiProviderCliSession.*`. Drop the `@beep/acp` dependency: only Session files import it, so ai-provider-cli tsconfig refs follow via tsconfig-sync. |
| `packages/drivers/ai-provider-cli/README.md` | edit | Rewrite the managed-session prose and keep the capability/home sections. `CHANGELOG.md`: keep. |
| `packages/tooling/library/ai-metrics/test/fixtures/managed-observation-process.ts` | delete (judgment J2) | Its only consumer is `goals/agent-observability-foundation/ops/verify-worker-entrypoint.py`. |
| `packages/tooling/library/ai-metrics/package.json:88` (`@beep/ai-provider-cli`), `tsconfig.json:12`, `tsconfig.check.json:6` | edit | Only that fixture uses it. |
| `.fallowrc.jsonc:9,146` (entry plus negated entry for that fixture), `:394-399` (CRAP override for it), `:401-407` (override for `AiProviderCliSession.test.ts`) | edit | Stale entries can fail fallow config validation and leave an unknown-file warning. |
| ai-metrics `src/observation-launch-claims.ts`, `-client.ts`, `-facts.ts`, `-http.ts`, `observation-claim-population.ts`, `privacy.ts` | keep (judgment J2) | Their only consumers outside the package are AgentMessage.observation and its tests. They become orphaned but stay entry points (fallow `packages/**/src/*.ts`), so no gate fails. `observation-launch.ts` is still used by `AIMetrics/internal/ObservationWorker.ts`. |
| `@beep/acp` (`packages/drivers/acp`) | keep | Still used by codegen-kit, obs and CI partitions. Its `agent_message_chunk` hits are ACP protocol vocabulary. |
| `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:329,463`, `Quality/internal/CoverageScope.ts:164` | keep | The package survives. Re-tune the coverage weight (11.9) after the shrink if the coverage gate complains. |

## 3. `@beep/t3-code` (`packages/drivers/t3-code`, 15 files) — DELETE via `beep delete-package`

Its only importer is the AgentMessage attached adapter (`AgentMessage.attached.{command,schemas,service}.ts`,
`test/AgentMessage.attached.test.ts`). The dry run reports direct dependent `@beep/repo-cli` and
transitive dependent `@beep/scratchpad`.

Registration points the tool removes or rebuilds: root `package.json:604` workspace literal,
`tsconfig.packages.json:244`, `tsconfig.json` paths, `vitest.aliases.generated.json`, `syncpack.config.ts:120`,
`turbo.json:285` (`//#lint:policy-fingerprint` inputs), `bun.lock` (1928, 4065, 5039),
the `packages/foundation/modeling/identity/src/packages.ts` `$T3CodeId` composer (around line 2892-2906) and its shape row,
`standards/schema-catalog/@beep/t3-code.generated.jsonc`, `standards/instrumentation-catalog/@beep/t3-code.generated.jsonc`,
`standards/jsdoc-documentation.inventory.{jsonc,md}`, `standards/coverage.regression-baseline.jsonc:49174-49223`,
`standards/fallow.boundaries.generated.jsonc`, `standards/policy-tools.fingerprint.json:497`,
`standards/cache-qualification-baseline.json` rows, and the retired-package registry
`standards/changesets.retired-packages.json`. The package is private, so no changeset.

Dry-run refusals today:
- HARD: 14 dependent hits. All but one sit in AgentMessage plus repo-cli package.json, and they clear after section 1.
  The remaining hit is **R3**: `packages/tooling/tool/cli/test/fixtures/dependency-review/manifest-inventory.json:503`, a recorded 2026-10-21 `gh api` capture.
  Trim the `production` row. The test asserts only misclassification and `syntheticFixtureCount`, so a trimmed production row is safe; the fixture README says "rows are trimmed, never edited".
- SOFT: a packet reference remains in `goals/agent-session-bridges/GOAL.md:13` and `SPEC.md:156`, so pass `--rewrite-packets`.
  The packet is deleted anyway in section 5. `goals/effect-vitest-canon/ops/inventory/test-files.json:4833-4834` gets the tombstone rewrite.

Keep: `THIRD_PARTY_NOTICES.md:161+` (t3code MIT notice; it covers `@beep/acp` and the ai-provider-cli
Home port, not t3-code), `scripts/references.json:40` (t3code reference repo), and `docs/runbooks/systemd-timers.md:27`
(the t3code source-update timer).

## 4. Docs, skills, standards, IDE

| Path | Action | Notes |
| --- | --- | --- |
| `docs/runbooks/agent-messaging.md` | delete | It links goals/agent-message-router and agent-session-bridges SPECs. |
| `docs/README.md:39` | edit-ref | Drop the "local agent messaging" runbook link. |
| `.claude/skills/orchestrate/SKILL.md` (lines 19-30 routing table, 36-94 "T3-owned visible conversations", 96-134 "Managed cross-provider messages") (`.agents/skills` is a symlink to it) | edit (rewrite) | Replace the `agent-message attach-t3/peer/serve` and `agent_message_*` routes with T3 Code MCP (`t3_thread_send`, `launch`, ...). It has 6 links into the deleted packets/runbook, all of which would be **introduced knowledge findings**. Then run `bun run beep skills relock`, because `skills-lock.json:317-323` `installedTreeHash` changes. |
| `standards/cache-qualification-agent-message-request.json`, `standards/cache-qualification-agent-message-review.md` | delete (optional) | PR #1571 review-basis records. Nothing reads them except the deleted packet's MAIN-1666-INTEGRATION.md and an effected-promotion research list (archival). |
| `standards/effect-vitest.inventory.jsonc` (21 AgentMessage plus 2 Session rows), `schema-first.inventory.jsonc` (7), `schema-catalog/@beep/repo-cli.generated.jsonc` (34), `schema-catalog/@beep/ai-provider-cli.generated.jsonc` (23), `instrumentation-catalog/@beep/repo-cli.generated.jsonc` (57), `instrumentation-catalog/@beep/ai-provider-cli.generated.jsonc` (7), `jsdoc-documentation.inventory.jsonc` (218 AgentMessage plus 123 Session), `coverage.regression-baseline.jsonc` (AgentMessage 31496-31652, Session 1322-1430), `fallow.boundaries.generated.jsonc` | regenerate | See section 6. |
| `beep-effect.iml:246,250` | edit | `excludeFolder` entries for the two deleted goal packets. |
| `standards/architecture/DECISIONS.md:1807` ("GitHub-issue mailbox" for Grok Bot), `standards/ARCHITECTURE.md:1710` (cluster mailbox) | keep | Unrelated meanings of "mailbox". |
| `docs/reports/*cache*-review-2026-10-2x.md`, `repository-recovery-2026-10-20.md` | keep | Historical reports that name `@beep/t3-code` and ai-provider-cli in tables. Not sha-pinned by any json. They are not path links, so no knowledge finding. Optional tombstone via `--rewrite-packets`. |

## 5. Goal and exploration packets

### 5a. DELETE (A: primarily agent-to-agent comms)

| Packet | Files | Status | Inbound links that must be rewritten (non-archival) |
| --- | --- | --- | --- |
| `goals/agent-message-router` | 19 | completed-retained (provenance: cross-provider-agent-communication) | `docs/runbooks/agent-messaging.md` (also deleted), `explorations/expiring-repo-facts/RESEARCH.md:148`, `explorations/t3code-fleet-driver/{CAPTURE,RESEARCH}.md` |
| `goals/agent-session-bridges` (PR #1571) | 34 | completed-retained | orchestrate SKILL.md (2 links), runbook, `expiring-repo-facts/RESEARCH.md:145`, t3code-fleet-driver |
| `goals/codex-security-findings-2026-10-14-agent-message` | 12 (+ ignored `raw/`) | completed-retained (CSF-001 Fixed) | `goals/codex-security-findings-2026-10-14/README.md:42` (slug mention) and `beep-effect.iml:246`. Codex finding ID bindings are per-packet (`Findings.normalize.ts:228`), so deleting it cannot re-mint IDs. |
| `explorations/cross-provider-agent-communication` | 89, including runnable spikes: `research/spike/**/*.py`, `codex-remote-bridge/*.ts` with `transport.test.ts`, and `test_*.py` | graduated (`links.goals` = the two goals above) | orchestrate SKILL.md (2 links), `explorations/t3code-fleet-driver/CAPTURE.md:62`. Archival references in `goals/codex-security-findings-2026-10-28/findings/CSF-007.md:29-36` and `ops/triage.json:262-268` (CSF-007 Fixed 2026-10-31) can stay as history. Neither `goals/tsconfig.ops.json` (it covers only `goals/*/ops/**/*.ts`) nor any vitest project includes the spike TS. |

### 5b. Judgment calls (operator must rule)

| Packet | Status | Why it is borderline | Options |
| --- | --- | --- | --- |
| `goals/wake-service` (J1) | **active**, graduated 2026-10-31 from expiring-repo-facts, no code yet | Its mission is wakes "delivered through the agent-message router". Scope names `AgentMessage delivery` and `@beep/ai-provider-cli` dispatcher reuse (`SPEC.md:9,53,55,106`; `GOAL.md:7,23`; `README.md:11`; manifest mission). | (a) Delete or supersede it (`goals set-status wake-service superseded` plus `supersededBy`) and fold "wake" into the T3 Code fleet driver. (b) Re-scope SPEC/GOAL to deliver wakes via T3 Code MCP. Either way, edit `goals/hold-ledger/SPEC.md:23-24` (relative link `../wake-service/README.md`). |
| `goals/agent-observability-foundation` (J2) | active, final PR #2364 merged, P2-P4 closing | Mixed. Its "managed-owner enrollment" decision (`SPEC.md:357-372`) added `agent-message observation` plus `AiProviderCliSession.lifecycle` and the ai-metrics `observation-launch-*` claims. Ops proofs pin those paths: `ops/verify-worker-entrypoint.py:470`, `ops/verification-source-freshness.json` (~40 rows), `ops/whole-cli-runtime-abort-verification.json:80-93`, `ops/boundary-predicates-verification.json:8`, `ops/managed-owner-typecheck.json:6`, `ops/terminal-classification-verification.json:7`. | Keep the packet. Add a Decision Log row retiring the managed-owner route, edit SPEC 357-372, and treat the ops JSON as frozen evidence. Decide whether to delete the orphaned ai-metrics `observation-launch-{claims,client,facts,http}` and `observation-claim-population` modules or keep them for a future T3-launch enrollment path. |
| `explorations/expiring-repo-facts` | graduated (hold-ledger, wake-service) | Its wake design runs through the router. | edit-ref: `MAP.md:15` (AgentMessage path), `RESEARCH.md:144-153`, `DECISIONS.md:50,85`, `BRIEF.md:52,97`, `README.md:43`. Add a DECISIONS row. |
| `explorations/t3code-fleet-driver` (untracked successor) | capture/active | It cites the deleted packets as prior art. | edit-ref when committing: `CAPTURE.md:62,66`, `RESEARCH.md:18,69,79`; turn the links into git-history references (`git show <sha>:path`). |
| `goals/yeet-pr-events` (from `explorations/pr-event-awareness`) | completed-retained | It is a machine-to-session notification channel (yeet inbox rows, `.claude/hooks/yeet-inbox.sh`), not agent-to-agent, and has no AgentMessage dependency. | Keep (C) unless the operator wants PR events routed via T3 Code too. |

### 5c. EDIT-REF (B: keep the packet, fix references)

| Packet/file | Reference |
| --- | --- |
| `explorations/agent-observability-rebuild/MAP.md:20` | `AiProviderCliSession.profile.service.ts` path (deleted). Archival `research/REVIEW.md` and `HARNESS-COVERAGE.md` keep their bytes. |
| `goals/codex-security-findings-2026-10-14/README.md:42`, `SPEC.md:123` | sibling-packet slug and "agent-message code" prose |
| `goals/palantiri-parcels/SPEC.md:80` | "the CLI already hosts `McpServer.layerStdio` (`beep agent-message`)" is now false. Point it at another McpServer host or reword. |
| `goals/entity-optimistic-concurrency/SPEC.md:111` | "tooling `AgentMessage` SQLite stores" (prose example) |
| `goals/hold-ledger/SPEC.md:23-24` | only if wake-service is deleted (J1) |
| `goals/agent-observability-foundation/SPEC.md:359,372` | see J2 |

### 5d. KEEP (C: unrelated, or historical mention only)

`explorations/fleet-coordination` (graduated to `goals/fleet-mirror`, a read-only checkout view; its
"mailbox" hits are prior-art notes), `explorations/agent-chat-interface` (professional-desktop chat UI),
`explorations/harness-the-harness` (to practice-gateway), `explorations/agent-fleet-layout` (fleet-root and lanes),
`explorations/remote-skill-activation-conformance` (skill origin), `explorations/multi-provider-llm-dispatch-fallback`
(to llm-provider-subscription-auth; it uses ai-provider-cli capability/home, which is kept), `explorations/cursor-agent-pool`
(its `agent_message` hits are Cursor hook fields), `explorations/agent-governance-control-plane`, `goals/fleet-mirror`,
`goals/llm-provider-subscription-auth`, `goals/agent-outcome-experiments`, `goals/harness-telemetry-enrollment`
(audit cites Session file:line; archival), `goals/effect-rules-diagnostics-lane`, `goals/repository-simplification-{residue,confidence}`,
`goals/schema-opaque-default`, `goals/practice-gateway`, `goals/time-to-certainty`, `goals/cloud-agent-readiness`,
`goals/beep-cli-composition`, `goals/effected-promotion`, `goals/turborepo-*`, `goals/tsc-rs-gates`, `goals/tsrs-gates`,
`goals/docs-lint-oxlint-rules`, `goals/lint-policy-oxlint-type-aware` (all of these name AgentMessage or t3-code only in historical
prose, census JSON or cache-review records). `practice-mail-*`, `m365-*`, `design-figure-review-loop`, `scratchpad/party` and `packages/law-practice`
hits are Outlook or domain "mailbox" and are unrelated. `apps/*` and `packages/agents/*` contain no inter-agent messaging code.
`beep session` (continuity ledger) and the Grok Bot GitHub-issue mailbox are not this use case.

## 6. Gates and regeneration

### Gates that see packet deletions
- `bun run beep knowledge semantic-delta` (turbo `//#knowledge:semantic-delta`, CI Lint Policy) fails on
  **introduced** blocking findings, such as broken repo-path references in non-archival markdown under
  AGENTS.md, CLAUDE.md, goals, explorations, docs, .claude, .agents, .codex, standards and .github. Paths under
  `history|research|reviews|synthesis|findings|outputs|reflections|logs|.proofs` and `goals/*/data` are archival and exempt
  (`Knowledge.refs.ts:1265-1280`). Every non-archival markdown backlink in sections 4 and 5 must therefore be rewritten.
  The sealed `goals/knowledge-doctor.baseline.jsonc` (mint-App-only writer) holds no rows for these packets, so no baseline edit is needed.
- `bun run beep knowledge refs --check` (`//#knowledge:refs-check`) is the reference census.
- `bun run beep goals doctor` checks against `goals/goals-doctor.baseline.jsonc`, which has no rows for these packets. Broken
  `provenance.exploration` back-links are advisory and never block. Deleting the exploration and both of its goals together leaves no dangling back-link.
- `bun run beep goals index --check` (`goals/INDEX.md` is an ignored local projection; `bun run beep goals index --write`).
- `bun run beep lint roadmap-refs` (inputs: `docs/ROADMAP.md`, `goals/**`, `explorations/**`). ROADMAP has no hits.
- `bun run beep lint reflection-artifacts`: deleted packets' reflections disappear, which is fine. Run it if wake-service or observability is edited.
- `bun run beep explore atlas` (ignored `explorations/ATLAS.md`, local only).
- Fallow config validation of `.fallowrc.jsonc` entries (section 2).

### Regeneration commands (writers `delete-package` runs automatically are marked *)
- `bun run beep delete-package @beep/t3-code --rewrite-packets` covers identity-segment removal, *tsconfig-sync, *`bun install --lockfile-only`,
  and *baseline writers: `bun run beep fallow boundaries --write`, `bun run fallow:health:baseline:write`,
  `bun run fallow:dead-code:baseline:write`, `bun run beep quality jsdoc-inventory`, `bun run beep lint schema-first --write`,
  `bun run beep lint package-test-typecheck --write-baseline`, `bun run beep lint schema-catalog --write`,
  `bun run beep observability catalog --write`, `bun run beep lint package-scripts --write`. Rerun them yourself after the
  AgentMessage and Session deletions too: the dry run plans them for t3-code only, but the same files carry repo-cli and ai-provider-cli rows.
- `bun run beep tsconfig-sync` (tsconfig refs, root paths, `vitest.aliases.generated.json`).
- `bun run beep lint effect-vitest --write` (`standards/effect-vitest.inventory.jsonc`).
- `bun run coverage -- --filter=@beep/repo-cli --filter=@beep/ai-provider-cli --write-baseline` (`standards/coverage.regression-baseline.jsonc`; header: "Regenerate the rows you changed").
- `bun run beep lint policy-fingerprint --write` (`standards/policy-tools.fingerprint.json` plus the turbo.json `//#lint:policy-fingerprint` inputs).
- `bun run beep cache baseline --request <new-request.json>` re-records `standards/cache-qualification-baseline.json` on a new
  review basis, as in #1975 and the `docs/reports/driver-removal-cache-review-2026-10-21.md` pattern. Its 50+ t3-code and ai-provider-cli rows go stale otherwise.
- `bun run beep skills relock` refreshes the orchestrate `installedTreeHash` in `skills-lock.json`.
- `bun run beep docgen aggregate` (`docs:aggregate`), if docs aggregates list removed modules.
- Verify with `bun run beep delete-package @beep/t3-code --check` (post-deletion residue doctor) and `bun run beep yeet verify` / `vp`-equivalent cheap gates.

## 7. Deletion and retirement convention

- `goals/README.md:120-142`: lifecycle vocabulary is closed (`active|paused|completed-retained|superseded|reference`),
  written with `bun run beep goals set-status <slug> <status>`. "Removal from the working tree is an archive *operation*, not a
  status — a removed packet's history lives in git, and physical `goals/_archive/` moves are a follow-up packet." "Retain a
  completed packet only when it continues to serve as evidence, reference design, or launch context." `superseded` requires
  `supersededBy` plus `supersededNote`. So physical deletion of completed packets is sanctioned and git is the archive.
  Precedents: #401 portfolio consolidation and #1975.
- `explorations/README.md:105-109`: `killed` = explicitly rejected, with a one-line epitaph in tracked DECISIONS.md or the README
  Trail; `links.supersededBy` exists in the manifest schema. There is no written rule for physically deleting a graduated exploration. #1975 and #401
  deleted packets outright; the rationale lives in the PR body and in Decision Log rows of the surviving packets.
- `standards/architecture/11-evolution-and-deprecation.md`: the five-step slice retirement (deprecate, sunset window, migrate dependents,
  removal PR, DECISIONS entry) applies to product **slices**, not tooling or drivers. Its relevant parts here are the removal-PR scope
  (tests, fixtures and lint exemptions go together) and the **DECISIONS entry**: add a dated row to `standards/architecture/DECISIONS.md`
  if the operator wants the retirement recorded architecturally. There is no existing DECISIONS row for agent-message to supersede.
- Recommended: delete the four A packets outright, write a dated Decision Log row in each surviving B packet (expiring-repo-facts,
  agent-observability-foundation, hold-ledger/wake-service per J1, t3code-fleet-driver), and put the rationale and replacement (T3 Code
  MCP) in the PR body.

## 8. Out-of-repo cleanup candidates (not touched)

| Location | What |
| --- | --- |
| `~/.cache/beep/` | ~375 top-level entries matching `agent-comms*`, `agent-message*` or `*t3-code*` (~2.0 GB), including 19 dirs such as `agent-comms-spike`, `agent-comms-implementation`, `agent-message-tests`, `agent-message-review-1571{,-contention}` and `agent-message-store-refactor-review`, and SQLite mailboxes such as `agent-message-review-1571/state.sqlite`, `agent-message-store-refactor-review/state.sqlite` and `agent-message-checkpoint-diagnostic/*.sqlite`. The runbook told operators to put private stores under `~/.cache/beep/agent-messaging/` (absent now). |
| `~/.local/state/mise/trusted-configs/beep-effect8-worktre-agent-message-lint-c-*` | mise trust entry for a legacy agent-message lint worktree |
| `~/.codex/memories/{MEMORY.md,raw_memories.md,rollout_summaries/2026-10-09T16-05-37-*cross_provider_agent_communication*.md, 2026-10-20T16-06-10-*.md}` | Codex memories that still describe the agent-message route |
| systemd user units | none for agent-message (`t3code-source-update.{service,timer}` and `~/.local/bin/update-t3code-source*` belong to the T3 Code app; keep) |
| MCP registrations | none (`~/.claude/settings.json`, `~/.codex/config.toml` clean) |
| git branches | no local or remote `agent-message*` / `session-bridge*` branches in this clone |
