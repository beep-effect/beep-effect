# time-to-certainty — specification

Successor to the completed-retained `goals/ship-velocity` packet. That packet made failures reach
an active session in seconds, made local green predict hosted green, made every checkout read the
remote cache, and made concurrent proofs safe. It did not make the proof itself cheaper. Its final
episode is the motivating receipt: a 12-file docs-and-script change spent roughly 85 minutes in
local proof, ran the coverage lane three times (pre-push wave, merged-preview parity pass, hosted
checks), and lost two full proof rounds to false-positive gates, on a machine with 74 GiB free and
zero admission queue wait. Route dominated; tension did not.

This packet optimizes exactly one number and refuses to guess at levers before measuring them.

## The metric

**KPI.** The fleet-aggregated distribution (P50/P95) of time-to-certainty per verification
episode: the time from an agent writing code that must be validated to that agent knowing, at a
stated tier, that it passes. Tier-relative (repair loop, local full proof, merged preview, hosted
merge) and epoch-relative (a proof is a fact about a cache epoch and a tree). The formal
definition, its ontology, and the planner that will eventually compute routes from it belong to the
`explorations/beep-ci-operational-ontology` packet (its 2026-08-27 kpi-shape ruling). This packet
does not redefine the KPI; it moves the operational proxies below and hands its evidence to that
packet's next corpus capture.

**Operational proxies** (all computable from `yeet-attempt-journal/v1` rows, whose `verdict`
carries per-lane `durationMs`, `status`, `phase`, `peakRssKb`, and from the ack ledger under
`.beep/inbox/acks/`):

| Id | Proxy | Why it moves the KPI |
| --- | --- | --- |
| M1 | Red-to-green episode duration per branch, P50/P95, and machine-minutes inside episodes | The KPI's dominant term; the ontology article's baseline is median 41 min, P95 3.1 h |
| M2 | Time-to-first-actionable-failure per attempt, P50/P95 | An agent acts on the first red; everything after it is wasted work |
| M3 | Lane executions per change for lanes whose input digest did not change between tiers | The ×3 multiplier (pre-push, merged preview, hosted) |
| M4 | False-red round trips per gate class: attempts that failed with an unchanged tree fingerprint and then passed, joined with ack resolution kinds | One false positive costs more wall time than any contention ever measured |
| M5 | Unjournaled terminations: submitter or lease deaths with no event in any journal | A severed cord never reaches certainty; the ontology's replay found the first instance |

**Laws inherited from ship-velocity.** The C5 first-cold-lane rule for any cache-hit accounting
(never a whole-proof denominator); the correctness tripwire that tasks of a package whose source the
change touches must never reuse a proof; the parity ledger as the record of every local-versus-hosted
divergence; friction receipts written at the moment they happen in `research/OPPORTUNITIES.md`.

## Workstreams

### A — Measure

- **A1 Economics report.** A reproducible script over the fleet's attempt journals (the ontology
  packet's frozen fleet corpus plus live journals in every checkout root) producing per-lane
  duration and share, runs-per-attempt across tiers, first-failing-lane offsets, red-to-green
  episodes, false-red proxies, and a data-quality section (the attempt journal is a ring buffer of
  50 rows per branch). Output: `research/economics.md` and `research/economics.json` with input
  digests. Lands in P0 and is re-run at close.
- **A2 Baseline freeze.** M1 through M5 recorded once from A1 as the packet baseline, with the
  sample window and caveats. No calendar proxies; the operator ratifies the sample, as in
  ship-velocity's 2026-08-30 ruling.
- **A3 Economics as a Yeet surface.** The A1 computation becomes a yeet subcommand reading the
  same journals, so every closeout can print where the minutes went. Schema first: the report is an
  `S.Class` document with a schema version.
