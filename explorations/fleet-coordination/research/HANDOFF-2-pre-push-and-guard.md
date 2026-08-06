# Handoff #2 to speed-loop — pre-push wiring (PR-G) and the staleness guard

**From:** fleet-coordination packet, `beep-effect5`
**To:** speed-loop campaign, `beep-effect3-pra`
**Date:** 2026-08-04
**Basis:** fleet-coordination grill #1, decisions D2 and Q7 disposition.

Two items are handed to you rather than fixed here, for the same reason: both
edit `Yeet/internal/*`, which PR-E is actively building in, and T5's conflict
scan already shows `beep-effect3/.claude/worktrees/vigilant-mclaren-c9b1de`
predicting conflicts in `Handler.ts` and `Verdict.ts` right now. Editing yeet
internals from a parallel clone is the exact collision this packet exists to
prevent.

---

## Item 1 — `beep yeet` is not an engineering control (→ PR-G)

**Finding.** `lefthook.yml` defines `pre-commit`, `commit-msg`, `post-merge` —
**no `pre-push`**. The installed `.git/hooks/pre-push` shells to lefthook and is
therefore a no-op. `git push && gh pr create` bypasses yeet entirely. By Hillel
Wayne's test this is an administrative control wearing an engineering control's
clothes, and three of five research tracks built recommendations on top of the
assumption that it was a real chokepoint.

**The mechanism is already three-quarters built:**

| Piece | State |
|---|---|
| `beep yeet pre-push-hook` command | Exists — `Yeet.command.ts:342` |
| `runPrePushHookMode` | Exists, fail-closed — `Handler.ts:526` |
| `assertReusableVerifiedState` | Requires matching branch, base, head, commit SHA, diff fingerprint, `proofTier === "full"` — `ProofState.ts:705` |
| `BEEP_YEET_REUSE_PRE_PUSH_PROOF=1` on `pushStep` | Planted — `Planner.ts:442` |
| A consumer that reads that marker | **Missing** |
| `pre-push` stage in `lefthook.yml` | **Missing** |

`packages/tooling/tool/cli/test/yeet.test.ts:391` asserts the plan *emits* the
marker. Nothing asserts anything *honors* it.

### Work items

1. **`lefthook.yml`** gains a `pre-push` stage running
   `bun run beep yeet pre-push-hook`.
2. **`runPrePushHookMode` must honor `BEEP_YEET_REUSE_PRE_PUSH_PROOF=1` as
   passthrough.** Without this, `beep yeet publish --fast --monitor` blocks
   itself: `Planner.ts:610` omits the proof step entirely under
   `fast && monitor`, so no `full` proof state exists at push time. That flag
   combination is in active use — you shipped #558 with it.
3. **Open design conflict — yours to settle.** `earlyPushStep` deliberately does
   **not** carry the marker. Its comment (`Planner.ts:430-431`) reads: *"early
   push: `--no-verify` would publish unverified content to the remote before any
   hook could block secrets or policy violations."* But `earlyPushStep` runs
   **before** `proofStep` in the early-publish plan (`Planner.ts:598-606`), so a
   wired pre-push hook blocks `--start-pr-early` **by construction**. Wanting
   hooks to run there and wanting them to assert a full proof are incompatible as
   written.

   *Input, not a ruling:* `gitleaks protect --staged --config .gitleaks.toml`
   already runs at **pre-commit**, so the secret-blocking rationale in that
   comment is satisfied earlier in the pipeline — a commit cannot exist with
   staged secrets in it. That argues the marker can safely ride on
   `earlyPushStep` too, but it is your call and the comment's author may have had
   a case we did not reconstruct.
4. **`assertReusableVerifiedState`'s failure text is wrong in hook context.** It
   says *"yeet publish --reuse-verified found stale proof state"* regardless of
   caller. Invoked from a git hook that is a misleading instruction — a #50
   teach-at-point-of-failure fix, and a natural rider since you are in the file.

### Blast radius to weigh before flipping it blocking

Wiring this fail-closed hard-blocks **every** ad-hoc `git push` across all
checkouts unless a matching full proof exists. Three clones were dirty at
handoff time (57 / 5 / 3 files). `LEFTHOOK=0` remains the escape hatch, but
that is administrative again. An advisory-first period was considered and
rejected here only because we were not the right owner — it remains available
to you, though note it cuts against the gates-diet doctrine.

---

## Item 2 — policy-surface staleness guard: compare against #21/#25 first

**Disposition.** Handed over with one binding input and one recommendation.

**Binding input — the measure-first law (fleet-coordination D3).** No path enters
a policy surface unmeasured. T4's proposed 14-path surface touches **52.6% of the
last 253 first-parent `main` commits** and would hard-fail 53% of publishes at one
commit behind, 98% at five — it reproduces the treadmill it was meant to kill.
Measured against commit frequency: `biome.json*` **4.0%** and `turbo.json` **5.1%**
pass the bar; `package.json` **38%**, `packages/tooling` **34%**, `bun.lock` **31%**,
`tsconfig` **29%** fail it. `.beep/**` is **untracked** (0.0%) and contains no laws.

