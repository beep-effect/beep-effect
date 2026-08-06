# T1 — Prior Art: Does a purpose-built solution already exist?

**Scope:** tools that coordinate multiple *independent, OS-level* AI coding agent
sessions working in *parallel checkouts of one repository*, on **one machine**.
Distributed/multi-host designs are out of scope per the brief.

**Date of sweep:** 2026-08-04. All star counts / archived flags / last-push dates
below are from the GitHub REST API on that date, not from scraped pages.

---

## Verdict up front

**ADAPT.** Split the problem — the market has solved half of it, and the half it
solved is not the half that's hard here.

1. **Mode A (duplicate work) is a solved category — but solved for the wrong
   granularity.** Six-plus tools ship file-level advisory reservations, claims,
   and heartbeats. None of them claim *work items* ("the broken thing on main").
   Two agents fixing the same breakage often touch **different** files (one edits
   the rule, one edits the callsites), so file reservations do not fire and the
   duplicate spend still happens. The tools that *do* claim work items
   (Beads, Gastown) are issue trackers that want to own the agent lifecycle.

2. **Mode B (in-flight base churn) is genuinely unbuilt as a notification
   problem.** I found no tool that broadcasts "a repo-wide policy just landed on
   main" into running agents. The only prior art is *mechanical immunity* via
   merge queue (GitHub native; Gastown's Bors-style "Refinery"), which changes
   *when* you discover the breakage, not whether the agent is told.

3. **The binding constraint is delivery, and almost the entire field fails it.**
   Nearly every candidate is **pull-based**: the agent must call an MCP tool or
   run a CLI to learn anything. That is exactly the failure mode the brief rules
   out. Precisely **one** mature tool has push delivery into a running agent
   (`hcom`), and **one** immature tool has it via hooks (`mclaude`, 6 stars).

**Concrete recommendation:** buy `hcom` as the *transport* (MIT, Rust, single
binary, mid-turn context injection, wakes idle agents, supports Claude Code
**and** Codex CLI — the fleet is mixed). Build the *semantics* — work-item claims
keyed to repo concepts, and a Mode-B broadcast fired from `beep yeet publish` —
as `beep` subcommands on top. Do **not** buy MCP Agent Mail, Gastown, or any
board/GUI product; see fall-short notes.

**The one thing worth paying for rather than building:** waking an *idle* agent.
A `PostToolUse`/`UserPromptSubmit` hook only fires while the agent is working. An
agent sitting at a prompt receives nothing. `hcom` solves this with PTY
injection (`hcom term`). That capability is real work to build and is the only
part of `hcom` that clearly beats the shell+flock+hook baseline.

---

## Verdict table

Legend — **Primitive**: what coordination it actually implements.
**Delivery**: `push` = information arrives in the agent's context unbidden;
`pull` = agent must call a tool/CLI. **Fit**: for a 13-clone, single-machine,
CLI-native, mixed Claude+Codex fleet.

| Tool | What it actually does | Primitive | Delivery | Own runtime / UI | License | Maturity (2026-08-04) | Cross-*clone*? | Fit |
|---|---|---|---|---|---|---|---|---|
| **hcom** (`aannoo/hcom`) | Shared message + event bus for agents across terminals; hooks write/read SQLite | messaging + event subscription + 30s collision *notification*; **no locks** | **push** (mid-turn injection between tool calls; wakes idle agents via PTY) | single Rust binary, no daemon; TUI optional | MIT | 418★, pushed 2026-07-30, active | **yes** — `~/.hcom` is global by default; `HCOM_DIR` is opt-*out* | **Best fit.** Transport only; semantics missing |
| **MCP Agent Mail** (`Dicklesworthstone/mcp_agent_mail`) | Identities, threaded inboxes, advisory file leases w/ TTL, pre-commit guard, task prioritization | **file reservations** (advisory, glob, TTL) + messaging | **pull** — "Agents only receive messages addressed to them"; agent must call MCP tools | `am` daemon + MCP server + TUI + web UI; 38 tools / 25 resources | NOASSERTION (site says MIT) | 2,068★ (Python), 118★ (Rust rewrite), pushed 2026-08-04 | one repo; "product bus" for cross-repo | Strong Mode A, **fails delivery**; very heavy |
| **Gastown** (`gastownhall/gastown`) | Full multi-agent workspace manager: beads issue tracking, convoys, watchdogs, Bors-style merge queue ("Refinery") | work-item claims + **merge queue** (bisecting batches) | pull (agents query beads) | **heavy** — Dolt + daemon + tmux services (`gt up`), spawns its own agents ("polecats") | MIT | 17,434★, pushed 2026-08-04, very active | yes, via "rigs" | Only tool touching **both** modes; **owns the lifecycle** → dealbreaker |
| **Beads** (`steveyegge/beads` → `gastownhall/beads`) | Git/Dolt-backed dependency-aware issue tracker as agent memory | work-item state (ready/claimed/done) + dependency graph | pull | CLI (`bd`), Dolt-backed | open source | ~20k★ class, very active | yes (travels in git) | Good **claim substrate**, zero delivery, zero Mode B |
| **swarm-protocol** (`phuryn/swarm-protocol`) | MCP coordination: Intent / Claim / Signal / Context Package; heartbeat flags stale claims | **claim + heartbeat + signal** — closest primitive match | pull — "Polling via MCP tools, no WebSocket subscriptions" | MCP server + **PostgreSQL** | MIT | 51★, **pushed 2026-03-15 (5 mo stale)**, alpha, 18 commits | one repo per team | Right idea, wrong delivery, effectively abandoned |
| **clash** (`clash-sh/clash`) | `git merge-tree` 3-way merges between worktree pairs; warns before you edit a conflicting file | conflict *detection*, 100% read-only; no claim | **push at edit time** (PreToolUse `Write\|Edit` hook) — but only when *you* edit | single Rust binary + CC plugin | MIT | 63★, pushed 2026-07-17 | **worktrees only, not clones** | Nice hook shape; wrong scope, no Mode A/B semantics |
| **session-collab-mcp** (`leaf76/session-collab-mcp`) | File **and symbol**-level claims, WIP registry, strict/smart/bypass conflict modes | file + symbol claims | pull — "requires explicit tool calls; no passive synchronization" | MCP server, SQLite in `~/.claude/` | MIT | **2★**, pushed 2026-07-28 | no | Best *granularity* idea (symbol claims), unusable maturity |
| **mclaude** (`AnastasiyaW/mclaude`) | 6 file-based layers: `O_CREAT\|O_EXCL` work locks + heartbeat, handoffs, messages, memory graph | **atomic work locks** (not file locks) | **push** — ships `session_start.py`, `pre_edit_lock_check.py`, `pre_commit_guard.py` hooks | none (Python stdlib only, plain files) | MIT | **6★**, pushed 2026-05-13, alpha v0.6.0 | no — "does not synchronize across git clones" | **Closest conceptual design**; unusably immature |
| **agent-message-queue** (`avivsinai/agent-message-queue`) | Maildir-style file message queue; `amq wake` terminal notifications | message queue + waitable handoffs | mostly pull (`amq drain`), experimental `wake` | none — files + Go binary | MIT | 79★, pushed 2026-08-04, 555 commits | **yes** — `AMQ_GLOBAL_ROOT` / absolute base roots | Honest minimal transport; no claims, no broadcast |
| **container-use** (`dagger/container-use`) | Container + branch per agent; isolation and visibility | **none** (isolation ≠ coordination) | pull (MCP) | Docker + Dagger | Apache-2.0 | 3,953★, pushed 2026-06-12 | n/a | Solves a problem this fleet doesn't have |
| **Vibe Kanban** (`BloopAI/vibe-kanban`) | Kanban board + web UI to run agents in parallel | board | pull, human-mediated | **web UI**, and Bloop shut down Apr 2026 (community-maintained) | Apache-2.0 | 27,662★, **pushed 2026-04-24 (stalled)** | n/a | GUI = dealbreaker; vendor gone |
| **claude-squad** (`smtg-ai/claude-squad`) | tmux + worktree TUI multiplexer | none | n/a | TUI | **AGPL-3.0** | 8,233★, pushed 2026-07-30 | worktrees | Multiplexer, not coordinator; AGPL |
| **Crystal / Nimbalyst** (`stravu/crystal`) | Desktop app, parallel sessions in worktrees | none | n/a | **desktop GUI** | MIT | 3,108★, pushed 2026-02-26 (renamed) | worktrees | GUI = dealbreaker |
| **Conductor** (Melty Labs) | Mac desktop app, parallel Claude Code w/ checkpoints | none | n/a | **macOS GUI** | proprietary | commercial | worktrees | Mac-only GUI; fleet is Linux CLI |
| **Sculptor** (`imbue-ai/sculptor`) | One Docker container per agent, sync back to local repo | none (isolation) | pull | Docker + app | MIT | 213★, pushed 2026-08-04 | n/a | Isolation, not coordination |
| **worktrunk / uzi / gwq / amux / agentree** | Worktree lifecycle managers for agent workflows | **none** | n/a | CLI | mixed | worktrunk 6,286★; uzi 581★ (**last push 2025-06-04**); gwq 460★ | worktrees | Pure ergonomics. Not in the running |
| **A2A / AGNTCY ACP / MCP-as-protocol** | Inter-*service* agent interop: discovery, auth, task delegation over network | RPC/messaging between agent *services* | n/a | network services | Apache-2.0 (Linux Foundation) | mature specs | n/a | **Wrong problem.** Nothing about repo file collision |
| **AutoGen GroupChat / CrewAI / LangGraph / OpenAI Agents SDK** | Task decomposition & handoff **inside one orchestrator process** | in-process handoff / graph edges | n/a | library | mixed | mature | n/a | **Irrelevant.** See dismissal below |
| **Cursor background agents / Devin parallel sessions / Codex Cloud / Jules / Amp subagents** | Cloud/parallel agent execution, branch + PR per agent | **none between agents** | n/a | hosted product | proprietary | GA 2026 | n/a | Explicitly do not coordinate; Amp: "you cannot orchestrate them or have them talk to each other" |
| **GitHub merge queue** | Tests each PR against latest main + queued PRs before merge | serialization / mechanical immunity | n/a (CI, not agent) | hosted | n/a | GA | n/a | **Real partial Mode B answer.** Discovers breakage; never *tells the agent* |

---

## Closest three, and why each falls short

### 1. `hcom` — right delivery, no semantics

`hcom` is the only tool in the sweep whose delivery model satisfies the hard
constraint, verbatim from its README:

> Hooks record activity to a local SQLite database and deliver messages from it.
> `agent → hooks → db → hooks → other agent`
>
> **Messages arrive mid-turn (injected between tool calls) or wake idle agents
> immediately.**
>
> Agents can subscribe to events and react instantly. **Collision detection is on
> by default: if two agents edit the same file within 30 seconds, both get
> notified.**
>
> **Any process can wake agents with `hcom send`.**

That last line is the Mode-B primitive nobody else has: a git `post-merge` hook,
or a step in `beep yeet publish`, can push "lint rule X landed, rebase before you
re-verify" into every live agent. Group addressing exists (`--tag <name>` →
agents addressed as `@tag`). Scope is **global by default** (`~/.hcom`);
`HCOM_DIR` is the opt-*out* for per-project isolation — so 13 clones share one
bus with zero configuration, and `--dir <path>` launches agents anywhere. Codex
CLI is a first-class supported tool alongside Claude Code, which matters because
the fleet is mixed.

