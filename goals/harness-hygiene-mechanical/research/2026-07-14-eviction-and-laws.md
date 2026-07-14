## 1. EVICTION MAP

The pre-audit identifies the dated memory migration, provisioning details, tool routing, and cache TTL as volatile
state in a laws-only cache prefix
(`explorations/agent-effectiveness-pulse/research/2026-07-13-agents-md-preaudit.md:22-26`).

> - Cognee (`beepintir` MCP + cognee-memory plugin hooks/skills) is the sole
>   always-on durable dev-memory (2026-07-08 decision,
>   `standards/memory-architecture/04-decision-log.md`). It is OPERATOR-LEVEL
>   config (user plugin + user MCP settings), not provisioned by this repo's
>   `.mcp.json` — checkouts without it fall back to file memory and repo docs,
>   by design. Bounded use only: embedded/local or all-Postgres profile;
>   semantic memory is a managed cache (TTL, pruning, consolidation, node-set
>   scoping) — never source of truth. No uncited LLM output crosses the
>   authority boundary.

**Already covered at destination.** The dated decision, Cognee incumbency, bounded profiles, Layer-1 fallback, and
authority rule are in `standards/memory-architecture/04-decision-log.md:7-38`; operator provisioning is explicit at
`standards/memory-architecture/04-decision-log.md:53-58`; cache controls and node-set scoping are also in
`standards/memory-architecture/05-context-graph-capability-assessment.md:189-198`.

> - File memory (this file via the `CLAUDE.md` symlink, auto-memory
>   `MEMORY.md`) remains Layer 1 for durable curated knowledge.

**Already covered at destination.** The decision log says file memory remains Layer 1
(`standards/memory-architecture/04-decision-log.md:26-32`). This stable fact stays in the compact replacement
(`AGENTS.md:87-88`).

> - `graphiti-memory` is DEPRECATED: write-frozen, read-available for
>   historical context only until the `@beep/epistemic-tables` bitemporal port
>   lands, then decommissioned. Read helpers until then:
>   `bun run graphiti:proxy`, `bun run graphiti:proxy:ensure`; `group_ids`
>   must be a JSON array containing `beep_dev`.

**Split.** The write freeze, read availability, and port-gated decommissioning are already covered at
`standards/memory-architecture/04-decision-log.md:26-32,53-58`. **Needs landing:** the helper commands and `group_ids`
wire shape; scripts exist at `package.json:367-368`, and payload forms at
`.claude/skills/mcp-graphiti-memory/SKILL.md:23-38`. Destination prose is in section 2.

> - If memory is unavailable in-session, fall back to repo-local docs, code
>   search, and this file.

**Already covered at destination in principle.** The authoritative decision's
failure fallback is Layer-1 file memory (`standards/memory-architecture/04-decision-log.md:26-32`).
The existing in-session fallback remains verbatim as required (`AGENTS.md:94-95`).

> - effect v3↔v4 differences: prefer the `effect-v4-imports` skill; reach for
>   Cognee recall (or read-frozen `graphiti-memory`) only for historical
>   context.

**Needs landing in part.** The Effect skill routing stays in AGENTS.md, but historical Graphiti recall belongs in
the operations destination. Its write-frozen/read-available boundary is already authoritative in
`standards/memory-architecture/04-decision-log.md:26-32` (`AGENTS.md:99-101`).

> avoid idle gaps over ~5 minutes (cache TTL).

**Needs landing.** This literal session-cache constant appears only in Context Economy (`AGENTS.md:116-117`);
section 2 moves it to the operations runbook.

## 2. DESTINATION PROPOSAL

Use a new `standards/memory-architecture/06-agent-memory-operations.md`, not an append to 04 or 05. Slots 00-05 are
occupied; the index defines 04 as the decision log and 05 as the capability assessment
(`standards/memory-architecture/README.md:44-53`). A separate 06 keeps mutable commands, payload shapes,
provisioning, and cache timing out of both. It cites and implements the decision; it does not re-decide it
(`standards/memory-architecture/04-decision-log.md:7-58`).

