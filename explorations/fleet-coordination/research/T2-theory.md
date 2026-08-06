# T2 — Design theory: blackboards, tuple spaces, leases, stigmergy

Scope: what 50 years of coordination design says about **Mode A** (duplicate work /
collision) and **Mode B** (in-flight base churn), for **one machine, ~13 clones, CLI-native
agents**. Network-scale results are explicitly rejected, not summarized.

---

## Bottom line first

Four load-bearing conclusions, each traced to primary sources and (where testable) verified
on this workstation:

1. **Mode A is a textbook failure, and it has a name.** 13 agents pulling from one pool of
   broken-things-on-main is the **replicated-worker paradigm**. The tuple-space literature
   states flatly that with only *single-op atomicity* — which is what a naive NDJSON claims
   journal gives you — "both the distributed variable and the replicated-worker paradigms
   **can fail**" under faults. Do not hand-roll the journal without fixing atomicity first.

2. **`flock` is not a compromise, it is the correct primitive here.** Verified on this box:
   a claim held under `flock` is **released by the kernel on holder death**, with no TTL, no
   heartbeat, no reaper. That is the single hardest problem in the leases literature
   (Gray & Cheriton, Chubby) handed to us for free — *because* we are single-machine. It is
   the strongest argument in the entire research area for staying local.

3. **But `flock` does not survive a hang, and an LLM agent hangs constantly.** Verified: a
   `SIGSTOP`ped holder keeps the lock forever. Kleppmann's GC-pause argument maps exactly
   onto an agent blocked 12 minutes on `beep yeet verify` or waiting on a human. So the
   claim needs a **fencing token**, not a TTL. Verified: a counter incremented under the same
   `flock` issues gapless monotonic tokens under 13-way contention — that is a correct
   sequencer on one machine, and it costs ~6 lines of shell.

4. **Declared coordination will decay; derived coordination will not.** This is the
   hierarchy-of-controls result, and this repo has already *measured* it: `law-pulse.sh`
   exists because instruction adherence drops ~5.6% per generated function. Any protocol
   whose first step is "the agent remembers to announce" is an administrative control and
   will fail at a rate no design review can talk it out of. **Derive claims from traces the
   agent cannot avoid leaving** (branch names, lock fds, worktree dirs, open PRs).

The synthesis: **derive the claim, enforce it with `flock` inside a tool the agent must
already run (`beep yeet`), fence it with a counter, and push notification of it — never
expect anyone to poll.**

---

## 1. Blackboard architecture

*Sources: Hearsay-II (Erman/Hayes-Roth/Lesser/Reddy 1980); Nii's 1986 two-part AI Magazine
survey; Hayes-Roth BB1 (AI 26:251-321, 1985); Corkill,* Blackboard Systems *(AI Expert 1991).*

### The finding that matters most: they abandoned polling in 1976

This is the strongest external confirmation of the "delivery, not storage" constraint the
orchestrator already identified. Corkill, describing why the blackboard *metaphor* had to be
broken to build a real system:

> "**A specialist should not have to scan the entire blackboard** to see if a particular item
> has been placed on the blackboard by another specialist."

> "**Rather than having each KS scan the blackboard (as in the metaphor), each KS informs the
> blackboard system about the kind of events in which it is interested.** The blackboard system
> records this information and directly considers the KS for activation whenever that kind of
> event occurs."

A bulletin board nobody reads is not a hypothetical failure mode — it is the failure mode
the first blackboard system hit and engineered away 50 years ago, by inverting scan into
**registered interest + push**. An LLM agent is a *worse* poller than a Hearsay-II KS,
because polling costs it context window.

### Two-stage triggering (cheap filter, then expensive look)

Hearsay-II's designers found that rich subscription predicates did not work:

> "The developers of the original Hearsay-II system recognized that **rule-like condition
> specifications of KS interest would be ineffective.** Instead, they opted for a combination
> of **simple triggering-condition specifications to be followed by a more detailed procedural
> examination** of the blackboard before activating the KS."

