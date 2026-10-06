# ciops-ontology-pipeline — decisions

Ruling log for this goal. Each entry records the question, the ruling, the rationale and the
rejected options, in the house style of the prior log. Rulings are the steward's; the
orchestrator proposes and records. Entries are append-only, newest last.

## Prior log

The exploration this goal graduated from keeps its full ruling history:
[`explorations/beep-ci-operational-ontology/DECISIONS.md`](../../../explorations/beep-ci-operational-ontology/DECISIONS.md).
It ends with two 2026-10-01 entries that found this goal:

- "2026-10-01 — admission-journal snapshot (one ruling, steward: Benjamin)": the snapshot at
  `explorations/beep-ci-operational-ontology/research/evidence/journal-snapshot-2026-10-01/`,
  digest-only as ruled; the PR #1386 review addendum at the end of that file adds a committed
  redacted projection (`journal.redacted.ndjson`) that W3 reads by path and sha256.
- "2026-10-01 — graduation sitting (11 rulings, steward: Benjamin)": Rulings 1–11. This
  packet's SPEC, PLAN and manifest cite them as "graduation Ruling n".

Older ruling numbers in that log name their series (run-3, S7, time-to-certainty) wherever
they could be confused. Those entries stay where they are and are never copied here; the
ontology tree and `research/scripts/**` they govern stay under the exploration, owned by this
goal by back-link (graduation Ruling 7).

## Rulings

None yet. The first entry lands here, not in the exploration log.

## 2026-10-05 — P0 sitting (steward: Benjamin)

**Ruling 1 — W2 seat launcher not chosen.** Auditor run 4 seats run on Opus 5.5 by
launch-entry deviation from skill v15 (graduation Ruling 4); no v16 model-agnostic launcher,
no new self-test family, no new pinned digests. Rationale: the 2026-10-01 model defaults pin
`claude-opus-5-5` on every seat, so a model-agnostic launcher has no consumer at run 4, and
validator v15 already accepts the deviation (a non-blank `agents.<role>.model` and
`agents.<role>.effort`). Rejected: build v16 first (a workstream with no run-4 need that
reopens the pinned-digest family for a launcher nobody exercises).

**Ruling 2 — graduation Ruling 6's hosted clause amended: the same mechanisms on the hosted
tier.** The admission criterion now reads: a row records a change to admission, ordering, gate
selection or early stop, Turbo/cache task inputs, or lane assembly or sharding on any tier, plus
hosted-runner capacity on the hosted tier; instrumentation-only and shadow-only changes stay
excluded. Rationale: hosted episode time-to-certainty is set by Heavy Admission gating,
skip-satisfied verdicts and lane sharding as much as by fleet size, and rows are observational
seed data that partition only their own tier's series (KPI law v1.1 tiers). The first W1 pass
refuted #982, #1064, #1155, #1165, #1195 and #1384 on the hosted clause alone; they are admitted
under this ruling. Rejected: capacity only (leaves the hosted series untagged at its gating and
sharding instants).