```markdown
# Agent Memory Operations

This runbook implements the authoritative external-memory decision in
[`04-decision-log.md`](./04-decision-log.md#2026-07-08-external-memory-stack--donor-portfolio-confirmed-cognee-is-the-sole-dev-memory-incumbent-doctrine-phrasing-sharpened).
It records mutable operator and session details only; changes here do not amend
that decision.

## Provisioning and operating envelope

- Cognee and the read-frozen Graphiti service are operator-level MCP facilities,
  supplied by user plugin/settings rather than the repository `.mcp.json`.
- Run Cognee only in its embedded/local or all-Postgres profile, never the full
  compose stack. Treat its semantic state as a bounded cache with TTL, pruning,
  consolidation, and node-set scoping; it is not an authority source.
- File memory (`CLAUDE.md` and `MEMORY.md`) remains Layer 1 and is the fallback
  when external memory is unavailable.

## Recall routing

- Prefer Cognee for durable dev-memory recall. Use `graphiti-memory` only for
  historical reads while the decision log's write freeze and decommissioning
  milestone remain in force.
- Start or recover the historical Graphiti read proxy with
  `bun run graphiti:proxy` or `bun run graphiti:proxy:ensure`.
- Graphiti reads scope `group_ids` to `beep_dev`: pass `["beep_dev"]` when the
  tool accepts an array, or the JSON array string `"[\"beep_dev\"]"` when its
  wrapper exposes a string field. Never pass the scalar string `"beep_dev"`.

## Session continuity

- Keep the MCP/tool surface stable within a session. Continue related work on
  an existing subagent and avoid idle gaps over ~5 minutes when preserving the
  prompt cache matters; that interval is an operational cache TTL, not an
  architecture guarantee.
```

The command aliases are grounded at `package.json:367-368`; payload variants at
`.claude/skills/mcp-graphiti-memory/SKILL.md:23-38`; profile, ownership, and lifecycle boundaries at
`standards/memory-architecture/04-decision-log.md:26-32,53-58`.

## 3. REPLACEMENT AGENT MEMORY SECTION

This replacement preserves the three stable memory facts and existing fallback while pointing operations to the standard
(`AGENTS.md:76-95`; `standards/memory-architecture/04-decision-log.md:26-32`).

```markdown
## Agent Memory

- Cognee is the durable always-on dev-memory; file memory (`CLAUDE.md` /
  `MEMORY.md`) remains Layer 1; `graphiti-memory` is write-frozen.
- See `standards/memory-architecture/` for all memory decisions and operational
  detail.
- If memory is unavailable in-session, fall back to repo-local docs, code
  search, and this file.
```

The Tool Routing bullet should simultaneously contract to:

```markdown
- effect v3↔v4 differences: prefer the `effect-v4-imports` skill.
```

This removes its remaining Graphiti operational route (`AGENTS.md:97-101`).

## 4. THREE LAWS

**Quality Operator — after the Docgen bullet (`AGENTS.md:55-57`):**

```markdown
- Attribute verification failures before repairing — introduced / inherited /
  unrelated / environment-only; attribution decides fix vs rebase vs report,
  not blind rerun.
```

Evidence: requested in 6 reflections and complements the current Yeet green promise
(`explorations/agent-effectiveness-pulse/research/2026-07-13-agents-md-preaudit.md:46-54`).

**Docs & Knowledge — after the exploration graduation rule (`AGENTS.md:72-74`):**

```markdown
- same-PR packet-state flips: flip goal manifest/lifecycle status and land the
  closeout reflection in the same PR as the final work.
```

Evidence: requested in 11 reflections
(`explorations/agent-effectiveness-pulse/research/2026-07-13-agents-md-preaudit.md:48-50,68-74`).
The framing is ergonomics, not drift prevention: H4 was refuted at 3/90 mismatches; H9 was partial at 18/47 atomic
closeouts with only a small, non-causal later-touch difference
(`explorations/agent-effectiveness-pulse/research/pulse-report.md:66-78`;
`explorations/agent-effectiveness-pulse/research/pulse/closeout-hypotheses.md:8-16,48-55,277-303`).

**Context Economy — after the retained subagent-reuse rule (`AGENTS.md:116-117`):**

```markdown
- Durable on-disk handoffs: agent/session transitions exchange deliverables as
  files on disk (packet `research/`, scratchpad), never chat-only summaries.
```

