# Semantica Reasoning Spike Spec

## Objective

Run the dated NET-NEW reasoning spike (A6) as one S1 candidate in four phases:
build the `G-entailment/rules` fixture first, then run the three `/adhd`
first-step probes as kill criteria, each ablated against the restricted EYE
oracle on that fixture.

- **P1 — the rules fixture.** A schema-first `g-entailment-rules/v1` tagged
  family (case, expectation, witness) and twenty cases in five classes (R-a
  join, R-b recursion, R-c retraction, R-d budget, R-e contradiction), four
  each, generated under the same EYE pins as `g-entailment-rdfs/v1`, with EYE
  gold separated from lab-owned expectation per class; no negation class, the
  gap typed in the fixture.
- **P2 — P-R1 proof-ledger kernel.** `CanonicalProofNodeV1` + deterministic
  encoder + hash, stable across premise-order permutations and cold replays.
- **P3 — P-R2 budget-certified rules.** `RuleCertificate` + pure
  `compileRuleCertificate`; the R-d cases produce the proof-linked
  `InferenceTruncated` fact. The v3 `rete` salvage enters here.
- **P4 — P-R3 evidence-graph workspace.** `EvidenceBatch` → kernel →
  `InferenceEvent` end to end on R-c and R-e with retraction; rete-port vs
  naive fixpoint vs EYE ablated on the fixture.

Scope is defined by reference, not restated:

- **Phases, classes, probes and kills** —
  [`MAP.md` §R](../../explorations/semantica-lab/MAP.md#r-semantica-reasoning-spike--the-fixture-is-the-spikes-first-slice-not-its-gate)
  (v1.1, ratified 2026-09-03 with amendments applied inline).
- **The ratified sub-decisions** —
  [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) "2026-09-03
  (ratification grill)": R0.a, R1.g, R2.a–R2.g; the Current law table wins
  over any log entry.
- **The opportunity space the probes come from** —
  [`research/adhd-reasoning.md`](../../explorations/semantica-lab/research/adhd-reasoning.md)
  §Focus 1–3 (D15).
- **The v3 salvage verdict** —
  [`research/grounding-v3-logos.md` §5](../../explorations/semantica-lab/research/grounding-v3-logos.md#5-verdict-for-the-new-lab).
- **What C2 already proved** — the ρdf runtime, content-addressed
  `InferenceEvent` proof DAGs and the EYE oracle wiring
  ([`goals/semantica-canary/SPEC.md`](../semantica-canary/SPEC.md), C2 pass).

Provenance: graduated 2026-09-03 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.1 re-entry packet R). The v1.0 precondition "`G-entailment/rules`
fixture committed" had no owner; it became this packet's P1 (R2.a).

## Non-Goals

Every item of
[`BRIEF.md` §No-Gos](../../explorations/semantica-lab/BRIEF.md#no-gos) holds
as listed in
[`goals/semantica-canary/SPEC.md` §Non-Goals](../semantica-canary/SPEC.md#non-goals).
This spike adds:

- No change to `g-entailment-rdfs/v1`, its seven C2 cases, or
  `GEntailmentExpectation`; the rules fixture is a sibling family (R2.b).
- No negation class in `gold/v1` until restricted EYE is shown to accept
  scoped negation; the gap is typed, never silent (R2.d).
- No fixture-local retraction law: R-c inherits the ledger's `Invalidated`
  semantics ratified by the sibling storage spike (R2.e, R1.g).
- No M1 runtime replacement: the C2 ρdf closure stays the lab runtime; the
  spike's kernel, certificates and workspace are probe surfaces until the
  ablation verdict.
- No `@beep/*` reasoning package: the O4 OSS gate `reasoning-package` opens
  only after this spike survives ablation.
- No vendored v3 code before the archive is located and its Apache-2.0
  license re-verified; until then `rete`, `rules` and `logos` are
  reference-only patterns (R2.g).
- No Notion write; the reasoning verdict lands in the exploration's
  `DECISIONS.md`.

## Source Hierarchy

1. User decisions recorded in the source exploration:
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) Current law
   table, then the 2026-09-03 ratification grill (R0.a, R1.g, R2.a–R2.g).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development, yeet, reflect).
3. `standards/ARCHITECTURE.md` with
   [`standards/architecture/15-lab-apps.md`](../../standards/architecture/15-lab-apps.md).
4. The exploration contracts in force:
   [`BRIEF.md`](../../explorations/semantica-lab/BRIEF.md) v1.1,
   [`MAP.md`](../../explorations/semantica-lab/MAP.md) v1.1 §R,
   [`research/adhd-reasoning.md`](../../explorations/semantica-lab/research/adhd-reasoning.md),
   [`research/grounding-v3-logos.md`](../../explorations/semantica-lab/research/grounding-v3-logos.md).
5. [`goals/semantica-storage-inversion/SPEC.md`](../semantica-storage-inversion/SPEC.md)
   for the tombstone law R-c and P4 inherit, and
   [`goals/semantica-canary/SPEC.md`](../semantica-canary/SPEC.md) for the
   lab's standing constraints.
6. This `SPEC.md`.
7. `PLAN.md`.
8. `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. Where this SPEC and
the exploration's Current law table disagree, the table wins until a dated
DECISIONS entry amends it.

## Target Surfaces

- `apps/labs/semantica`: `src/schema/Reasoning.ts` (the
  `g-entailment-rules/v1` family; `RdfsRuleId` widened to a branded rule id;
  `InferenceEngine` widened to a domain; `InferenceTruncated`; the
  statement-level conflict witness; `CanonicalProofNodeV1`; `RuleCertificate`),
  `apps/labs/semantica/scripts/generate-g-entailment.ts` extended for the rules family,
  `fixtures/gold/v1/g-entailment-rules.{json,n3}`, `src/layers/ReasonerLive.ts`
  and the probe Layers, `test/helpers/EyeOracleChild.ts` reused unchanged, and
  the ported v3 behavioural tests as the match-semantics oracle (P3+).
- `goals/semantica-reasoning-spike/`: fixture provenance, probe evidence
  under `history/`, the closeout reflection.
- [`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md):
  the dated reasoning-spike verdict (or park).