**Where it falls short:**
- **No claims, locks, or leases.** Collision detection is *after the fact* and
  time-boxed to 30 seconds — useless for Mode A, where two agents start the same
  fix twenty minutes apart. It is a transport, not a coordinator.
- **No work-item concept.** Nothing to claim "I am fixing the broken gate."
- **Enrollment friction.** Agents are expected to be launched via `hcom claude` /
  `hcom codex`, or joined with `hcom start` run inside the tool, or resumed via
  `hcom r <session_id>` ("Resume a session started outside hcom"). Benjamin
  starts sessions with his own `claude`/`claudex`/`claudeg` wrappers; those
  wrappers would have to change. Not hard, but not zero.
- 418 stars is real but not battle-hardened; it installs hooks into `~/` config
  dirs, which collides conceptually with this repo's own hook governance.

### 2. MCP Agent Mail — right Mode-A semantics, fatally wrong delivery

The most complete Mode-A design found: project-scoped agent identities, threaded
inboxes, **advisory file leases** on glob patterns with TTL expiry, and a
`mcp-agent-mail-guard` **pre-commit hook that blocks commits touching files
reserved by other agents**. Stress-tested at 40–50 concurrent agents across mixed
providers. 2,068 stars, pushed today.

**Where it falls short:**
- **Pull-only, and by explicit design.** Its own docs: *"Agents only receive
  messages addressed to them"* — framed as a feature to avoid context-window spam.
  Information sits in SQLite until an agent calls an MCP tool. Against the brief's
  hard constraint ("LLM agents do not poll"), this is disqualifying as-is.