**Recommendation — compare against #21/#25 before building it.** The synthesis
records that **no research track ever compared them**, and that #21 (input-hash
proof-carrying jobs) and #25 (prove-the-merged-object; proofs keyed to tree hashes
survive pushes and rebases) attack the same re-verify tax with no ruleset change
and no vendor. If #25 is viable, the narrow guard is redundant rather than
complementary. The guard is an afternoon; #25 is not — which is an argument for
sequencing, not for skipping the comparison.

---

## Item 3 — `yeet publish` without `--monitor` exits 1 on success (regression from #551)

**Found by tripping it**, publishing this packet on 2026-08-05. The publish was
completely successful — commit `684cd6d9dd`, full proof green, push landed, PR
#562 created and reported `OPEN` — and then the process exited 1 with
`Failed to decode pull request number for yeet monitor.`

**Mechanism.** `runPublishMonitorAndResult` calls `runMonitorPhase`
**unconditionally** (`Handler.ts:662`), from both publish call sites
(`Handler.ts:451` for `--start-pr-early`, `:496` for the normal path). But the
planner emits monitor steps **only** under `--monitor` — all three plan variants
read `...(options.monitor ? monitorSteps(context) : [])`
(`Planner.ts:595`, `:605`, `:614`). With an empty step list:

| Step | Result |
|---|---|
| `A.filter(monitorSteps, id === "monitor:01-pr-context")` (`:630`) | `[]` |
| `runPhase(context, [], recorder)` (`:632`) | `[]` — `A.some(...)` is false, so the exit-code check passes vacuously |
| `A.head` → `O.getOrElse(() => Str.empty)` (`:636-641`) | `""` |
| `S.decodeUnknownEffect(S.fromJsonString(GhPrView))("")` (`:642`) | **fails** |

Verified empirically: no `monitor:*` step appears anywhere in the run log, and
the failure lands after the `yeet status` block has already printed
`remote: PR #562 OPEN`.

**Introduced by `aee2664b91` (#551, 2026-08-04).** Before that commit the body of
`runMonitorPhase` was `yield* runRequiredPhase(context, monitorSteps, recorder,
failureMessage)` — a harmless no-op on an empty array. #551 replaced it with the
context/checks split plus a mandatory JSON decode of the first context result and
did not carry the empty case across. The author knew the array can be empty:
`Handler.ts:665` guards `printOperatorStatusSummary` on
`!A.isReadonlyArrayEmpty(monitorSteps)`, three lines below the unguarded call.

**Blast radius.** Every `yeet publish` that does not pass `--monitor` — including
the plain `publish --message` that `CLAUDE.md` names as the default — now exits
non-zero after a fully successful commit, push, and PR creation. It has likely
gone unnoticed because the speed-loop session has been publishing with
`--fast --monitor`. Anything that branches on yeet's exit status (scripts, hooks,
an agent reading the return code) currently reads a successful publish as failed.

**Fix.** Early-return from `runMonitorPhase` when `monitorSteps` is empty — or
move the existing `:665` guard up to cover the `:662` call. Note the guard cannot
simply move to `contextResults` being empty without also deciding what
`runPublishMonitorAndResult` should do about the status summary; the two are one
decision.

**Why you and not us:** same reason as items 1 and 2 — `Yeet/internal/Handler.ts`
is PR-E's active build surface, and this is #551's own regression.

**It is also a live Mode B specimen.** A repo-wide change landed in a shared file
on 2026-08-04 and silently broke the default publish path for every other
checkout in the fleet. No in-flight PR conflicted with it textually, so no
conflict-based detector could have seen it; it surfaced a day later only because
someone tripped over it. That is the exact failure this packet exists to catch,
observed in the session that published the packet.

---

## Also relevant to your queue

- **`merge_group` degrades two required security-relevant gates.** commitlint
  drops to one commit (`check.yml:599-609`) and gitleaks runs with `-1` and the
  base-pinned scanner-config hardening bypassed (`:657-681`). Both would pass
  vacuously. Fix before any ruleset flip, independent of whether merge queue is
  ever adopted.
- **Correction against T4 on `strict_required_status_checks_policy: true`:** it
  does **not** rebase anything. Cost is roughly one extra run per merged PR
  (~8/day), not the 67–208/day herd T4 rejected — T4 conflated it with an
  auto-rebase bot. Given K8 (PR lanes run `--affected --base origin/main`, so
  base-side policy breakage in untouched packages is invisible), it closes a real
  hole. Still gated behind a green gauntlet.
- **Decision 36 audit:** remaining `[ -d .git ]` sites across the repo miss all
  linked worktrees. `find -maxdepth 2 -not -path '*/.git/*'` also does **not**
  exclude `.git` itself — that gave a 100%-false-positive liveness signal
  fleet-wide before correction. Use `-name .git -prune`.
- **`FETCH_HEAD` lives in `--git-common-dir`, not `--git-dir`** — reads from a
  linked worktree silently return nothing. Relevant to #39 sweep and #48.
- **`status --porcelain` without `-uall`** collapses untracked directories, so a
  new package's 40 files count as one path. Relevant anywhere you compute a
  change surface.
