# Batch migration, 2026-11-13 (S9)

Step S9 of `research/design-pr-a.md` §5. It ran from lane
`feat/goal-closeout-hosted-verification` (base `7a462a27d4f`) with S1-S7 in
the working tree. `origin/main` was at `ae6ab98b3c6` when the migration
claims reader and the `merge-queue-lab` restore read it. The record holds
numbers, file names and digests only. Every receipt below is a
`goal-completion-receipt/v2` row in the shared workstation store, written by
`goals completion refresh` between 05:04Z and 05:08Z, except
literal-kit-subset-algebra's, written at 05:19Z.

## Outcome per packet

| Packet | Final | Outcome | Required contexts at the head | Threads (outstanding/total) | Receipt digest (16) |
| --- | --- | --- | --- | --- | --- |
| goal-packet-conflict-free-appends | #2869 | verified | 15 success | 0/0 | `5ae7e052e376b8b2` |
| hold-ledger | #2755 | verified (rule suite bypassed) | 15 success; Test Unit is the newest run, green after the merge | 0/0 | `940dae56fd1ad097` |
| lejeune-demo-corpus-and-ontology | #2756 | verified (rule suite bypassed) | 15 success; Test Unit green after the merge | 0/0 | `5a7540ad63e23bea` |
| packet-archive-mechanics | #2998 | verified | 15 success | 0/0 | `3c75dc0f76a66d43` |
| scripts-to-beep-cli | #3027 | verified | 8 success, 7 skipped | 0/0 | `8ef47891ad367381` |
| merge-queue-lab | #3169 (see below) | verified | 6 success, 9 skipped | 0/0 | `c0b5270360177c6b` |
| alchemy-vault-sync-slice | #3132 | verified (refresh only) | 8 success, 7 skipped | 0/0 | `1d392acec88bdf88` |
| citation-extraction-engine | #2966 | verified with attributed reds, **pending commit** | 11 success, 4 cancelled | 0/10 | stored `unsatisfied`: `37d34874ed626e24` |
| research-intake-2026-11 | #2963 | verified with attributed reds, **pending commit** | 11 success, 4 cancelled | 0/0 | stored `unsatisfied`: `57250e7f30a16f07` |
| beep-effect-web-alchemy (archived) | #2583 | verified (receipt only, DN-23) | 15 success | 0/1 | `16bd1780878a9ca1` |
| literal-kit-subset-algebra (archived) | #2080 | unsatisfied, stays unverified (receipt only, DN-23) | 10 success, 5 cancelled, 2 failure (17 required under ruleset version 53390820) | 0/12 | `73732d12e8af765b` |

The seven verified packets have a stored receipt that matches the
post-migration declaration digest. Offline `goals doctor` prints
`completed-retained (verified via #N)` for each of them, and still does
after the status-prose and phase edits below, which the digest does not
cover.

### Pending commit: citation-extraction-engine and research-intake-2026-11

Both attribution files exist only in the working tree, so the stored receipts
are `unsatisfied` (DN-6). Refresh printed `would verify once committed` for
both files:

- `goals/citation-extraction-engine/decisions/2026-11-13-final-2966-attributed-reds.md`:
  Heavy / Check, Heavy / Docgen, Heavy / Doctest `introduced`, fix #2984;
  Heavy / Test Integration `inherited`, fix #2994 (`unblocks-main`).
- `goals/research-intake-2026-11/decisions/2026-11-13-final-2963-attributed-reds.md`:
  Heavy / Docgen `introduced`, fix #2975; Heavy / Check, Heavy / Doctest and
  Heavy / Test Integration `introduced`, fix #2985.

Each fix PR was checked against GitHub: it merged, its head contains the
final's merge commit (`git merge-base --is-ancestor`), and the attributed
context passed on that head. The cause for each context follows DN-24. The
run and job ids are in each file's body. After the orchestrator commits,
`goals completion refresh --slug citation-extraction-engine` and
`--slug research-intake-2026-11` must print
`verified (claims at HEAD only: …; not done until they merge)`.

### literal-kit-subset-algebra

The receipt-only refresh printed `unsatisfied` with seven unattributed reds:
Heavy / Check, Heavy / Docgen, Heavy / Doctest, Heavy / Effect Diagnostics
and Heavy / Test Integration (cancelled) and Lint and Test Unit (failure).
This matches the 2026-11-12 read in `research/map-migration.md`. Nothing was
written to the tombstone. DN-23 forbids an attribution file there, so the
packet stays unverified, and offline `goals doctor` now reports its stored
receipt as the advisory `completion-gate-unsatisfied`. The refresh's `next:`
line still suggests `goals decisions add literal-kit-subset-algebra`, which
does not apply to a tombstone. The stored row keeps the hosted facts after
the merge-push rule suite leaves GitHub's one-month listing (about
2026-11-22). After that, only an operator ruling recorded in the archive
repository could close the packet, and no reader looks there (design §9
risk 4).