- **No broadcast, stated as a design decision.** So Mode B is architecturally
  excluded, not merely unimplemented.
- **Enormous surface for the value delivered:** a daemon, 38 MCP tools, 25 MCP
  resources, a 16-screen TUI, a web UI, 11 Rust crates. The brief's baseline is
  "a shared local directory + flock is available and free." This does not beat
  that baseline for two failure modes; it is a product.
- License is `NOASSERTION` on GitHub despite the site claiming MIT — worth
  resolving before adoption.
- MCP tool surface is exactly the thing this repo's Context Economy law tells you
  to keep small and stable.

### 3. Gastown — the only tool touching *both* modes, and it wants your whole fleet

Gastown (17,434★, pushed today, MIT, Go) is the only candidate that addresses
Mode A **and** Mode B in one system: git/Dolt-backed **beads** issue tracking
gives work-item-level claims, and the **Refinery** is a Bors-style merge queue
that batches merge requests, tests the batch, and *bisects to isolate the failing
MR* when the batch goes red. It supports multiple repos via "rigs."

**Where it falls short — and this is decisive:**
- **It owns the agent lifecycle.** Gastown *spawns* its agents ("polecats" with
  persistent identity and ephemeral sessions), supervised by a hierarchy of
  Witness / Deacon / Mayor / Dogs. Benjamin's fleet is 13 sessions **he** starts
  and drives, in clones he chose, with his own model-routing wrappers
  (`claude` / `claudex` / `claudeg` against different quota pools). Gastown's
  model is orthogonal to that and would have to replace it.
