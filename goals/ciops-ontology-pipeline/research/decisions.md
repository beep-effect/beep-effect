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

## 2026-10-06 — P3 opened; run-4 launch sitting (orchestrator under the autonomy charter)

Inputs: a five-lane read-only survey with a critic (the run-3 choreography, the vendored auditor
engine v15, the docket queues A–G, the gate and pin, the CQ-009 re-scope and the lab's exclusion),
checked against PLAN P3/W7, SPEC Constraints and Stop Conditions, graduation Rulings 1, 4, 6, 7, 8,
9, 10 and 11, the docket's "Not in scope", and the P1/P2 sittings. Facts the survey settled: the
run-3 prior index digests to `b9c140ccd31b` (284 rows: 37 proposed / 77 mapped / 138 unresolved
= 84 live + 54 carried / 32 irrelevant); the engine bytes at the P2 head are validator
`fdbcefc9fd70`, framed contracts `dcc8da4cc7f9` (21 files), SKILL.md `a12de4055976`, prompts
denotation `ddec132ee905`, ufo-analysis `3d94feb0629c`, synthesis `117d82b29904`,
ontoclean-adversary `9dbfb7fc9d4c`, alternative-model `4563e5726438`, sandbox runner
`ecb6dcab421b`, CQ suite `e99e30cd8015` (26 CQs), `scope.md` `9ff61c839a08` (all recomputed at
the pin); the launch gate passes from the pinned bytes (C4.1 checked at
`goals/time-to-certainty/PLAN.md:171`, byte-equal to `run4-ledger/MANIFEST.yaml` `gate.c4_1`;
`post_cut_pre_push_facts: 3628`, `holds: true`; merged-preview dormant; C4.2 unchecked) and needs no
second fleet read; the validator binds the run manifest and the dispositions index to exactly
`ONT/work/`, so every seat output lands under `ONT/work/` and `ONT/work-run4/` holds only the impl
report; the run-3 adapter is hard-wired to the four run-3 pins, so run 4 needs a sibling adapter
version with its own golden; the control-interventions ledger holds 42 rows with W1's census head at
`8b7392fe00`; the rat-049 lane-plan line, S7 contract §8 and the lane-plan golden are P2 bytes. Each
ruling is reversible by a later entry before the pin commit, and by a new run after it (a committed
pin is never refreshed).

**Ruling 1 — the run base is `origin/main` after the P2 projection PR merges.** The run branch is
`feat/ciops-p3-run4` off the merge commit of #1459, so the pin tree carries the rat-049 lane-plan
line, contract §8, `lane-plan-v1.ttl` and the live replay evidence the seats must judge (CT §8.3
hands the eleven provisional lane-plan terms to the run-4 Queue E/G intake). Rejected: stacking on
the P2 branch (no hosted proof until retargeted); pinning on main without P2 (seats would read a pin
without the vocabulary they must judge). Reversal: rebase before the pin; after the pin, a new run.

**Ruling 2 — the orchestrator rules every sitting under the charter, named honestly.** Sittings 1–3,
withdrawals, parks and every ratification are the orchestrator's calls under the operator autonomy
charter (PR #1448; "only money" escalates; the operator reviews asynchronously). The skill reserves
ratification to a human steward (SKILL "HUMAN — authoritative"; the ratification schema header), so
the deviation is recorded here, in the run README and in every run-4 ratification: `steward.id`
is the role `orchestrator-under-autonomy-charter`, `steward.name` names the session and the charter
date, every `verbatim_decision` is the orchestrator's own words, and no record names the operator or
carries words he did not say (the failure mode SKILL "Known Limits" documents is an invented human
authority, which honest labelling avoids). Rejected: routing accepts to the operator as structured
prompts (a non-money escalation the charter withdrew); closing the run by ruling with everything
`proposed` (leaves P4 on seed rows and three tiers). Reversal: a later sitting supersedes with
revise or reject ratifications (a scribed `rat-*` is never deleted); the P3 closing entry lists every
accept for the operator's asynchronous review, which is the charter's review path.

**Ruling 3 — "append under a new run or pin root" is read as the run-3 precedent reads it.** Frozen
means the corpus pins and their generators, prior indexes and manifests under `ONT/runs/`, archived
observations and seat trees under `ARCH/`, every `rat-*` byte, and `s4/LEDGER.yaml`. The run may
move the run-3 seat trees and rat-053..070 byte-identically into the shelter roots
`ARCH/orun-2026-09-10T02:10:52Z.{work,governance}/` (the SKILL rotation; `validate_packet.py` reads
them there), add new files, and regenerate the S5/S6 status files additively for its own accepts
(graduation Ruling 7; #1089). Notes live only in new files: the relocation note is
`ARCH/orun-2026-09-10T02:10:52Z.work/README.md`, the adapter record is a new file beside the adapter,
and the run-3 README, `adapters/README.md` and `work-run3/impl-report.md` are not appended to (broken
links there stay as provenance). Rejected: the literal reading (rotation impossible, v15 scans run-3
trees as live, the run cannot start). Reversal: revert before merge; after merge a later entry and a
follow-up PR.

**Ruling 4 — lanes edit files; the orchestrator owns git, the remote and the worktree.** No lane
stages, commits, tags or pushes. The relocation is a plain `mv` by the engine lane with a byte-identity
check; the orchestrator stages by name. The pin is a lightweight tag
`evidence/beep-ci-ops/<run_id with ':' → '-'>-pin` pushed by the orchestrator (run-1..3 precedent;
P1 Ruling 4 is scoped to the captures, and a run pin differs: the validator needs the pin COMMIT and
every observation id embeds it, so a tree on main cannot stand in). Residue scans run before the push.
The pin worktree is a detached worktree at the tag in the sibling `-worktrees` root; never `/tmp`,
never force-push. Reversal: delete the remote tag; remove the worktree after the run PR merges.

**Ruling 5 — the CQ-009 re-scope is the full package, in its own pre-pin commit, by the pin lane's
CQ-009 step.** Graduation Ruling 9's "re-scoped to same-checkout exclusion plus the legacy-origin
drain, with a new must-fail fixture" is read as the whole falsifiable change, so it is one commit
before the digests are computed: the CQ-009 entry (question, SPARQL with both arms bound in `?arm`,
notes citing the #929 law by symbol, temporal scope, fixtures); two new must-fail fixtures, one per
arm (`cq009-same-checkout.ttl`, `cq009-legacy-drain.ttl`), because each arm needs its own falsifier;
the seed's `grant-1` gains the checkout predicate and a protocol value so the checkout arm is not
vacuous; the old fixture `cq009-two-grants.ttl` keeps its bytes and becomes the retained pre-#929
regression under a hand-authored `ontology/tests/temporal/cq-009-pre929.sparql`, its harness row
re-pointed; the harness antecedent (`run_cq_suite.py`) and the validator's copy require an active
grant with a checkout; the errata fold is the Ruling 9 list plus `orsd.md` §9 (CQ-008 sample answer,
CQ-010/CQ-023 code cites by symbol, CQ-021 pre-#878 note, pre-glossary rows, the closed-world row,
UC-002, dated "folded at the run-4 pin" lines in `scope.md` and `orsd.md`). The two predicates are
`ciops:hasCheckout` (object property, SeatGrant → Checkout) and `ciops:hasCoordinationProtocol`
(data property, `xsd:string`, value `legacy-origin-lock/v1` for the drain); they enter
`s6/PREDICATES.yaml` as `seed-only` through `build_predicates.py`, which is not ratification (the
`landedAt` precedent). `regen_cq_artifacts.py` has no check mode, so a pre-change regeneration must
prove an empty diff first. Rejected: the minimal reading with a vacuous checkout arm (untestable);
one fixture for two arms. Reversal: revert before the tag; after the tag only a new run, because the
CQ digest sits in every review chain.

**Ruling 6 — engine scope: one sibling adapter, one transcriber, every tuple pinned.** The pin lane's
engine step writes `ONT/adapters/adapter-journal-run4.py` (v1.2.0) over the `run4-fleet` and
`run4-ledger` `.properties` projections only, with a tracked, clean golden
`ONT/adapters/golden/journal-run4/**`, and a run-4 prose transcriber over: the
control-interventions ledger rows (id, class, landedAt, mechanismChanged lines), KPI law §2 and §6,
S7 contract §8, `lane-plan-v1.ttl`, `literal-domains.md`, the deployed `ProofStage` literal line,
and both pin manifests' census readings (stage census, the gate block, the merged-preview reading).
It never transcribes DECISIONS, CQ text or ratifications. The engine lane first evaluates whether
`po_from_evidence.py` or `runtime_po_capture.py` can be reused and reports; a new
`po_transcriber_run4.py` is written only if neither fits. Queue G and the tier evidence travel as
prose observations plus `adapter-config` scalar facts where the object grammar allows. The source
observation budget stays near run 3's (about 250). Reversal: a new version before the pin; after
it, a new run.

**Ruling 7 — Queue F is carried to the next S6 refresh.** Regenerating `s6/POLICY.yaml` at a new
commit re-extracts the S6 policy (a baseline re-run under the SPEC stop) and risks value drift since
its last extraction; the tree-pinned citation convention it was to adopt is already carried by both
run-4 pin manifests. The docket records the carry as a dated addendum. Reversal: a later entry.

**Ruling 8 — seat launch: Workflow children for every seat but the blinded one, which runs headless
from an isolated root.** Denotation, foundational, synthesis and adversary seats and every
orchestration lane are one Workflow `agent()` per invocation with `model: "claude-opus-5-5"` and an
explicit `effort: "medium"` (the Claude Code default under the 2026-10-01 policy), a fresh agent per
batch and per adversary round, never continued through SendMessage (SKILL "same-context execution
voids the pass"). The blinded alternative seat runs as a headless `claude -p --model
claude-opus-5-5` with the effort setting, no MCP servers and the default permission mode, from an
isolated root under `~/.cache/beep/run4-blinded/<prefix>/` that holds only its prompt, contracts, CQ
suite, observations and hypotheses, so a read outside the root is denied by the harness rather than
by instruction alone; the engine step proves this with a canary seat before the first real launch,
and if the probe does not deny, the seat falls back to a Workflow child with instruction-only
blinding and the launch entry says so. The manifest records `effort: medium` on all five seats, the
launch entry quotes both command shapes as the deviation from skill v15's `codex exec` recipe
(graduation Ruling 4), and no Codex or Grok seat runs (no operator opt-in). Reversal: before launch,
a later entry; after launch, re-run the affected seat pass and re-review stale chains.

**Ruling 9 — seats write to the lane; gates run in the pin worktree.** Seat output goes to the run
lane's untracked `ONT/work/` (and `ONT/governance/ratifications/` for new rats); every
`validate_artifacts.py --gate --repo .` runs in the detached pin worktree with those two trees
rsynced in, so documentation commits can move the branch while `HEAD == manifest.commit` holds at
the pin. The run manifest is written after the pin, in the lane's `ONT/work/`, with `repository.commit`
= the pin SHA in block style, and is committed only at rotation.

**Ruling 10 — the docket's at-pin addendum.** The pin lane's docket step appends one dated
addendum: every count and digest re-verified at the pin; the prior chain; a Queue G row presenting
the pair only (`OperationalChangeEvent`, `ciops:landedAt`) over the ledger as it stands at the pin,
after the orchestrator re-runs the W1 lever query over `8b7392fe00..<run base>` so the ledger is
fresh (a goal-owned seed-data step, with its `w1-lever-query.md` addendum); a Queue H row for the
fourth `AssuranceTier` member (graduation Ruling 10) stating the parked `AssuranceTierId` domain as
the blocker and the dormant merged-preview reading as the evidence line; a Queue E addendum taking
the eleven provisional lane-plan terms into intake (S7 contract §8.3); a dated correction of the
stale "no CQ, seed or fixture edit is owed to run 4" and "none is scheduled" sentences; and the
shelter path remap for the run-3 trees. Rows never gain a structured `tier` member in this phase;
tier derivation for W8 is a P4 hand-off. Reversal: a later dated addendum.

**Ruling 11 — batching and the adversary round cap.** Batches keep prefix-stable membership across
stages. An adversary FAIL is blocking: it is fixed or withdrawn in any round, and rounds continue
while a FAIL remains, capped at three (run-3 precedent); a FAIL that survives round 3 ends in a
withdrawal with named evidence. Non-blocking findings from round 3 on become tracked follow-ups
(the charter's loop cap). Reversal: a later entry before the next round.

**Ruling 12 — carried rows.** The index-close lane authors all 138 carried rows with fresh
`needed_evidence` and the run date, never `mapped` or `proposed` on a carried row. The carried-rows
lane reuses the run-3 fifteen-cluster frame for the 54 C(iv) rows and the docket's C(i)–C(iii) groups
for the 84 live ones, re-clustering only where a run-4 pin offers new evidence, and re-parks every
CQ-requiring duty with "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009" as
the named missing decision. Reversal: sitting 2 re-adjudicates.

**Ruling 13 — numbering.** Ratifications continue at `rat-071`, rejections at `rej-001`, each the
maximum over the live directory and every shelter (the SKILL `LAST` probe reads only the live
directory); proposal slugs are fresh and never equal an archived id (a collision breaks the archived
digest checks in `--s5`).

**Ruling 14 — projection rides the run PR, additively.** Accepts are projected in the run PR through
the #1089 footprint (`s5/DISPOSITIONS.yaml`, `s5/TAXONOMY.yaml`, `s6/PREDICATES.yaml`, `ABOX.yaml`
only if a new class needs typing, dated notes in the S5/S6 contract docs); `apply_s5_dispositions.py`
is never run over `s4/LEDGER.yaml`. Flags are never removed: a lifted flag is a ratification that
names it, listed beside the flag, so the S5 contract needs no removal rule. Rejected: a follow-up
projection PR (lawful only with zero accepts; `--s5` must be green on the final tree). Reversal: a
revert commit.

**Ruling 15 — the lab's CQ-009 lift is its own small PR inside P3, after the run PR merges.** The
run PR carries data and docs; the lab change is schema-first (a typed `Cq009Verdict` replacing the
"temporally out of scope" reading: the same-checkout arm evaluated over the replayed active set, the
legacy arm reported as unobservable in the journal with its census, a censorship line), regenerates
the live evidence, and carries a ruling superseding P2 Ruling 9's CQ-009 sentence, an S7 §8 dated
note, and the PLAN/README/manifest text. The P3 status flip rides that last P3 PR. Rejected: lab
code inside a >1,000-file run PR (unreviewable); deferring to P4 (PLAN ties the lift to W7).
Reversal: a later entry and a lab follow-up.

**Ruling 16 — waivers.** An unresolved-fraction waiver exists only as a sitting ruling scribed here
and applied to the manifest with the sitting entry; it is never pre-declared (a dormant waiver is
flagged). Reversal: re-disposition, then re-gate.

**Ruling 17 — publication, gitleaks and the P4 hand-off.** The run tree is scanned with `gitleaks`
under main's configuration before the pin push; a main-first allowlist PR is opened only on a hit,
never speculatively. The run PR is a draft until final, labelled `ready-for-heavy`, published through
Yeet when the planner's capture limit admits it and by hand otherwise; never force-pushed. The P3
closing entry carries the P4 hand-off: the tier outcome (KPI law §2 and W8 text), the change-event
ratification state, W1 freshness at the pin, the lane-plan terms' intake outcome, and tier
derivation for change-event rows.

Recorded calls: (a) every validator run uses `uv run --offline --python 3.12 --with pyyaml python -B`
with `UV_CACHE_DIR=$HOME/.cache/beep/uv-cache`, `env -u TMPDIR` and `PYTHONDONTWRITEBYTECODE=1`
from the pin worktree, never `mise trust`; (b) the engine step proves, before anything else, the
v15 self-test on 3.12, the offline cache for cp3.12 + PyYAML, the sandbox runner, that v15 ignores
`ONT/lanes/` and `ONT/ratification-package.yaml`, and the blinded-root read denial; (c) every seat
brief states the expected standing violations before index close (138 "prior unresolved
observation … has NO row") so no seat invents rows; (d) every lane records friction receipts in
`research/OPPORTUNITIES.md` at the moment, redacted; (e) MAP W7's capability line is provenance and
stays; the NET-NEW adapter, golden and transcriber are recorded here as the capability gap it did
not list; (f) sitting entries are appended here with byte-equal mirrors under `ONT/work/sittings/`;
(g) the run README names the pin tag, the sitting entries here, the shelter relocation, the
unresolved fraction and the launch deviation.

Recorded call (h) — where gates run before the pin: no pin worktree exists before the pin, so the
call-(b) proofs, the pre-pin CQ-009 packet gates and the final-tree packet gates run in the lane
checkout under call (a)'s runtime; only `validate_artifacts.py --repo` and `--gate` runs happen in
the pin worktree. The call-(b) scans are plain `VAL "$ONT"` scans whose expected output is the
noise call (c) names (904 lines before the relocation; exactly one "NO records and no manifest"
line after it); the engine step alone may write a transient provisional manifest (`pin_waived:
true`, `repository.commit` = the current HEAD) so the adapter proofs validate against a pinned
tuple, and it deletes that file before the pin, proving it gone in its residue step (the run-3
precedent). The Ruling 9 run manifest is a different file written after the pin.
Recorded call (i) — relocated bytes are provenance, not a placement: the 26 run-3 files in the
relocation set that match the residue scan (the login-valued `steward.id` of rat-053..070 and one
gate log; seven 12-hex keys in run-3 records) are already public on `main` and move byte-identically;
the pre-push residue scan applies to new bytes only, scan B over the moved trees is informational and
must report exactly that count, and the gitleaks proof is the hosted shape: every commit in
`origin/main..HEAD` plus a `dir` scan of the final tree under main's configuration (Ruling 17).
Recorded call (j) — Ruling 6's "adapter-config scalar facts" arm is withdrawn: the run-1
`adapter-config` reads only hard-coded JSON files and Ruling 6 admits one sibling adapter, so Queue G
and the tier evidence travel as prose observations only, one PO per control-interventions row
spanning `- id:` through its first `mechanismChanged:` line (the row's own public fields). The
adapter record is the new file `ONT/adapters/adapter-journal-run4.md`; the relocation note
`ARCH/orun-2026-09-10T02:10:52Z.work/README.md` is written by the engine lane with the move.
Recorded call (k) — the blinded canary's "default permission mode" reads as `--permission-mode
acceptEdits` with permission prompts disabled, from the isolated root: a write inside the root must
succeed and a read outside it must be denied; the engine lane records the exact command and both
outcomes, and the real blinded seats use the shape the canary proved (Ruling 8's fallback applies if
the probe does not deny).
Recorded call (l) — lane scratch lives under `$HOME/.cache/beep/run4-p3/<lane>/`, never the repo
or `/tmp`; briefs cite the sitting by ruling number and the `S:n` offsets of this entry as filed.
Recorded call (m) — sequencing: the engine lane runs its call-(b) proofs and the relocation first
and reports; the orchestrator stages the relocation by name; only then do the engine's adapter and
transcriber work and the docket + CQ-009 step run in parallel (the packet validators read live and
shelter ratifications, so a relocation racing a `--s5` run would be a false red). The uv cache for
CPython 3.12 (PyYAML, rdflib, pyshacl, pyoxigraph, owlrl) was warmed online once by the orchestrator
before launch and every offline with-set verified; lanes never drop `--offline`.
Recorded call (n) — CQ-009 details under Ruling 5: the seed `grant-1` protocol value is the deployed
current default `scheduler-origin-concurrency/v1` (the legacy arm is exercised by its fixture only);
the harness carries 22 fixtures (two new rows, the old row re-pointed, no extra `rows_eq_0` row);
`closed-world.yaml` gains no `hasCheckout` closure row in run 4 because `build_predicates.py`
hard-codes fourteen declarations and the S6 scripts are not touched (a tracked follow-up for a later
ruling); the orchestrator re-verifies the CQ and scope digests on the Commit A blob before writing
the run manifest.
Recorded call (o) — the docket addendum is appended at the end of the file after "Not in scope",
the title line keeps its "pre-pin draft" words as provenance, and the addendum also dates the stale
gate-amendment sentence (docket lines 30–33) as superseded by graduation Ruling 7.
Recorded call (p) — the W1 lever-query re-run over `8b7392fe00..<run base>` is the orchestrator's
first step on the run branch; the resulting ledger sha256, row count and census head are supplied to
the docket lane in its launch message, and the docket lane writes nothing about the ledger without
them.
Recorded call (q) — the run-4 adapter's selection rules (first attempt-started per stage; per
clone and stage the first fact and shadow, the first shadow per decision class, the first fact per
outcome, tier, input source and lane class) are reviewed by the orchestrator against the engine brief
before the engine lane launches and recorded in the engine report; a rule change after the pin is a
new adapter version and a new run.
Recorded call (r) — opening facts and W1 pass 5: the P2 projection PR (#1459) merged as
`41a7b0717e`; the run branch `feat/ciops-p3-run4` was cut from `origin/main` `50b79e470b`, which
contains it, and the launch-gate bytes, both pin manifests and every engine digest above were re-read
unchanged at that base. Under call (p) the W1 lever query was re-run over the window since
`8b7392fe00` (ten PRs; "Pass 5" in `w1-lever-query.md`): two rows survived both refuters,
`iv-1427-push-first-publish` (lane-assembly, landed 2026-10-06T01:36:13Z) and
`iv-1422-spot-pool-drop-r6a` (hosted-runner-capacity, landed 2026-10-06T02:22:00Z from the runbook's
apply record under P0 Ruling 6; its record PR #1450 is not a row), eight PRs were excluded, none was
contested, and the ledger stands at 44 rows (sha256 `f520b302424f`). Ruling on the one open point:
#1427 partitions the local series only. No hosted mechanism is in its diff and rows partition only
their own tier's series (P0 Ruling 2), so its hosted consequences stay in a caveat that partitions
nothing; W8 states that population shift as a confounder at that instant (a P4 hand-off). Pass 5
batched its classifier lanes by path family (three lanes over ten PRs) with one criterion refuter and
one facts refuter. Reversal: a later entry adds a hosted co-row or re-classifies.
Recorded call (s) — engine stage 1 and the blinded seat shape (amends call (k)): stage 1 passed
with no stop (the v15 self-test on CPython 3.12, the offline cache, the sandbox runner under the
system interpreter 3.14.7 with the run-3 golden at 31 records, v15 ignoring `ONT/lanes/` and
`ONT/ratification-package.yaml`, the launch gate holding from pinned bytes, both pins verifying),
and the run-3 trees moved byte-identically (315 + 18 files, each equal to its committed blob; tree
digests `4fe3bccbf243` and `87e15cfa6d99`), leaving exactly the one expected "NO records and no
manifest" line. The canary refuted call (k)'s literal shape: with user settings loaded, user-level
allow rules for shell commands let a seat read outside its root, so that shape never launches a
seat. The blinded alternative seats launch from the isolated root with an environment of `HOME`,
`PATH` and `TERM` only, as `claude -p --model claude-opus-5-5 --settings
'{"effortLevel":"medium"}' --strict-mcp-config --mcp-config '{"mcpServers":{}}' --restricted --tools
"Read,Write" --permission-mode acceptEdits --permission-prompts none --setting-sources project,local
--no-session-persistence`, the shape the three-outcome canary proved (the inside read and write
succeed; the outside read is denied by the harness, which confines the file tools to the working
directory; the seat has no shell tool). The launcher asserts from the init event that the permission
mode is `acceptEdits`, the tool list is exactly Read and Write and no MCP server is attached, hands
the seat an explicit input manifest (it has no listing tool), checks that the harness's per-root
memory directory is empty before launch, and records every permission denial as a blinding incident
in the launch record. Ruling 8's Workflow-child fallback is not used. Also recorded: verification
lanes (skeptics) may run at effort `high`, while seats and their manifest entries stay `medium`; the
engine step's scratch root is `~/.cache/beep/run4-engine` as its brief names (call (l) covers the
other lanes); the three empty directories left under `ONT/work/` stay; the system interpreter version
is named in the run README as the adapter runtime. Reversal: a later entry before the first blinded
seat launches; after it, a re-run of the blinded pass.

## 2026-10-06 — P3 pin-stage and seat-stage calls (orchestrator under the autonomy charter)

Inputs: the engine lane's stage-2 report and its skeptic, the docket and CQ-009 lane's report and its
skeptic, and the five seat briefs with their two skeptics. Each call is reversible by a later entry
before the pin commit, and by a new run after it, unless it says otherwise.

**Call (t) — the CQ-009 package is committed and its digests are final.** The package landed as
`4af5ca6981`; read from those blobs, the CQ suite is `e1ed9c0f65f5` (26 CQs), the scope document
`750657e0c5b7` and the S6 predicate registry `93b8172adc08` (89 predicates; `hasCheckout` and
`hasCoordinationProtocol` seed-only). The orchestrator's gates on that tree: validators base, `--s5`
and `--s6` at 0 blockers and 0 warns, the CQ suite at 0 failures across 25 seed tests and 22
fixtures with CQ-009 non-vacuous on the seed. One skeptic correction is adopted as law for any later
ETL: `hasCoordinationProtocol` carries the DECODED value (a persisted record without the field decodes
as `legacy-origin-lock/v1`), so an absent triple would be a false green on the legacy arm. No CQ or
scope byte changes after this commit until the run closes (the digest sits in every review chain).

**Call (u) — adapter v1.3.0 before the pin.** v1.2.0 as proven emits 287 source observations in 5.2 MB,
three of them whole-file vocabulary records of 0.27 to 2.2 MB, and with the 95 prose observations the
run would open at 382 against a budget of about 250 (run 3: 216). It is not pinned. v1.3.0 changes
two rules and keeps the rest: R2 keeps every admission chain that carries a withdrawal or an eviction
(47; Queue D needs the organic evictions and a withdrawal chain with both ticket records, so none is
sampled away) plus the first plain chain per (kind, priority) of its enqueue row; R1 emits one
vocabulary record per record stanza that holds the first occurrence of at least one key of its (pin,
kind), carrying exactly the keys first seen there, so no record spans a whole file. R3 and R4 stand,
with R4(b) keyed on (decision kind, reason, observed) as the brief and the adapter have it (call
(q)'s "decision class" wording yields to it). The prose grain stands: the lane-plan terms have per-term
Turtle observations and the tier evidence has the literal-domains row beside the KPI section. The
golden keeps every lock the review round added (each rule component alone, thirty failing mutants)
and adds locks for the two changed rules; its expected set may be produced through the sandbox by a
throwaway variant and then proven by the real adapter, disclosed in the adapter record. The lane
reports the new totals; the orchestrator accepts them only at or under the budget, or rules again.
Rejected: pinning 382 (seats would denote 196 near-identical plain chains and read megabyte
excerpts); per-item prose grain (more records for no new kind).

**Call (v) — one rule set for every seat.** Seats run none of the common brief's preconditions (they
read this log, which is excluded for seats; the orchestrator verifies them before each launch), write
no report file and no receipt (friction returns in the structured result and the orchestrator files
it), run scan A only, and run only the plain validator scan in the lane, or none when their toolset
has no shell. Seats receive a trimmed seat-common brief (the common brief without the scan-B file
names, the owners table and the prior-index census, which name archived slugs and outcomes), never
the lane copy. Launch variables are fixed: `LANE`, `PREFIX`, `BATCH` (always the observation list
`ONT/work/denotation-batches/batch-<PREFIX>.txt`), `INPUT MANIFEST` (the exhaustive file list for
that launch; a needed file missing from it is a stop), `ROUND` (r1 to r3 for synthesis revision and
the adversary), `REPAIR` (validator lines under the seat's own directory only, never a line naming
`work/alternative/` and never a FLAGGED line; or the orchestrator's restatement of a landed attack
as rule id, target record and one sentence, never review text), and for consolidation `OUT` and
`SOURCES`. Each seat's input set is closed as its brief lists it; extra record keys the validator
does not close (`referent_grain`, `evidence_refs`, `rationale`) are allowed on identity cards and
analyses as at run 3. Expected noise once proposals exist is the 138 lines of call (c) plus one
"dispositions.index.yaml missing" line; stages run in order (all denotation, then foundational beside
blinded, then synthesis, then the gate, then the adversary), so a seat that sees another prefix's
partial files in a plain scan reports their count and fixes nothing.

**Call (w) — denotation and batching.** The skill's default stands: a discriminated referent with
neither a warranting suite CQ nor a CQ-warranted kind it supports is written null-standing and
`unresolved` with Ruling 12's sentence as the named missing decision, so the Queue D terminations
re-park on the CQ barrier while a tier member reaches analysis through the tier CQs. The
consolidation pass is conditional: it runs only when the orchestrator's cross-batch check finds one
kind under two or more prefixes, a status disagreement or per-individual grain. Batches are planned
so each queue's evidence sits together: the change-event rows with KPI law section 2 (Queue G); KPI
section 6, the literal-domains rows, the `ProofStage` line, both manifest census records and the
stage-bearing attempt and ledger observations (Queue H, with the `AssuranceTierId` row in the same
batch so the tier class can be hypothesized beside a member); S7 section 8 with the lane-plan Turtle
(the lane-plan terms). No batch is built to manufacture a support chain: the lane-plan terms have no
CQ and no same-run decision term to support, so they are analyzed and end deferred with the missing
lane-order CQ named, unless the seats find a warrant the orchestrator did not.

**Call (x) — blinded seat details (extends call (s)).** Prose observations are evidence for every
seat, the blinded one included: identifiers of earlier ratifications, flags or archived record ids
that appear inside quoted source text (S7 section 8, literal-domains, hypothesis descriptions quoting
them) are sanctioned exposure, read as quoted text and never as a category verdict. The root also
receives the shared foundational-analysis contract. A pass that meets a permission denial stands when
the three init assertions held and its output cites nothing outside its manifest; the denial is
logged in `ONT/work/review-audit/blinded-launch-log.md` with the pass's root, prefix and init facts.
A pass whose init assertions fail is void. A repair pass is a fresh process in a rebuilt root holding
only the failing `-alt-` pairs and the validator lines naming that prefix's alternative files;
DISPUTED flags and coverage errors are never forwarded (they name the primary category). A prefix gets
at most the first pass and two repair passes. Before the first launch the orchestrator confirms that
the user-level instruction files the headless seat loads carry no ontology content and that the
per-root memory directory is empty.

**Call (y) — proposals, reviews and withdrawals.** Proposals name `https://oip.law/ontology/ci-ops#`
plus the local name as the proposed IRI (run-3 precedent; proposing an IRI is not IRI-scheme work). A
flagged term that a surviving chain denotes is carried by a reuse proposal with the phrase "flag
<name> persists; no lift claimed", because a `mapped` row needs a same-run proposal; a lift is claimed
only by a proposal that says so. Category rivals on one hypothesis go to a steward-choice open issue,
never a second proposal. A struck attack stays listed in the revision log with an open-issues line
naming the striking ruling, and the adversary does not re-land it without a different counterexample;
when a revision log misses a failed digest or a landed rule, the adversary writes no review and
reports the gap. New proposals in a revision pass are allowed only in rounds 1 and 2 and only where a
landed attack, a ruling or an upstream repair requires one. The synthesis seat writes a withdrawal
receipt (digests of the proposal and each review); the orchestrator verifies the digests and deletes
the files, so no seat deletes another seat's records. Ruling 11's cap holds: a round-3 FAIL is
withdrawn, except that a sitting which strikes every landed attack of that FAIL may order one more
review of the unchanged bytes, recorded in that sitting entry. The orchestrator runs the mechanical
gate in the pin worktree before every adversary round and checks slug freshness against the shelters.

**Call (z) — adapter v1.3.0 accepted; the pin's observation set.** v1.3.0 (`0e6d17963817` in the
working tree; the run manifest pins the committed blob) emits 109 source observations in 0.44 MB with
a largest record of 11.5 KB: 24 stanza-scoped vocabulary records, 52 admission chains (44 with a
withdrawal, 3 with an eviction, 5 plain, one per (kind, priority) class) and the first-v3-tag record, 3
first-stage records and 29 ledger records. With the 95 prose observations the run opens at 204,
inside the budget. The golden holds 65 expected records over 21 synthetic inputs, and fifty-five
single-substitution variants of the adapter all fail it. Ruled with it: the one record that equals its
file (the three-line protocol projection, a single stanza) meets call (u) in intent; five pairs of
records share path, span and name and differ only in facts, the vocabulary record being a strict
subset, so they stay, the denotation brief names the pattern and each pair is batched together; the
chain definition stays v1.2.0's; Queue D's resubmission evidence is sufficient as emitted (all 44
withdrawal chains and all 3 eviction chains, with a later same-checkout enqueue emitted as its own
chain for 20 of the withdrawals), so no further version is ordered: the withdrawn readings turn on a
demand referent and consumers the journal does not carry. The run manifest is written from the pin's
blobs and the prose set is emitted in the pin worktree, never from lane scratch.

## 2026-10-06 — run-4 launch record (orchestrator under the autonomy charter)

The pin is commit `71c7357adc`, retained by the pushed lightweight tag
`evidence/beep-ci-ops/orun-2026-10-06T15-51-01Z-pin`; the run is `orun-2026-10-06T15:51:01Z`. Gates on
the pin tree before the push: gitleaks under main's configuration over every commit of the branch
and every changed path (no leaks), the residue scan over the added lines (clean), the packet
validators base, `--s5` and `--s6` (0 blockers, 0 warns), the CQ suite (0 failures across 25 seed
tests and 22 fixtures), the run-3 citation replay (0 failing) and the repository knowledge, goals,
atlas and markdown-law checks (all clean). The pin worktree is a detached worktree at the tag in the
sibling worktrees root. The run manifest records the pinned digests (CQ suite `e1ed9c0f65f5`, 26 CQs;
scope `750657e0c5b7`; adapter-journal 1.3.0 `0e6d17963817`; the engine freeze), five seats on
`claude-opus-5-5` at effort `medium`, and the prior chain. Observed at the pin inside the pin
worktree: 109 source observations from the sandboxed adapter and 95 prose observations from the
transcriber, each set byte-identical on a second pass; the repository-fidelity scan shows exactly
the 138 expected lines and nothing else. Fifty-four source observations quote the one native 12-hex
`originKey` the pins carry verbatim (goal P1 Ruling 7); attempt ids in the ledger and attempt
projections are pin bytes already on main.

**Call (aa) — the denotation batches.** Five batches, every observation in exactly one, each
shared-span pair inside one batch: `chg` (45: the 44 change-event ledger rows with KPI law section 2;
Queue G), `tier` (41: KPI law section 6, the literal-domains rows and rulings, the `ProofStage` line,
both pin manifests' census blocks and the 16 attempt observations; Queue H), `prf` (32: the
proof-ledger observations; Queue B issuance and custody), `jrn` (61: the 60 admission-journal
observations with the live-state record; Queue D), and `lpl` (25: S7 contract section 8 with the
lane-plan Turtle; the Queue E lane-plan terms). Call (w) placed the stage-bearing ledger observations
with Queue H; they stay in `prf` instead, because the tier batch already reads the ledger's stage
census through the manifest prose and one batch of 73 records would crowd a single context. If the
tier and proof-ledger seats denote the same kind under two prefixes, the conditional consolidation
pass of call (w) reconciles them. Reversal: a re-batched denotation pass before foundational
analysis starts.

**Call (ab) — seat repair rows, the round-3 exception, and three seat details (amends calls (v),
(w) and (y)).** The seat briefs' skeptic showed four gaps; each is closed here. (1) `REPAIR`'s second
arm is a list of bare rows the orchestrator writes, one per line, never sitting text, its mirror or
review text: `landed <rule> <target>: <sentence>`, `struck <ruling n> <target> <failed digest
12-hex> <rule>`, `withdraw <ruling n> <target>: <sentence>`, `upstream <target> <repaired dh, ic or
fa id> <rule>`, `ruling <ruling n> <target>: <sentence>`. The adversary receives struck rows only;
denotation and foundational seats receive landed rows only; a withdrawal receipt's authority is the
row's ruling number with its sentence. The blinded seat's `REPAIR` may also carry `residue <file>
<class>` rows for a residue-scan or gitleaks hit on its own records. (2) Call (y)'s round-3 exception
runs on changed bytes: when struck rows cover every rule a round-3 FAIL landed, the synthesis seat
appends the revision-log entry and one open-issues line per struck rule and changes nothing else,
and the adversary reviews once more at the target's next review number; the engine can only re-FAIL
unchanged FAILed bytes, so "unchanged bytes" in call (y) is superseded. Partial strike coverage does
not open the exception. (3) Call (w) is read strictly for the lane-plan terms: they are denoted and
parked null-standing and `unresolved` at denotation with the missing lane-order CQ named, receive no
analysis pair and no proposal, and the index-close lane carries their rows; a warrant named at
denotation is the only route to analysis. (4) The Queue H "prior refutation to answer"
(`fa-pb-yeet-proof-tier-001` in the run-2 shelter) is answered by the orchestrator in the sitting
that rules the tier proposal, not by a seat, because the shelters are closed to seats. (5) Before the
first blinded launch, the memory canary of the blinded brief's checklist runs and its result is
logged; the earlier canary already showed no memory path and no ontology skill under the final shape.
The six seat briefs are installed as `research/run4-lanes/p3-seat-{common,denotation,foundational,
blinded,synthesis,adversary}-brief.md`; every input manifest lists the seat-common brief and the
seat's own brief, and the blinded seat receives Part A of its brief only, as the root's brief file.

**Call (ac) — denotation results and the consolidation pass.** The five seats wrote 56 hypotheses
(`chg` 6, `tier` 15, `prf` 12, `jrn` 14, `lpl` 9), every observation cited by its own batch, no stop.
The cross-batch check found the same kinds under several prefixes: a verification attempt under
`tier`, `prf` and `jrn`; a proof stage, tier values, a grouping of attempts under one run and a lane
execution under `tier` and `prf`; the admission work kind under `jrn` and, as a merged-preview
reading, under `tier`. Under call (w) the consolidation pass runs once over those three batches with
the fresh output prefix `vfy` and a union batch of 134 observations; `vfy` is the prefix of every later
stage for that material, and the 41 source records are retired after an exact coverage check (kept
outside the repository for audit, never committed). `chg` and `lpl` share no kind with them and keep
their prefixes; the `lpl` hypothesis of the same-checkout admission skip is a mechanism reading from
prose, not an instance of the seat-grant or checkout kinds, so it is not consolidated. Reversal: a
re-run of the consolidation pass before foundational analysis starts.

**Call (ad) — the denotation stage closes.** The consolidation pass merged the `tier`, `prf` and `jrn`
hypotheses into 35 `vfy` records over their 134 observations; an exact coverage check confirmed the
union, and the 41 source records were retired outside the repository. An independent skeptic per
prefix then checked every hypothesis against its records. The recurring defects were wording a seat
took from its brief and stated as a record fact (for example "applied outside the repository", which no
change-event row says), viable rival readings collapsed into one, and queue answers stated beyond the
records (the merged-preview records read the deployed `proofTier=full` as placing an attempt in an
assurance tier, although that mapping is open). Two repair rounds fixed every blocker and major from
landed rows in the call (ab) shape, and a last majors-only round split the head-plus-diff working state
into its own hypothesis and removed one unsupported claim; the remaining minors are tracked follow-ups
for the synthesis seat. The stage ends with 54 hypotheses (`chg` 6, `vfy` 36, `lpl` 12), every
observation cited, and the repository-fidelity scan in the pin worktree showing only the 138 expected
lines. Survivors under the validator's rule (null rejected, a discriminator, a domain-referent or
information-artifact status) are `chg` 1 and `vfy` 16; the lane-plan batch has none, as call (ab)
expects, so the foundational and blinded seats run for `chg` and `vfy` only. Notable outcomes the later
seats inherit: the assurance-tier class and the change-event landing instant both stand
null-standing and unresolved for want of a record-backed discriminator, so the Queue G property and the
Queue H tier class reach synthesis without an analysis pair unless a later record supplies one; the
merged-preview stage and work-kind readings survive, the tier reading does not. The blinded seat's
memory canary passed before launch (it reports nothing in context and loads no memory path), and the
launch log records the pre-launch checks. Reversal: a re-run of the affected denotation pass before
the foundational pairs are reviewed.

**Call (ae) — the analysis stage and its check.** The two foundational seats wrote one identity card and
one foundational analysis per survivor: `chg` 1 (an event, rigid, with two event-grain rivals still
viable) and `vfy` 16 (ten analysed, six explicitly deferred with named evidence: both work-kind
readings, the proof stage, the merged-preview stage, the seat grant and the seat request). The blinded
alternative seats, launched in the call (s) shape from allow-listed roots, wrote the same 17 pairs; the
init assertions held, no read was denied, no record fell outside the alternative grammar or cited
anything outside its manifest, and residue and gitleaks scans were clean. With all 68 analysis records
in place the repository-fidelity scan in the pin worktree shows only the 138 expected lines. The
primary pairs, which feed synthesis, get one independent check of the denotation kind (record-backed
claims, criteria, categories, rivals, queue duties), whose checkers never read the blinded pairs so no
blinded category can reach a primary repair row. The blinded pairs are judged only by the validator and
by the category comparison the mechanical gate prints as DISPUTED flags for the sitting; they are not
repaired to chase agreement. Reversal: a repair pass of either seat before synthesis starts.

**Call (af) — foundational repair loop and the unnamed-pair Stop.** The primary pairs went through an
independent check, then repairs and rechecks: round 1 (52 rows), round 2 (22 rows, after a recheck found
11 majors and 18 minors) and round 3 (9 rows, majors only). The review-loop rule applies as written:
blockers and majors are fixed in any round, minors are fixed through round 2, and from round 3 the
minors become tracked follow-ups carried into synthesis as open issues, not repair rows. After the
round-3 repair a narrow recheck confirms every row is answered and looks only for new blockers; a new
major that a repair sentence introduces at that point goes to the adversary stage, whose attacks on
identity, category or rivals land on the IC, FA or DH anyway. The foundational brief's Stop for "an
`ic-`/`fa-` file of your prefix exists before you start and `REPAIR` does not name it" guards against
overwriting work: on a `REPAIR` launch the prefix's unnamed pairs exist by design from earlier passes,
they are read-only inputs, and their presence is not a Stop; a seat still never rewrites a pair no row
names. The launch message states this call. Reversal: name every pair of the prefix in a later pass, or
relaunch the affected pairs from a first pass.

**Call (ag) — the foundational stage closes.** Three repair rounds answered all 83 landed rows (52, 22
and 9), none declined, and the round-4 recheck found no new blocker. The plain scan and the
repository-fidelity scan in the pin worktree still show only the 138 expected lines. The pairs now
stand at: `chg` 1 analyzed (change-landing, an event, with four viable rivals: apply against merge,
the supersession grain, the ledger row and the change artifact); `vfy` 4 analyzed (committed-failure,
lane-execution, verification-attempt, verification-evidence-record) and 12 explicitly deferred
(admission-charge, admission-work-kind, cache-epoch, checkout, merged-preview-stage,
merged-preview-work-kind, peak-memory-use, proof-stage, seat-grant, seat-request, tree-state,
verification-lane), most with the category unresolved and each naming the record that would decide
it. The repairs moved pairs toward deferral because the selected records show shapes, never counts,
joins or absences, and several first-pass readings had leaned on facts outside their own hypothesis.
That is the honest yield of this corpus, not a defect to repair away. Queue H stays open: no pair
rules tier against stage. The 21 minors from rounds 3 and 4 are tracked follow-ups for the
implementation report. One seat's filename-only grep over all prose observations saw one name off its
manifest without reading the file; that file is a run-4 observation, not an excluded path, so the
pass stands. Synthesis starts for `chg` and `vfy`; `lpl` has no surviving chain and goes to index
rows only. Reversal: reopen a pair with a repair row before synthesis reads it.

**Call (ah) — an interrupted synthesis seat.** The workstation session ended while both synthesis seats
ran. The `chg` seat had already returned (one decision proposal, `OperationalChangeEvent` on CQ-016,
with the four viable rivals as steward-choice open issues; `landedAt` is not proposed because its
chain did not survive denotation, so CQ-016 is half answered and goes to the sitting). The `vfy` seat
died after writing nine proposals and before its self-check, scan or Return, so nothing vouches for
those bytes. They are retired outside the repository with their digests, and a fresh `vfy` seat redoes
the whole batch from the same input manifest; a dead seat's partial output is never continued
(same-context rule). No upstream record changed after synthesis started. Reversal: restore the retired
files from their digest list.

## 2026-10-06 — run-4 withdrawal sitting W1 (orchestrator under the autonomy charter)

Run-4 rulings continue the launch sitting's numbering (Rulings 1–17). Adversary round 1 landed a
`discriminator-true-of-dto` attack on three `vfy` proposals. The denotation seat, sent the landed
attacks as repair rows, found no cited record false under the named twin and set each null not
rejected: `dh:vfy-cache-epoch:001` (each cited epoch digest belongs to one attempt, which an opaque
per-attempt digest also shows), `dh:vfy-checkout:001` (a recurring checkout root is equally a path label
stored on each request; it also moved its warrant from CQ-009, whose query compares values, to CQ-015)
and `dh:vfy-verification-evidence-record:001` (a later lookup and an expiry are equally true of a
skip-only build-cache entry). A proposal needs a surviving chain, so these three cannot stand.

**Ruling 18 — withdraw the three proposals whose chains no longer survive.**
`otp:vfy-cache-epoch:001` (CacheEpoch), `otp:vfy-checkout:001` (Checkout) and
`otp:vfy-verification-evidence-record:001` (VerificationEvidence, a reuse) are withdrawn. The synthesis
seat writes the receipt with the files' digests; the orchestrator verifies them and deletes the
proposals and their round-1 reviews. No proposal depends on them. Their identity cards, analyses and
blinded pairs stay as records of non-surviving chains, and the index-close lane carries their
observations with the needed evidence each hypothesis now names: one epoch digest across two attempts,
heads or clone ledgers; tree state carried by one checkout root across two requests or attempts, or a
checkout mounting a cache; an issued fact consulted for something other than skipping work, or copied
or corrected as the same item. CQ-005, CQ-006, CQ-014 and CQ-015 therefore lose these subjects in run
4; no CQ edit is made (Ruling 5). Reversal: a later run re-presents a term from a fresh chain that cites
the named record.

## 2026-10-06 — run-4 sitting 1 (adversary adjudication, orchestrator under the autonomy charter)

Docket: 15 adversary reviews over 14 proposals (round 1: 11 PASS / 4 FAIL, no INDETERMINATE;
round 2: the revised change-landing class, PASS), three proposals already withdrawn at sitting W1,
and the review-validity audit by three independent auditors who read the closure only
(`work/review-audit/validity-report-r1-{chg,vfy-admission,vfy-verification}.md`). Every landed attack
the audit examined is demonstrated; none is struck. Of the 11 latest PASS reviews, 6 are sound
(change-landing, admission-charge, seat-grant, seat-request, committed-failure, verification-lane)
and 5 are not, each for an attack the reviewer tried with a twin or a record reading the closure
refutes.

**Ruling 19 — four missed attacks land; one is outside the reviewer's standard.** The sitting lands:
on `otp:vfy-lane-execution:001`, identity (the cited verdict record's durations show the wrapper lane
containing its 32 child lane executions, which the card says the record does not show, and the same
record and a ledger fact share one attempt and one duration, which bears on the two-referent rival);
on `otp:vfy-tree-state:001`, the null discriminator (every shared head value in the chain is equally
shared by a per-attempt or per-run writer stamp); on `otp:vfy-merged-preview-work-kind:001`, the null
discriminator (the still-viable charge-code reading makes every cited charge fact true); on
`otp:vfy-admission-work-kind:001`, the warrant (Ruling 20). The audit's null attack on
`otp:vfy-verification-attempt:001` does not land: VerificationAttempt is a Queue A recorded-value
reuse deferral, and the adversary brief judges a reuse that keeps its flag on semantic match only, the
standard the reviewer applied. Its warrant falls under Ruling 20. Rejected: re-running the adversary
blind on unchanged bytes (the reviewer may miss again, and the audit already shows the attack from
the closure).

**Ruling 20 — a decision warrant needs a query that uses the term itself.** A Must/Should CQ warrants
a decision term only when its executable query types by the class, uses the property, or names the
individual. A query that binds the referent as an untyped join or harness-bound node, with the class
only in `required_classes`, needs the individual but not the term, and warrants nothing (the briefs'
"a CQ that only mentions the term warrants nothing", applied to the query text). Such a term takes the
support arm toward a same-run decision term it is necessary to define, constrain or disambiguate, or it
defers. This reaches `otp:vfy-admission-work-kind:001` (CQ-021 reaches the kind only as the object of
`hasWorkKind`), `otp:vfy-tree-state:001` (no CQ-005, CQ-006 or CQ-014 query types the tree) and
`otp:vfy-verification-attempt:001` (CQ-022 joins executions to the attempt without typing it); the
other proposals' queries type their terms. Rejected: reading `required_classes` as a warrant (it
licenses every listed class with no query need).

**Ruling 21 — the semantic-match exemption covers flagged reuses only.** A reuse is attacked on
semantic match only when the ratified term is flagged in TAXONOMY or is one of the Queue A
recorded-value reuse deferrals (SeatRequest, SeatGrant, VerificationAttempt, VerificationResultArtifact)
and the proposal says the flag persists and claims no lift. Every other reuse, including an unflagged
literal member such as MergedPreviewWork, takes the full standard on every surface.

**Ruling 22 — how the landed attacks reach the seats.** An attack the sitting lands on a hypothesis or
analysis reaches that record's own seat as a `landed` row (call (ab) shape; the sitting is the one that
landed it) and then the synthesis seat as an `upstream` row; a Ruling 20 warrant defect reaches the
synthesis seat as a `ruling` row. A chain whose null then stands is withdrawn at a further sitting. A
revised proposal is reviewed by a fresh adversary at its own next round. No validity-audit text reaches
any seat.

**Ruling 23 — questions held for sitting 3.** The change-landing class keeps its CQ-016 warrant (the
query types it), but `landedAt` has no surviving chain, so CQ-016 cannot return a row on run-4
vocabulary; sitting 3 decides whether the class ratifies alone. PASS with DISPUTED is the intended
outcome when a proposal carries steward-choice rivals, and an explicitly deferred proposal submits
FLAGGED; sitting 3 rules each. Identity rivals carried as steward-choice issues on an analyzed verdict
(committed-failure's obsoletion point, verification-attempt's request alias) are allowed, and sitting 3
weighs them. Reuse proposals that carry rigidity unresolved over a ratified rigid row meet the step-8
OntoClean rule at sitting 3; no prior ratification changes before then. Tracked follow-ups: the
change-landing proposal's "later P0 Ruling 3" wording (the closure-grounded reason is that a row
records a merge commit), and the seat-grant proposal's open issue that names the withdrawn checkout
proposal. Reversal: a later sitting supersedes any ruling here.