- [`explorations/semantica-lab/research/SOURCES.md`](../../explorations/semantica-lab/research/SOURCES.md):
  the `beep-effect-logos` row flips from reference-only when the archive is
  located.
- No other package changes; `src-tauri` stays frozen (S4).

## Constraints

Each line cites the sub-decision or law it inherits.

1. **The fixture is P1, not a gate.** Twenty cases in five classes, four
   each, generated under the same EYE pins (EYE 11.24.5 via `eyereasoner`
   21.1.18, `--restricted`, 64 KiB input / 1 MiB output caps), each with a
   per-case proof digest (R2.a, R2.c).
2. **Sibling family, frozen elders.** `g-entailment-rules/v1` is a NET-NEW
   tagged family (case, expectation, witness); `g-entailment-rdfs/v1` is
   untouched; `RdfsRuleId` widens to a branded rule id and `InferenceEngine`
   to a domain (R2.b).
3. **Oracle split per class.** EYE establishes only what it can
   independently establish: closure + proof digest (R-a, R-b); two closures,
   with and without the retracted premise (R-c); the complete closure of the
   finite instance (R-d); derivability of both statements (R-e). Lab-owned
   expectations carry the rest: exact-diff shrinkage (R-c), the
   `InferenceTruncated` fact at the declared boundary with the last complete
   proof node and a deterministic budget-prefix witness (R-d), the
   statement-level conflict witness and two surviving nodes, never a merge
   (R-e) (R2.c).
4. **No negation in `gold/v1`;** a typed gap recorded in the fixture (R2.d).
5. **One tombstone law.** R-c reuses claim-targeted `Invalidated` with reach
   derived through `claimQuads` and recorded premises; R-c and P2–P4 start
   only after the storage spike's P-S1 has landed; R-a, R-b, R-d, R-e build in
   parallel with it (R2.e, R1.g).
