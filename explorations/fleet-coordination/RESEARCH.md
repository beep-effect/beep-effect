# Research — fleet coordination

Five tracks, each adversarially verified, then synthesized (11 agents, ~1.39M
tokens, 2026-08-04). Full detail in [`research/SYNTHESIS.md`](./research/SYNTHESIS.md);
per-track deliverables beside it. **Every number here is post-verification** —
where a track's figure was refuted, the refuted figure does not appear.

Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## Bottom line

**Build a mirror, not a message board. Buy nothing.** Smallest first build: a
read-only derived fleet view (`beep worktree fleet`) delivered through the
already-locked `AgentBrief.fleet` field. Every input is on disk; it needs zero
agent cooperation and has no protocol for anyone to forget.

The design order that fell out of verification: **derive early, deliver
ambiently, enforce late** — not "enforce at the gate and call it coordination."
Three of five tracks independently recommended enforcing at `beep yeet`; it is
both not currently a gate (K2) and the *latest* possible point, firing after the
duplicate spend Mode A exists to prevent.

## Killed assumptions

Verified independently in-session before acceptance, because each invalidated a
claim this investigation had already made confidently.

| Assumption | Verdict | Evidence |
| --- | --- | --- |
| `law-pulse.sh` proves a working push channel | **DEAD** | `PostToolUse` + plain stdout + exit 0 reaches the debug log only. Docs: *"The exceptions are `UserPromptSubmit`, `UserPromptExpansion`, and `SessionStart`, where stdout is added as context."* Silent no-op 2026-07-05 → 2026-08-04. **Fixed in this PR**; confirmed live in-session. |
| Every agent passes through `beep yeet` before pushing | **DEAD** | `lefthook.yml` defines `pre-commit`, `commit-msg`, `post-merge` — no `pre-push`. Installed `.git/hooks/pre-push` shells to lefthook and is a no-op. `git push && gh pr create` bypasses yeet entirely. |
| The fleet is mixed Claude + Codex, so a cross-harness transport must be bought | **DEAD** | `~/.zshrc`: `claudex`, `claudeg`, `claudep` all exec the **`claude` binary** with `--model` overrides through a proxy. One harness, several models. Codex appears only as ad-hoc sessions and companion children. |
| `flock` is released by the kernel on holder death | **DEAD** | Released only when the **last descendant holding the inherited fd** closes it. Reproduced: SIGKILL the holder, leave one child alive, `lslocks` still shows it held. This fleet orphans `bun`/`turbo` children constantly. Also: lock lifetime ≠ claim lifetime. |
| PR checks already detect Mode B (`refs/pull/N/merge`) | **DEAD** | The merge ref is real, but lanes run `--affected --base origin/main`, so the affected set is exactly the PR's own files. A policy change on main that breaks an untouched package is in the tree but not in scope. No run is triggered by base movement at all. |
| Merge queue is the mechanical answer worth adopting now | **DEAD at measured shape** | 2 open PRs ⇒ single-entry merge groups ⇒ speculation buys nothing. Median base drift at merge is 1 commit (p90 2, 33% zero). Main's full-repo gauntlet passes **19%** (39/206, 30d) — a queue makes an 81%-red gauntlet the only path to main. |
| A broad policy-surface staleness guard is the top value-per-effort item | **DEAD on calibration** | 52.6% of the last 253 first-parent `main` commits touch the proposed 14-path surface; the surfaces that actually cause Mode B are rare (`biome.json*` 4.0%, `turbo.json` 5.1%) and `.beep/**` is untracked. Would hard-fail 53% of publishes at 1 commit behind. |

## Load-bearing survivors

**Delivery physics.** Model-context injection in a live session is hook-only and
`additionalContext`-only; `hook_success` ≠ context. `PreToolUse` →
`permissionDecision: "deny"` works even under `--dangerously-skip-permissions`
and is the only pre-write enforcement vector — but `matcher: "Edit|Write"` misses
every Bash-mediated write (heredocs, `sed -i`, `git apply`, and this repo's own
mandated codegen). `FileChanged` fires inside a session blocked mid-`Bash`-call,
driven by an external write: a busy agent is *unreachable for words, reachable
for actions*. Injected context is replayed verbatim on `--continue`/`--resume`,
so bulletins must be epoch-stamped facts, never "as of now" statements.

**Derivation.** `git merge-tree --write-tree --name-only HEAD <target>` is a real
offline Mode-B oracle at ~50–65 ms, safe against a checkout an agent is actively
editing, and **it works on unpushed branches, which a merge queue never sees**.
Its blindness is HEAD-only. `/proc/<pid>/cwd` liveness: 890 ms in bash, **6.8 ms
in Bun** — on one machine liveness is directly observable, which is the thing
fifty years of leases literature works hardest to approximate.

**Theory.** Observe ≠ claim (Linda's `rd` vs `in`): if reading the work list is
indistinguishable from taking it, Mode A is unsolved by construction. Claim keys
must be mechanically derived, never prose. Wayne's test — *does breaking it take
effort, or does following it take effort?* — is how K2 was found, and it should
be applied to this design's own recommendations.

## In-repo capability inventory

Net new surface for the whole program: **one widened enumeration, one schema row
(`FleetCheckout`), one wrapper (`FleetClaim`), one field on a locked schema, one
subcommand.** Everything else routes into commands that already have owners.

| Existing capability | Location | Relation |
| --- | --- | --- |
| `beep worktree doctor` | `packages/tooling/tool/cli/src/commands/Worktree` | Single-clone by design; widen its enumeration to all checkouts sharing the origin URL. |
| `AgentBrief` + `fleet` block | speed-loop PR-I (#52, decisions 26/35b) | The ambient delivery surface, already reserved. |
| `OwnershipClaim` | speed-loop PR-I (#49, decisions 28/35a/37) | Provenance-free claim record; the fleet layer **wraps** it. |
| `beep agent report list` | speed-loop PR-I (#45, decisions 27/35c) | Session-independent report discovery — a live agent's own account of `filesTouched`. |
| `beep yeet pre-push-hook` | `Yeet.command.ts:342`, `Handler.ts:526` | **Built, fail-closed, and never wired** — see Q0. |
| `BEEP_YEET_REUSE_PRE_PUSH_PROOF` | `Planner.ts:442` | Set on `pushStep` to mark yeet-origin pushes; **no consumer reads it**. A test asserts the plan emits it. |
| `standards/git-worktrees.md` | repo standards | States "disjoint file sets per lane" as prose with zero enforcement. |

## Q0 — the finding that replaced P0 #2

The synthesis called for a ten-line `pre-push` stage to convert `beep yeet` from
convention into engineering control. Inspection before shipping found the
mechanism is **three-quarters built**: the command exists, its mode is
fail-closed (`assertReusableVerifiedState` requires matching branch, base, head,
commit SHA, diff fingerprint, and `proofTier === "full"`), and `pushStep` already
plants an origin marker. Two wires are missing, and one is a genuine design
conflict rather than an oversight:

- Nothing reads `BEEP_YEET_REUSE_PRE_PUSH_PROOF`, so a naive wiring blocks
  `publish --fast --monitor` — which omits the proof step entirely
  (`Planner.ts:610`) and is in active use.
- `earlyPushStep` deliberately does **not** carry the marker; its comment
  (`Planner.ts:430-431`) says early push must stay hook-visible so secrets can be
  blocked. But early push runs *before* the proof step, so a wired hook blocks
  `--start-pr-early` **by construction**. Wanting hooks to run there and wanting
  them to assert a full proof are incompatible as written.

This is a decision, not a fix. It leads the align stage.
