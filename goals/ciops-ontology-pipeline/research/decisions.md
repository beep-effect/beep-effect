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