- **Heavy runtime:** `gt up` starts Dolt, a daemon, the Deacon, the Mayor,
  Witnesses, and Refineries, over long-lived tmux services. Requires Go 1.26.2+,
  tmux 3.0+, Beads 0.57.0+.
- **Its merge queue duplicates what GitHub already gives you.** This repo already
  has `main` PR-only behind ~24 required checks; GitHub's native merge queue is
  the cheap version of the Refinery and is already on the opportunities ledger
  ("evaluate GitHub merge queue").
- Coordination is still pull — agents query beads; nothing is pushed.

**Salvageable idea:** the *bead* — a git-backed, dependency-aware, claimable work
item — is the right shape for Mode A claiming, and Beads is usable standalone.

---

## Category dismissals (stated plainly, not padded)

**Multi-agent frameworks are irrelevant here.** AutoGen GroupChat, CrewAI,
LangGraph supervisor graphs, and OpenAI Agents SDK handoffs are all
**single-process orchestrators**: they decompose a task and route control between
agent *roles inside one application instance*, coordinating through internal
state. They have no concept of an OS process, a working directory, a checkout, or
a file on disk that another process might also be editing. Nothing in this
category touches either failure mode. Any writeup recommending them for
"multi-agent coding" is describing task decomposition, not fleet coordination.

