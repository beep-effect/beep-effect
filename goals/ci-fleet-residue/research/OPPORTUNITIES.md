# ci-fleet-residue — friction and opportunity ledger

Record receipts at the moment friction happens; redact for the public repo.

## Seed context (2026-08-13, from the split)

- Spot evidence: 3 same-second reclaims killed 6 jobs on cutover evening
  (2026-08-11 19:49:32Z sweep); on-demand since. A calm-week baseline is the
  revert precondition.
- IMDS attribution is CONFOUNDED: the original DROP rollback blamed the
  firewall, but the toolbelt post-install reproduced the identical
  runner-start failure with no firewall (inline set -u leak). Retest
  subshell-scoped.
- Closeout writer bug field evidence: PR #668 and #673 closeouts both
  emitted reviewedHeadSha as a raw Option object.
## 2026-08-13 — mid-publish worktree writes would fail proof-changed-worktree

- What: while a `yeet publish` full proof was running for the P3 closeout
  writer fix, packet research notes were written into
  `goals/ci-fleet-residue/research/`. `validatePostCommitProofDidNotChangeWorktree`
  fails the publish when ANY staged/unstaged/untracked path exists post-proof,
  regardless of who created it — the files had to be parked in `/tmp` and
  restored after the push.
- Evidence: `packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts`
  (`proof-changed-worktree` packet, "no staged, unstaged, or untracked paths
  remain").
- Prevention: a path-set diff (snapshot at commit, fail only on new paths)
  does NOT work — files an agent writes during the proof are new paths in
  the post-proof set and still fail, while grandfathering baseline paths
  would mask proof-time mutations of those files. The honest options are
  isolation or messaging: run the proof against a detached worktree of the
  committed HEAD (the head-install preflight already builds exactly that
  machinery), or emit an explicit advisory at publish start ("worktree is
  sealed until push") so operators/agents park side work elsewhere.

## 2026-08-13 — no safe porcelain for bumping a locked transitive dep

- What: a fresh advisory (GHSA-2v37-7h3g-55p8, nanoid <3.3.18) failed
  `repo-sanity:bun-audit` and `pre-push:security` mid-arc — environment
  class, identical tree had passed ~40 min earlier. Remediation required
  bumping ONLY the transitive `nanoid@3.3.17` (under postcss/docx), and no
  bun porcelain does that: `bun update nanoid` silently ADDS `nanoid@^6` as
  a root direct dependency (wrong and does not fix the locked 3.3.17);
  `bun update docx` re-resolved docx's own subtree but left `postcss/nanoid`
  at 3.3.17; a root `overrides` entry would force the 5.x consumers down.
  Ended up hand-patching the `bun.lock` entry (version + registry
  `dist.integrity`) and verifying with `bun install --frozen-lockfile` +
  both security lanes.
- Evidence: bun.lock one-line diff `nanoid@3.3.17 -> 3.3.18`;
  `bun audit` / osv-scanner green after; `bun install` accepted integrity.
- Prevention: a `beep` helper (or documented recipe) for
  "bump one locked transitive to a fixed release": patch the lock entry
  with registry integrity, frozen-install to verify, run both audit lanes.
  Advisory-feed failures mid-publish are recurring; the repair should be a
  one-command ritual, not lockfile surgery.