## Writes

| Packet | Files |
| --- | --- |
| goal-packet-conflict-free-appends | `ops/manifest.json` (`closeout` #2869, proposal deleted, `{2874, supporting}` added per DN-22), `README.md` Lifecycle line |
| hold-ledger | `ops/manifest.json` (`closeout` #2755, the existing #2755 entry raised to `final`, `{2865, supporting}` added per DN-22), `README.md` Lifecycle line |
| lejeune-demo-corpus-and-ontology, packet-archive-mechanics, scripts-to-beep-cli | `ops/manifest.json` (`closeout`, proposal deleted), `README.md` Lifecycle line |
| citation-extraction-engine, research-intake-2026-11 | the same, plus the new decision file above and its regenerated `SPEC.md` block |
| merge-queue-lab | `goals/merge-queue-lab/` restored byte for byte from `origin/main` (`decisions/2026-11-13-migration-merge-queue-lab-takes-main.md`) |
| alchemy-vault-sync-slice, beep-effect-web-alchemy, literal-kit-subset-algebra | none |

Every adoption ran `bun run beep goals set-status <slug> completed-retained`,
which took the legacy proposal's own final (DN-17 rule 1).

The writer flips the status fields and the README Lifecycle line only. The
old-route packet-state PRs (for example #2985 and main's #3169 for
merge-queue-lab) also closed the packet's phases and rewrote its status
prose. S11 leaves completed packets alone, so the seven adopted packets got
that pass here:

- `ops/manifest.json`: the phases still `in-progress` or `pending` (the Yeet,
  Close and hosted-proof phases, 11 entries) are now `complete`. The
  `statusNote` of citation-extraction-engine and lejeune-demo-corpus-and-ontology
  said that merge and adoption were still pending. Both now name the final.
- `README.md`: the "Current Phase" paragraph (citation-extraction-engine's
  status paragraph, which has no such heading) now names the final, says how
  it verifies, and links this note. Before, it said a proposal or re-final
  was pending, or that the lifecycle stayed `active`. lejeune's Lifecycle
  line no longer says the final only proposed completion. hold-ledger's
  Latest Evidence gained a 2026-11-13 entry recording #2755 as final and
  #2865 as supporting (DN-22).

None of these fields feeds `goalCompletionDeclarationDigest` (`initiative.id`,
`packetId`, `completionGate`, the closeout slot and `pullRequests`), so the
stored receipts still match.

## Other committed closeouts (§5 step 7)

`goals doctor --online` was not run in this step, for two reasons:

- It has to run on the committed state. Until the orchestrator commits the
  two attribution files, DN-6 does not count them, and an online run would
  report `closeout-unverified` for #2966 and #2963.
- It costs more than the step's quota (about 200 REST and 20 GraphQL). The lane
  has 34 committed closeouts. All of them merged on or after 2026-10-28, so all
  are inside the 28-day window until 2026-11-25. They cover 31 distinct finals
  (#2488 closes two packets and #2985 three, so 34 − 1 − 2). At roughly 12 REST
  calls and one GraphQL call per final, that is about 372 REST and 31 GraphQL,
  plus a `pulls/{n}` pre-check for each legacy completed row that names a
  final. After the S12 merge of `origin/main` (`6c2dc6a51fd`), skill-effect-probe
  adds a 35th closeout and a 32nd final (#3210): about 384 REST and 32 GraphQL.
  Recount after the last `origin/main` merge before sizing the run. Other sessions
  were also drawing the same token heavily (core use rose by about 360 in the
  few minutes before the 05:19Z refresh).

The offline evidence instead:

- Offline `goals doctor` prints `verified via #N` for all 25 committed
  closeouts outside the 11. There were 26 committed closeouts at base,
  #3132 included. These are stored v1 `verified` rows, which DN-8 returns as
  stored.
- #2985, which closed three packets through the status-only bypass, was
  refreshed through t3code-fleet-rollout: `verified`, 15 success and 0 of 9
  threads outstanding (digest `9f31ee8099214ee2`). t3code-harness-mcp and
  t3code-spill-routing share the final and keep their stored v1 rows.
- #3132 (alchemy-vault-sync-slice) is `verified` above.

Since base, `origin/main` closed skill-effect-probe completed-retained by
operator ruling (#3212): its manifest now commits `closeout` naming #3210, so
there is no proposal left to migrate. S12 step 1 checks it with
`goals doctor --online`. If #3210 does not verify, add a decision file with
`operatorRuling: { finalPullRequest: 3210 }` that cites #3212, because main's
ruling file for the packet carries no machine-readable block. merge-queue-lab
(#3169) is the other new committed closeout; `goals/merge-queue-lab/` in the
lane is byte-identical to `origin/main` `6c2dc6a51fd`. No other migration
packet changed on `main` since base. The only `proposedCloseout` keys left on
`origin/main` are the seven migration packets this lane adopts.

### Packets `main` closed or added while PR A was open (S12 step 1)

DN-21 keeps the bytes of completed and superseded packets. That status is the
one on `origin/main` after each merge of it, not at base. Between the S11 pass
and `origin/main` `6c2dc6a51fd`, `main` closed 20 packets the lane had
rewritten: #3219 closed 19 as superseded (agent-outcome-experiments,
agent-rating-critique-fixes, belief-view-engine, ci-fleet-endgame,
coding-agent-effectiveness-evidence-loop, effect-native-legal-eval,
goal-portfolio-driver, knowledge-freshness-audit,
model-arrangement-admission-core, nightly-research-routine,
openclaw-workstation-agent, ops-seat-timers, patent-drafting-episode-ledger,
professional-desktop-adversarial-qa, semantica-atlas-sync,
semantica-reasoning-spike, semantica-storage-inversion, thread-virtualization
and time-to-certainty), and #3212 closed skill-effect-probe completed-retained.
The lane's edits to their 25 files (GOAL.md launchers with the DN-21 trims,
PLAN.md step 3, and the SPEC.md and PLAN.md prose of
agent-rating-critique-fixes and knowledge-freshness-audit) were reverted to
base before the merge, so the merge takes `main`'s bytes.

S12 step 1, after every merge of `origin/main`:

1. For every lane-modified `goals/<slug>/` file whose packet is not `active`
   or `paused` on `origin/main`, run `git checkout origin/main -- <file>`, then
   confirm `git diff origin/main -- goals/<slug>` is empty. merge-queue-lab is
   already byte-identical.
2. Re-run the S11 script and census over the packets `main` added that are
   live: citation-engine-install-once, citation-regex-worker-v3 and
   skill-lane-probe carry the old done paragraph and PLAN.md step 3, and
   session-route-resolver carries the old launcher done paragraph.
3. Re-run the `proposedCloseout` census and `goals doctor --online` as
   described above.

## Checks

Rerun after the status-prose pass, on the working tree (the orchestrator
reruns them on the commit):

- `jq -e 'has("proposedCloseout")' goals/*/ops/manifest.json`: 299 `false`, no `true`.
- `bun run beep goals decisions check`: `packets=298 decisions=705 invalid=0 drift=0`.
- `bun run beep goals doctor` (offline): `packets=298 blocking_new=0 blocking_inherited=0 baseline_resolved=0 advisories=27`.
  The migration adds six advisory `archive-decision-missing` rows, one for
  each newly completed packet without an archive block or `retentionReason`
  (citation-extraction-engine already declares one). It leaves two
  `completion-gate-unsatisfied` advisories, for #2966 and #2963, until the
  commit and refresh. literal-kit-subset-algebra's advisory changed from
  `completion-gate-unknown` ("no matching clone receipt") to
  `completion-gate-unsatisfied`.
- `git diff --check -- goals`: clean.
- `bunx --bun vitest run test/goals-manifest-capabilities.test.ts test/goals-graph.test.ts test/goals-ops-typecheck.test.ts`: 3 files, 36 tests passed.
- `bun run check` in `packages/tooling/tool/cli`: exit 0 (first pass; the
  second pass touched no source).
- Attribution re-check: `git fetch origin pull/<n>/head` shows that the heads
  of #2984 (`a7f168d9e0`) and #2994 (`25305d8ecd`) contain `9f44753a8c1`, and
  the heads of #2975 (`de3a204c13`) and #2985 (`d838de23b1`) contain
  `de54b37982b`. All four merged on `main`. `gh pr checks` shows each
  attributed context passing on its fix PR: #2984 Check, Docgen and Doctest;
  #2994 Test Integration; #2975 Docgen; #2985 Check, Doctest and Test
  Integration.

## GitHub usage

About 175 REST calls and 14 GraphQL calls. The first refresh (alchemy-vault-sync-slice)
ran alone. The other ten ran as two batches in one process each, sharing one
memoized rule-suite listing. Attribution evidence used about 25 REST reads
(check-runs, two job logs, one issue read) and three batched GraphQL rollup
queries. `git fetch origin pull/<n>/head` supplied head ancestry at no API cost.

The second pass added the literal-kit-subset-algebra refresh (one process
with its own rule-suite listing, about 20 REST and one GraphQL) and four
`gh pr checks` reads (GraphQL). The rate-limit window reset during that
refresh, so these figures are estimates, not measurements.