**Agent interop protocols solve a different layer.** A2A (Google → Linux
Foundation, 50+ partners), AGNTCY's ACP, and MCP-as-transport standardize how
agent *services* discover each other, authenticate, and delegate tasks over a
network. They are enterprise-integration plumbing. There is no file-collision,
repo-state, or checkout concept anywhere in them. Also: they are
network/distributed by construction, which the brief rules out.

**Worktree managers are ergonomics, not coordination.** worktrunk (6,286★), uzi
(581★, last pushed 2025-06-04), gwq, amux, agentree, dmux, herdr, vibe-tree,
git-worktree-runner, worktree-cli. Every one of them creates and destroys
worktrees faster. **Not one implements a lock, claim, queue, or board.** The
category's implicit claim — that filesystem isolation *is* coordination — is
exactly wrong for this problem: Mode A's whole point is that isolation lets two
agents duplicate work in perfect comfort right up until merge.

**Isolation products likewise.** Dagger container-use (3,953★) and Imbue Sculptor
(213★) put each agent in its own container. Excellent hermeticity; zero agent-to-
agent awareness. Benjamin already has stronger isolation than either (13 real
clones) and it did not prevent either failure mode.

**Hosted/cloud agent products explicitly decline this problem.** Cursor Background
Agents give each agent a branch and a PR and — per the reporting — *"do not
prevent two agents from writing to the same file, and do not enforce any ordering
between sessions; that coordination is still your job."* Sourcegraph Amp is blunter
about subagents: *"you cannot orchestrate them or have them talk to each other."*
Devin's Feb-2026 parallel sessions use a coordinator session delegating to child
VMs — in-orchestrator decomposition again, not peer coordination. Every major
platform shipped concurrency in early 2026 and none shipped coordination.

**GUI/desktop products are dealbreakers by the operator's own constraint.**
Conductor (macOS), Crystal/Nimbalyst, Vibe Kanban (27,662★ but Bloop shut down
April 2026, hosted cloud switched off, community-maintained), Fusion, Orkas,
parallel-code, synara, Agent Teams desktop. Also note claude-squad is **AGPL-3.0**,
which is a licensing consideration the star count hides.

---

## The negative result (the valuable one)

> **No tool exists that broadcasts impending or landed repo-wide base-state
> changes into running coding agents.** Mode B is unbuilt.

Evidence for the claim, not just absence of evidence:

- **The tools that *could* have built it explicitly chose not to.** MCP Agent
  Mail documents "**No broadcast by design** … Agents only receive messages
  addressed to them," justified as context-window hygiene. That is a considered
  rejection of the Mode-B primitive by the most complete coordination product in
  the field.
- **The dedicated coordination protocols don't model it.** swarm-protocol has
  Intent / Claim / Signal / Context Package — `Signal` is completion/blocking
  notification for *dependent tasks*, not base-state change. Its docs do not
  mention base-branch churn or policy broadcast at all.
