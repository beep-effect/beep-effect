# ADHD Amendment Report — 2026-07-31

Divergent-ideation pass over the audit-produced plan for this packet, run
before packet creation. Method: `/adhd` skill — five isolated parallel
branches under distinct cognitive frames (no branch saw another's output),
followed by a single-critic scoring/clustering pass and three deepened
survivors, then a two-round user interview that dispositioned every
candidate. Frames: **regulator**, **3am on-call**, **speedrunner**,
**inversion**, **remove-the-load-bearing-assumption**. 30 ideas total.

Score chips: `[N V F]` = novelty / viability / fit, 0–10; ranking weight
0.35·N + 0.40·V + 0.25·F.

## 1. Idea inventory by cluster

### Make the instrument unable to lie

- Refuse-don't-guess attribution: unmatched identity → quarantine ledger,
  never a default clone/config identity. `[6 9 9]` → **adopted (law 1)**
- Coverage attestation per ingest run: emit the denominator (enumerated /
  read / unreachable) so absence of data is a provable claim. `[7 9 9]` →
  **adopted (P2)**
- Weakest-link evidenceTier propagation, lint-enforced. `[7 8 9]` →
  **adopted (law 2)**
- Privacy by unrepresentability: schemas physically cannot hold
  prompt/command/tool-arg content. `[6 9 9]` → **adopted (law 3)**
- Tombstone terminals for unclosed sessions (kills survivorship bias).
  `[7 9 9]` → **adopted (P2)**
- Instrument-class tagging: meta-work excluded from baselines. `[7 9 9]` →
  **adopted (law 4)**
- OIP confidentiality taint chain-of-custody with periodic adversarial
  reconstruction audit. `[7 8 8]` → **adopted (law 5)**

### Crash-only pipeline ops

- Crash-only doctrine: raw WAL is truth, derived tables disposable,
  scheduled delete-and-replay drill. `[6 8 9]` → **adopted (P4)**
- Per-clone spools + one flock-holding mover. `[6 8 8]` → deferred to P4
  implementation detail (adopt if write contention appears).
- Sentinel-file kill switch, disarm <1 s, self-labeling gap. `[6 9 7]` →
  **adopted (P1)**
- Skip shadow-write: replay twice on different days and diff. `[7 8 8]` →
  **adopted (P4, replaces shadow-write)**

### Content-address the cutscene (Yeet)

- Void-verdict/mistrial doctrine: FAILED must cite an exhibit or is
  schema-invalid; exhibit-less failure = mistrial, blind rerun forbidden.
  `[8 8 9]` → **adopted (P3)**
- Content-addressed proofs (tree-hash + toolchain-hash), per-lane
  transactional writes, resume as cache hit; `yeet doctor`. `[7 8 10]` →
  **adopted (P3)** (surfaced independently by two frames)
- Hotfix v1 identity in place with a content-address key. `[5 8 8]` →
  **rejected (trap):** contradicts the locked "new derived schema +
  deterministic replay, never patch rows" decision; effort leaks into a
  store slated for replacement.

### Shared failure knowledge

- Cross-session circuit-breaker ledger (op/gh/network probes; one failure
  trips machine-wide; retries become labeled skips). `[6 9 9]` →
  **adopted (P1)** (surfaced independently by two frames)

### Sequence-break the wins

- Ship the notification canary against plan-approval waits now, measured
  with raw hook timestamps; telemetry rebuild off the critical path.
  `[7 9 9]` → **adopted (new P1 phase)**
- Retro-mine the eval corpus from existing history. `[8 6 7]` →
  **partially rejected:** confounded natural experiments; kept as
  candidate-generation only, never primary evidence (P5).

### Experiment hygiene

- Config-fingerprint-verified treatment assignment. `[6 8 9]` →
  **adopted (P5/P7)**
- Memory-ablated eval profile (Cognee + shared auto-memory as explicit
  variable). `[8 7 8]` → **adopted (P5)**
- Goodhart counter-metric: silent-decision audit; a canary that wins by
  skipping human gates reads as a regression. `[8 8 9]` →
  **adopted (P8 gate, plus non-increasing mistrial rate)**

### Continuous calibration

- Tracer sessions with known ground truth; admissibility windows.
  `[8 7 8]` → deferred with trigger: adopt in P4 as fixture-tracers per
  ingest if trust-gate regressions recur; full admissibility-window
  machinery only if evidence demands it.
- Hourly synthetic probe tasks (auth health, skill activation, wait
  latency). `[7 8 8]` → deferred to P7 as a candidate treatment (the
  circuit-breaker ledger covers the acute auth-storm case first).

### Change who records truth

- First-person witness flight records; archaeology demotes to crash
  recovery. `[8 8 9]` → **adopted (P2 write contract)**
- Objective actors: a session is a lease on a long-lived objective.
  `[9 5 8]` → deferred (north-star framing; the objective→session
  hierarchy already encodes the data model half).
- Speculative execution at approval gates (approval selects a precomputed
  future). `[9 5 8]` → **parked** as a P7 treatment candidate; token/safety
  surface too large for an amendment.
- Canary dead-man lease + bounded flight recorder. `[7 8 7]` → folded into
  P8 canary mechanics (TTL lease, no credentials, auto-teardown).

### Far-out restructures

- Ephemeral objective-scoped checkouts replacing standing clones.
  `[8 4 7]` → **rejected (trap):** fights the real multi-clone workflow;
  the identity registry already buys the attribution benefit.
- Goal packets as materialized views over the evidence store. `[8 5 6]` →
  **rejected (trap):** dissolves a working, lint-enforced ceremony to save
  its cheapest step.

## 2. Deepened branches (survivor sketches)

### A. Sequence-break canary (→ P1)

Wire Notification/UserPromptSubmit/Stop hooks to one `hook-pulse` script
appending schema-versioned NDJSON (`HookPulseV1`: sessionId, clone cwd,
agent kind, hookEvent, notifierRev, ts) under the XDG root; optional ntfy
push (`BEEP_NOTIFY=1`) for plan-approval and permission blocks. A ~100-line
decoder pairs Notification/Stop timestamps with the next UserPromptSubmit;
a 105 min → sub-10 min p95 shift is detectable with ~30 observed waits.
Instrument-before-treat: one week log-only baseline, then flip
notifications — an interrupted time-series is legitimate at a 10–20x
expected effect. `notifierRev` lets later paired trials stratify; the
notifier joins the P8 frozen environment manifest.

- **Load-bearing risk:** plan-approval hook-firing semantics are
  empirically unverified on this harness; if ExitPlanMode emits no
  distinguishable Notification event, the biggest number is measured by the
  weakest instrument.
- **First step:** scratch-clone hook spike; trigger a plan approval, a
  permission prompt, and a 60 s idle; confirm distinguishable
  sessionId-bearing events before writing any schema.
- Children: remote Approve/Deny actuation via ntfy action buttons bridged
  to `ccd_session send_message` (adopted as stretch); escalation ladder
  with storm damping; hook ledger as the independent witness for P4 trust
  gates; hook events as the P6 spike fixture corpus; live blocked-agents
  dashboard.

### B. Witness flight records + attestation (→ P2)

`FlightRecord` + `IngestManifest` as the telemetry-v2 write contract.
Hook computes mechanical fields from transcript JSONL (never the agent);
agent supplies semantic fields only; invalid records are recorded events.
Codex parity via `codex exec` wrapper. Ingest enumerates its denominator
before reading anything; enumerated-but-recordless sessions get scanned
and tombstoned (`evidenceTier: reconstructed`).

- **Load-bearing risk:** SessionEnd doesn't fire on SIGKILL/crash/context
  exhaustion, and semantic self-report can be wrong — without the
  mechanical/semantic split plus tombstone reconciliation, v2 becomes a
  biased sample of clean exits decorated with narrative, worse than
  archaeology because it looks authoritative.
- **First step:** author the schemas + LiteralKit domains with one
  hand-written fixture from a real session and one real IngestManifest,
  round-trip tested, before any hook wiring.
- Children: self-report-divergence metric; heartbeat leases (SessionStart
  lease + PostToolUse renewal, crash detection in O(open leases));
  attestation as a publish gate (≥95% denominator accounting); config
  fingerprints enabling fingerprint-native paired trials; per-brand emitter
  federation with unemittable brands as a quantified burn-down list.

### C. Yeet mistrial doctrine (→ P3)

`YeetVerdict` → tagged union; `failure` requires
`S.NonEmptyArray(YeetExhibit)` (laneCommand, checkId, outputSha256,
content-addressed outputPath under `.beep/yeet/runs/<slug>/exhibits/`);
`mistrial` carries an instrument-defect reason from a shared LiteralKit;
repair/verify refuse to blind-rerun a mistrial. `ProofState.ts` already
keys per-lane proofs by command + tree fingerprint — extend the key with a
toolchain hash, write lane proofs transactionally at lane completion, and
consult surviving proofs on resume. `yeet doctor` answers "what is Yeet
waiting on" from transition checkpoints carrying the P2 `waitReason`
vocabulary.

- **Load-bearing risk:** classification under crash — erring toward
  mistrial suppresses real failures (worst case: a stale-but-matching
  proof lets an unproven tree publish as a cache hit); erring toward
  failure recreates the rerun treadmill. Checkpoints must be strictly more
  trustworthy than the verdicts they explain (repo memory already records
  verdict.json step attribution as untrustworthy).
- **First step:** `YeetExhibit` S.Class + outcome LiteralKit
  `success|failure|mistrial` + tagged-union restructure + decode test
  proving exhibit-less failure fails to decode.
- Children: exhibits as P5 eval ground truth; shared instrument-defect
  vocabulary (1Password 56/58 becomes a detectable `auth-instrument`
  class); `yeet doctor --until-transition` blocking watch; cross-clone
  proof sharing via the P0 store; mistrial rate as a P8 guardrail.

## 3. Interview outcomes (2026-07-31, all user-decided)

1. P1 sequence-break phase: **adopt, including phone actuation stretch**.
2. P2 truth model: **adopt full flight-record + attestation amendment**.
3. P3 Yeet: **adopt full mistrial doctrine + proof durability + doctor**.
4. P4: **replace shadow-write with replay-twice-diff + crash-only + drill**.
5. Evidence-integrity laws: **adopt all five** (incl. OIP taint).
6. Experiment hygiene: **adopt all three** (fingerprint verification,
   memory ablation, Goodhart guardrails).
7. Shared operational state: **both circuit breaker and kill switch, in P1**.
8. Execution start: **docs-only packet PR first** (this PR), then the P1
   instrument-verification spike.

## 4. Provocations recorded, not scheduled

- Remote plan approval as ambient action (partially adopted as the P1
  stretch item).
- Objective-actor runtime (sessions as leases) as the ten-year direction.