## 2026-10-06 — run-4 sitting 2 (carried-row adjudication, orchestrator under the autonomy charter)

Docket: the 138 prior unresolved rows (91 source, 47 prose; 84 live in Queue C(i)–C(iii), 54 carried
run-2 rows in C(iv)), clustered on the intake docket's groups and the run-3 fifteen-cluster frame
(`work/sittings/carried-rows-docket.md` and `carried-clusters.yaml`). No run-4 observation re-observes
a prior chain (no shared nonce or attempt id) and no run-4 analysis cites a prior id, so nothing
re-clusters and nothing retires by re-identification. The lane's checks hold: 138 ids, each once,
equal to the prior unresolved set; every row `unresolved`, `carried_from_prior: true`,
`since: 2026-10-06`; no needed evidence repeats the prior text; the 48 rows on duties that need a new
Must/Should CQ name "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009".

**Ruling 24 — all 138 rows re-park with fresh evidence; none retires.** The index-close lane writes
the carried rows exactly as `carried-clusters.yaml` gives them. The four retirement candidates are
rejected for run 4: recovery-durations (the run-4 chain holds that observation on policy recurrence,
not on execution boundaries, so re-identification would drop the duty); comparison-operand-binding
with the freshness duty (the ground is the workspace-bookkeeping null, a hypothesis no proposal or
review has tested); governing-specification-comparison (the contract's diagnostic-only wording speaks
of the admission model; whether any gate consumes the comparison stays the open question); and the
origin-block rows (the change ledger row that retires the per-origin lock is observational seed data,
and CQ-009's legacy-drain arm still needs the origin regime). Rejected: retiring the synthetic-corpus
rows because run 4 dropped that corpus (the duties concern boundaries an organic record leaves just as
open).

**Ruling 25 — the zero-ledger premise has changed.** Run 4 captures writer-issued proof-ledger facts
and shadows, so the issuance duties that rested on there being no ledger now narrow to copy,
correction (the time-to-certainty C4.2 check) and custody, plus their CQ duties; the fresh needed
evidence says so row by row. The frozen-replay rows stay bound to the frozen S6 snapshot; moving them
to the live-replay report needs a transcription lane in a later run. The deferred-tail row stays
decision-gated, with the same-checkout skip named as the candidate consumer for the next capture.
Reversal: the next run's sitting 2 re-adjudicates.

## 2026-10-06 — run-4 withdrawal sitting W2 (orchestrator under the autonomy charter)

Under Rulings 19 and 22 the denotation seat received the two null-discriminator attacks the sitting
landed and again found no cited record false under the named twin: every head value that recurs in
`dh:vfy-tree-state:001` stays inside one attempt or one run, as a writer stamp's would, and every
charge fact in `dh:vfy-merged-preview-work-kind:001` is equally true of a charge code with no kind of
work behind it. It set both nulls not rejected and named the needed evidence: one head value across two
runs, or across two attempts that share no run; and a merged-preview chain charged other than 5, or a
work fact beside the kind that no full-proof record carries.

**Ruling 26 — withdraw the two proposals whose chains no longer survive.** `otp:vfy-tree-state:001`
(TreeState) and `otp:vfy-merged-preview-work-kind:001` (MergedPreviewWork, a support individual) are
withdrawn on the Ruling 18 procedure: the synthesis seat writes the receipt, the orchestrator verifies
the digests, deletes the proposals and their reviews and keeps a backup. No proposal depends on either.
The index-close lane carries their observations with the named evidence. In the same synthesis pass,
`otp:vfy-admission-work-kind:001` and `otp:vfy-verification-attempt:001` answer Ruling 20 (support arm
or deferral) and `otp:vfy-lane-execution:001` answers the repaired card and analysis; a proposal the
seat returns as a withdrawal candidate is withdrawn at the next sitting. Tracked follow-up: the
alternatives of sibling hypotheses that still describe these two referents as domain referents.
Reversal: a later run re-presents either term from a fresh chain that cites the named record.

**Call (ai) — the W2 withdrawal receipt.** The synthesis pass for Ruling 26 stopped before writing its
receipt: both withdrawal passes ran at `ROUND: r1`, so the brief's fixed name
`withdrawals-vfy-r1.yaml` already held the Ruling 18 receipt and the seat correctly refused to overwrite
it. It returned the digests instead. The orchestrator wrote `work/sittings/withdrawals-vfy-w2.yaml`,
naming itself as author and transcribing the seat-computed digests after checking each against its own
pre-pass digests and the files, then kept a backup and deleted the two proposals and their reviews.
The same pass moved `otp:vfy-admission-work-kind:001` to the support arm (toward the seat-request and
admission-charge proposals) and `otp:vfy-verification-attempt:001` to the support arm (toward the
committed-failure and lane-execution proposals) under Ruling 20, and re-derived
`otp:vfy-lane-execution:001` from its repaired card and analysis. Next run's brief should name the
receipt by pass, not by round. Reversal: restore the backup and rerun the pass.

## 2026-10-06 — run-4 withdrawal sitting W3 (orchestrator under the autonomy charter)

Adversary round 3, the last round under Ruling 11, closed the review loop. `otp:vfy-lane-execution:001`
(WorkUnitExecution) passed: the round-2 rule did not land again on the revised definition, which now
counts an execution from its start, and its one rival (a process counted while running) makes it
DISPUTED. `otp:vfy-admission-work-kind:001` (AdmissionWorkKind, an exact reuse moved to the support arm
under Ruling 20) failed again on `support-not-necessary`, with a new counterexample: CQ-021 already keeps
the work kind and the priority apart on two properties with distinct member names, so the class could
disambiguate them only as the range of `hasWorkKind`, which is parked with its range unknown, and no
cited chain carries the publish-and-publish case it would separate.

**Ruling 27 — withdraw the round-3 FAIL with named evidence.** `otp:vfy-admission-work-kind:001` is
withdrawn on the Ruling 18 procedure. It returns only with: a ratified range of `ciops:hasWorkKind` equal
to AdmissionWorkKind (an S6 refresh) together with a SeatRequest constraint that a request has exactly
one work kind from that class; or a pinned Must/Should CQ whose query types the kind; and, for the
disambiguation case, an admission chain carrying kind and priority both equal to publish. No proposal
depends on it. The ratified AdmissionWorkKind row is untouched: this withdraws a run-4 reuse proposal,
not a prior ratification. Reversal: a later run re-presents the reuse from a chain citing that evidence.

## 2026-10-06 — run-4 sitting 3 (ratification, orchestrator under the autonomy charter)

Docket: the eight proposals that stand after three adversary rounds and six withdrawals
(`work/sittings/ratification-docket.md` and `.yaml`, advisory only). Latest reviews: 8 PASS, 0 FAIL,
0 INDETERMINATE. The pre-scribe gate at the pin printed ARTIFACTS VALID — GATE PASSED with 154 flags
(138 carried rows, 12 DISPUTED, 4 explicitly deferred) and an unresolved fraction of 54/198 = 27%, so
no waiver is in play (Ruling 16). The blinded seat agreed with the primary seat's event category on the
four event proposals; it named a category (quality, relator, relator, information object) where the
primary seat left four deferred reuses unresolved. Every ratification below names the orchestrator role
as steward under Ruling 2 and is in the orchestrator's own words.

**Ruling 28 — a reuse ratification affirms denotation under the ratified values.** When a run-4 chain is
mapped to an already ratified term at the same grain, ratifying the mapping affirms that run 4 denotes
that term; it does not overwrite the ratified row's category, rigidity or identity. The run-4 card's
unresolved values and still-viable rivals enter the row as flags with their discriminating evidence, and
a Queue A flag that the proposal says persists keeps persisting. The step-8 OntoClean rule therefore does
not fire for the five reuses (VerificationAttempt, SeatRequest, SeatGrant, admissionChargeTokens,
VerificationLane): none submits a new core sortal, and each ratified rigid value stands. The seat cluster
takes this one position together, and no SeatRequest flag lifts singly. Rejected: rejecting the reuses for
unresolved rigidity, which would re-disposition 96 mapped index rows and erase run 4's re-examination
while the ratified rows stand regardless.

**Ruling 29 — the new event classes are not core sortals.** The step-8 rule's core sortal is an endurant
type that supplies identity to other types, a kind or subkind anchor. CommittedFailure and
WorkUnitExecution are events whose criteria derive from an attempt and a step or a lane; nothing takes
identity from them. Their rigidity doubts (a retried step or revised failed step; a wrapper absorbing its
children, or a relabelled lane) become flags. OperationalChangeEvent's rigidity is resolved. Rejected:
holding them for revision until wrapper parthood and the obsoletion point are decided; the review loop is
closed (Ruling 11) and each doubt carries its discriminating record.

**Ruling 30 — all eight are accepted as flagged accepts,** scribed individually as rat-071 to rat-078:
OperationalChangeEvent, VerificationAttempt, WorkUnitExecution, CommittedFailure, SeatRequest,
SeatGrant, admissionChargeTokens and VerificationLane. VerificationLane's run-4 doubts become the first
flags on an unflagged ratified row; projection stays additive (Ruling 14).

**Ruling 31 — what the accepted terms answer, stated plainly.** CQ-016 is answered for its subject only:
`landedAt` stays seed-only and unproposed because its chain did not survive. CQ-022 returns no row on run-4
vocabulary even with its three terms accepted, since `inAttempt`, `hasExecutionState` and
RunningExecution are parked and `hasCancelClass` is seed-only. VerificationLane's CQ-006 citation is void
under Ruling 20 (the query binds the lane untyped); its warrant stands on CQ-001. Prose in the
admission-charge and seat-grant proposals that names the withdrawn admission-work-kind and checkout
proposals is superseded by Rulings 27 and 18; the bound bytes are not revised.

**Ruling 32 — Queue H's prior refutation stands.** The run-2 analysis `fa-pb-yeet-proof-tier-001` refuted
reading Yeet proof tiers as AssuranceTiers because both use the word tier; run 4 affirms it: the
literal-domains table keeps YeetProofTier apart from AssuranceTierId, every cited `proofTier` is `full`,
and no tier chain survived denotation. No tier proposal exists, so no fourth AssuranceTier member is
ratified: the member stays blocked on the parked AssuranceTierId domain, and KPI law §6 keeps merged
preview a sub-partition of TierLocalFullProof. This goes to the P4 hand-off. Reversal for Rulings 28–32:
a later sitting supersedes with revise or reject ratifications; a scribed ratification is never deleted.

## 2026-10-06 — run-4 closing entry and P4 hand-off (orchestrator under the autonomy charter)

Auditor run 4 (`orun-2026-10-06T15:51:01Z`, pin `71c7357adc`) is closed: the gate passed at the pin before
and after the scribe, the run is rotated (`runs/orun-2026-10-06T15:51:01Z.{manifest,index,README}`,
`prior_index_sha256_12` `2d70f0ffcaf5`, observations at the sibling shelter), and the run report with every
tracked follow-up is `explorations/beep-ci-operational-ontology/research/run4-lanes/p3-run4-report.md`. P3's
exit criterion is met; the P3 status flip rides the lab's CQ-009 lift PR (Ruling 15).

Accepts for the operator's asynchronous review (Ruling 2), each a flagged accept in the orchestrator's own
words: rat-071 OperationalChangeEvent; rat-072 VerificationAttempt (reuse, support arm); rat-073
WorkUnitExecution; rat-074 CommittedFailure; rat-075 SeatRequest (reuse); rat-076 SeatGrant (reuse);
rat-077 admissionChargeTokens (reuse); rat-078 VerificationLane (reuse, its first flags). Withdrawn with
named evidence: CacheEpoch, Checkout, VerificationEvidence (Ruling 18), TreeState, MergedPreviewWork
(Ruling 26), AdmissionWorkKind (Ruling 27).

**Call (aj) — the projection.** Under Ruling 14 the accepts are projected in the run PR through the #1089
footprint: TAXONOMY gains the three new classes (52 to 55 terms) and, on the five reuse rows, run-4 flag
segments that open with their ratification id plus an additive `later_ratifications` list, with every
ratified value unchanged (Ruling 28); DISPOSITIONS turns the CommittedFailure and WorkUnitExecution rows
from parked to accepted and adds four later ratifications; PREDICATES regenerates byte-identically (no new
property); ABOX is unchanged; both contract docs carry a dated note. `validate_packet.py`, `--s5` and `--s6`
are green on the final tree (`--s5` was red at the run commit until the projection, as Ruling 14 expects).
The S5 gate does not yet check the TAXONOMY `later_ratifications` list; that is a tracked follow-up.
Reversal: a revert commit.

P4 hand-off (Ruling 17):

- Tier outcome: Queue H stays open. No tier chain survived denotation, every cited `proofTier` is `full`,
  merged preview is dormant in the capture window, and the run-2 refutation of reading proof tiers as
  AssuranceTiers stands (Ruling 32). KPI law §2 and the W8 text keep the three ratified tiers; §6 keeps
  merged preview a sub-partition of TierLocalFullProof.
- Change-event ratification state: OperationalChangeEvent is ratified (rat-071) and closes all 44
  change-event rows and the KPI law §2 block; `ciops:landedAt` stays seed-only and unproposed, so CQ-016 is
  answered for its subject only and W8 partitions on the seed `landedAt` values as before.
- W1 freshness at the pin: pass 5 re-ran the lever query from `8b7392fe00` to the run base `50b79e470b` (ten
  PRs, two rows kept: `iv-1427-push-first-publish`, `iv-1422-spot-pool-drop-r6a`); the ledger holds 44 rows,
  `f520b302424f`, at the pin.
- Lane-plan terms: the eleven provisional terms entered intake through the lpl batch; none survived
  denotation (no pinned lane-order CQ), so none was analysed or proposed and they stay provisional.
- Tier derivation for change-event rows: rows carry no structured tier member in this phase; deriving one
  for W8 is P4 work (Ruling 10), with #1427 partitioning the local series only and the hosted population
  shift named as a confounder at that instant.

## 2026-10-06 — P3 close: the lab's CQ-009 lift (orchestrator under the autonomy charter)

The last P3 PR, after the run PR (#1490, `077cb283d9`) merged, under launch-sitting Ruling 15. It
lifts the lab's CQ-009 reading, applies the review follow-up from #1490, and flips P3.

**Ruling 33 — CQ-009 in the live replay is a typed verdict; P2 Ruling 9's CQ-009 sentence is
superseded.** P2 Ruling 9 printed CQ-009 as "temporally out of scope: 0 of 689 pinned rows precede #929",
never a pass or a failure. `apps/labs/ciops` now reports a `Cq009Verdict` over the replayed active grant
set (the replay's own fold, window and skip rule). The same-checkout arm is evaluated: on the
`run4-fleet` pin it holds with 0 pairs across 200 grants, every one with a checkout joined from its
chain. The legacy-origin-drain arm is reported as unobservable, never green: the deployed journal writer
has no coordination-protocol field (only scheduler ticket and lease state carry it, with a decoding
default of `legacy-origin-lock/v1`), so no journal row can answer it. Its census: 148 of 200 grants carry a
non-empty origin key, 0 of 689 rows carry a protocol, and 99 concurrently active grant pairs share a
non-empty origin key, reported as a journal fact and not as the arm's answer. The censorship line gives
the retained window, the 3 pre-v3 chains, the 4 ledger-censored verdicts, 44 withdrawn and 1
ticket-evicted request rows, 1 grant active at the first edge and none at the last. Design call: the
pinned query scopes the same-checkout arm to grants that record the current protocol, but the journal
records none, so applying the scope literally would make the lab's arm vacuously green; the lab keeps
pairs with no recorded protocol in scope and exempts only a pair in which a grant records
`legacy-origin-lock/v1` by value, as drain-window state. That errs toward a false violation, never a
false green. Reversal: a later entry and a lab follow-up.

**Ruling 34 — CQ-009's same-checkout arm is scoped to current-protocol grants.** The #1490 review
showed the pinned arm flags legal drain-window state: the pre-#929 release admits a review-fix lease
with an empty origin key beside a full-proof lease in one checkout, and the must-be-zero query returned
2 rows on it. The same-checkout UNION branch now requires `hasCoordinationProtocol
"scheduler-origin-concurrency/v1"` on both grants, and a `rows_eq_0` fixture
(`cq009-drain-window-checkout.ttl`) guards the legacy case; the harness carries 23 fixtures, superseding
call (n)'s count of 22. `regen_cq_artifacts.py` was a no-op before the edit and afterwards changed only
`tests/cq-009.sparql`. The CQ suite digest moves from `e1ed9c0f65f5` to `3eed0c3f73de`; the run-4
archive, its ratifications and its docket keep `e1ed9c0f65f5`, which is the suite run 4 was pinned to.
The next run pins the new digest. Reversal: revert the query and the fixture.

**Ruling 35 — P3 is complete.** Its exit criterion (gate passed and sittings scribed) was met by run 4,
and the CQ-009 lift that PLAN ties to W7 lands here. P3 is marked complete in PLAN, README and the
manifest; P4 (the KPI reading and verdict) starts next, from the P4 hand-off in the run-4 closing entry.
