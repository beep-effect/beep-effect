# T3 — Delivery Vector Feasibility

**Track:** T3 (load-bearing) · **Date:** 2026-08-04 · **Method:** official docs + local install verification + 6 live headless probes

---

## 0. Bottom line

Three findings change the design premise.

1. **The premise handed to this track is false.** `.claude/hooks/law-pulse.sh` prints plain text
   on stdout from a `PostToolUse` hook and exits 0. **That text never reaches the model.** I proved
   this by asking the model. A push channel into a running agent exists — but the repo is not
   currently using it. Fixing law-pulse is a two-line change and a prerequisite for everything else.

2. **A true external-process → live-session push vector exists and I verified it works:**
   `asyncRewake` command hooks. A background process armed from a tool-loop hook can exit 2 at any
   later moment and its stderr is delivered to the model as a system reminder. Content is fully
   external; the hook is only the arming mechanism. **It does not work on `SessionStart`** (verified
   — it runs synchronously there and exit 2 degrades to a non-blocking error). It must be armed from
   a tool-loop event.

3. **Codex has hooks, but has no async anything.** Codex CLI 0.146.0 ships a stable, enabled hooks
   system with `additionalContext` injection on five events — so Codex agents *are* reachable
   ambiently, contrary to the worry in the brief. But `async` is explicitly parsed-and-ignored, so
   Codex has **no** external-push vector: delivery is strictly pull-at-next-tool-boundary. This is
   the real asymmetry, and it is narrower than feared.

**Worst-case latency, measured:** a bulletin is delivered at the **next model request**, which means
it waits for the longest in-flight tool call in the current batch. During a 30-minute test run under
`Bash`, a bulletin waits ~30 minutes in both harnesses. **No hook vector interrupts a running tool.**

---

## 1. Local install ground truth

| Fact | Value | Evidence |
|---|---|---|
| Claude Code version | `2.1.221` | `claude --version`; `/home/elpresidank/.local/bin/claude` → `/home/elpresidank/.local/share/claude/versions/2.1.221` |
| Codex CLI version | `codex-cli 0.146.0` | `codex --version` |
| Codex `hooks` feature | **stable, enabled** | `codex features list` → `hooks   stable   true` |
| Claude user settings | no hooks block | `/home/elpresidank/.claude/settings.json` |
| Claude project settings | one `PostToolUse` hook on `Edit\|Write` | `/home/elpresidank/YeeBois/projects/beep-effect5/.claude/settings.json` |
| Repo Codex config | `.codex/config.toml`, **no `hooks.json`** | `/home/elpresidank/YeeBois/projects/beep-effect5/.codex/config.toml` |
| Codex hooks were once used here | `[hooks.state]` holds trusted hashes for `pre_tool_use` in beep-effect, 2, 3, 5, 6, 7 — files now deleted | `/home/elpresidank/.codex/config.toml:1598-1620` |
| Live fleet, right now | 6 interactive + 3 background sessions across 8 clones | `claude agents --json` |

`.claude/settings.json` denies `Edit(**/.claude/settings.json)` — hook changes need an explicit
human edit or a permission carve-out. Worth knowing before designing anything that self-installs.

---

## 2. THE DELIVERY LAW (empirically established)

Two separate transcript attachment types exist, and only one is context:

| Attachment type | Produced by | Model sees it? |
|---|---|---|
| `hook_success` | any hook exiting 0 (records stdout/stderr) | **No** — transcript/debug bookkeeping |
| `hook_additional_context` | `hookSpecificOutput.additionalContext` on a supporting event | **Yes** — wrapped as a system reminder |
| `hook_blocking_error` | exit 2 (stderr as reason), incl. `asyncRewake` | **Yes** |
| `hook_non_blocking_error` | exit ≠ 0,2 — or exit 2 on an event that cannot block | **No** |

### Probe A — plain stdout vs additionalContext

Identical `PostToolUse` matcher `Write`, two hooks, two sentinels. Model asked to report both.

```
plain codename = UNKNOWN
json codename  = BETA-222
```

Transcript confirms the mechanism:

```
line 11: attachment.type="hook_success"            content="The plain codename is ALPHA-111."
line 13: attachment.type="hook_additional_context" content=["The json codename is BETA-222."]
```

