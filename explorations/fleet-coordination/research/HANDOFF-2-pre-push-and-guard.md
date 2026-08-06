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
