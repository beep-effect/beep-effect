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
| citation-extraction-engine | #2966 | verified with attributed reds (claims at `HEAD` only; S12 refresh) | 11 success, 4 cancelled | 0/10 | `37d34874ed626e24` |
| research-intake-2026-11 | #2963 | verified with attributed reds (claims at `HEAD` only; S12 refresh) | 11 success, 4 cancelled | 0/0 | `57250e7f30a16f07` |
| beep-effect-web-alchemy (archived) | #2583 | verified (receipt only, DN-23) | 15 success | 0/1 | `16bd1780878a9ca1` |
| literal-kit-subset-algebra (archived) | #2080 | unsatisfied, stays unverified (receipt only, DN-23) | 10 success, 5 cancelled, 2 failure (17 required under ruleset version 53390820) | 0/12 | `73732d12e8af765b` |

The seven verified packets have a stored receipt that matches the
post-migration declaration digest. Offline `goals doctor` prints
`completed-retained (verified via #N)` for each of them, and still does
after the status-prose and phase edits below, which the digest does not
cover.

### Attributed reds: citation-extraction-engine and research-intake-2026-11

At S9 both attribution files existed only in the working tree, so the stored
receipts were `unsatisfied` (DN-6). Refresh printed `would verify once
committed` for both files:

- `goals/citation-extraction-engine/decisions/2026-11-13-final-2966-attributed-reds.md`:
  Heavy / Check, Heavy / Docgen, Heavy / Doctest `introduced`, fix #2984;
  Heavy / Test Integration `inherited`, fix #2994 (`unblocks-main`).
- `goals/research-intake-2026-11/decisions/2026-11-13-final-2963-attributed-reds.md`:
  Heavy / Docgen `introduced`, fix #2975; Heavy / Check, Heavy / Doctest and
  Heavy / Test Integration `introduced`, fix #2985.