**Ruling 3 — contested local rows, and a check step inside a lane is gate selection.** Admit
#1102, #1112 and #1269 (the criterion refuter upheld each; only cites were corrected). Exclude
#882, #913, #967 and #1143 (the criterion refuter showed no decision changed). A new check step
added inside an existing lane is gate selection, because it adds a predicate that can turn the
lane red; #1098 stays and #1029 is admitted on the same rule. Rejected: steps never count
(drops #1098 and leaves a lint:policy gate addition untagged); admit every contested row with
a flag (rows without a criterion verdict).

**Ruling 4 — #1068 and #1269 promoted to rows; the iv-1006 caveat rewritten; the
`mechanismChanged` vocabulary ratified.** Each qualifies on its own (#1068: the cache-policy
gate joins the repo-sanity and cheap-gate lanes and lint cache turns off for two packages;
#1269: a seed row moves `quality:cache-policy` to rank 19), and caveat prose never becomes a
CQ-016 partition point. The third iv-1006 caveat becomes the cross-reference list of later
ladder edits; its "changes its early stop" for #1269 was wrong (the lane is stop-after-red
before and after; only its rank changed). `mechanismChanged` stays scalar over the closed set
admission, ordering, gate-selection, early-stop, turbo-cache-inputs, lane-assembly, sharding,
hosted-runner-capacity; co-mechanisms at the same instant are named in a CONFOUNDED caveat.
Rejected: keep them as caveats; leave the known error in iv-1006.

**Ruling 5 — the W1 query widened and run twice.** The first pass (four path families, 155
PRs) missed the hosted-capacity lever itself (`infra/` Pulumi fleet: #1050, #1141, #1364) and
parsed PR numbers only from `(#N)` squash subjects (dropping `Merge pull request #N`: #891,
#892, #893, #894). The families now also cover `scripts/systemd`, every tracked `turbo.json`,
`internal/cli/{TurboCache,EnvConfig}.ts`, the cache-qualification store, `commands/Lint`,
`commands/Docgen/internal`, `internal/package-scripts`, `vitest.shared.ts`, the
`setup-monorepo-ci` action and CI profile scripts, the fleet infra and runner runbooks: 190
PRs, 35 new, classified in a second pass under Rulings 2–4 (with #952 and #989 re-reviewed
under the rule that admitted #1182). Workspace `package.json` scripts are not a family: they
are generated by `internal/package-scripts`, which is.

**Ruling 6 — `landedAt` for fleet changes applied outside the repository.** When a
hosted-capacity lever is applied outside the repository at an instant the runner runbooks
record, the row's `landedAt` is that recorded instant and the PR is the record; GitHub's
`mergedAt` stays in the row's evidence line. The fleet changes when the apply lands, not when
the source merges: iv-1050 (the scale-up Lambda changed at 2026-09-09T09:13:51Z, 64 minutes
before the merge) and iv-1364 (the Pulumi apply ended 2026-10-01T12:05Z, after a merge that
deployed nothing). A live change with no clock time on record keeps the merge instant and marks
the mixed window in a caveat (iv-1141). Rejected: `mergedAt` everywhere (iv-1364 would
partition the hosted series two hours before the pool changed).

**Ruling 7 — pass-2 contested rows, a third pass, and the commit with no PR.** Confirmed on
the Ruling 3 pattern: #1053 and #1141 become rows (criterion upheld, facts corrected); #984
(local resource control on `agent-runs.slice`, outside the vocabulary), #1085 (a docgen
discovery guard with no realized target change at landing) and #1375 (the runbook record of
#1364's apply, so that event has one row) are excluded. `#1232` and `#1233` file under
`turbo-cache-inputs` and `#891`/`#894` under `admission`, as the ratified vocabulary reads.
The query gains two paths, `.envrc` (turbo-cache: which shells share the cache store) and the
git pathspec `:(glob)**/docgen.json` (lane-assembly: the Docgen aggregation set, deletions
included), and a bounded third pass
classifies the PRs the extension surfaces together with the three pass-1 exclusions whose
widened-family hunks looked like levers (#1055 Spot allocation strategy, #1061 docgen JSDoc
metadata check, #1389 the `packages/tooling/tool` shard split); the remaining pass-1
exclusions stay as classified, under the screen recorded in `w1-lever-query.md`. The one
first-parent commit without a PR (`8ef3213cbf`, 2026-09-03, an out-of-band correction of 27
checkouts' Turbo remote-read token references) is classified like a PR from its diff and
message; if it qualifies it is recorded as a dated caveat on iv-953, not as a row, because
rows carry a PR number and the correction happened outside the repository. Rejected: a local
capacity vocabulary value now (a run-4 question); re-reviewing all 42 pass-1 exclusions; a
row with an empty `pr`.

**Ruling 7 addendum — PR #1424 review follow-ups (2026-10-05).** Two review findings on the
committed query, both accepted. (1) The turbo-cache family listed only the `turbo.json` files
tracked at the checked-out commit, so a later census would miss a deleted package-level
override; the family now uses the git pathspec `:(glob)**/turbo.json`, like `docgen.json`. At
`8b7392fe00` the census is unchanged (no `turbo.json` was deleted in the window). (2) Workspace
`package.json` scripts assemble what a Turbo task runs, and #1053 reached the census only
through another family path; a fifth family, the package-scripts probe, now runs `git log -G`
over task-facing script-entry lines (`beep:*`, every Turbo task name at `8b7392fe00`,
`typecheck`, `proof`) in every `package.json`. At `8b7392fe00` it surfaces 21 PRs, three of
them new (#872, #911, #936), classified in a fourth bounded pass under the same
protocol: none became a row (#872 and #936 are new workspaces joining existing lanes; #911's
new `beep:audit` steps reach only `package-verify` and the ad hoc root `audit` script, so the
criterion refuter refuted it on the #967 precedent). Census after both fixes: 321 lines, 197
PRs, 198 first-parent commits; the ledger stays at 42 rows. The
"generated by `internal/package-scripts`" reasoning in Ruling 5 stays true but is no longer a
reason to leave scripts unswept.

## 2026-10-05 — P1 sitting (steward: Benjamin)

Opened when the P1 pin lane re-read the run-4 gate (graduation Ruling 1) before any capture.
The first half holds: `goals/time-to-certainty/PLAN.md` shows C4.1 checked (2026-09-21). The
second half does not. Census at the sitting (2026-10-05T22:40Z, counts only):

- The fleet root holds 23 `beep-effect*` clones. Ten of them carry
  `.beep/yeet/proof-ledger.ndjson`; the clone that owns the lane this goal works in carries
  none. Thirteen more ledger files sit in linked worktrees and predate #1321.
- The ten clone ledgers hold 4,067 fact rows and 4,067 shadow rows. 3,442 facts were recorded
  at or after the #1321 merge instant (2026-09-28T15:09:38Z), in eight clones, by 93 attempts
  over 58 lanes (3,384 passed, 58 failed), from 2026-09-28T16:29:42Z to 2026-10-05T22:10:19Z.
- Every one of those facts carries `provenance.stage = "pre-push"` and tier `full`. No ledger
  file in the fleet, clone or lane, holds a `merged-preview` fact from any date.
- The fleet's surviving attempt journals (459) hold three `merged-preview` attempt starts, the
  last on 2026-09-09, before the C4.1 writer shipped. After #1321 they hold 107 `pre-push`
  starts, 10 `repair-loop` starts and no `merged-preview` start.

So "from both local stages" cannot hold: the merged-preview stage has not run since before
its facts could be written. Two questions were put through AskUserQuestion; both resolved to
the recommended arm.

**Ruling 1 — the gate's ledger half is amended: pre-push facts discharge issuance and
custody; the merged-preview legs stay flagged.** Graduation Ruling 1 required `ProofFact`
rows recorded after #1321 "from both local stages (pre-push and merged-preview)" and told the
pin lane to record the census and stop otherwise. The gate now reads: time-to-certainty C4.1
checked, plus `ProofFact` rows recorded after #1321 from the pre-push stage in the fleet's
owning-clone ledgers (Ruling 2). The issuance and custody legs of rat-047/048/051/052
discharge against those rows. Their merged-preview legs join the realization and copy legs as
flagged: each names its evidence, the first `ProofFact` with
`provenance.stage = "merged-preview"` recorded after #1321 in an owning-clone ledger, and a
later capture reads it. The ledger pin's manifest records the stage census, so run-4 seats
read the merged-preview stage as dormant in the capture window, never as observed and empty
of failures. The fourth `AssuranceTier` member proposal (graduation Ruling 10) weighs the
same census. The W3 and W4 captures proceed as one capture PR. Rejected: commissioning
`yeet verify --merged` attempts to issue the missing facts (the rows would be requested for
the gate rather than produced by fleet work, seats would have to discount them, and each
costs a full local proof on a saturated fleet); stopping the pin lane as written (W5, run 4
and the verdict would wait on a stage with no attempt in 26 days, the undated wait that
graduation Ruling 1 itself rejected for C4.2).

**Ruling 2 — "the owning clone" means every fleet clone, each read once.** The W4 generator
discovers fleet checkouts the way the run3b generator does, resolves each to its owning clone
the way time-to-certainty ruling 71 does (the `.git` file's `gitdir:` line and the `commondir`
file, without spawning git), and reads each owning clone's ledger once. It never reads a
linked worktree's `.beep/` tree, so the thirteen pre-#1321 lane ledgers stay out of the pin. A
clone without a ledger file is recorded as absent, not as an error. Rejected: the strict
singular reading (only the clone the capture runs from; from this goal's lane that ledger
does not exist, so W4 would stop whatever Ruling 1 said, and the pin would depend on where
the generator happened to run).

**Ruling 3 — the ledger's two `key` members are pinned as 12-hex prefixes.** Every proof-ledger
row carries a 64-hex reuse key (`fact.key.key` on facts, `decision.key` on shadow rows). The
hosted Secret Scanning check reads main's `.gitleaks.toml`, and its `generic-api-key` rule flags
a 64-hex value under a member named `key` (probed on 2026-10-05; the other 64-hex digests in the
row pass). The W4 capture writes both members as their first 12 hex characters, asserts that the
mapping stays injective over every key in the capture (a collision fails the capture closed),
records the projection rule in the manifest, and keeps every other digest verbatim. Within-pin
joins (shadow decision to fact, hit to prior fact) survive, and a seat can still recompute the
prefix from the row's other members (`laneId`, `commandDigest`, `envProfile`, `inputDigest`,
`epochDigest`). The width matches `ownerRef`, `checkoutRef` and the admission `originKey`.
Rejected: a path- and shape-scoped allowlist landed in a prior PR (full fidelity, but two PR
cycles and a standing allowlist on the pin path).

**Ruling 4 — citations resolve against the fetched `origin/main` tree; no evidence tag.** Both
captures record `corpus_commit` and `corpus_tree` from `refs/remotes/origin/main` as fetched at
capture, resolve every citation against that tree with `git cat-file blob <tree>:<path>`, assert
that the capturing checkout's copy of each cited file is byte-equal to the blob (otherwise the
capture fails closed and asks for a merge of `origin/main`), and record the lane HEAD beside it
as `capture_head`. `corpus_tree` therefore stays reachable from main after the squash merge
without any remote write; verify mode fails loud when the tree object is absent and names
`git fetch origin <corpus_commit>`. Current-tree resolution is printed as an advisory count and
never changes the exit code (graduation Ruling 8). Rejected: citing the lane's capture commit
and pushing an `evidence/beep-ci-ops/…-capture` tag (the run-3 route; a fresh clone would need
the tag before verify works).

**Ruling 5 — W3 scope: public-origin filter, Claude-app worktrees, the `promotions` family,
quarantine as one payload per root.** A verbatim copy of the run3b discovery would today publish
the private duplicate clone, miss 17 checkouts under `<clone>/.claude/worktrees/`, skip the
`promotions` live family (`yeet-admission-promotion/v1`, present since #993) and turn 2,068
quarantined lease files into about 4,100 payload files. The `run4-fleet` generator (1) resolves
each checkout's git directory from the filesystem and reads the `origin` URL from its config as
text, admitting only `github.com/beep-effect/beep-effect`; any other origin, a missing origin or
an unreadable config excludes the checkout, counted by reason and never labelled; (2) discovers
`<clone>/.claude/worktrees/<name>` checkouts with label `<clone>/.claude/worktrees/<name>`,
and nested clones under a `*-worktrees` directory with their `clone` kind; (3) adds
`promotions` to the live families; (4) captures the `quarantine` family as ONE NDJSON payload
per admission root in sorted filename order, with filenames never persisted, custody surrogates
minted per object and the residue scan over every byte. Rejected: a counts-only quarantine
receipt (the two reaper sweeps' dead-lease records would not be pinned); the run3b one-file-per-
object layout (about 5,000 files, past the review bot's sight).

**Ruling 6 — W4 pins whole ledgers with the cut census.** The `run4-ledger` pin holds every
terminated row of every owning-clone ledger, facts and shadow rows, and its manifest splits the
census at the #1321 cut instant (`2026-09-28T15:09:38Z`, the committer instant of
`9d52d8f587`). The 625 pre-cut facts are issuance history; the gate reads the post-cut stage
census, not the row count. Rejected: post-cut rows only (drops the five `repair-loop` facts and
the 28 pre-cut lane-origin facts in one clone that already contradict SPEC's "only facts written
inside a clone" sentence).

**Orchestrator notes (recorded under the sitting, not rulings).** (a) The two generators and
their tests are new files beside the run3b generator in the corpus home, as run-3 Ruling 3 and
Stage B Ruling 18 did; they are appends, and no existing byte under `ontology/extraction/**`
changes. (b) Root names: `run4-fleet` (W3) and `run4-ledger` (W4), each with its own manifest
and self-pinned generator digest, plus a `generator_lineage` field naming the run3b generator
and its digest (Ruling 22 rider). (c) The Queue D projection is read by path and sha256 and
recorded with a recomputed census; it is not copied into the pin. (d) W4 maps
`provenance.originKey` to the run3b descriptor form `<fleet>/<label>` (clone root, lane,
Claude-app worktree, or merged-preview worktree with its process component redacted); a path
outside the fleet root fails the capture. (e) A terminated line that is not JSON is tallied and
excluded; an unterminated tail is excluded and its byte count recorded; a row that decodes but
drifts from the deployed schema (unknown member, literal or kind) fails the capture closed.
(f) W4 reads no attempt journal; W3 owns attempts, and join coverage is recorded as counts.
(g) `biome.jsonc` and the generated `biome.identity.jsonc` gain negations for both roots before
any payload is staged; graduation Ruling 7 names them as coupled files.

**Orchestrator notes, continued (after the survey critic, 2026-10-05 ~23:40Z).** (h) Ruling 5(1)'s
public-origin filter applies to W4's owning clones as well: the private duplicate clone's ledger (pre-cut
rows only) never enters the pin and is counted under the excluded reasons. (i) No manifest member may
carry a sha256 or byte length of a raw fleet file that embeds a host path: the length would disclose the
fleet root's length and the digest would confirm a guessed path offline, the oracle the snapshot's second
addendum closed; only emitted payload digests and row counts are recorded. (j) Under Ruling 4 a
`{file, line}` citation needs byte equality with the `origin/main` blob, so files this PR edits (the
intake docket, SPEC, PLAN, README, the manifest, this log, the Biome files, the lane briefs) are named in
prose, never cited, until the PR merges. (k) The admission work kind `merged-preview` is written by real
`yeet verify --merged` admissions and by any full proof that carries the CI-parity step; the merged-preview
STAGE is the attempt journal's `stage`. The W3 manifest states this beside an attempt-start census by stage,
so the "dormant" reading of Ruling 1 is reproducible from pinned bytes. (l) The first post-#1321
merged-preview fact will be read by a later sibling pin with its own root; `run4-ledger` is never
refreshed. (m) For P2: the lab's v3 admission decoders (`AdmissionJournalV3Identity`,
`AdmissionJournalQueuedIdentity` in `apps/labs/ciops/src/projection/Schemas.ts`) require `pid` and
`procStart`, which run-3 Ruling 11 custody removes, and `releaseFromLedger` fails on ring-trimmed
released-only chains; W5 must widen the decoder to surrogate rows and skip released-only chains, and the
W3 manifest records each root's window boundaries for that purpose.

**Ruling 2 addendum — PR #1434 review (2026-10-05).** A review finding, accepted: "the way the
run3b generator does" named a discovery with no origin check, so a duplicate clone of another
repository would count as an owning clone and its ledger would reach the public pin. Ruling 2 is
read with Ruling 5(1): W4 discovers checkouts the run3b way AND admits an owning clone only when
its origin canonicalizes to `github.com/beep-effect/beep-effect`; excluded clones are counted by
reason and never labelled (orchestrator note h records the same). Today that excludes exactly one
fleet-root clone, whose ledger holds pre-cut rows only. The pairing rule of the W4 brief is
likewise amended (brief addendum W4-A6): pairing is computed over decoded rows, an orphan adjacent
to a torn line or the unterminated tail is counted and kept but never paired, and only an orphan
with intact neighbours fails the capture.

**Operating note — autonomy charter adopted (2026-10-06).** The operator's autonomy charter
(PR #1448, `AGENTS.md` "Autonomy"), relayed by the "Merge open PRs" orchestrator session and
confirmed by Benjamin directly in the P1 session, applies to this goal from here on: steward-style
calls (gate amendments, "the PR is final", phase starts) are made by the pin lane's orchestrator
and recorded here with their reason and reversal; the goal runs phase to phase to
`completed-retained` without a steward go at each boundary; review loops stop after round 2
(P0/P1 always fixed, lower priorities from round 3 become tracked follow-ups); only money goes to
the operator. Reversal: a later entry here, or the operator withdrawing the charter.

## 2026-10-06 — P1 build sitting (orchestrator under the autonomy charter)

Both generators exist (`etl_run4_fleet_corpus.py`, 87 tests; `etl_run4_proof_ledger.py`, 76 tests),
each after three refuting reviews and two fix rounds. Two findings need rulings and three need
recorded calls; each is reversible by a later entry before the real pin, and by a new sibling root
after it (a committed pin is never refreshed).

**Ruling 3 amendment — the prefix width is 11 hex, not 12.** The hosted Secret Scanning check's
`generic-api-key` rule applies a 3.5-bit Shannon-entropy cut; a 12-hex value whose twelve digits
are all distinct carries log2(12) = 3.585 bits and is flagged, which the W4 lane measured on about
0.3% of 12-hex key prefixes (64 findings over its dry root, 0 at 11 hex under both the PR's and
main's config). No value of 11 or fewer hex characters can exceed log2(11) = 3.459 bits. The two
ledger `key` members are therefore pinned as their first 11 hex characters, with the injectivity
assertion unchanged; the capture refuses any width whose log2 reaches the cut. Rejected: keeping
12 and allowlisting (the allowlist cannot ride the same PR, Ruling 3's own reason).

**Ruling 7 — a 64-hex admission `originKey` is written as its first 11 hex characters.** The live
canonical journal carries 12 rows (6 `admission-enqueued`, 6 `admission-admitted`, all
`full-proof`, one distinct value) whose `originKey` is 64 hex, written by a checkout on an earlier
lock-name derivation; the deployed derivation yields 12 hex (`artifactNameHash` of the canonical
repository identity), and the same gitleaks rule flags `originKey=<hex64>`. The W3 capture writes
such a value as its first 11 hex characters at any depth, records the member count, the distinct
count and the rule under `origin_key_shapes.hex64_written_as_prefix`, asserts injectivity, and
never persists the 64-hex form; native 12-hex and empty values stay verbatim (run-3 Ruling 5, the
snapshot addendum). Rejected: an allowlist PR; dropping the 12 rows (they are organic full-proof
admissions in the window).

**Ruling 8 — a post-cut merged-preview fact never refuses the ledger pin.** The W4 lane added an
exit-3 refusal when a `merged-preview` fact recorded after the cut exists, to protect Ruling 1's
"dormant" reading. That makes the pin hostage to one attempt. Instead the capture pins and counts
such facts, and the manifest's `stage_census.merged-preview.reading` says "dormant in capture
window" only when the post-cut count is 0, else "observed after the cut: n facts"; Ruling 1's
flagged merged-preview legs may then discharge against those rows at run 4, and the "later
sibling pin" clause applies only to facts that appear after this pin. Verify recomputes the
reading from pinned bytes.

**Recorded calls.** (n) The capture PR carries about 950 payload files and is past the review
bot's sight (Stage B Ruling 21); accepted, because review bots never gate merges and the pin is
verified by its own replay. (o) W4 reads "adjacent to a torn line" directionally: an orphan is
excused only when the tear sits toward its missing partner (the raw line after an orphan shadow,
before an orphan fact); that is the tighter reading of the Ruling 2 addendum and is kept.
(p) No raw-file digest or length of any kind is recorded, not even one computed with the fleet
root replaced: torn rows and the unterminated tail are never emitted, so any digest of source
bytes is an offline oracle. (q) W3 and W4 discover checkouts with separate copies of the same
rules; parity is proven at the pin by checking that every W4 origin label whose directory exists
names a W3 checkout. (r) The W3 attempt-start census by stage is a capture-time census over ring
buffers; the P1 sitting's quick counts (107 pre-push, 10 repair-loop starts after the cut) were
taken over a different file set at a different instant, and the pinned census governs.

**Round cap and two more calls (2026-10-06, after round 3).** Round 4 is the final pre-pin fix
round under the charter's cap; what it cannot finish becomes a tracked follow-up PR, never a
further round before the pin. (s) The encoded home marker `-home-` is refused only when it starts
a path component (the knowledge-refs gate's class); a branch-derived lane name that carries
`-home-` mid-token is an ordinary public label, and both generators apply the same rule.
(t) Ruling 8's "post-cut count" is a count of merged-preview FACTS: the reading is "dormant" when
no post-cut merged-preview fact exists, and a lone post-cut merged-preview shadow whose fact
tore stays under the tear receipts.

**Pin recorded (2026-10-06T03:19Z–03:21Z, orchestrator).** Both roots pinned from the lane at
capture head `28d962ec6b` with citations against `origin/main` `26269bb0ec` (tree `edc79dd7b6`):
`run4-fleet` 937 files, 260 checkouts, 11,179 events, Queue D reconciliation 0 conflicts;
`run4-ledger` 9 ledgers, 8,082 rows, 4,041 pairs, 0 torn, gate holds (C4.1 checked, 3,628 post-cut
pre-push facts), merged-preview dormant (0 facts, 0 shadows after the cut; last merged-preview
attempt start in the retained journals 2026-09-09). Every gate in the lane reports is green; the
hosted knowledge-refs observations are inherited from other packets. P1 is complete; W3/W4 are
ticked in PLAN and the manifest reads `complete`. Tracked follow-ups (not blocking, per the round
cap): the `released_only_chains` member name needs a ruling to rename; the `-home-` scan's
percent-encoding gap is covered by the verbatim label; the W4 reading wording paraphrases Ruling 8;
one long docstring line. Reversal: a committed pin is never refreshed; a defect found later is
repaired under run-3 Ruling 22 (unratified pin) or re-captured under a new sibling root.

## 2026-10-06 — P2 opened (orchestrator under the autonomy charter)

P1 merged as #1434 (squash `9e7742176f`, 2026-10-06T04:10Z). P2 starts at once per the charter:
W6's S7-v2 seam first (the §3.2 and §6 amendment and the `PlanEpisodeInput` widening, design before
code), then W5 live differential replay on the `run4-fleet` pin and the `planEpisode` body, as one
projection PR. Rulings for P2 are appended below as they are taken. Reversal: a later entry.

## 2026-10-06 — P2 design sitting (orchestrator under the autonomy charter)

Inputs: a five-lane read-only survey with a critic (the S7-v2 seam, the gate-order handoff and its
rulings, the live replay, the installed `effect` Graph module, CQ-020 and the lab gates), checked
against PLAN P2, SPEC and graduation Rulings 9 and 11. Facts the survey settled: the handoff
`goals/time-to-certainty/research/gate-order-handoff.json` carries 33 lanes at sha256
`705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198` (#1380 added
`quality:shadcn-lint`; PLAN and MAP's "32" predate it), it carries a total order and no edges
(time-to-certainty ruling 78 rejected `blockedBy`), the installed `effect` 4.0.0 Graph module is
byte-identical to the reference checkout and `Graph.topo` throws on a cycle while `Graph.findCycle`
returns a typed witness, the lab's v3 admission decoders require `pid` and `procStart` and reject
every pinned `run4-fleet` row, the pinned canonical journal (689 rows) has exactly one release whose
admission fell outside the retained window and three pre-v3 chains, no pinned row precedes #929, and
`check-emission-cq.py` is hard-wired to the admission golden. Each ruling is reversible by a later
entry before the projection PR merges, and by a follow-up PR after.

**Ruling 1 — one projection PR off main; the seam amendment is its first commit.** P1 merged
before P2 started, so the `run4-fleet` pin is on main and the W5 + W6 work rides one PR
(`feat/ciops-p2-projection`, PLAN "W5 + W6 ship as one projection PR"). Graduation Ruling 11's
"before any planner body lands" is satisfied by commit order inside that PR: the §3.2/§6 amendment,
the widened `PlanEpisodeInput` and the lane-plan schemas land in the first commit with the stub
still failing, and the body in a later one; a squash merge flattens the history, so this entry is
the record. Rejected: a separate seam PR (two hosted cycles for one deliverable).

**Ruling 2 — the pinned handoff is the live 33-lane document; counts come from the decoded
bytes.** W6 pins `705f3e75…`. PLAN W6's "32 lane steps" and "the 32-lane handoff fixture" are
amended to "the lane steps of the pinned handoff" (33 at that digest); MAP keeps its text as
provenance (graduation Ruling 7). No test or script asserts a literal lane count; each asserts the
count the decoded document carries. A byte copy of the document lives in the lab's test fixtures
(`apps/labs/ciops/test/fixtures/gate-order-handoff-v1.json`, excluded from Biome like the pin
roots) for hermetic tests, and one test reads the live path and requires its sha256 to equal the
pinned constant, so handoff drift turns the lab red on the next uncached run. Known limit, accepted:
the lab's Turbo inputs do not name the handoff, so a cached green can hide drift until the lab's own
files change; `evidence:lane-plan` plans the live path through contract §8.1 on every run, in check
and write mode alike, and fails typed (`HandoffDigestMismatchError`, naming the path) when its
sha256 drifts, so the orchestrator's per-phase run and the PR body's check-mode line are the
uncached fallback (review round 1 correction: the first text credited a live-evidence script that
read only the fixture copy). Rejected: a Turbo input (it moves the cache-qualification baseline);
the superseded 32-lane bytes.

**Ruling 3 — the lane plan is its own proposal type, with a fully disjoint provisional
vocabulary.** `planEpisode` succeeds with a `LanePlanProposal` (episode id, plan id, handoff path
and sha256, order rule, lane scope, the ordered lane steps), never by widening `ScheduleProposal`:
the ratified `ScheduleStep` identity is one ordinal slot aimed at one `SeatRequest`, and CT §3.3
"Only admitted actions get steps" outranks PLAN's "add … lane steps to the `ScheduleProposal`
A-Box". Emission of a lane plan uses only new provisional `ciops-prov:` terms (a lane-plan class,
a lane-step class, an episode-to-plan edge, a plan-to-step edge, a plan-to-specification edge, a
lane-plan specification class, step index, scheduled lane reference, a precedence edge between
consecutive steps, handoff digest and order rule members) and never the ratified ordering cluster
(`hasCurrentProposal`, `hasProjectionSpecification`, `hasStep`, `hasScopeTag`, `stepIndex`,
`ScheduleStep`, `ScheduleProposal` typing), never `ciops:VerificationLane` typing, never
`schedulesWorkUnit`, `hasScope` or `Scope` in any namespace (CQ-019 arm 3; Queue E). The exact
term names are proposed by the W6 lane and pass an ontology-foundational-auditor lens in review
before the body lands; the run-4 Queue E/G intake decides ratification. The admission emission
`s7-emission/v2` and its golden stay byte-equal (a regression test proves it); the lane-plan
specification tuple is `(s7-lane-plan/v1, handoff sha256, order rule, lane scope)` under
`pnLocalSlug`. `ScheduleScope` stays admission-only; the lane scope is its own literal kit
(`pre-push:non-main`, the handoff's `scope`).

**Ruling 4 — the lane DAG is the rank chain over nodes inserted in declaration order; cycles come
only from explicit precedence input.** The handoff carries no edges, and the deployed pre-push
runs one single-lane wave per lane in rank order, so the lab's lane DAG has one edge from each
rank to the next (provisional precedence, never a dependency claim) and nothing else; nodes are
inserted in `declarationIndex` order so that `Graph.topo` recovering the rank order is a real
agreement check, not a tautology. A duplicate `laneId` is a decode failure, not a cycle. The pure
core `planLanes(lanes, precedences)` is exported and takes an explicit precedence list, so the
cyclic must-fail fixture is a hand-built precedence set; `Graph.findCycle` runs before `Graph.topo`
and its closed path becomes `CyclicPlanError.cycleNodes`; tests assert a typed `Fail`, never a
defect. Rejected: deriving edges from `firstRedSourceLane` (12 self-loops; not a dependency);
recomputing `gate-order-lexicographic/v1` in the lab (the mirror ruling 78 forbids, and a new order
literal under ruling 76).

**Ruling 5 — the handoff subset decoder and its errors.** The lab decodes `schemaVersion`
(`gate-order-handoff/v1` literal), `scope` and `orderRule` (single-member literal kits), and
`lanes[{rank, laneId, declarationIndex}]` with `laneId` a pattern-checked non-empty string
(`^[a-z0-9-]+(:[a-z0-9-]+)+$`), ignoring every other member (Effect v4 excess properties are
ignored by default; the lab never mirrors `GateOrderHandoff`). Reading goes through `FileSystem`
and the digest through `Crypto` (`@beep/schema` `Sha256HexFromBytes` over the raw bytes, never a
re-encoded string); the sha256 is compared with `PlanEpisodeInput.handoffSha256` before decoding.
New tagged errors: `HandoffReadError {path}`, `HandoffDigestMismatchError {path, expected,
actual}`, `HandoffDecodeError {path, message}`; `CyclicPlanError` stays; `PlannerNotImplementedError`
and `plannerNotImplemented` retire in the body commit. `CiOpsProjectionLive` captures `FileSystem`
and `Crypto` at construction so the service shape keeps requirement-free methods; providers add the
Bun layers. The handoff path is repo-relative under a caller-supplied repo root and may not contain
`..`.

**Ruling 6 — amendment home and stale prose.** The S7 contract gains a dated §8 ("2026-10-06
amendment — the S7-v2 seam") that supersedes the §3.2 `planEpisode` bullet and the first §6 bullet,
with one pointer line in each; the consequential §3.1 (new schemas and errors), §3.3 (Graph
construction and the findCycle pre-check), §3.5 (lane-plan IRIs and the disjoint vocabulary) and
§5 (live evidence) notes ride the same entry, and the stale §5/§7 claims (the bare `evidence:s7`
rewrite, now check-by-default with `evidence:s7:write`; the test count) are corrected in place as
dated notes. A §3.4 delta line records that the deployed same-checkout skip (#929) is not modelled
by admission v1 and is the attribution for live mismatches (Ruling 9).

**Ruling 7 — CQ-020 over the emitted Turtle.** `check-emission-cq.py` stays unchanged as the
admission regression. A sibling `check-lane-plan-cq.py` loads the admission golden and a new
lane-plan golden (`test/fixtures/lane-plan-v1.ttl`) into one graph, runs the yaml-extracted
amended CQ-020 and requires its admission rows unchanged, and runs provisional lane queries: the
step count equals the fixture's lane count, the precedence chain has count−1 edges in rank order,
no ratified ordering term touches a lane node, and `schedulesWorkUnit`, `hasScope` and `Scope`
appear nowhere. Both scripts' outputs ride the PR body because the Labs context is not required.

**Ruling 8 — W5 decoder widening.** The admission-journal v3 identity classes widen schema-first:
`pid`, `procStart` and `checkoutRoot` become optional members beside optional `ownerRef`,
`ownerRefVariant` and `checkoutRef`; an invariant requires a v3 row to carry exactly one of `pid`
or `ownerRef` (live versus surrogate custody) and fails decode otherwise; a derived `custody`
reading labels each row live, surrogate or redacted; the frozen golden's decode and replay bytes do
not change (regression test). If a class-level check cannot survive the lab's `.extend`/spread
composition on effect 4.0.0, the invariant moves into `decodeAdmissionJournal` with the same typed
error; the lane proves which. Rejected: fake pids; a parallel corpus-view schema family (two
decoders to keep in step).

**Ruling 9 — W5 replay window, skip rule, mismatches and the report.** `ReplayOptions` gains an
optional `window` (first and last retained instants, the pre-v3 chain count, the pinned journal
sha256, the manifest sha256) supplied by the evidence script as typed constants asserted against
the pinned bytes (never a JSON extract beside the pin, never a YAML dependency). Inside the fold,
only a terminal row whose admission is absent from the retained window is skipped (one row today);
enqueue-less admitted→released pairs replay; the window's pre-v3 count (3) is the guard the skip
is checked against; verdicts before the last skipped release are marked ledger-censored. The
engine is unchanged: first-choice disagreements are reported with a diagnostic attribution (the
#929 same-checkout skip, from the pinned rows' `checkoutRoot`), never modelled. The report is a
`LiveReplayReport` wrapping `ReplayReport`, printed by a new
`apps/labs/ciops/scripts/generate-live-replay-evidence.ts` (check-by-default, `--write` for the
render) into `goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md` beside the
frozen golden's 41-of-41 recomputed in the same run; `research/s7-replay-evidence.md` is never
re-rendered. The report states the pending-set censorship (withdrawn and ticket-evicted requests
never compete) and any grant active before the window. CQ-009 prints one line, "temporally out of
scope: 0 of 689 pinned rows precede #929", never a pass or a failure (graduation Ruling 9).

**Ruling 10 — gates and test hygiene for the lab PR.** New test files go through
`bun run beep lint effect-vitest --rows <dir>` before publish and get spliced inventory rows (never
a whole-file `--write`); `bun run beep quality test-tsgo` and `bun run --filter @beep/ciops check`
run after the last test edit; `bun run beep quality package-verify @beep/ciops`, lint:laws,
schema-first, knip, fallow (cognitive ≤ 8, unit ≤ 60: keep the planner and decoder small) and the
packet validators and CQ suite run before the flip; no changeset (labs are exempt); every new
export carries the titled JSDoc the law requires even though the lab has no docgen.

**P2 seam lane recorded (2026-10-06, orchestrator).** The W6 seam landed as CT §8 with the widened
schemas, reviewed by a rulings-and-ontology lens (with the ontology-foundational-auditor skill) and an
Effect-v4 mechanics lens, fixed and skeptic-checked (33 lab tests, every lane gate green). Calls taken
on the lane's deviations, all reversible by a later entry: (u) `PlanEpisodeInput` carries `repoRoot`
beside `episodeId` and `handoff`, the caller-supplied root Ruling 5 names, and `LanePlanProposal`
records `handoffPath` outside its identity (Ruling 3 lists the path); (v) `HandoffReadError` carries
`{path, message}` and `HandoffDigestMismatchError` spells `expectedSha256`/`actualSha256`, as CT §8.3
records; the spelling is ratified; (w) Biome's import order moved `projection.test.ts`'s
`BunFileSystem` import from line 4 to line 5 when `BunCrypto` was added, and the existing effect-vitest
inventory row was re-keyed to line 5 with its reason intact; the ratchet key ignores the line, the
live rows equal the inventory, and the move is accepted; (x) the provisional vocabulary recorded in
CT §8.3 (`LanePlan`, `LaneStep`, `hasLanePlan`, `hasLaneStep`, `hasLanePlanSpecification`,
`LanePlanSpecification`, `laneStepIndex`, `laneIdRef`, `precedesLaneStep`, `handoffDigest`,
`laneOrderRule`) is the body's vocabulary; `hasCurrentLanePlan` and `scheduledLaneRef` were rejected
by the auditor lens (current-selection semantics; the unratified lane-scheduling relation);
(y) `standards/schema-catalog.generated.jsonc` is regenerated for the lab's entries only (other
packages' staleness is inherited from main and left to its owners); (z) the body lane also carries
the tests CT §8 assigns it: episode-node disjointness between an admission and a lane-plan document,
the `planLanes` self-check defect on a non-chain acyclic precedence list, the `cycleNodes` closing-
repeat and self-loop shape, the pure-core permutation test, and `LanePlanProposal.make` enforcement.

**P2 phase B landed (2026-10-06, orchestrator).** Both lanes finished under the round cap with 0
majors left: W6 (the `planEpisode` body, `emitLanePlan`, the lane-plan golden and the CQ-020 sibling;
33 lane steps, 32 precedence edges, admission emission byte-unchanged, CQ sibling PASS) and W5 (the
decoder widening, the replay window and skip rule, `LiveReplayReport`, `evidence:s7-live`: live
first-choice agreement 197 of 200, golden 41 of 41, three disagreements attributed to the #929
same-checkout skip, one skipped terminal row, four ledger-censored verdicts, custody 689 surrogate
rows, CQ-009 out of scope). The lab runs 73 tests in 5 files. Calls on the lanes' deviations, each
reversible by a later entry: (aa) Ruling 8's widening also applies to the v1 and v2 journal classes
with an at-most-one-owner check, because the pinned v1 `admission-admitted` rows carry `ownerRef`
(every class is tested); (bb) no cached or hosted step re-proves the committed live evidence (the
Labs context is not required and the lab's Turbo inputs do not name the pin): the orchestrator
re-runs `evidence:s7-live` and `evidence:lane-plan` at each phase and the PR body carries their
check-mode lines, the same accepted limit as Ruling 2's; (cc) in the W6 core, `decodeHandoffView`
takes `(path, text)` because `HandoffDecodeError` names the path, an unknown-lane precedence passed
to `planLanes` is a defect (not reachable from `planEpisode`), and a platform digest failure is a
typed `HandoffReadError` (a `Uint8Array` always decodes, so the digest is its only failure source;
corrected in review round 1, the first text said `orDie`); (dd) the stale generated module docs under `apps/labs/ciops/docs/` (git-ignored local output that
no gate regenerates: labs are docgen-exempt) are removed from the lane rather than left describing
the retired stub; (ee) `replayAdmissionJournal` was over the 60-line unit law before P2 and stays so after the
skip rule moved to helpers; a pure-reducer split is a tracked follow-up, as is the
`released_only_chains` rename from P1. Phase P2 is complete; PLAN, README and the manifest say so.
Next: P3 auditor run 4 (W7), fed by the P1 pins and the P2 projection, under the Ruling 1 gate as
amended by P1 Ruling 1.

## 2026-10-06 — P2 review round 1 (orchestrator under the autonomy charter)

Three P2 threads on the projection PR, all fixed in round 1 (the charter's round cap starts at
round 3): (ff) `generate-lane-plan-golden.ts` decodes its mode with `decodeEvidenceMode`, so
`evidence:lane-plan --write` (argv `--check --write`) is the same typed refusal as `evidence:s7`,
and golden drift fails typed as `EvidenceDriftError` naming the committed path instead of a defect;
(gg) the same script plans the live `gate-order-handoff.json` through contract §8.1 before it reads
the fixture, in both modes, so handoff drift fails typed on every run and a golden is never
rewritten from a stale fixture; Ruling 2's limit text is corrected in place (the PR had not merged,
so the entry is amended rather than superseded); (hh) call (cc) is corrected in place: the platform
digest failure is a typed `HandoffReadError`, as the code, contract §8.1 and the test assert.
Reversal: a later entry here; the script's live check is one `planEpisode` call and can be removed
if a Turbo input or a hosted step ever names the live handoff.

Round 2 (one P2 thread, fixed under the charter's cap): (ii) the shared mode-conflict refusal named
`evidence:s7:write` for every caller, so `decodeEvidenceMode` now takes the caller's own `:write`
script (`EvidenceWriteScript`, a named literal domain of the three regenerate scripts) and the hint
names it; each of the three scripts passes its sibling and the test asserts the lane-plan hint never
mentions the admission replay. From round 3 on, P2-and-below threads become tracked follow-ups
with a resolve and no push.
