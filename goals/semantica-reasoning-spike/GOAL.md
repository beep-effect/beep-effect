# GOAL: run the Semantica reasoning spike, fixture first

Repo root: the current working directory. All paths are repo-relative.

Outcome: the `G-entailment/rules` fixture exists as `g-entailment-rules/v1`
(twenty cases, five classes, pinned EYE gold separated from lab-owned
expectation), and the three `/adhd` probes — proof-ledger kernel,
budget-certified rules, evidence-graph workspace — have run as kill criteria
ablated against EYE on it, as one S1 candidate; the verdict lands in the
exploration's `DECISIONS.md`.

Read these as the contract:

- `goals/semantica-reasoning-spike/{README,SPEC,PLAN}.md`
- `goals/semantica-reasoning-spike/ops/manifest.json`
- `goals/semantica-reasoning-spike/research/SOURCES.md`
- `explorations/semantica-lab/MAP.md` §R (v1.1) and `DECISIONS.md` (Current
  law table, then the 2026-09-03 ratification grill R0.a, R1.g, R2.a–R2.g;
  the table wins over prose)
- `explorations/semantica-lab/research/adhd-reasoning.md` §Focus 1–3
- `goals/semantica-storage-inversion/SPEC.md` (the tombstone law R-c inherits)

Then `AGENTS.md`, `CLAUDE.md`, `standards/architecture/15-lab-apps.md`, and
the skills `SPEC.md` names.

Scope:

- In: `apps/labs/semantica` (the rules family in `src/schema/Reasoning.ts`,
  the extended `apps/labs/semantica/scripts/generate-g-entailment.ts`, `fixtures/gold/v1/`
  rules gold, probe schemas and Layers, ported `rete` tests); this packet's
  evidence; the reasoning verdict in the exploration's `DECISIONS.md`.
- Out: every `SPEC.md` non-goal — rdfs/v1 and its seven cases, a negation
  class, a fixture-local retraction law, replacing the C2 runtime, a
  reasoning `@beep/*` package, vendoring v3 code before the archive is
  located, Notion writes, `src-tauri`.

Execution:

1. P1: schema first (`g-entailment-rules/v1` case/expectation/witness;
   branded rule id; `InferenceEngine` domain; `InferenceTruncated`;
   statement-level conflict witness), then the generator under the same
   EYE pins, then R-a, R-b, R-d, R-e (four each). R-c only after the storage
   spike's P-S1 has landed. Type the negation gap. Yeet to `merge-ready: yes`.
2. P2 P-R1: `CanonicalProofNodeV1` + encoder + hash; stable across
   premise-order permutations and cold replays; C2 digests unchanged.
3. P3 P-R2: entry = the `beep-effect-logos` archive located, LICENSE
   re-verified Apache-2.0, recorded under `history/`. Port the 46 `rete`
   tests as the match oracle; `RuleCertificate` + pure
   `compileRuleCertificate`; R-d emits proof-linked `InferenceTruncated`.
4. P4 P-R3: `EvidenceBatch` → kernel → `InferenceEvent` on R-c/R-e with
   retraction; ablate rete-port vs naive fixpoint vs EYE; record the verdict.
5. P5: verdict to `DECISIONS.md` (Current law "Reasoning" row + O4 gate
   status amended), `/reflect`, evidence under `history/`, state flip.

Non-negotiable:

- EYE is the oracle and gold source, never the runtime; gates are closure
  equality + per-`InferenceEvent` rule validation, never proof isomorphism.
- Each class asks EYE only for what it can independently establish; the rest
  is lab-owned expectation.
- One tombstone law: R-c and P4 reuse claim-targeted `Invalidated` with
  reach derived from `claimQuads` and recorded premises.
- Performance measurements and wall-clock live in the telemetry sidecar,
  never in a digest; the R-d budget and its `InferenceTruncated` witness are
  replay-stable fixture and run data.
- `HashSet`/`HashMap`, `Effect.fn`, decode at boundaries, Effect v4 verified
  against the reference checkout; schema → service → Layer.

Acceptance: every `SPEC.md` criterion, all `ops/manifest.json`
`verificationCommands` green, no unrelated churn.

Stop on the probe breaker (one redesigned candidate per failed probe, then
park and drop the exploration to `decompose`) — never on a calendar; on a
kill (drift, unsoundness, unstable identity); on P3 without the archive; on
any No-Go crossing.