- **A4 Precision vein repair.** The ack command's contract is `--wontfix --reason "<text>"`, but
  the P0 reminder printed at tool boundaries advertised a value-bearing shorthand that the parser
  rejects, so on 2026-09-02 an environment-only failure was acknowledged with a fix SHA instead.
  The ack ledger is the cheapest source of per-gate precision: the reminder and the command must
  agree (or the shorthand becomes an alias), and the ledger must distinguish `fix-sha`,
  `wontfix`, and `environment-only` resolutions so M4 is computable.

- **A5 Journal facts.** The economics report could not compute M3, M4, or M5 from the journals:
  attempt rows record `head=HEAD` and no tree fingerprint, run state is overwritten after the
  latest green, the pre-push and merged-preview wrappers journal one aggregate row each, and 327
  of 3,069 started attempts (10.7%) never recorded a finish. Every attempt row carries the tree
  fingerprint and tier; wrappers journal each inner lane (id, tier, start, end, duration, input
  digest when known); unfinished starts and lease or submitter deaths become terminal rows. This
  precedes both the hygiene measurements and the C4 shadow report.

### B — Hygiene: kill the known false-red and cord-severing classes

Each item is one small PR with its own receipt. All six were paid for on 2026-09-02.

- **B1 Package verification through the graph.** `bun run beep quality package-verify` ran the
  package's audit script directly, so stale upstream `dist` after merging main raised a P0 for a
  test-only change. Run the audit through Turbo with upstream builds, or attribute the P0 as
  environment-only automatically when no package source differs from base.
- **B2 Semantic-delta stops reading branch names as paths.** A backticked branch name in packet
  prose was classified as a broken tracked path and cost an 18-minute proof round. Git-ref-shaped
  spans are exempt, or the rule is documented and linted before the proof starts.
- **B3 Cheap, precise gates first.** The pre-push wave learned about a policy failure at minute
  18, after build, type check, and coverage had already run. Second-precision policy gates run
  before any heavy lane and fail the wave immediately; ordering is by (cost, precision) from A1.
- **B4 Cache plan resolves only its quad.** One live root could not read the remote cache because
  an unrelated stale reference elsewhere in its env file failed the whole-file wrapper closed. The
  remote-read plan hands the secret resolver only the four references it consumes; the whole-file
  wrapper remains a separate environment-health check that names the failing variable.
- **B5 Detached, durable proof jobs.** Three agent-launched processes died on 2026-09-02 with no
  record anywhere; the survivor ran in its own systemd user scope. A proof submitted by an agent
  runs in its own scope with a durable id, reports through the inbox, and outlives the submitter.