- **The multi-agent engineering writeups don't mention it.** OpenHands' CAID
  asynchronous-agents post identifies the semantic-collision problem precisely
  ("two agents each produce correct code independently, but when their changes
  are combined, the result breaks") and answers with worktrees, dependency
  graphs, merge, and tests. It **does not discuss stale branches, rebasing, or
  base-branch churn breaking in-flight work.** Same for Augment Code's
  multi-agent workspace guides and Addy Osmani's orchestra piece.
- **The only prior art is mechanical, not informational.** GitHub merge queue
  (and Gastown's Refinery) re-tests each PR against latest main plus queued PRs.
  That converts silent breakage into a *detected* failure at merge time. It never
  tells the agent, mid-work, that its base assumption just changed. Aviator's
  monorepo writeup notes GitHub's native queue lacks scope-aware batching; the
  only near-miss found was a *cron that re-enqueues status rollups for every
  active PR against a staleness threshold* — a polling workaround at the CI
  layer, not agent delivery. GitHub's July-2026 stacked-PR/`gh-stack` GA helps
  rebase mechanics, not notification.
- **The one tool with the right transport doesn't frame it this way.** `hcom`'s
  "any process can wake agents with `hcom send`" makes Mode B ~5 lines of shell,
  but no documentation, script, or blog post in the sweep proposes using it for
  base-state change. The bundled scripts are about confession/eval/file-watching.

**Secondary negative — the market's mental model is one repo, many worktrees, and
this fleet is off-model.** clash is *worktrees only*; MCP Agent Mail is
one-repo-scoped; session-collab-mcp explicitly "not across separate git clones";
mclaude "does not synchronize across git clones automatically." Only `hcom`
(global `~/.hcom`), `agent-message-queue` (`AMQ_GLOBAL_ROOT` / absolute base
roots), and Gastown (rigs) handle N independent clones. Anything else adopted
here would need its scoping model bent.

### Search coverage backing the negative result

Ran ~14 distinct queries across four modalities, plus 10 direct README/site
fetches and 24 GitHub API maturity checks.

- *By product name:* Conductor, Crystal/Nimbalyst, claude-squad, Vibe Kanban,
  Sculptor, Dagger container-use, Cursor background agents, Devin parallel
  sessions, OpenHands/CAID, Amp/Sourcegraph, Jules, Codex Cloud, Factory, Tembo,
  Warp, uzi, gwq, worktrunk, amux, agentree, Gastown, Beads, hcom, ClawTeam.
  (Terragon, Charlie, Cosine returned no substantive results for this problem.)
- *By capability phrase:* "agent coordination", "agent mailbox", "shared task
  board for agents", "agent lockfile", "claim a task", "prevent duplicate agent
  work", "parallel agents merge conflicts", "worktree fleet", "AI mutex lock".
- *By protocol:* A2A/Agent2Agent, AGNTCY ACP, MCP coordination servers, AutoGen
  GroupChat, CrewAI, LangGraph supervisor, OpenAI Agents SDK handoffs.
- *By blog/incident:* OpenHands async-agents, Augment Code multi-agent workspace,
  Addy Osmani code-agent-orchestra, Mike Mason, Aviator monorepo merge queues,
  Aspect "keeping main green", Factory "using linters to direct agents",
  agentsroom "scale AI coding agents across a dev team".
- *Mode-B-specific queries* (3 separate phrasings around notifying in-flight PRs
  of merged policy changes) returned **zero** purpose-built tools — only merge
  queue, stacked PRs, and generic rebase advice.

---

## What the field actually converged on (useful design intel)

Even where tools don't fit, the *design consensus* is worth stealing:

1. **Advisory, bypassable, TTL-expiring reservations beat hard locks.** MCP Agent
   Mail: "reservations surface conflicts and enable the pre-commit guard, but
   they can always be bypassed." Every serious tool made claims advisory —
   because a crashed agent holding a hard lock is worse than a duplicate PR.
2. **Heartbeat + stale-claim reaping is mandatory.** swarm-protocol heartbeats
   every 10–15 min; mclaude and Agent Mail both do TTL expiry. Agents die.
3. **The pre-commit / pre-push hook is the universal enforcement point.** Agent
   Mail (`mcp-agent-mail-guard`), mclaude (`pre_commit_guard.py`), clash
   (pre-commit + PreToolUse). For this repo the analogous chokepoint already
   exists and is stronger: **every agent passes through `beep yeet` before
   pushing.** That is a better guard site than a git hook, and it's already built.
4. **Atomic claim = `O_CREAT | O_EXCL` on a shared dir.** mclaude's whole locking
   layer is this, with zero dependencies. It is the brief's flock baseline, and
   it is what the field independently landed on.
5. **Granularity is the open research question.** File-level is too coarse
   (session-collab-mcp and the archived `wit` both went to *symbol*-level via
   Tree-sitter). For Mode A the right granularity is probably neither — it's the
   **work item** (Beads' insight), because the duplicate-fix problem is about
   intent, not bytes.

---

## Buy / adapt / build — final

| Concern | Verdict | Why |
|---|---|---|
| **Transport / delivery into running agents** | **BUY `hcom`** (evaluate; fall back to build) | Only mature tool with mid-turn injection + idle-agent wake + Codex support. Waking idle agents is the one genuinely hard part |
| **Mode A: work claiming** | **BUILD** on `beep` | Nobody claims *work items* at the right granularity except lifecycle-owning trackers. `O_CREAT\|O_EXCL` + TTL + heartbeat in a shared dir is ~100 lines and is the field-standard design |
| **Mode A: enforcement point** | **BUILD** — already have it | `beep yeet verify/publish` is a better chokepoint than any pre-commit hook; every agent passes through it |
| **Mode B: broadcast** | **BUILD** (trivial on `hcom`, or on the existing hook) | `hcom send @fleet` from a `post-merge` hook or a `yeet publish` post-step. Zero prior art to copy; ~5 lines |
| **Mode B: mechanical immunity** | **BUY GitHub merge queue** | Already on the opportunities ledger. Converts silent in-flight breakage into detected-at-merge. Complementary to broadcast, not a substitute |
| **Anything with a GUI, daemon, Postgres, Dolt, or its own agent lifecycle** | **REJECT** | Fails the "must beat shared-dir + flock on its own merits" bar |

**The honest ponytail check:** this repo already ships `law-pulse.sh` — a
PostToolUse hook that reads a per-checkout counter file and echoes ~30 tokens to
stdout, which Claude Code injects as context. Mode A and Mode B broadcast are the
*same shape*: read a shared file, echo if there's something to say. The shared
file is `flock`-guarded and lives in one directory. That baseline is ~40 lines and
already proven in-tree. `hcom` earns its place only for (a) waking idle agents and
(b) Codex CLI parity — if neither turns out to matter in practice, build it all
and skip the dependency.

---

## Addendum — 2026-08-05: `block/buzz`

Surfaced by the operator after this track closed; not found by any of the ~14
queries above. It deserves recording because it is the **most on-the-nose
existing artifact for the operator's original message-board framing** — and
therefore the strongest available test of the pivot away from it.

**What it is.** A self-hostable Nostr-relay workspace where humans and agents
share the same rooms. Agents are first-class members: own keypair, own channel
memberships, own durable history, own presence, own audit trail, scoped by
identity rather than permission flags. Every message, reaction, workflow step,
review approval, and git event is a signed event in one log. Its agent runtime is
`buzz-agent` (Rust, ACP over stdio) paired with `buzz-dev-mcp`;
`VISION_REMOTE_AGENTS.md` makes the relay the management plane, with a one-way
deploy handoff and a deliberately disposable body.

**Verdict: reject**, for three reasons that this track's own findings predicted.

1. **It solves delivery by owning the agent runtime.** Buzz agents are driven by
   the relay because they *are* Buzz processes. This fleet is Claude Code, where
   the only channel into a live session is `hookSpecificOutput.additionalContext`.
   Buzz's coordination is not a transport that could be adopted — it is a
   different agent. Adopting it means replacing the harness.
2. **Everything it coordinates is declared.** Every claim and update is a signed
   event someone chose to post. Derive-don't-declare is this packet's spine, and
   D1 puts claim registries out of scope on exactly that ground. Buzz is evidence
   *for* the call: even executed this well, it cannot see the #551 specimen —
   that change conflicted with nothing and its author had no reason to announce
   it. A board carries only what someone knew to post.
3. **Cross-machine is its reason for existing, and that is out of scope by
   operator ruling.** Relay, Postgres, Redis, object storage, Kubernetes
   providers — that is the machinery of coordinating across hosts and across
   time. T2's finding was that on one machine liveness is *directly observable*.
   Buzz confirms it from the other side: `VISION_REMOTE_AGENTS.md:59` makes
   presence a lease the agent renews, with a wrong-dot window of up to about
   three minutes. D5's `/proc` scan has no such window because it reads the truth
   instead of estimating it.

Scale follows from that: 539 MB, 676 Rust files plus a full server stack, against
this packet's 1–2 day appetite for a read-only derived view.

**Worth taking:**

- **"Agents are members, not bots."** Scoping by identity rather than permission
  flags is decision 37's principle reached independently — and the same instinct
  behind speed-loop's `beep agent report list`.
- **`docs/welcome-kickoff-silent-failures.md`** is the directly transferable
  artifact: a postmortem on agent-to-agent silent failures in which `ignore_self`
  is the only loop guard and A→B→A is precisely what it misses. Read it before
  any fleet bulletin becomes bidirectional.

**What it does not change.** The negative result above stands unweakened: Buzz
does not broadcast base-state change into running agents either. It moves the
agents inside its own workspace instead — a legitimate answer to a different
question.

---

## Sources

- [block/buzz](https://github.com/block/buzz) · `VISION_AGENT.md` · `VISION_REMOTE_AGENTS.md` · `docs/welcome-kickoff-silent-failures.md` (read from a local clone at `~/YeeBois/dev/buzz`, `a7ea86cdc`, 2026-08-05)
- [clash-sh/clash](https://github.com/clash-sh/clash)
- [MCP Agent Mail](https://mcpagentmail.com/) · [Dicklesworthstone/mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail) · [mcp_agent_mail_rust](https://github.com/Dicklesworthstone/mcp_agent_mail_rust)
- [aannoo/hcom](https://github.com/aannoo/hcom) · [hcom README](https://github.com/aannoo/hcom/blob/main/README.md)
- [gastownhall/gastown](https://github.com/gastownhall/gastown) · [Gastown research writeup](https://www.wal.sh/research/gastown.html)
- [Beads documentation](https://steveyegge.github.io/beads/) · [gastownhall/beads](https://github.com/steveyegge/beads)
- [phuryn/swarm-protocol](https://github.com/phuryn/swarm-protocol)
- [AnastasiyaW/mclaude](https://github.com/AnastasiyaW/mclaude)
- [leaf76/session-collab-mcp](https://github.com/leaf76/session-collab-mcp)
- [avivsinai/agent-message-queue](https://github.com/avivsinai/agent-message-queue)
- [dagger/container-use](https://github.com/dagger/container-use)
- [andyrewlee/awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)
- [OpenHands — Effective Strategies for Asynchronous Software Engineering Agents](https://www.openhands.dev/blog/asynchronous-software-engineering-agents)
- [Augment Code — How to Run a Multi-Agent Coding Workspace (2026)](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace)
- [Addy Osmani — The Code Agent Orchestra](https://addyosmani.com/blog/code-agent-orchestra/)
- [Aviator — Merge Queues for Large Monorepos](https://www.aviator.co/blog/merge-queues-for-large-monorepos/)
- [GitHub Docs — Merging a pull request with a merge queue](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue)
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks)
- [Devin parallel sessions / multi-agent February](https://agentmarketcap.ai/blog/2026/04/10/devin-parallel-sessions-multi-agent-concurrency)
- [Google — Announcing the Agent2Agent Protocol](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [Galileo — AutoGen vs CrewAI vs LangGraph vs OpenAI Agents](https://galileo.ai/blog/autogen-vs-crewai-vs-langgraph-vs-openai-agents-framework)
- [Nimbalyst — Best Multi-Agent Coding Tools 2026](https://nimbalyst.com/blog/best-multi-agent-coding-tools-2026/)
- [amux — Best AI Agent Multiplexers Compared (2026)](https://amux.io/guides/best-ai-agent-multiplexers-2026/)