Each fix PR was checked against GitHub: it merged, its head contains the
final's merge commit (`git merge-base --is-ancestor`), and the attributed
context passed on that head. The cause for each context follows DN-24. The
run and job ids are in each file's body. Both files were committed in
`51517c1eebc`. On the merged head (S12 step 1),
`goals completion refresh --slug citation-extraction-engine` and
`--slug research-intake-2026-11` each printed
`verified (claims at HEAD only: …; not done until they merge)`, and the stored
rows are now `verified` with the digests in the table above.

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
  final. After the S12 merge of `origin/main` (`13303191caf`), the merged tree
  has 35 committed closeouts and 32 distinct finals; skill-effect-probe's #3210
  is the new one, so about 384 REST and 32 GraphQL. Recount after any later
  `origin/main` merge before sizing the run. Other sessions
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
there is no proposal left to migrate. S12 step 1 refreshed it, and
`goals completion refresh --slug skill-effect-probe` printed
`skill-effect-probe #3210: verified` (6 success and 9 skipped required
contexts, 0 of 0 threads, digest `bd1e9c746812d189`). No
`operatorRuling` decision file is needed. merge-queue-lab (#3169) is the other
new committed closeout; `goals/merge-queue-lab/` in the lane is
byte-identical to `13303191caf`. No other migration packet changed on `main`
between base and `13303191caf`. The only `proposedCloseout` keys left on
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
base before the merge, so the merge takes `main`'s bytes. The lane merged
`origin/main` at `13303191caf` (merge commit `115e045e95e`). The three
commits after `6c2dc6a51fd` (#3224, #3217 and #3230) closed no packet; they
changed only ci-lane-economics and yeet-async-merge-and-stacks, both still
active.

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

#### Result on `13303191caf`

Run on the working tree of the merged head, before the orchestrator's commit:

- Restored: nothing. Every packet named by
  `git diff --name-only 13303191caf -- goals` is `active` or `paused` on
  `13303191caf` (the migration packets included, which `main` still holds
  open), except this new packet and `goals/README.md`.
- Rewritten: the S11 script re-ran from a copy that skips the `edits.ts` rows
  of packets `main` closed (ten rows across agent-rating-critique-fixes,
  goal-portfolio-driver, knowledge-freshness-audit and the three semantica
  packets), because DN-21 keeps their bytes. Over the 73 live packets it
  changed seven files: the GOAL.md done paragraph of
  citation-engine-install-once, citation-regex-worker-v3 and skill-lane-probe
  (T2703) and session-route-resolver (T1448), and PLAN.md step 3 of
  citation-engine-install-once, citation-regex-worker-v3 and skill-lane-probe.
  A second run changed nothing. No GOAL.md is over 4000 characters (`wc -m`).
- Live-prose census (`proposedCloseout|adoption PR|packet-state PR` over the
  live packets, excluding `decisions/`, `history/`, `research/`, `data/`,
  `ops/` and this packet): seven hits. Four sit inside generated
  `beep:decisions` blocks of the two turborepo packets; three in
  canonical-digest-owner describe the digest's field and instruct nothing.
  No live manifest string still prescribes the old route.
- `jq -e 'has("proposedCloseout")' goals/*/ops/manifest.json`: 303 `false`,
  no `true`, and no nested key of that name. public-origin-beep-effect-com
  (completed) mentions the word only in a phase `exit` string, which stays.
- Refreshes: skill-effect-probe printed `verified` (above).
  citation-extraction-engine and research-intake-2026-11 printed
  `verified (claims at HEAD only: …; not done until they merge)` with their
  four attributed contexts each.

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

### On the merged head (S12 step 1)

Run on the working tree of `115e045e95e` plus the S12 step 1 edits:

- `jq -e 'has("proposedCloseout")' goals/*/ops/manifest.json`: 303 `false`, no `true`.
- `bun run beep goals decisions check`: `packets=302 decisions=888 invalid=0 drift=0`.
- `bun run beep goals doctor` (offline): `packets=302 blocking_new=0 blocking_inherited=0 baseline_resolved=0 advisories=29`.
  It prints `completed-retained (verified via #2966)`, `(verified via #2963)`
  and `(verified via #3210)`. The two `completion-gate-unsatisfied` rows for
  #2966 and #2963 are gone, and the six migration `archive-decision-missing`
  rows remain. The new rows come from `main`: six `capability-stranded` rows
  for packets #3219 superseded and three `archive-decision-missing` rows for
  graduated explorations. The lane does not touch either.
- `bun run beep goals manifest --write`, `bun run beep lint schema-catalog --write`,
  `bun run beep observability catalog --write` and
  `bun run beep goals decisions write --slug goal-closeout-hosted-verification`:
  no change. `bun run beep lint policy-fingerprint --check`: current.
- `bun run beep skills update`: re-locked the closeout, reflect and yeet hashes
  in `skills-lock.json` (the merge took `main`'s file); `--check` is then
  current. Its one advisory, `yeet/SKILL.md` at 503 lines, is the same on
  `main`.
- `git diff --check`: clean.
- `bun run beep quality package-verify @beep/repo-cli --quick`: lint ok, check ok.
- 30 test files, each run alone with `bunx --bun vitest run test/<file>.test.ts`
  from `packages/tooling/tool/cli`: all passed (677 tests), the two
  `knowledge-doctor-*` files included.
- `bun run lint:jsdoc` in the package, `bun run beep lint effect-vitest`
  (`introduced=0 resolved=0`) and `bun run beep lint schema-first` (parity
  ratchet `introduced=0`): exit 0. The effect-vitest baseline already holds
  six findings in two test files this lane edits (`session-ledger` and
  `yeet-sweep-retire`: the `withCwd`, `withRealCwd` and `scoped` helpers and
  the `@effect/platform-node` import). They are on `main` too; the lane adds
  calls to `withCwd` but does not change the helpers.

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

S12 step 1 ran three refreshes (skill-effect-probe alone, then
citation-extraction-engine and research-intake-2026-11). Across them the
token's remaining core quota fell by 162 and GraphQL by 32. Other sessions
share the token, so these are upper bounds.

## Result on `de6dc093e79` (second merge of `main`)

`main` gained one more legacy proposal after the first merge:
canonical-digest-owner, whose final #3209 had merged. `bun run beep goals
set-status canonical-digest-owner completed-retained` bound #3209 from the
proposal and deleted the key, and `bun run beep goals completion refresh
--slug canonical-digest-owner` printed `verified`. Its GOAL.md and PLAN.md keep
`main`'s bytes, because the packet is now completed. PR B merged as #3245
(`de6dc093e79`) and is in this merge. The manifest census is again all `false`.
