# Sources — fleet coordination

Provenance ledger. Claims that survived adversarial verification are marked
**confirmed**; claims killed in verification are recorded with their refutation
so they are not re-derived later.

## Method

Five parallel research tracks (Opus 5), each followed by an adversarial verifier
instructed to refute rather than agree and to default to refuted when unable to
confirm, then a synthesis pass. 11 agents, ~1.39M tokens, 2026-08-04. Workflow
script and per-agent transcripts under the session's workflow directory.

Three findings were re-verified by hand in the main session before acceptance,
because each invalidated a claim the investigation had already made:
`law-pulse.sh`, `lefthook.yml`, and the harness composition of the fleet.

## Primary — official documentation

| Source | Used for | Status |
| --- | --- | --- |
| `code.claude.com/docs/en/hooks` (redirect from `docs.claude.com/en/docs/claude-code/hooks`) | Hook event capability matrix; exit-code semantics; which events add stdout to context; `hookSpecificOutput.additionalContext` behavior | **confirmed**, quoted directly |
| GitHub docs — merge queue, `merge_group` event, required checks, rulesets | Merge-group formation, required-check interaction, batching | **confirmed** |
| Zuul CI documentation — dependent pipelines, speculative execution | The speculative-merge model as the mechanical answer to Mode B | **confirmed** |

## Primary — this machine and this repo

Measured live rather than assumed. Commands and costs recorded in
[`T5-derivation.md`](./T5-derivation.md).

| Source | Finding |
| --- | --- |
| `~/.zshrc` | `claudex`/`claudeg`/`claudep` exec the `claude` binary with `--model` overrides — the interactive fleet is one harness |
| `lefthook.yml`, `.git/hooks/pre-push` | No `pre-push` stage; installed hook shells to lefthook and no-ops |
| `.claude/hooks/law-pulse.sh` | Bare `echo` from `PostToolUse` — never reached the model |
| `Yeet.command.ts:342`, `Handler.ts:526`, `ProofState.ts:705`, `Planner.ts:430-443,610` | `pre-push-hook` built and fail-closed; origin marker planted with no consumer; `--fast --monitor` omits the proof step; `earlyPushStep` pushes before proving |
| `/proc/<pid>/cwd` scan, `git merge-tree`, `git ls-remote` | Liveness 6.8 ms in Bun (890 ms in bash); conflict oracle ~50–65 ms; ground-truth main ~0.9 s |
| `gh api` — 30d run history, open PRs, merge history | Main gauntlet pass rate 19% (39/206); ~2 concurrent open PRs; median base drift 1 commit |
| `.github/workflows/check.yml:599-609,657-681` | `merge_group` degrades commitlint to one commit and gitleaks to `-1` with base-pinned scanner config bypassed |
| Live collision matrix across 69 checkouts | Top contention: `bun.lock` (20), `goals/INDEX.md` (16), `package.json` (13); 4 of 5 live collisions intra-wave on generated aggregates |

## Secondary — prior art surveyed

Products and projects evaluated in [`T1-prior-art.md`](./T1-prior-art.md), with
the verdict for a single-machine, CLI-native, 13-checkout fleet.

| Source | Verdict |
| --- | --- |
| `hcom` (MIT, Rust, single binary, mid-turn injection, PTY wake) | **Reject.** Fleet is not mixed, so Codex parity evaporates; PTY wake of idle agents is near-worthless when `SessionStart`/`UserPromptSubmit` deliver on next engagement; enrollment is total trust; installs hooks into `~/` config dirs, colliding with existing hook governance |
| Claude Code **Agent Teams** (v2.1.32) | Wrong shape (one team per session, lead owns lifecycle) but the **first-party reference design** — file-locked task claiming, per-agent mailboxes, `TaskCreated`/`TaskCompleted`/`TeammateIdle` hooks. Strongest confirming data point for work-item granularity |
| MCP Agent Mail, Gastown, Beads | Fail the "must beat shared-dir + flock on its own merits" bar: daemon, 38 MCP tools, TUI/web UI, or Dolt + tmux services |
| Mergify / Aviator / Graphite / Trunk merge queues | Batch-failure bisection studied; all deferred with merge queue itself |
| In-process multi-agent frameworks (AutoGen, CrewAI, LangGraph, A2A, ACP) | Coordinate subagents inside one orchestrator process — a different problem shape from independent OS-level sessions in separate checkouts |

**Citation-integrity note:** T1 attributed the phrase *"No broadcast by design"*
to the MCP Agent Mail README. Verification found the phrase absent, and that the
product in fact ships a Human Overseer composer with select-all and a
contact-policy bypass. The defensible negative is narrower and still useful:
**nobody wires broadcast to a base-branch-landing event and delivers it by push.**

## Secondary — design theory

Extracted for failure modes rather than survey; detail in
[`T2-theory.md`](./T2-theory.md).

| Source | Used for |
| --- | --- |
| Blackboard architecture — Hearsay-II, HASP/SIAP, BB1; Nii (1986); Corkill | The control problem; two-stage trigger (terse delta, then let the agent spend a call on detail) |
| Linda / tuple spaces — Gelernter; JavaSpaces | `rd` vs `in` — observe ≠ claim; orphaned tuples |
| Leases — Gray & Cheriton; Chubby lock+sequencer | Liveness under holder death; fencing tokens; why TTL alone is unsafe. **Endorses decision 37**: declared claims expire by clock, derived claims expire by re-observation — two different mechanisms that must not share one invalidation rule |
| Stigmergy / ant-colony coordination — Heylighen | Coordination through environmental traces: derive claims rather than ask agents to declare them |
| Hillel Wayne — engineering vs administrative controls | The test that found K2 |

## Cross-session provenance

Ownership transfers and schema reservations negotiated with the concurrent
speed-loop session in `beep-effect3-pra`, ratified as its grill decisions 34–38
and recorded in [`HANDOFF-to-beep-effect3.md`](./HANDOFF-to-beep-effect3.md) and
[`AMENDMENTS-from-beep-effect3.md`](./AMENDMENTS-from-beep-effect3.md). Speed-loop
ledger items referenced throughout: #16, #21, #22, #25, #39, #42, #45, #48, #49,
#52, #53, #54, #56, #57, #60.