The plain hook produced **only** a `hook_success` record. No `hook_additional_context` line was
emitted for it. Repro dir: `…/scratchpad/hooktest2/`.

This matches the docs exactly — "For most events, stdout is written to the debug log but not shown
in the transcript. The exceptions are `UserPromptSubmit`, `UserPromptExpansion`, and `SessionStart`,
where stdout is added as context that Claude can see"
(https://code.claude.com/docs/en/hooks, *Exit code output*).

### Consequence: law-pulse.sh is a no-op

`/home/elpresidank/YeeBois/projects/beep-effect5/.claude/hooks/law-pulse.sh` is a `PostToolUse` hook
that ends with:

```bash
echo "law pulse: schema-first models · typed errors/tagged unions · …"
```

`PostToolUse` + plain stdout + exit 0 → `hook_success` only. **The laws have not been reaching the
model since adoption (2026-07-05, `goals/agent-pipeline-velocity` C4).** The counter file increments,
the hook runs, the transcript records it, the model never reads it.

Fix (keeps every other property of the script):

```bash
if (( n % 5 == 0 )); then
  jq -nc --arg c "law pulse: schema-first models · typed errors/tagged unions · …" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext:$c}}'
fi
```

This is a standalone bug report independent of fleet coordination, and it is the single cheapest
win found in this track.

---

## 3. Capability matrix — Claude Code 2.1.221

`inject` = can put text in front of the model. `block` = can stop the action. Latency is measured
from "bulletin file written" to "model reads it". Token cost is per injection (see §5).

| Event | Injects into model | Channel | Blocks | Cadence / latency | Matcher | Fit for fleet |
|---|---|---|---|---|---|---|
| `SessionStart` | **yes** | plain stdout **or** `additionalContext` | no | once/session; 0s at launch | `startup\|resume\|clear\|compact\|fork` | **Ambient digest.** Best cost/benefit. Also emits `watchPaths`, `sessionTitle`, `initialUserMessage`, `reloadSkills` |
| `Setup` | yes | `additionalContext` | no | `--init-only` / `-p --init` only | `init\|maintenance` | CI only, not the fleet |
| `UserPromptSubmit` | **yes** | plain stdout **or** `additionalContext` | **yes** (erases prompt) | once/turn; ≤ user think-time | none | **Cheap re-pulse.** 30s timeout |
| `UserPromptExpansion` | yes | plain stdout / `additionalContext` | yes | on `/command` expansion | command name | Per-skill gating |
| `PreToolUse` | **yes** | `additionalContext` | **yes** (`permissionDecision:"deny"`), can rewrite via `updatedInput` | every tool call; ~0s | tool name + `if:` rule | **JIT collision warning — the only pre-write vector** |
| `PermissionRequest` | no | — | yes (`decision.behavior`) | on permission need | tool name | Silent enforcement lane |
| `PermissionDenied` | no | — | no (`retry:true` only) | auto-mode denials | tool name | — |
| `PostToolUse` | **yes** | `additionalContext`, `updatedToolOutput` | yes (blocks result) | every tool call; ~0s | tool name + `if:` | Post-hoc notice; **current law-pulse site** |
| `PostToolUseFailure` | yes | same as PostToolUse | yes | on tool error | tool name | — |
| `PostToolBatch` | **yes** | `additionalContext` | yes (halts loop) | once per parallel batch; ~0s | none | **Best gated ambient site** — fires once per batch, not per tool |
| `Notification` | no | — | no | on notification | 8 types incl. `idle_prompt`, `agent_completed` | Outbound only |
| `MessageDisplay` | no (display only) | `displayContent` | no | while text streams | none | Human-facing only. 10s timeout |
| `SubagentStart` | yes | `additionalContext` | no | on spawn | agent type | Brief children |
| `SubagentStop` | yes | `additionalContext` | **yes** | on finish | agent type | — |
| `TaskCreated` / `TaskCompleted` | no | — | **yes** (rollback / block) | on task ops | none | **Claim-gate candidate** |
| `Stop` | **yes** | `additionalContext` | **yes** (continues turn) | once/turn end | none | **End-of-turn bulletin; can force a re-plan** |
| `StopFailure` | no | — | no | API error | error type | — |
| `TeammateIdle` | no | — | yes | teammate idling | none | Agent-teams only |
| `InstructionsLoaded` | no | — | no | CLAUDE.md load | load reason | Observability |
| `ConfigChange` | no | — | yes | settings change | config source | Tamper detection |
| `CwdChanged` | no | — | no | `cd` | none | Emits `watchPaths` |
| `DirectoryAdded` | no | — | no | `/add-dir` | add method | — |
| `FileChanged` | **no** | — | no | on watched-file change | **literal filenames only** | **Trap — see §4.2** |
| `WorktreeCreate` / `WorktreeRemove` | no | (stdout = path) | create: **any non-zero aborts** | worktree ops | none | Claim-on-worktree candidate |
| `PreCompact` / `PostCompact` | no | — | PreCompact: yes | compaction | `manual\|auto` | Re-pulse after compaction |
| `Elicitation` / `ElicitationResult` | no | — | yes | MCP elicitation | server name | — |
| `SessionEnd` | no | — | no | termination | 6 reasons | **Claim release.** 1.5s budget, ≤60s |

**Exit codes** (https://code.claude.com/docs/en/hooks#exit-code-output):
`0` = success, JSON parsed from stdout. `2` = blocking error, stdout and JSON ignored, **stderr fed
to Claude**. **Any other non-zero = non-blocking error, the action proceeds** — exit 1 does *not*
block. Only `WorktreeCreate` aborts on any non-zero.

**Universal JSON output on exit 0:** `continue`, `stopReason`, `suppressOutput`, `systemMessage`
(user-visible warning, not model context), `terminalSequence` (OSC 0/1/2/9/99/777 + BEL only),
`hookSpecificOutput.{hookEventName, additionalContext}`.

**Config precedence:** `~/.claude/settings.json` (user) → `.claude/settings.json` (project, committed)
→ `.claude/settings.local.json` (gitignored) → managed policy → plugin `hooks/hooks.json` → skill/agent
frontmatter. **Hooks merge across levels rather than replace** — every level's hooks run. Identical
handlers are deduplicated (command hooks by command+args, HTTP by URL). All matching hooks run in
parallel.

**Matcher grammar:** `*`/`""`/omitted = match all. Only letters/digits/`_`/`-`/space/`,`/`|` →
exact-string or separated list. Any other character → **unanchored JS regex** (`Edit.*` also matches
`NotebookEdit`; use `^Edit$`). MCP tools are `mcp__<server>__<tool>`; plugin-bundled are
`mcp__plugin_<plugin>_<server>__<tool>`.

**Persistence:** injected text is saved in the session transcript and **replayed verbatim** on
`--continue`/`--resume` rather than re-running the hook. Timestamps and SHAs in a bulletin go stale
on resume. Only `SessionStart` re-runs (with `source: "resume"`). **Design bulletins as
epoch-stamped facts, not "as of now" statements.**

**Size cap:** any injected string > 10,000 chars is written to a file and replaced by path + preview.

---

## 4. The design questions, answered

### 4.1 Ambient fleet digest → `SessionStart`, re-pulsed by gated `PostToolBatch`

`SessionStart` is the only once-per-session event that injects, costs nothing per tool call, and
re-runs on resume (so it self-refreshes across `--continue`). Plain stdout works here, so the hook
can be a one-liner `cat`.

Because within-session decay is the documented reason law-pulse exists at all, pair it with a
**gated** `PostToolBatch` hook: read a single bulletin epoch file, emit nothing unless the epoch
changed since this session last saw it. `PostToolBatch` fires **once per parallel batch** rather
than once per tool, which is 2-5× cheaper than `PostToolUse` for the same coverage, and the docs
name it as "the right place to inject context that depends on the set of tools that ran."

Steady-state token cost when nothing changed: **zero** (hook exits 0 with no output).

### 4.2 Just-in-time collision warning → `PreToolUse` with `if:`. Yes, there is a pre-write path.

`PostToolUse` fires after the edit — too late. **`PreToolUse` fires before the tool call executes and
can deny it**, which is exactly the mutual-exclusion primitive Mode A needs:

```json
{"hooks":{"PreToolUse":[{"matcher":"Edit|Write","hooks":[
  {"type":"command","command":"${CLAUDE_PROJECT_DIR}/.claude/hooks/claim-check.sh","args":[]}]}]}}
```

Three response strengths, all available:

| Response | Effect |
|---|---|
| `permissionDecision:"deny"` + reason | hard block, reason shown to the model |
| `permissionDecision:"ask"` | escalates to the human — good for a soft claim |
| `additionalContext` alone (no decision) | pure warning, edit proceeds |

`PreToolUse` receives full `tool_input`, so `claim-check.sh` gets `file_path` for `Edit`/`Write` and
`command` for `Bash` and can consult a flock'd claim directory in <5ms.

**`if:` narrows the spawn**, so the hook process is not paid on every edit:
`"if": "Edit(packages/tooling/tool/cli/**)"`. Note `Edit(src/**)` matches only top-level `src`;
`Edit(**/src/**)` matches at any depth (v2.1.214+).

**Do not use `FileChanged` for this.** It looks perfect and is a trap on three counts:
its matcher registers **literal filenames in the working directory** (`^\.env` would watch a file
literally named `^\.env`), it uses a narrower exact-match set (letters/digits/`_`/`|` only — no
hyphens, spaces, commas), and per the decision-control table it has **no injection and no decision
control** at all. It fires your script; it cannot tell the model anything.

### 4.3 Reaching a session mid-long-running-task → `asyncRewake`, with a measured ceiling

**Verified working.** `PostToolUse` hook, `asyncRewake: true`, sleeps then exits 2 with stderr:

```
rewake codename = DELTA-444
```

Stream ordering proves it ran in the background — an `assistant` tool_use is issued *between*
`hook_started` and `hook_response`, so the agent kept working:

```
system hook_started   PostToolUse:Write
assistant                               ← agent continued, hook still running
system hook_progress  PostToolUse:Write
system hook_response  PostToolUse:Write  exit_code=2
user                                    ← reminder delivered
```

Docs: *"If `true`, runs in the background and wakes Claude on exit code 2. Implies `async`. The
hook's stderr, or stdout if stderr is empty, is shown to Claude as a system reminder"*
(https://code.claude.com/docs/en/hooks, command-hook fields) and *"Hook output is delivered on the
next conversation turn. If the session is idle, the response waits until the next user interaction.
**Exception: an `asyncRewake` hook that exits with code 2 wakes Claude immediately even when the
session is idle.**"*

**Two verified limits:**

**(a) `asyncRewake` does not work on `SessionStart`.** Probe 3: the 6-second hook ran
**synchronously** — `hook_started`/`hook_response` both landed *before* `system init` — and exit 2
was recorded as `hook_non_blocking_error`. The model reported `UNKNOWN`. Arming must happen at a
tool-loop event (`PreToolUse`/`PostToolUse`/`PostToolBatch`), which means **a session that has not
yet made a tool call is unreachable.**

**(b) It does not interrupt an in-flight tool call.** Probe 5 timeline, 5s hook against a ~40s ping:

```
15:57:39.688  assistant tool_use  (Write)
15:57:40.132  assistant tool_use  (ping -c 40)      ← same batch
15:57:44.698  attachment hook_blocking_error         ← rewake fired at T+5s
15:58:25.159  user tool_result    (ping finished)    ← ~40s later
15:58:26.540  assistant                              ← model finally reads it
```

The reminder was *recorded* at T+5s but *read* at T+46s. **Worst-case latency = duration of the
longest in-flight tool call**, because that is when the next model request happens.

**Honest latency table:**

| Session state | Bulletin → model | Vector |
|---|---|---|
| Idle at prompt | **immediate** | `asyncRewake` exit 2 |
| Mid agentic loop, short tools | **seconds** (next batch boundary) | `asyncRewake` or gated `PostToolBatch` |
| Blocked in one 30-min `Bash` | **~30 min** | none better exists |
| Not yet made a tool call | **unreachable** by rewake | `SessionStart` only |

**Operational caveat:** *"Each execution creates a separate background process. There is no
deduplication across multiple firings of the same async hook."* Arming from `PostToolUse` means one
watcher process per edit. A pidfile/flock singleton guard in the script is mandatory, and the
re-arm must be idempotent.

### 4.4 Is there a non-hook external push? Honestly: no, with three partial exceptions.

I looked for one and did not find it. Everything that reaches a live interactive session goes
through the hook dispatcher. The three near-misses:

1. **`asyncRewake` (§4.3)** — the hook is only the *arming* mechanism; the payload and its timing are
   fully external (block on `inotifywait`, exit 2 when a bulletin lands). This is the answer, but it
   still requires a hook to be configured up front and a tool call to arm it.
2. **`--input-format stream-json`** — a headless `-p` session accepts realtime streaming user
   messages on stdin. A real injection vector, but only for sessions launched that way. The fleet's
   interactive TUI sessions cannot use it.
3. **Remote Control** — this session carries
   `"bridgeSessionId":"session_01RZ4MmyzLJuginHTVcPTRdX"`
   (`/home/elpresidank/.claude/sessions/197785.json`), and hooks receive
   `CLAUDE_CODE_BRIDGE_SESSION_ID`. It injects into a live session, but routes the transcript through
   Anthropic servers, and needs a human sender. **`~/.claude/rules/oip-confidentiality.md` forbids it
   in any session touching OIP material.** Not a fleet mechanism.

MCP is pull-only: the model must call a tool. MCP server-initiated notifications are not routed
into context.

### 4.5 Free fleet inventory — already on disk

Unexpected find, directly useful: `claude agents --json` returns a live machine-readable roster with
no TTY requirement.

```json
{"pid":197785,"cwd":"…/beep-effect5","kind":"interactive","status":"busy","name":"beep-effect5-37",
 "sessionId":"56137bb3-…"}
```

Live right now: **6 interactive + 3 background** sessions across beep-effect, 2, 3, 5, 6, 8, 10 and
effect-jetbrains-plugin. Backing store is `~/.claude/sessions/<pid>.json`, updated live with
`status` and `statusUpdatedAt`.

**The Claude half of the fleet needs no session registry — one already exists.** A bulletin poster
can enumerate exactly which clones are running, whether each is `busy` or idle, and target the
per-clone bulletin drop accordingly. Codex has no equivalent (`~/.codex/sessions/` is a rollout
archive, not a live roster).

---

## 5. Token cost, measured

Method: identical prompt/model (`haiku`), varying only `additionalContext` length, comparing
`cache_creation_input_tokens` on the post-hook assistant message.

| additionalContext | cache_creation | Δ vs baseline |
|---|---|---|
| none (no hook) | 377 | — |
| 43 chars | 403 | **+26** |
| 966 chars | 540 | **+163** |

Marginal: `(540-403)/(966-43)` ≈ **0.15 tokens/char** (~6.5 chars/token). Fixed system-reminder
wrapper: **~15 tokens**. A 462-char run measured +228, well off the line — cache-boundary noise is
roughly ±50 tokens, so treat these as order-of-magnitude.

**Practical numbers:**

| Payload | ≈ cost |
|---|---|
| Silence (gated hook, no change) | **0** |
| 1-line collision warning (~120 chars) | **~35 tokens** |
| Current law-pulse string (180 chars) | **~45 tokens** |
| 5-line fleet digest (~500 chars) | **~90 tokens** |
| Hard cap before spill-to-file | 10,000 chars |

At 13 clones × ~90 tokens per SessionStart, a fleet digest costs **~1.2k tokens per full fleet
restart** — negligible. The cost that matters is a *per-tool-call* injection: at ~35 tokens on every
`PostToolUse` over a 200-edit session that is 7k tokens of pure repetition. **Gate on an epoch file
and emit nothing when nothing changed** — this is the difference between a viable and a wasteful
design, and it is one `[ "$seen" = "$epoch" ] && exit 0` away.

---

## 6. Part 2 — Codex CLI 0.146.0

Docs: https://developers.openai.com/codex/hooks (→ https://learn.chatgpt.com/docs/hooks).
Feature `hooks` is **stable and enabled** on this machine.

### 6.1 Codex capability matrix

| Event | Injects | Channel | Blocks | Matcher |
|---|---|---|---|---|
| `SessionStart` | **yes** | plain stdout **or** `additionalContext` | no | `startup\|resume\|clear\|compact` |
| `UserPromptSubmit` | **yes** | `additionalContext` | yes | **not supported** |
| `PreToolUse` | **yes** | `additionalContext` | **yes** (`permissionDecision`, `updatedInput`) | tool name |
| `PostToolUse` | **yes** | `additionalContext` (plain stdout **ignored**) | yes (replaces tool result) | tool name |
| `PermissionRequest` | no | `systemMessage` only | yes | tool name |
| `SubagentStart` | yes | `additionalContext` | no | agent type |
| `SubagentStop` | no | — | yes | agent type |
| `Stop` | no `additionalContext` | **`decision:"block"` + `reason` becomes a new user prompt** | yes | **not supported** |
| `PreCompact` / `PostCompact` | no | — | PreCompact: yes | `manual\|auto` |
| `SessionEnd` | no | — | advisory only | `other` |

**Config discovery:** `~/.codex/hooks.json`, `~/.codex/config.toml` (`[hooks]` inline),
`<repo>/.codex/hooks.json`, `<repo>/.codex/config.toml`, plus plugin-bundled. All matching sources
load; higher layers do not replace lower ones. **Project-local hooks load only when the `.codex/`
layer is trusted**, and non-managed command hooks require an interactive trust review keyed by
`sha256` (this is why `~/.codex/config.toml:1598-1620` holds `trusted_hash` entries for the
now-deleted per-clone `hooks.json` files — the fleet used to run Codex hooks and stopped).

**Tool coverage is broader than the third-party write-ups claim.** `PreToolUse`/`PostToolUse` cover
shell (`Bash`), unified exec, `apply_patch` (matchable as `apply_patch`, `Edit`, or `Write`), MCP
tools, and local function tools like `update_plan`. Only hosted tools (`WebSearch`) are excluded.
Blog posts saying "Bash only" are stale.

**Size cap:** ~2,500 tokens per model-visible hook message, tunable per handler with
`additionalContextLimit`; overflow spills to `<temp_dir>/hook_outputs/<session_id>/<uuid>.txt` with a
head-and-tail preview.

### 6.2 The constraint that matters

> **"The `async` option is parsed, but asynchronous command hooks aren't supported yet."**
> — https://learn.chatgpt.com/docs/hooks, config-shape notes

Also: `prompt` and `agent` handler types are parsed but skipped — **command hooks only**.

**Therefore Codex has no external-push vector.** Every hook is synchronous and inline. Codex agents
are reachable only when they cross a hook boundary of their own accord.

But the brief's worst case — "Codex agents can only be reached at gate time via `beep yeet`" — is
**too pessimistic**. Codex fires `PreToolUse`/`PostToolUse` on every shell command and every
`apply_patch`, so a working Codex agent crosses an injectable boundary every few seconds. The real
statement is: **Codex delivery is pull-at-next-tool-boundary with no idle-session wake and no
mid-tool interrupt.** For Mode A (pre-write collision block) Codex is fully capable via `PreToolUse`.
For Mode B (broadcast to an idle or long-blocked session) Codex has a hole that Claude's
`asyncRewake` partially fills.

**`Stop` is Codex's strongest lever and has no Claude equivalent in kind:** `decision:"block"` +
`reason` *"automatically creates a new continuation prompt that acts as a new user prompt, using
your `reason` as that prompt text."* That is a full re-tasking channel at turn end — strictly more
powerful than Claude's `Stop` `additionalContext`.

### 6.3 Codex `notify` — outbound only

`notify` is `array<string>`: *"Command invoked for notifications; receives a JSON payload from
Codex"* (https://learn.chatgpt.com/docs/config-file/config-reference). It is Codex → world, not
world → Codex. Also **ignored in project-local `.codex/config.toml`** (along with `otel`, `profile`,
`model_providers`) — it must live in user-level config. Not set on this machine.

### 6.4 Unverified lead

`codex app-server proxy` — *"Proxy stdio bytes to the running app-server control socket"* — plus
`codex remote-control` and `codex exec-server` suggest a local control plane that could accept
injected turns. But `codex features list` reports `remote_control  removed  false`, and interactive
TUI sessions are not necessarily attached to the daemon. **Flagging as unexplored, not as a
capability.** Worth a follow-up probe if Codex-side push turns out to be load-bearing.

### 6.5 AGENTS.md re-reading

No documented mid-session re-read. `SessionStart` matcher `compact` is the one documented refresh
point: after compaction *"Codex delivers the hook's additional context to the immediate continuation
instead of waiting for a later user turn."* Treat `AGENTS.md` as start-of-session only.

---

## 7. Part 3 — The gate vector (`bun run beep yeet`)

`bun run beep yeet` is an ordinary process every agent runs before pushing. Subcommands live at
`/home/elpresidank/YeeBois/projects/beep-effect5/packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:318-403`:
`verify`, `repair`, `publish`, `monitor`, `closeout`, `status`, `pre-push-hook`, plus fallow/plan
checks.

**Properties as a delivery vector:**

| Property | Value |
|---|---|
| Delivery guarantee | **100%** — no hook config, no version drift, harness-agnostic |
| Reaches Codex sessions | **yes**, identically to Claude |
| Reaches a session mid-long-task | no |
| Can block | **yes, absolutely** — non-zero exit stops the publish |
| Token cost | ~0 ambient; the agent reads output it already asked for |
| Latency | **late** — only at push time |
| Bidirectional | **yes** — the only vector where the agent's *own* state is naturally reported |

**What late delivery fixes and fails:**

| Mode | Verdict |
|---|---|
| **A — duplicate work** | **Fails at the objective, succeeds at the symptom.** Both agents have already spent the tokens by the time either reaches `yeet`. The gate can detect the collision and stop the second PR from opening, which saves the merge conflict and the review cycle — but not the duplicated spend. Mode A needs `PreToolUse`. |
| **B — in-flight base churn** | **Genuinely fixes the outbound half.** `yeet publish` is exactly where a repo-wide policy change should be announced *before* it merges, and it is the one place a mandatory hold is enforceable. It cannot fix the inbound half — an agent already 40 minutes into a branch learns at push time, having already built on a doomed base. |

**The asymmetry to design around:** `yeet` is the only place where a claim can be *registered* with
certainty (every agent passes through it) but the *worst* place to *learn* about someone else's
claim. Register at the gate; deliver via hooks.

`yeet pre-push-hook` already exists as a git-hook entry point — a natural place for claim
registration and release that requires no new command surface.

---

## 8. Recommended vector assignment by urgency class

| Class | Example | Claude vector | Codex vector | Latency | Cost |
|---|---|---|---|---|---|
| **U0 — Must not proceed** | "another clone holds a claim on this file" | `PreToolUse` (`Edit\|Write` + `if:`) → `permissionDecision:"deny"` | `PreToolUse` → `permissionDecision:"deny"` | **before the write** | ~30 tok on hit, 0 otherwise |
| **U1 — Must know now** | "the lint policy you depend on merges in 10 min" | `asyncRewake` armed from `PostToolUse`, exit 2 with bulletin | **none** — falls back to U2 | idle: instant · looping: seconds · mid-30-min-tool: 30 min | ~50 tok |
| **U2 — Know by next action** | "3 clones now failing on the same gate" | gated `PostToolBatch` `additionalContext` | gated `PostToolUse` `additionalContext` | next tool batch | 0 when unchanged |
| **U3 — Ambient orientation** | "who owns what right now" | `SessionStart` (plain stdout) | `SessionStart` (plain stdout) | session start + resume | ~90 tok/session |
| **U4 — Turn-boundary steering** | "re-plan, your base moved" | `Stop` + `additionalContext` / `decision:"block"` | `Stop` + `decision:"block"` → **becomes a new user prompt** | end of turn | ~60 tok |
| **U5 — Guaranteed, blocking** | "claim registration; policy hold" | `beep yeet` non-zero exit | same | push time | 0 |
| **Claim release** | agent finished / died | `SessionEnd` (1.5s budget) + `yeet closeout` + pid liveness from `~/.claude/sessions/*.json` | `SessionEnd` (1s budget) | on exit | 0 |

**Minimum viable channel set** — three hooks and one CLI change:

1. `SessionStart` → digest (plain stdout, one `cat` of a shared bulletin file).
2. `PreToolUse` on `Edit|Write` with `if:` narrowing → claim check against a flock'd shared dir,
   `deny` or `ask`. This is the Mode A fix and the only pre-write vector in either harness.
3. `PostToolBatch` (Claude) / `PostToolUse` (Codex) → epoch-gated re-pulse, silent by default.
   Fold the law-pulse fix into this hook rather than keeping two.
4. `yeet pre-push-hook` / `publish` → claim register + release + policy-change hold.

Add `asyncRewake` (Claude only) **only if** U1 turns out to be real. It is the most complex piece —
singleton guard, re-arm logic, cannot be armed at `SessionStart` — and everything else works without
it.

**Every one of these is a shell script over a shared local directory + flock.** Nothing in this
capability map argues for a broker, a daemon, or a database. The delivery vectors are free; the only
new machinery needed is the claim file format and the epoch counter.

---

## 9. Evidence appendix

**Docs cited**
- https://code.claude.com/docs/en/hooks — full reference (raw markdown mirror:
  `…/scratchpad/hooks.md`, 244,625 bytes, retrieved 2026-08-04)
- https://code.claude.com/docs/en/hooks-guide — async hooks guidance
- https://developers.openai.com/codex/hooks → https://learn.chatgpt.com/docs/hooks
  (raw: `…/scratchpad/codex-hooks-try.md`, 39,235 bytes)
- https://learn.chatgpt.com/docs/config-file/config-reference — `notify` semantics

**Local files**
- `/home/elpresidank/.claude/settings.json` — no hooks; `defaultMode: auto`; model `opus[1m]`
- `/home/elpresidank/YeeBois/projects/beep-effect5/.claude/settings.json` — the one `PostToolUse` hook; `Edit(**/.claude/settings.json)` denied
- `/home/elpresidank/YeeBois/projects/beep-effect5/.claude/hooks/law-pulse.sh` — **the no-op**
- `/home/elpresidank/.codex/config.toml` — `[features]`, `[hooks.state]:1598-1620`, `[otel]`
- `/home/elpresidank/YeeBois/projects/beep-effect5/.codex/config.toml` — no hooks
- `/home/elpresidank/.claude/sessions/<pid>.json` — live per-session status
- `/home/elpresidank/YeeBois/projects/beep-effect5/packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:318-403`

**Probes** (all under `…/scratchpad/`, reproducible)

| # | Dir | Question | Result |
|---|---|---|---|
| 1 | `hooktest/` | does plain stdout produce a context attachment? | no — `hook_success` only; `additionalContext` → `hook_additional_context` |
| 2 | `hooktest2/` | does the *model* see plain stdout? | **`plain = UNKNOWN`, `json = BETA-222`** |
| 3 | `hooktest3/` | `asyncRewake` on `SessionStart`? | **no** — ran synchronously, `hook_non_blocking_error`, model `UNKNOWN` |
| 4 | `hooktest4/` | `asyncRewake` on `PostToolUse`? | **yes** — `DELTA-444`, agent kept working during the hook |
| 5 | `hooktest5/` | does rewake interrupt a running tool? | **no** — fired T+5s, read T+46s after ping finished |
| 6 | `cost-*/` | token overhead | ~15 tok fixed + ~0.15 tok/char |

Probe command shape:

```bash
cd "$T" && /home/elpresidank/.local/bin/claude -p "<prompt>" \
  --model haiku --permission-mode bypassPermissions --setting-sources project \
  --output-format stream-json --verbose --include-hook-events < /dev/null
```

`--include-hook-events` surfaces `system/hook_started|hook_progress|hook_response` telemetry — note
that a sentinel appearing in those lines proves **nothing** about model visibility. Only
`attachment.type == "hook_additional_context"` (or `hook_blocking_error`) in
`~/.claude/projects/<slug>/<session>.jsonl` does. That distinction is what separates this track's
finding from the assumption it replaced.

**Two gotchas worth recording:** `--setting-sources project` is required or the probe silently
inherits the user's real settings; and `command claude` is a zsh function, unavailable in the Bash
tool's shell — probes must use the absolute binary path.