- **B6 Journal every death.** Lease death and submitter death become events in the admission
  journal (the ontology packet's replay needs them; today it infers evictions from arithmetic).

### C — Proof reuse (the multiplier)

Schema first, then the service contract, then a shadow ledger, then enforcement.

- **C1 ProofFact schema.** A proof is a fact about a lane's inputs at an epoch, not about a
  branch. Sketch, to be validated against the Effect v4 reference checkout before implementation.

  **Example** (ProofFact schema sketch)

  ```ts
  export const ProofTier = LiteralKit(["repair-loop", "pre-push", "merged-preview", "hosted"]);
  export const ProofOutcome = LiteralKit(["passed", "failed"]);

  export class ProofInputDigest extends S.Class<ProofInputDigest>($I`ProofInputDigest`)({
    laneId: S.String,           // stable lane identity from the shared CiLane builder
    laneKind: LaneKind,         // turbo-task | script | collected-gate
    inputDigest: S.String,      // turbo task hash for turbo lanes; declared-input digest otherwise
    epochDigest: S.String,      // lockfile, toolchain pins, root turbo config, global env profile
    envProfile: S.String,       // local | pr-posture | hosted, as a literal domain
  }) {}

  export class ProofFact extends S.Class<ProofFact>($I`ProofFact`)({
    schemaVersion: S.Literal("proof-fact/v1"),
    key: ProofInputDigest,
    tier: ProofTier,
    outcome: ProofOutcome,
    provenance: ProofProvenance, // run id, checkout origin key, hosted run id when known
    recordedAt: S.String,
    expiresAt: S.String,         // bounded by the cache epoch's lifetime
  }) {}
  ```

  The existing shadow records in `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts`
  (`YeetLaneProofState`, keyed by command hash and whole-tree diff fingerprint) are the migration
  source; the new key replaces the whole-tree fingerprint with per-lane inputs so an unchanged lane
  can be reused after a docs edit or a merge that did not touch its inputs.
- **C2 ProofLedger service.** A `Context.Service` with record, lookup, and expire, backed by a
  per-checkout append-only NDJSON ledger under the checkout's Yeet state directory. No new
  coordination primitive: one writer, keyed rows, like the inbox. A machine-wide ledger keyed by
  repository origin is a P3 candidate, not part of this item (decisions.md ruling 3).
- **C3 Lane input digests, one hashing engine.** The reuse key is a tier-independent action
  digest: lane command, sorted env profile, lane input digests, and the epoch salt (lockfile,
  Bun and Node pins, root Turbo and TypeScript config, policy-pack version). Turbo lanes use
  Turbo's task hash. Script lanes (coverage shards, tsgo tests, policy, labs) become Turbo tasks
  with explicit inputs, `cache: false` where outputs must not be cached, so Turbo computes their
  hash too; migration order follows the economics report's minutes-per-lane ranking. A lane
  without a declared input set is not reusable and says so in the report (rulings 1, 4, 5).
- **C4 Shadow, then enforce.** Shadow mode records what would have been reused and compares it
  with what actually ran. The first enforced pair is attempt-to-attempt within pre-push (a review
  fix reruns only the lanes whose inputs changed), gated on at least 200 attempts across at least
  10 branches with zero disagreements and every must-fail fixture green (rulings 2, 7). The second
  pair, pre-push to merged preview, follows once env profiles are proven in the key. Hosted reuse
  is a separate decision recorded before any change, gated on the parity ledger.
- **C5 Must-fail fixtures.** Changed-package tasks never reuse; a lockfile or toolchain change
  invalidates the epoch; a proof from a different env profile never satisfies another tier. Each is
  a fixture that must fail before enforcement ships.

### D — Ordering (planner seam handoff)

- **D1 Wave ordering by (cost, red probability, precision).** With A1's numbers, order the
  pre-push wave so the cheapest lane most likely to prove the change wrong runs first. This is the
  first body for the planner seam the ontology packet declared in its S7 projection contract; it
  ships here only as the ordering of existing lanes and hands its inputs to that packet's S8/S9
  stages. The lane-DAG planner itself is not in scope.

## Explicitly rejected

- Reopening ship-velocity as a new phase: it is completed-retained with a closeout reflection;
  packet-state law forbids it.
- A merge queue before the recorded flip condition (ship-velocity E8): unchanged.
- Hosted-tier reuse of local proofs without parity-ledger evidence: a local proof is a prediction of
  hosted, and the prediction's precision has to be on record first.
- Blanket cache-key tuning: C5 of ship-velocity still holds; measure hit rates by the first-cold-lane
  rule before touching keys.
- A second scheduler or lock: admission exists and was proven under load; this packet changes what
  runs, not who may run.

## Completion gate

Not achieved until, on a sample the operator ratifies:

1. A1 has run twice (baseline and close) and both reports are in `research/`;
2. M3 for lanes with unchanged input digests is at most 1.2 executions per change across pre-push
   and merged preview (from about 2 today), with zero shadow disagreements in the enforcement gate;
3. M4 is zero for the three named false-red classes (B1, B2, B4) over the sample;
4. M5 is zero over the sample for submitter and lease deaths;
5. M1 median is lower than the P0 baseline, with the number stated in the closeout;
6. the final PR is driven to Yeet merge-ready through the operator's own gates, and the status flip
   and closeout reflection ride that PR.