6. **Kill criteria are the probes' first steps unchanged**
   ([`research/adhd-reasoning.md`](../../explorations/semantica-lab/research/adhd-reasoning.md)):
   canonicalization drift (P2); certificate unsoundness, unsound admission or
   bounds that reject real rules (P3); unstable identity or invalidation
   across re-extraction and replay (P4) (R2.f).
7. **The archive gates P3.** The archived `beep-effect-logos` root is located
   and its LICENSE re-verified as Apache-2.0 before P3 (P-R2); the 46
   behavioural `rete` tests are ported first as the oracle for match
   semantics; P4 ablates rete-port vs naive fixpoint vs EYE (R2.g).
8. **One candidate.** P1–P4 are one stage of the reasoning family's opening
   candidate; a failed probe buys exactly one redesigned candidate for that
   probe; a second failure parks the family (R2.f, R0.a, E8).
9. **C2 laws stand:** closure equality plus per-`InferenceEvent` rule
   validation, never proof isomorphism or premise-set identity (S5, S8); EYE
   is an oracle, not the runtime.
10. **Inherited canary constraints** hold by reference
    ([`goals/semantica-canary/SPEC.md` §Constraints](../semantica-canary/SPEC.md#constraints)):
    5 (provider cache determinism, for any hosted call the ablation makes), 11
    (C2's gate shape), 14 (no id truncation, no DDL dimension).
11. **Telemetry law.** Tier-L/Tier-D performance measurements and wall-clock
    values live in the `EvalRunTelemetry` sidecar and never enter a digest (R1
    of PR #802). Each R-d case's declared depth or fan-out budget and its
    proof-linked `InferenceTruncated` fact and witness stay in the replay-stable
    fixture and run contract.
12. **Cross-cutting laws every contract obeys:** branded ids; typed degraded
    states instead of success-shaped fallbacks; `HashSet`/`HashMap`, never
    native; decode at boundaries; `Effect.fn`/`Effect.fnUntraced` for
    generators; Effect v4 APIs verified against the reference checkout before
    writing.

## Decision Log

Binding decisions live in
[`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md).
The rows below are the ones this spike executes against, one line each.

| Id | Holds for this spike |
| --- | --- |
| Stop rule (S1, R0.a) | First-probe candidate; a stage failure buys exactly one redesigned candidate; a second failure parks the family and drops the exploration to `decompose`. |
| A6 | The reasoning substrate is a dated post-C2 spike, never the M1 runtime. |
| D15 | The `/adhd` divergence target: proof-ledger kernel, budget-certified rules, evidence-graph workspace. |
| S5, S8 | Closure equality + per-event rule validation; EYE is oracle and gold source, not a shape to match; retraction consults recorded local premises only. |
| Reasoning (C2, 2026-08-31) | ρdf closure, naive fixpoint, content-addressed proof DAGs, restricted EYE oracle: the pick-one runtime this spike must not replace before ablation. |
| E8 | One re-entry candidate per family per stage; a second park is terminal absent an operator ratification. |
| R1.g | P-S1 lands before R-c and P2–P4. |
| R2.a | The rules fixture is this packet's P1. |
| R2.b | NET-NEW `g-entailment-rules/v1`; `RdfsRuleId` and `InferenceEngine` widened; rdfs/v1 frozen. |
| R2.c | Twenty cases, five classes, four each; EYE gold separated from lab-owned expectation per class. |
| R2.d | No negation class in `gold/v1`; a typed gap. |
| R2.e | R-c inherits the R1 tombstone law. |
| R2.f | P-R1..3 are P2–P4 with kills unchanged; P1–P4 are one S1 candidate. |
| R2.g | The archive gates P3 (P-R2); P4 inherits the gate. |
| O4 | `reasoning-package` waits on the spike surviving ablation. |
| T2 | Never wait on overlapping upstream PRs; upstream landings are atlas telemetry. |

## Acceptance Criteria

Class definitions and probe gates are quoted from
[`MAP.md` §R](../../explorations/semantica-lab/MAP.md#r-semantica-reasoning-spike--the-fixture-is-the-spikes-first-slice-not-its-gate).

- [ ] **P1 schema** — the `g-entailment-rules/v1` family (case, expectation,
      witness) lands before any case is written; `RdfsRuleId` and
      `InferenceEngine` are widened without touching rdfs/v1.
- [ ] **P1 fixture** — `fixtures/gold/v1/g-entailment-rules.{json,n3}` holds
      twenty cases in five classes with per-case `eyeProofDigest`s, generated
      by the extended `apps/labs/semantica/scripts/generate-g-entailment.ts` under the pinned EYE;
      R-c carries two closures; R-d carries EYE's complete closure plus the
      declared budget; R-e carries both derivable statements; the negation gap
      is typed in the fixture.
- [ ] **P2 P-R1** — `CanonicalProofNodeV1`, encoder and hash are stable
      across premise-order permutations and cold replays on every fixture
      case; the C2 report digests are unchanged.
- [ ] **P3 P-R2** — `RuleCertificate` + pure `compileRuleCertificate`; the
      R-d cases produce the proof-linked `InferenceTruncated` fact at the
      declared boundary; unbudgeted runs equal EYE; the 46 `rete` tests are
      ported and green as the match-semantics oracle.
- [ ] **P4 P-R3** — `EvidenceBatch` → kernel → `InferenceEvent` end to end on
      R-c and R-e with retraction; identity and invalidation stable across
      re-extraction and replay; rete-port vs naive fixpoint vs EYE ablated on
      the fixture with a recorded verdict.
- [ ] The reasoning-spike verdict (or park) is a dated entry in the
      exploration's `DECISIONS.md`; the Current law "Reasoning" row and the O4
      `reasoning-package` gate status are amended in the same PR.
- [ ] Each phase ships as a PR driven to mergeable; P5 records a valid
      closeout reflection; base packet checks and `bun run beep yeet verify`
      are green.
- [ ] No unrelated refactors or formatting churn.

## Verification Surface

Proof is a lab test or a CLI run, never a screenshot (A5, S4).

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/semantica-reasoning-spike/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/semantica-reasoning-spike/ops/manifest.json` | Passes |
| Packet references | `rg -n "semantica-reasoning-spike\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/semantica-reasoning-spike` | Required surfaces present |
| Whitespace | `git diff --check -- goals/semantica-reasoning-spike explorations/semantica-lab` | Passes |
| Portfolio index | `bun run beep goals index --check` | Generated index current |
| Goal contracts | `bun run beep goals doctor` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at closeout |
| Repo quality | `bun run beep yeet verify` | Green |
| Lab tests | the lab's `test` script (vitest) in the Labs lane | Green per phase |
| Fixture generation | the extended `apps/labs/semantica/scripts/generate-g-entailment.ts` run twice | Byte-identical output; twenty cases; pins recorded |
| Probe gates | one lab test per probe asserting the gate above; reports and sidecars archived under `history/` | Gate holds on every fixture case |
| Archive precondition | the `beep-effect-logos` root path and its LICENSE digest recorded under `history/` before P3 | Present; Apache-2.0 |
| Hosted completion | `bun run beep yeet monitor` after each phase's publication | `merge-ready: yes`; zero unresolved threads |

## Stop Conditions

- **The probe breaker (S1 as amended by R0.a), never a calendar.** P1–P4 are
  one stage of the reasoning family's opening candidate; a failed probe buys
  exactly one more candidate for that probe, redesigned when the failure was a
  design fault; a second failure parks the family, records the park in the
  exploration's `DECISIONS.md`, and drops the exploration to `decompose`.
- P2–P4 and the R-c class cannot start until the storage spike's P-S1 has
  landed (R1.g).
- P3 cannot start until the archived `beep-effect-logos` root is located and
  its license re-verified; the salvage stays reference-only until then (R2.g).
- A probe's kill fires: canonicalization drift (P2); certificate
  unsoundness (P3); unstable identity or invalidation across re-extraction
  and replay (P4).
- Any change to `g-entailment-rdfs/v1` or the EYE pins without regenerating
  every gold; a negation case before restricted EYE is shown to accept it; a
  fixture-local retraction law; an expectation that asks EYE for what it
  cannot independently establish.
- A change would cross a No-Go (the spike as the M1 runtime, a reusable
  reasoning export, the OSS gate opened early).
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