Evidence: 10 reflections mention subagents or handoffs, and the synthesis finds durable artifacts uncodified
(`explorations/agent-effectiveness-pulse/research/2026-07-13-agents-md-preaudit.md:55-58,68-74`).

## 5. BYTE BUDGET

Live `wc -c AGENTS.md` is **5,840 bytes** across 117 lines (`AGENTS.md:1-117`). Applying exactly the drafts above,
including replacement of the cache-TTL clause with the retained subagent rule, gives:

```text
Removed/replaced originals:
  Agent Memory lines 76-95       1,162
  Tool Routing lines 99-101        160
  Context tail lines 116-117        147
  Total removed                  1,469 bytes

Added replacements and laws:
  Compact Agent Memory             346
  Compact Effect routing            68
  Subagent rule without TTL         102
  Attribution law                  176
  Same-PR law                      135
  Handoff law                      156
  Total added                      983 bytes

Estimated result: 5,840 - 1,469 + 983 = 5,354 bytes
Net delta: -486 bytes; headroom below ceiling: 486 bytes
```

The estimate counts the exact fenced AGENTS.md drafts including newlines; the acceptance ceiling is 5,840 bytes
(`goals/harness-hygiene-mechanical/SPEC.md:42-46,80-90`).

## 6. SKILLS DELETION MECHANICS

Removing only the four `skillSource` entries is insufficient
(`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:253-276`):

- **(a) Skill directories: no automatic deletion.** Write mode writes still-managed sources but has no unmanaged-dir
  removal pass (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:914-944`). Manually delete the four
  `.claude/skills/ponytail-{audit,debt,gain,help}` directories before update.
- **(b) `skills-lock.json`: not pruned while directories remain.** The desired lock enumerates installed directories
  and uses a local-source entry for names absent from the registry
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:511-541,680-731`). After directory deletion,
  update omits and prunes the entries (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:946-955`).
- **(c) `.codex/config.toml`: not pruned while directories remain.** Its managed block uses the same installed names
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:738-747,790-815`). After deletion, update rewrites
  the block without them (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:958-967`).
- **(d) `.agents/skills`: no separate cleanup.** The current mirror is a symlink to `../.claude/skills` (live
  `readlink .agents/skills`; `.agents/skills:1`) and currently exposes all four, confirmed at
  `.claude/skills/ponytail-audit/SKILL.md:2`, `.claude/skills/ponytail-debt/SKILL.md:2`,
  `.claude/skills/ponytail-gain/SKILL.md:2`, and `.claude/skills/ponytail-help/SKILL.md:2`. Removing the targets removes
  them from the mirror. If the mirror drifts, update replaces the whole surface with the symlink, not individual skills
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:817-856,970-975`).

Safe order: remove the four registry entries and four `.claude/skills` directories manually, then run
`bun run beep skills update` to prune lock/config and validate the mirror. It was not run in this research lane
(`goals/harness-hygiene-mechanical/SPEC.md:32-40,70-78`).

## 7. REFERENCE SCAN

Command run exactly as requested:

```sh
rg -n --hidden "ponytail-(audit|debt|gain|help)" \
  --glob '!.git/**' --glob '!explorations/**' --glob '!goals/**' .
```

Every hit is a **provisioning surface**; there are **no consumer hits**:

- `.codex/config.toml:60,63,66,69` — four managed skill config names.
- `skills-lock.json:83,88,90,95,97,102,104,109` — four lock keys and four
  upstream `skillPath` values.
- `.claude/skills/ponytail-audit/SKILL.md:2,8,41` — the skill directory itself.
- `.claude/skills/ponytail-debt/SKILL.md:2,7,43` — the skill directory itself.
- `.claude/skills/ponytail-gain/SKILL.md:2,6,35,36,44` — the skill directory
  itself, including its links to sibling retiring skills.
- `.claude/skills/ponytail-help/SKILL.md:2,5,30,31,32,33,35` — the skill
  directory itself, including its internal inventory.
- `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:254,257,260,263,266,269,272,275`
  — the four remote registry names and paths.

The scan found no hook, plugin manifest, documentation, or surviving-skill consumer; no consumer triggers the stop condition
(`goals/harness-hygiene-mechanical/SPEC.md:56-58,92-97`).