Directly applicable: the hook should push **~30 tokens** ("2 fleet claims changed, base epoch
7"), not a digest. The agent then *decides* whether to spend a tool call on `beep agent brief`.
`law-pulse.sh` already has exactly this shape; it is the right shape.

### The control problem — and the warning against a naive lock

Corkill's framing of contention is a precise description of Mode A:

> "**What if most of the human specialists respond to an event and all rush to the blackboard
> simultaneously?** Some means of ordering their contributions is needed. (**A single piece of
> chalk is a simple control strategy, but one that favors the swiftest rather than the most
> appropriate specialist.**)"

Read that second sentence twice. **A bare mutex solves Mode A's waste but optimizes the wrong
thing**: first-to-`flock` wins, not best-placed-to-fix wins. If the agent that grabs the lint
fix is the one with a cold checkout and no context on that package, you converted duplicated
work into *misallocated* work.

The classical fix is a cheap bid, not a scheduler. KSs report estimates without doing the work:

> "each KS generates estimates ... of the form, '**If I am executed, I'll generate contributions
> of this type, with these qualities, while expending these resources.**'"

For us that is nearly free and needs no new information: an agent's fitness for a fix is
mostly derivable — does its branch already touch those files, is its working tree clean, is
it mid-`yeet`. A 30-second claim window where contenders write a one-line derived bid, then
the best bid takes it, is strictly better than first-come and costs one extra round.

### What the "control blackboard" separation teaches

BB1's contribution (Hayes-Roth 1985) was recognizing that **deciding what to work on is itself
a problem domain**, deserving its own blackboard, its own knowledge sources, and its own
explicit plan — separate from the domain blackboard. Domain KSs solve domain problems; control
KSs build a control plan.

The lesson for us is a **negative** one, and it is the most important guardrail in this section:
BB1 is where blackboard systems started becoming expensive. If we find ourselves writing a
scheduler that reasons about which agent should do what, we have reinvented BB1 and inherited
its cost. **Keep the control surface to: claims, base epoch, and a bid tiebreak.** Nothing
that requires reasoning about the fleet's plan.

### Why blackboards degraded at scale

Two mechanisms, both present in our design space:

- **Retrieval cost.** "Many contributions placed on the blackboard may **never prove useful**,
  and **maintaining the state of numerous, partially completed patterns is expensive**." An
  append-only NDJSON journal accumulates exactly this. It needs regions/indices (Corkill's
  answer: subdivide the blackboard into levels/planes) or compaction, or reading it becomes
  the dominant cost.
- **It stops being worth it.** Erman's 1989 conjecture, quoted approvingly by Corkill:
  "A blackboard system is useful for **prototyping** an application, but, once developed and
  understood, the application can be **reimplemented without the blackboard structure or
  opportunistic control machinery**." Corkill confirms this happened repeatedly.

Corkill's own "**the answer is no**" test for adopting a blackboard — verbatim: *you can easily
represent all knowledge in a framework you already know*; *the application does not need to make
dynamic control decisions*; *the completed application will not be combined with other systems*.
Our fleet arguably fails all three tests in the "no" direction. **We do not need a blackboard.
We need two shared facts (claims, base epoch) and a push channel.**

> **For a single-machine 13-clone CLI fleet:** steal the *triggering* design (registered
> interest → push → cheap trigger → optional detailed look) and the *warning* (a bare mutex
> favors the swiftest, not the best-placed). Reject the blackboard data structure itself, the
> agenda, and anything resembling BB1's control plan — Erman's conjecture says we would delete
> it later anyway.

---

## 2. Tuple spaces / Linda

*Sources: Gelernter,* Generative Communication in Linda *(TOPLAS 1985); JavaSpaces / Jini
distributed leasing spec (Apache River); De Florio & Blondia,* A Survey of Linguistic Structures
for Application-level Fault-Tolerance *(arXiv 1504.03256); Bakken & Schlichting, FT-Linda (1995).*

### The mapping is exact

| Linda | Semantics | Our operation |
|---|---|---|
| `out(t)` | insert a tuple | **publish** — "main is broken at X" |
| `rd(t)` | match **non-destructively**, tuple stays | **observe** — see the work without taking it |
| `in(t)` | match and **remove**, blocking | **claim** — take the work, exclusively |
| `inp`/`rdp` | non-blocking predicate variants | `flock -n` — try-claim, don't wait |
| `eval(t)` | tuple computed by a new process | an agent spawned to service a claim |

The `rd`/`in` split is the single most useful idea in this section and a naive journal usually
misses it: **observing must not claim, and claiming must be destructive.** If an agent can read
the work list without that read being distinguishable from taking the work, Mode A is
unsolved — every agent "sees" and every agent acts.

### What the tuple-space community learned, and what a naive NDJSON journal gets wrong

**(a) Liveness / crash semantics are simply absent from the base model.** Verbatim from the
De Florio & Blondia survey:

> "Unfortunately **the model does not cover the possibility of failures** — for instance, the
> semantics of its primitives are **not well defined in the case of a processor crash**, and no
> fault-tolerance means are part of the model."

**(b) Single-op atomicity breaks the replicated-worker paradigm — which is precisely us:**

> "in its original form, Linda only offers **single-op atomicity** ... i.e., atomic execution
> for only a single tuple space operation. With single-op atomicity **it is not possible to
> solve problems** arising in two common Linda programming paradigms when faults occur: **both
> the distributed variable and the replicated-worker paradigms can fail**."

The concrete mechanism, and the exact shape of "agent crashed holding a claim":
an agent does `in(fix-the-lint-rule)`, which **removes** the tuple; the agent dies before
`out(result)`. The work item is now **gone from the space and nobody knows it ever existed** —
no other agent will pick it up, because there is nothing left to match. Silent loss, not
duplication. An append-only NDJSON journal with a `claimed` line reproduces this bug faithfully:
a claim line with no matching release line is indistinguishable from work in progress.

**(c) The fixes the community converged on** were all about widening atomicity or adding
recoverability: **multi-op atomic transactions** (FT-Linda, MOM), **stable tuple spaces** via
replicated state machines, and **checkpoint-and-rollback**. Of these, only *transactions* is
affordable and relevant to us; replication is network-scale and rejected.

**(d) JavaSpaces' answer was leases, and that is not a coincidence.** Every entry written to a
JavaSpaces service is **governed by a lease**; expiry lets the entry be reclaimed. Under a
transaction, if a client fails while holding locked objects (from `take`/`write`/`read`), the
lease manager **releases them on timeout**. JavaSpaces is Linda plus exactly the two things
Linda lacked: **transactions** (so `take`-then-crash rolls back) and **leases** (so orphans get
collected). That is the industrial verdict on what a tuple space needs to survive contact with
crashing workers — and it is why section 3 exists.

**(e) Nondeterministic matching.** "When more than one tuple matches a template, the choice of
which actual tuple to address is done in a **non-deterministic way**." Same disease as Corkill's
piece of chalk: no notion of *appropriateness*, only *availability*. Reinforces the bid idea.

**(f) Associative lookup is exact-match on typed fields**, not a query language. A journal with
free-text `description` fields will not match reliably — two agents will describe the same
broken lint rule differently and both will claim. **Claim keys must be mechanically derived**
(failing check name, file path, rule id, PR number), never prose.

> **For a single-machine 13-clone CLI fleet:** adopt `rd` vs `in` as a hard distinction
> (observe ≠ claim), make claim keys derived identifiers rather than prose, and understand
> that a plain append-only journal is pre-1995 Linda — it has the replicated-worker bug by
> construction. We get JavaSpaces' two fixes cheaply: `flock` *is* our lease (§3), and
> "claim + release in one critical section" *is* our transaction. Reject replicated/stable
> tuple spaces — pure network-scale machinery.

---

## 3. Leases and liveness

*Sources: Gray & Cheriton (SOSP 1989); Burrows,* The Chubby Lock Service *(OSDI 2006);
Kleppmann,* How to do distributed locking *(2016); `flock(2)`, `fcntl(2)` OFD locks.*

### The classical problem, and why it is *mostly* not ours

A lease is a lock with an expiry, invented so that **a holder that dies cannot block the
system forever** — the failure degrades performance, not correctness, and short leases minimize
the damage. Lease *term* is a tradeoff between renewal overhead and false expiry.

Every one of those mechanics exists to answer one question: **how do we know the holder is
dead when we cannot see it?** On one machine, we can see it. The kernel already knows.

### Verified on this workstation

I ran these probes rather than asserting the semantics. Scripts and full transcripts are in
`flock-probe.sh` / `ofd-probe.py` beside this document.

| Probe | Result | Consequence |
|---|---|---|
| Holder `SIGKILL`ed, no trap, no cleanup handler | **Lock released immediately**; next `flock -n` succeeds | **Free liveness on death.** No TTL, no heartbeat, no reaper process. |
| Holder `SIGSTOP`ped (alive but wedged) | **Lock still held**, `flock -n` still fails | **No hang detection.** This is the dangerous case for LLM agents. |
| `lslocks` / `fuser` while held | Reports holding **PID + command + mode + path** | Claims are **introspectable from kernel state** — derivable, not declared (see §4). |
| POSIX `fcntl(F_SETLK)`, then an *unrelated* `open`+`close` of the same path | **LOCK SILENTLY LOST** | The classic POSIX record-lock footgun. Do not use `F_SETLK`. |
| Same test with **OFD** `fcntl(F_OFD_SETLK)` | **Lock survived** | OFD locks (Linux 3.15+) fix it. `flock` has the same safe ownership model. |
| Parent `fork`s, child inherits fd, parent closes and exits | **Lock STILL HELD by the child** | **A leaked background process holds the claim after the agent exits.** |

The ownership rule, verbatim from `man 2 flock`, explains both the good and bad results:

> "Locks created by flock() are **associated with an open file description** ... duplicate file
> descriptors (created by, for example, **fork(2)** or dup(2)) refer to the **same lock** ... the
> lock is released either by an explicit LOCK_UN operation on any of these duplicate file
> descriptors, or **when all such file descriptors have been closed**."

Process death closes all fds ⇒ automatic release. That is the whole mechanism. It is also why
probe C bites: a forked `bun`/`turbo`/`vitest` child inherits the description and keeps the
claim alive after the agent is gone. **Open lock fds with `O_CLOEXEC` / don't leak them into
long-running children** — this repo's memory already notes background bash children outliving
turns, so this is a live hazard, not a theoretical one.

### Why TTL alone is unsafe — and why this applies to agents specifically

Kleppmann's argument: client A holds a lock, **pauses** (stop-the-world GC), the lease expires,
B acquires and acts, A resumes *still believing it holds the lock* and writes. "Redlock does not
generate a monotonically increasing number every time a client acquires a lock" — without such a
token "a storage system has **no possible way to reject stale writes** from a process that thinks
it still owns the lock but actually doesn't."

**This is not an exotic distributed-systems edge case for us — it is the normal operating mode
of an LLM agent.** An agent routinely goes unresponsive for many minutes: waiting on a model
response, on a 10+ minute `beep yeet verify`, on a human answering `AskUserQuestion`, or on a
rate limit. That is a stop-the-world pause with agent-scale duration. Probe P2 (`SIGSTOP`)
is a faithful simulation. **Any TTL short enough to reclaim dead claims promptly is short
enough to falsely expire a live-but-thinking agent** — so TTL alone will produce exactly the
two-holders-at-once bug.

Chubby's two answers, and their single-machine translations:

- **Sequencers** — a client requests a sequencer for a lock and attaches it to downstream
  requests; the downstream server validates it and rejects stale ones. This is a **fencing
  token**.
- **`lock-delay`** — for servers that cannot validate sequencers, Chubby refuses to re-grant a
  lock for a period (typically ~1 min) after an unclean release, so in-flight work from the
  dead holder drains first. This is the cheap approximation when you cannot fence.

### The cheap correct pattern on one machine — verified

`flock` + **a counter incremented inside the same critical section**. Verified under 13-way
concurrency (matching the fleet size): **13 distinct, gapless, monotonic tokens, no lost
updates.** Because `flock` gives real mutual exclusion locally, read-increment-write inside it
is atomic — that is a correct sequencer, and it is ~6 lines of shell.

```sh
# claim: exclusive, self-releasing on death, and fenced
( flock -x 9 || exit 1
  epoch=$(( $(cat "$D/seq.n") + 1 )); echo "$epoch" > "$D/seq.n"
  # ... write claim record carrying $epoch ...
) 9<"$D/claims.lock"
```

The fence is then enforced at the **only** point that matters: `beep yeet publish` refuses to
push if the claim epoch it carries is not the current epoch for that key. A resumed zombie
agent gets rejected at the gate rather than opening a competing PR.

Note also that the natural fencing token for **Mode B already exists**: the merge commit SHA /
PR number on `main` is monotonic-ish and authoritative. A **base epoch** counter bumped whenever
a repo-wide policy lands is the Mode B sequencer, and an in-flight PR carries the epoch it was
branched from — a mismatch is a *mechanical, pre-CI* signal that the PR needs a rebase, rather
than discovering it via 24 red checks.

Finally, Gray & Cheriton's actual subject was **cache consistency**, and that reframes Mode B
precisely: **an in-flight PR is a cached copy of `main`'s policy surface.** Its checks fail
because the cache went stale and nothing invalidated it. The classical answer is a
**read lease with invalidation on write** — which is exactly "broadcast impending base-state
changes to holders."

> **For a single-machine 13-clone CLI fleet:** use `flock` (never `fcntl F_SETLK`; OFD if you
> need byte ranges), take crash-liveness for free, add a flock-guarded counter as the fencing
> token, and enforce the token at `beep yeet publish`. Add a Chubby-style lock-delay only if
> cheap. **Reject every TTL/heartbeat/lease-renewal design** — those exist to detect death
> across a network, and here the kernel does it for free and better. Reject Redlock, etcd,
> ZooKeeper, Raft entirely.

---

## 4. Stigmergy — derive, don't declare

*Source: Heylighen,* Stigmergy as a Universal Coordination Mechanism I & II *(Cognitive Systems
Research, 2016); Grassé 1959; open-source/Wikipedia applications.*

Stigmergy: **the trace left by an action on a medium stimulates the next action.** Coordination
emerges from the work product itself, with no messages between agents.

### What it buys, verbatim

> "Compared to traditional methods of organization, stigmergy makes **absolutely minimal demands
> on the agents**. In particular, in stigmergic collaboration there is **no need for**:
> **planning or anticipation** ... **memory** ... **communication** — no information needs to be
> transferred between the agents, except via the work done in the medium; there is in particular
> **no need for the agents to negotiate about who does what** ... **mutual awareness** ...
> **simultaneous presence** ... **imposed sequence**."

Every one of those is a property we want, because our agents genuinely have no shared memory, no
mutual awareness, and no simultaneous presence. Heylighen also names the preconditions, and they
are the whole design spec:

> "**The only requirements are that the agents can recognize the right conditions to start their
> work, and that they can all access the medium** in which these conditions are registered."

He explicitly identifies open-source development as stigmergic — developers "regularly check
their shared website for new modules, updates, requests for features, or postings of bugs" — and
notes it works "**without requiring any central supervision**."

### The catch that decides our design

Note the verb in that quote: developers **"regularly check."** Human stigmergy assumes a polling
agent. **LLM agents do not poll.** So the medium is necessary but not sufficient: for us,
stigmergy must be **paired with the §1 push channel**. The filesystem holds the trace; the hook
injects the fact that a trace changed. Neither alone works.

### When stigmergy beats explicit messaging — the documented condition

Heylighen gives a sharp criterion via the pushing-an-obstacle example:

> "the goals of the agents **are not contradictory** ... It is only when one group pushes
> eastward and another group westward that a conflict arises, without possibility for a
> compromise ... However, **the larger the number of aspects, components or degrees of freedom
> of the problem situation, the more freedom there is for agents to focus on different goals
> without getting in each others' way.**"

**This is the actual diagnosis of Mode A, and it is not "the agents failed to communicate."**
Duplicate work happens when the *degrees of freedom collapse*: one thing is broken on `main`,
13 agents can see it, and it is the single most salient action available to all of them. The
literature's answer is as much **widen the visible work surface** as it is **add a lock**. A
partitioned queue where each agent's most-salient next action is *different* removes the
collision at the source; a lock only arbitrates it after the fact.

And the honest cost, stated by Heylighen:

> "Perhaps the only disadvantage compared to a perfectly designed and executed plan, is that the
> stigmergic approach **does not guarantee an optimal use of the 'workforce'**."

Mitigated, he notes, by a worker pool larger than needed — which is what 13 clones are. Some
idle/redundant agent capacity is the *price* of the model, not a bug to engineer away.

### What is already a trace here (nothing new to build)

The fleet leaves machine-readable traces continuously, and none require an agent to remember
anything:

- **git branch names** pushed to the shared remote — the single best derived claim signal;
  a branch named for a fix *is* the claim.
- **open PRs and their changed-file sets** — claim + scope, already public, already queryable.
- **worktree/clone directories** and their dirty state.
- **kernel lock table** — probe P3 confirmed `lslocks` reports holder PID, command, and path.
- **running processes** (`beep yeet verify` in flight) and mtimes on build/verify outputs.

> **For a single-machine 13-clone CLI fleet:** make the claim a **derived** view over branches,
> PRs, worktrees, and `lslocks` — computed by `beep agent brief`, not maintained by agents.
> Reserve *declared* state for the one thing that cannot be derived: intent to start work that
> has not produced a trace yet, and even that should be auto-emitted by the tool the agent runs.
> Treat "widen the work surface so agents' salient actions differ" as a first-class Mode A fix
> alongside locking.

---

## 5. The voluntary-protocol failure class

The question — *what fraction of coordination should be derived vs declared?* — has a
defensible answer, from three independent directions that agree.

### (a) The hierarchy of controls (NIOSH; ISO 45001 §8.1.2)

Five tiers, most to least effective: **elimination → substitution → engineering controls →
administrative controls → PPE.** Administrative controls (procedures, training, "remember to
announce") are the **second-weakest tier**, and the reason is explicitly that they "depend
entirely on people doing the right thing every time" and have "a documented, consistent, and
predictable failure rate that is higher than any physical control." Engineering controls work
"without significant human interaction."

Hillel Wayne's software mapping supplies the operative sentence:

> "**it takes effort to break the engineering control, while it takes effort to follow the
> administrative control.**"

That is the whole design test. If following our protocol costs the agent effort and skipping it
costs nothing, we have built an administrative control and its failure rate is bounded below by
human/model unreliability. **A claims journal that agents must remember to append to is an
administrative control. A claim taken automatically by `beep yeet` is an engineering control.**

### (b) The kernel itself documents this failure mode

`man 2 flock`, verbatim:

> "flock() places **advisory** locks only; given suitable permissions on a file, **a process is
> free to ignore the use of flock()** and perform I/O on the file."

Verified: while a lock was held, a process that simply never called `flock` **clobbered the
guarded counter file**. Advisory locking *is* a voluntary protocol, and Linux ships it as the
only real option (mandatory locking is deprecated/removed). The lesson is not "locks don't
work" — it is that **the enforcement must live in the shared entry point, not in each
participant's good intentions.** Everyone touching the resource must go through one code path.

**We have that entry point already: `beep yeet`.** Every agent passes through it before pushing.
That is the single most important structural fact in this whole research area — it converts an
advisory lock into an effectively-mandatory one **without any new discipline**, because the
agents already cannot ship without it.

### (c) This repo has already measured the decay, on LLMs specifically

`.claude/hooks/law-pulse.sh` exists, in its own words, to counter "within-session instruction
decay (measured **~5.6% lower adherence odds per generated function, median first omission at
the 4th**)". Its comment concludes: "**Machine enforcement is the reliable channel**; this pulse
is the cheap middle ground for laws without lint rules yet."

That is a local, empirical, already-accepted finding that **declared protocols decay inside a
single session**, before we even get to cross-session or cross-clone. A 13-agent protocol
requiring voluntary announcement compounds this 13 ways.

### The answer to "what fraction?"

**Derive everything that leaves a trace. Declare only intent that precedes any trace — and
auto-emit even that from the tool.** Concretely: aim for **zero** coordination steps that an
agent could forget. Every coordination action should be a side effect of an action the agent
takes for its own reasons (branching, running verify, pushing, opening a PR). If a proposed
design has a step described as "the agent should also record…", that step will not happen
reliably and should be redesigned or deleted.

> **For a single-machine 13-clone CLI fleet:** put claim acquisition, epoch stamping, and
> release inside `beep yeet` / `beep worktree` / the existing hooks. Ship **no** command whose
> value depends on an agent choosing to run it. Judge every proposal by Wayne's test: does
> breaking it take effort, or does following it take effort?

---

## Mapping table: classical primitive → our artifact → failure prevented

| # | Classical primitive | Source | Our concrete artifact | Failure mode it prevents |
|---|---|---|---|---|
| 1 | KS **registered interest + event push** (not scanning) | Hearsay-II / Corkill | PostToolUse hook injecting ~30 tokens when claims/base-epoch change (`law-pulse.sh` shape) | The bulletin board nobody reads — agents never learn a claim exists |
| 2 | **Two-stage trigger**: cheap condition, then detailed examination | Hearsay-II | Hook emits a terse delta; agent optionally runs `beep agent brief` | Context-window blowout from pushing full state on every edit |
| 3 | `rd` (observe) vs `in` (claim) split | Linda | `beep agent brief` (read-only) vs `beep claim take` (destructive, locked) | **Mode A**: everyone who *sees* the work also *does* it |
| 4 | **Exact-match associative lookup** on typed fields | Linda | Claim keys = derived ids (check name, rule id, file path, PR #), never prose | Two agents describe the same breakage differently and both claim |
| 5 | **Multi-op atomicity / transactions** | FT-Linda; JavaSpaces | Claim take + record write in **one** `flock` critical section | Replicated-worker bug: `in`-then-crash silently *loses* the work item |
| 6 | **Lease** (auto-release of orphaned holdings) | Gray & Cheriton; JavaSpaces | `flock` — kernel releases on process death (**verified**) | "Agent crashed holding a claim" deadlocks the work item forever |
| 7 | **Fencing token / sequencer** | Chubby; Kleppmann | Counter incremented under the same `flock` (**verified gapless at 13-way**) | Hung-then-resumed agent acts on a claim it no longer holds → duplicate PRs |
| 8 | **Enforcement at the resource, not the client** | Chubby sequencer validation | `beep yeet publish` rejects a stale epoch before pushing | Zombie agent opens a competing PR; fencing token with nobody checking it |
| 9 | **Lock-delay** after unclean release | Chubby | Short cooldown before re-granting a claim released by death | In-flight work from the dead holder racing the new holder |
| 10 | **Read lease + invalidation on write** | Gray & Cheriton (cache consistency) | **Base epoch**: PR records the epoch it branched from; policy merges bump it | **Mode B**: in-flight PR silently goes stale, discovered only via 24 red checks |
| 11 | **Stigmergic trace over declaration** | Heylighen; Grassé | Claims *derived* from branches, open PRs, worktrees, `lslocks` | Protocol decay — agents forgetting to announce |
| 12 | **Widen degrees of freedom** to avoid contention | Heylighen (obstacle-pushing) | Partitioned work queue / wave manifests so salient next-actions differ | **Mode A at the source**: 13 agents converging on one salient task |
| 13 | **Cheap bid before selection** | Corkill (KS estimates) | Short claim window; contenders write derived fitness (branch overlap, tree state) | "Single piece of chalk favors the swiftest, not the most appropriate" |
| 14 | **Engineering control > administrative control** | NIOSH; Wayne | All claim ops as side effects of `beep yeet` / `beep worktree` / hooks | The entire voluntary-protocol failure class |
| 15 | **OFD/`flock` ownership, `O_CLOEXEC`** | `flock(2)`; OFD locks | Don't leak lock fds into forked children (**verified hazard**) | Leaked `bun`/`turbo` child holds a claim after its agent exits |
| 16 | **Blackboard regions / indices**, compaction | Corkill | Bounded claim store keyed by id; archive resolved claims | Journal bloat: "maintaining numerous partially completed patterns is expensive" |

---

## Explicitly rejected (network-scale only)

Each of these exists to solve a problem the single-machine setting deletes:

| Rejected | Exists to solve | Why not here |
|---|---|---|
| Raft / Paxos / etcd / ZooKeeper / Consul | Agreement among nodes that may partition | One kernel, no partitions. `flock` is already linearizable locally. |
| Redlock / Redis locks | Locking without a shared kernel | Kleppmann's own critique; we have the shared kernel. |
| TTL + heartbeat + reaper | Detecting death across a network | Verified: kernel releases on death for free, and TTLs *misfire* on agent-scale pauses. |
| Stable/replicated tuple spaces | Surviving node loss | Node loss = workstation loss = whole fleet gone. Replication buys nothing. |
| Cross-machine git-ref sync brokers | Multi-host fleets | Out of scope by constraint. |
| Hosted message brokers / pub-sub | Delivery across hosts | A file + a hook is the delivery channel; adding a broker adds a daemon to babysit. |
| BB1-style control blackboard / scheduler | Dynamic control of complex problem solving | Corkill's own "no" test; Erman's conjecture says we would delete it. |
| GitHub merge queue | Serializing merges | *Not* rejected — genuinely relevant to Mode B, and already in the opportunities ledger. It is the hosted half of the base-epoch idea and should be evaluated on its own merits. |

---

## Addendum — what the theory says about A4 (`OwnershipClaim` declared vs derived)

The relayed amendment A4 asks the grill to choose between **(1)** a
`provenance: "declared" | "derived"` field on one `OwnershipClaim` shape, and **(2)** a
`FleetClaim` that *wraps* `OwnershipClaim` with derivation metadata. It says explicitly that
"the derive-vs-declare balance is precisely what the research is measuring." T2's answer:

**Endorse (2) — but for semantic reasons, not scheduling ones.** The "keeps PR-I shipping on
schedule" argument is real but weak; the theory gives three stronger ones, and one of them says
(1) is actually incorrect rather than merely inconvenient.

**(a) A declared claim and a derived claim are different speech acts.** In Linda terms a declared
claim is an `out(t)` — an *assertion deposited* in the space by an orchestrator, authoritative by
construction. A derived claim is not a tuple at all: it is a **stigmergic trace** *read from* the
medium (§4), and reading a trace is `rd`, not `out`. One is a decision, the other is evidence.
A `provenance` enum flattens a producer/observer distinction into a value field — the exact
conflation §2 warns about, where "seeing the work" becomes indistinguishable from "claiming it."

**(b) `doNotTouch` having "no natural analogue" is diagnostic, not incidental.** Stigmergy encodes
*what has been done*, never *what must not be done* — Heylighen's list of things stigmergy needs
no provision for includes "imposed sequence," and the flip side of not needing one is being
**unable to express one**. Absence of a trace is not evidence of a prohibition. So `doNotTouch`
is **irreducibly declarative** and can never be derived, at any future maturity of the scanner.
Under (1) that field is permanently, structurally empty for half the schema's inhabitants — a
shape that lies about its own domain. Under (2) it stays where it is meaningful.

**(c) The two have genuinely different expiry mechanisms — this is Gray & Cheriton (§3).**
- A **declared** claim is a **lease with a term**: granted by an orchestrator, valid until the
  wave ends, invalidated by *the clock*.
- A **derived** claim is a **cache entry**: no term at all, valid exactly as long as it still
  matches reality, invalidated by *re-observation*.

Those are the two distinct consistency mechanisms in the leases paper, and they are not
interchangeable. Collapsing them behind one flag guarantees one of them gets the wrong
invalidation rule — the classic way a lease design goes silently unsafe. A4's own instinct here
("they expire when the scan goes stale; declared claims expire when the wave ends") is correct
and is the decisive argument.

**(d) Therefore option (2)'s extra fields are required for correctness, not overhead.**
`scanTimestamp`, `signalSource`, and `liveness` are exactly the metadata a cache entry needs to
be validated, and a declared claim needs none of them. Add the §3 **fencing token/epoch** to the
same wrapper: a derived claim asserted from a stale scan must be rejectable at
`beep yeet publish`, which requires the epoch to travel with the derivation metadata.

**Sharpening for the grill.** The cleanest framing is that these are not "two producers of one
record." The fleet scan produces **evidence**; a claim is a **decision minted from evidence**
under `flock`. `FleetClaim` = evidence trail + the minted `OwnershipClaim`. That reconciles
derive-don't-declare with A4's locked shape at zero cost to PR-I: we derive the *inputs*, and the
declaration becomes a mechanical side effect of the tool (§5) rather than something an agent
remembers to write. **Derive the evidence, mint the claim, fence the mint.**

## Artifacts produced

- `flock-probe.sh` — crash-release, hang-retention, and lock-introspection probes.
- `ofd-probe.py` — POSIX `F_SETLK` footgun vs OFD locks; fork-inheritance hazard.
- Inline sequencer probe — 13-way contention, gapless monotonic tokens.
- `corkill.txt`, `heylighen.txt`, `ftsurvey.txt` — extracted primary sources.

## Sources

- [Corkill, *Blackboard Systems* (AI Expert, 1991)](https://mas.cs.umass.edu/Documents/Corkill/ai-expert.pdf)
- [Nii, *Blackboard Systems* Part One](https://onlinelibrary.wiley.com/doi/abs/10.1609/aimag.v7i2.537) / [Part Two](https://onlinelibrary.wiley.com/doi/abs/10.1609/aimag.v7i3.550) (AI Magazine, 1986)
- [Hayes-Roth, *A Blackboard Architecture for Control* (AI 26:251-321, 1985)](https://www.semanticscholar.org/paper/A-Blackboard-Architecture-for-Control-Hayes-Roth/c79a41dc13c796c26388f8cbf599c67126374e39) · [BB1 tech report](http://iiif.library.cmu.edu/file/Newell_box00077_fld05423_doc0001/Newell_box00077_fld05423_doc0001.pdf)
- [De Florio & Blondia, *A Survey of Linguistic Structures for Application-level Fault-Tolerance*](https://arxiv.org/pdf/1504.03256) (Linda fault-tolerance, replicated-worker failure)
- [JavaSpaces Service Specification (Apache River)](https://river.apache.org/release-doc/2.2.2/specs/html/js-spec.html) · [Lease/automatic expiration](https://docs.gigaspaces.com/latest/dev-java/leases-automatic-expiration.html)
- [Gray & Cheriton, *Leases* (SOSP 1989)](https://web.eecs.umich.edu/~mosharaf/Readings/Leases.pdf) · [summary](https://blog.acolyer.org/2014/10/31/leases-an-efficient-fault-tolerant-mechanism-for-distributed-file-cache-consistency/)
- [Burrows, *The Chubby Lock Service* (OSDI 2006)](https://research.google/pubs/the-chubby-lock-service-for-loosely-coupled-distributed-systems/) · [notes](https://github.com/jguamie/system-design/blob/master/notes/chubby-lock-service.md)
- [Kleppmann, *How to do distributed locking* (2016)](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [Heylighen, *Stigmergy as a Universal Coordination Mechanism*](https://pespmc1.vub.ac.be/Papers/Stigmergy-varieties.pdf) (Cognitive Systems Research, 2016)
- [NIOSH Hierarchy of Controls (CDC)](https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html)
- [Wayne, *The Hierarchy of Controls (or how to stop devs from dropping prod)*](https://www.hillelwayne.com/post/hoc/)
- `man 2 flock`, `man 2 fcntl` (local, util-linux/glibc on this workstation)
