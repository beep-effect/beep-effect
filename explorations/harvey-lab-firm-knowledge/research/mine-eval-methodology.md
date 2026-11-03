# Mine: eval-methodology ports (harvey-labs → beep-effect)

**Date:** 2026-08-08
**Agent:** mine-eval-methodology (Opus 5)
**Lens:** what of LAB's grading methodology beep should adopt, and where it lands.

**Citation convention.** Paths starting `tasks/`, `evaluation/`, `harness/`,
`docs/`, `tests/`, `CONTRIBUTING.md` are relative to the harvey-labs clone root
(`~/YeeBois/research/harvey-labs`). Every other path is relative to the
beep-effect repo root. `dms/` was never read (hard rule).

**Inputs read:** all five `research/map-*.md` reports, plus first-hand
verification of the beep judge surfaces cited below and two spot-checks against
the clone (`CONTRIBUTING.md:87-99`, `docs/eval-strategies.md:96-110`,
`tasks/firm-knowledge/tasks/001/task.json` C-011).

---

## 0. TL;DR

beep already has **more judge-output integrity than LAB does** and **no rubric at
all**. That asymmetry is the whole finding.

- `beep qa` validates what the judge *said* twice (`judge-ingest` at write,
  `judge-lint` against the committed file), schema-enforces verdict/array
  coherence, and structurally cross-checks every citation. LAB has no equivalent
  of any of those — its dual-judge report literally disagrees with its own
  aggregate (map-evaluation §7.3).
- But beep never tells the judge **what to check**. The QA judge is an
  open-ended finding generator over one whole-round bundle; the lens list is
  hand-duplicated prose in a markdown file with **no test binding it to the
  schema**. LAB's leverage is entirely on that side: 3,098 atomic criteria,
  one judge call each, scoped context per criterion, all-pass gate.

So the ports that matter are not "copy their scorer" — beep's scorer discipline
is better. They are: **give beep a rubric, make the rubric source under test, and
scope the judge to it.**

**Ranked (detail in §3):**

| # | Opportunity | Status today |
|---|---|---|
| 1 | `beep lint judge-rubric` — bind `judge-prompt.md` to `QaLens`, make the rubric source under test | NET-NEW gate over an **existing** rubric surface |
| 2 | Criterion-scoped judge calls for `beep qa` (one call per lens/scenario, scoped evidence) | Shape already proven in `docgen quality-worker-eval`; absent in `beep qa` |
| 3 | All-pass + criterion-pass diagnostic pairing; delete the ignored `weights` block | All-pass shape exists in 2 of 3 lanes; `AgentEffectiveness` is a weighted mean |
| 4 | Author-declared **acceptable-either-way** band + a **semantic** precision criterion | NET-NEW; nearest existing analogues are `QaSeverity.P2` and `forbiddenPatterns` |
| 5 | Dual-judge, scoped to **clean rounds only** | NET-NEW |

---

## 1. Inventory: beep's actual judge surfaces (verified)

Four distinct scoring surfaces exist. They do not share a rubric model, a
verdict model, or a gate shape.

### 1.1 `bun run beep qa judge-*` — the vision judge

`packages/tooling/tool/cli/src/commands/Qa/`

| Piece | File | What it does |
|---|---|---|
| Evidence bundler | `JudgePack.ts` | Writes `judge/{timeline.md, manifest.json, prompt.md}` — "hands it exactly three files" (`JudgePack.ts:4-8`) |
| Byte budget | `JudgePack.ts:49`, `:64` | `JUDGE_TOTAL_BUDGET_BYTES = 8 MiB`, `JUDGE_PER_FILE_BUDGET_BYTES = 400 KiB` |
| Coverage honesty | `JudgePack.ts:10-13` | Over-budget evidence is recorded in `dropped` "so the judge can never claim coverage it did not have" |
| Prompt template | `.claude/skills/browser-qa-loop/resources/judge-prompt.md` (94 lines) | The **entire** rubric surface. 4 placeholders: `{{ROUND}}`, `{{SURFACE}}`, `{{ROUND_DIR}}`, `{{SCENARIO_NOTES}}` |
| Output schema | `Inventory.schemas.ts` | `qa-inventory/v1`: `QaSeverity` (P0/P1/P2, `:38`), `QaLens` (16 literals, `:74-91`), `QaEvidenceRef`, `QaFinding`, `QaInventory` |
| Verdict coherence | `Inventory.schemas.ts:402-413` | `RequiredCountCoherenceCheck` — schema-level filter forcing `requiredCount == count(P0,P1)`; a miscounted verdict **fails decoding** |
| Salvage parser | `JudgeCheck.ts:357-394` | `extractLastJsonBlock` — last ```` ```json ```` fence, else last ```` ``` ````-fenced `{...}` |
| Evidence cross-check | `JudgeCheck.ts:258-287` | Every cited path must resolve inside the canonical round root and stat as a file; every cited `eventIds` entry must exist in `events.ndjson` |
| Ingest | `JudgeIngest.ts:142-192` | Single writer of `inventory.json` + `inventory.md`; parse → decode → round check → cross-check → write |
| Re-validation | `JudgeLint.ts:2-7` | Re-runs decode + cross-check "against the file that is actually committed" |
| Gate | `.claude/skills/browser-qa-loop/SKILL.md` step 5 | "Exit when a round reports `requiredCount: 0` AND capture is green" |

**Shape:** open-ended defect discovery. **One** judge invocation per round
(SKILL.md step 3 launches one codex task against one `prompt.md`). No criteria,
no per-criterion verdicts, no scoped context, no second judge.

### 1.2 `bun run beep docgen quality` — the deterministic rubric

`packages/tooling/tool/cli/src/commands/Docgen/internal/quality/`

- `Quality.schemas.ts:31` — `QUALITY_RUBRIC_VERSION = "jsdoc-quality-v1"`.
- `Quality.schemas.ts:78` — `DocgenQualityScoreMode = LiteralKit(["none","rubric","codex"])`.
- `Quality.rubric.ts:131` — `EXAMPLE_FINDING_RULES` is a **data catalog** of
  per-example checks folded in order, explicitly so "a new rule is one array
  entry" (`:129-130`). This is the closest thing in the repo to an authored
  rubric with stable rule ids (`DocgenQualityFindingCode`, `Quality.schemas.ts:177`).
- `Quality.rubric.ts:341-351` — tiering is **already all-pass-shaped**: any
  `fail`-tier finding ⇒ `fail`; any finding at all ⇒ at least `warn`; zero
  findings ⇒ `pass`. The 1-10 `score` (`:340`) sits beside it as a diagnostic.
  That is exactly LAB's binary-gate-plus-fraction pairing, arrived at
  independently.
- `Quality.service.ts:358` — `scorer: scoreMode === "codex" ? "codex-advisory-packet-v1" : "deterministic-rubric-v1"`.

### 1.3 `bun run beep docgen quality-worker-eval` — the LLM worker judge

`packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts` (1,334 lines)

- Providers: `LiteralKit(["codex","ollama","lmstudio"])` (`:91`).
- Verdict domain: `DocgenQualityWorkerEvalReviewDisposition = LiteralKit(["candidate","needs-human-review","reject"])` (`:223`).
- Structured output enforced via `outputSchema` on the thread call (`:875`).
- **Scoped context is already the rule here**: `workerPrompt` says "Use only the
  supplied packet and policy excerpt. Do not inspect files, run commands, or
  change source" (`:607`), and the worker runs in a temp dir that
  "intentionally contains no repository checkout" (`:903`).
- **But the verdict is a vibe:** the final instruction is "Draft a replacement
  JSDoc block, **score it from 1-10**, explain policy concerns, and classify the
  draft as candidate, needs-human-review, or reject" (`:626`). One subjective
  scalar, no criteria, no per-criterion attributability.

### 1.4 `bun run beep agent-effectiveness evals score` — the deterministic scorer

`packages/tooling/tool/cli/src/commands/AgentEffectiveness/`

- Task manifest: `SkillOptTaskManifest` (`AgentEffectiveness.schemas.ts:116`) with
  `completion: { requiredExports, requiredPatterns, forbiddenPatterns }` (`:57-77`).
- Corpus: 12 tasks in `goals/skillopt-training-pilot/corpus/tasks/*.json`; Python
  trainer in `tools/skillopt/`.
- **`forbiddenPatterns` is already a precision criterion** in deterministic form —
  e.g. `sfv4-null-return-001.json` forbids `"\\|\\s*null\\b"`, `"return\\s+null\\b"`,
  `"function\\s+isCurie\\b"`. beep understands the "assert nothing outside the
  set" shape; it just does not carry it into any LLM-judged lane.
- **Scoring is a weighted mean, not all-pass** (`internal/EvalScoring.ts`):
  `lawComponentScore(v) = 1/(1+v)` (`:170`), `aggregateLawFraction = mean(schemaFirst, tsgo, biome)` (`:184`),
  `score = completion_frac * law_frac` (`:213`).
- **A live footgun:** `SkillOptTaskWeights` is accepted and documented as
  "Manifest weighting metadata retained for compatibility; scorer formula remains
  contract-fixed" (`AgentEffectiveness.schemas.ts:85-93`), and every corpus task
  ships `"weights": { "completion": 0.5, "law": 0.5 }`. An author can set weights
  and believe they matter. LAB hit this exact problem and solved it the other
  way: `weight` is **banned by a test that fails the build**
  (`tests/test_task_integrity.py:157-160`).

### 1.5 Adjacent

- `bun run beep lint reflection-artifacts` (`commands/Lint/ReflectionArtifact.ts`,
  registered at `Lint.command.ts:629`) — schema-validated reflection frontmatter.
  This is the **existing precedent for lint-gating an authored artifact**, and
  the natural sibling slot for a rubric lint.
- `.claude/skills/quality-review-fix-loop/SKILL.md` — a 10-role reviewer panel
  with `zero_gate` (`:27`), `loop_budget: 3` (`:28`), and a `waiver_policy`
  (`:31`) allowing a required blocker to remain only with an explicit waiver.
  **The waiver concept exists here and nowhere else** — `beep qa` has no waiver.
- **No dual judge anywhere.** `QaInventory.judge` is a single `QaJudgeRef`
  (`Inventory.schemas.ts:271-287`); an rg over `packages/tooling`, `.claude/skills`,
  and the evidence-loop goal packets for `dual|agreement|cross-model|inter-rater`
  returns only unrelated `effect/Function` `dual` hits.

---

## 2. Port-by-port: Harvey mechanic → beep delta

### 2.1 All-pass ("95% right is wrong")

**Harvey.** `score = 1.0 if n_passed == n_total else 0.0`
(`evaluation/scoring.py:383-386`). Verbatim rationale, `docs/eval-strategies.md:98`:
"A diligence memo that catches 95% of issues but misses one material one is not
95% useful — it's wrong." Diagnostics `all_pass` / `n_criteria` / `n_passed`
persisted beside the gate (`evaluation/run_eval.py:125-154`). Corollary at
`docs/eval-strategies.md:110`: "criteria that are 'nice-to-have' padding drag
down the all-pass rate without surfacing real quality signal."

The census (`map-task-census.md` §2) supplies the arithmetic beep should adopt
with the philosophy: at 50% per-criterion reliability, expected all-pass across
the 250-task set is **10.19**; at 95% per-criterion it is 152.6/250. All-pass and
criterion-pass are separated by `p^n`, and reporting one as if it were the other
is a category error.

**beep today.**

| Lane | Gate shape | Diagnostic |
|---|---|---|
| `beep qa` | binary, negative form: `requiredCount == 0` | none — `requiredCount` only; no `n_criteria`, because there are no criteria |
| `docgen quality` (per subject) | all-pass-shaped (`Quality.rubric.ts:341-351`) | 1-10 `score` |
| `agent-effectiveness evals` | **none** — continuous `completion_frac * law_frac` | the breakdown *is* the score |

**Delta.** Two concrete gaps, not one philosophy gap:

1. `beep qa` cannot answer "how close was this round?" A round with 1 P1 and a
   round with 9 P1s are both `requiredCount > 0`. LAB's pairing needs a
   denominator; beep has no denominator because it has no rubric. This is
   downstream of port 2.2, not independent of it.
2. `agent-effectiveness` grades an eval task by a product of means. Under that
   formula a fixture that satisfies 3 of 4 `requiredExports` and trips one
   forbidden pattern still scores ~0.37 rather than 0 — which is exactly the
   "95% useful" fallacy applied to a repo-law conformance test where a single
   `return null` is a law violation. The `weights` block makes it worse by
   implying the formula is tunable when it is contract-fixed.

**Lands in.** `AgentEffectiveness.schemas.ts` (delete `SkillOptTaskWeights`, add a
banned-field decode check mirroring `tests/test_task_integrity.py:157-160`) +
`internal/EvalScoring.ts` (`allPass: boolean` alongside the existing fractions;
keep the fractions as diagnostics, never redefine `score` — LAB's additive
metric-versioning discipline, `evaluation/compare.py:313`).

### 2.2 Criterion-scoped judge context

**Harvey.** One judge call per criterion (`evaluation/scoring.py:342-381`), and
each criterion declares which output files the judge may see (`:343-358`).
Purpose stated at `docs/eval-strategies.md:67`: "focused context and prevents
cross-contamination between unrelated deliverables." When it is *not* used, the
truncation guard fires with the advice "Ensure criteria have deliverables lists
to scope output" (`evaluation/judge.py:114-121`).

**beep today.** The opposite: one call, everything. `JudgePack` assembles the
whole round into an 8 MiB bundle and the judge is told to "Open and view EVERY
file listed in `judge/manifest.json`" (`judge-prompt.md:9`). Sixteen lenses share
one context window, so a `contrast` judgment is made in the presence of every
drag frame strip, and a `selection-smear` judgment in the presence of every
static screenshot.

Two consequences that are already visible in the code:

- **The budget cliff is structural.** `dropped` exists (`JudgePack.ts:10-13`)
  precisely because whole-round bundling overruns 8 MiB. Scoping per criterion
  makes the budget per-criterion; the same evidence fits with room to spare and
  `dropped` becomes rare rather than routine.
- **Verdicts are not independently attributable.** One bad frame read can color
  every lens in the same call. LAB's isolation is what makes a single verdict
  re-runnable without re-judging the round.

**Proof the shape is tractable in-repo:** `docgen quality-worker-eval` already
does exactly this at packet granularity — one call per remediation packet, "Use
only the supplied packet and policy excerpt" (`QualityWorkerEval.ts:607`),
no checkout in the sandbox (`:903`). The pattern needs porting *across* beep
lanes, not importing from Python.

**Lands in.** `JudgePack.ts` (emit `judge/criteria/<id>/{prompt.md,manifest.json}`
instead of one bundle; the lens→evidence map is the new required field),
`Inventory.schemas.ts` (a `QaCriterion` with `evidence: NonEmptyArray<EvidenceSelector>` —
**required**, unlike LAB, which left it optional and had 29.5% of criteria bypass
it, map-evaluation §5.3), `JudgeIngest.ts` (fan-in per-criterion verdicts,
bounded `Effect.forEach({ concurrency })`).

### 2.3 Acceptable-either-way

**Harvey.** Verified verbatim, `tasks/firm-knowledge/tasks/001/task.json` C-011
("Qualifying set — precision"):

> The answer does not assert any matter outside this list: 1003-00001
> (Harrowgate PE); 1038-00001 (Cascade Retail); 1041-00001 (Solara Digital).
> Additionally, the following matters are ACCEPTABLE EITHER WAY — they are NOT
> required, and the answer must NOT be penalized for including OR omitting them
> (a second request they drew sits in a deal we filed outside our antitrust
> practice): 1003-00003 (Harrowgate PE); 1032-00005 (Halcyon Semi); 1038-00009
> (Cascade Retail).

61 of 250 tasks carry the block (map-task-census §5.1d). It does three jobs at
once: over-inclusion fails (precision), the ambiguity boundary is **data** rather
than judge discretion, and the *reason* the boundary is ambiguous is documented
inline.

**beep today.** Two partial analogues, neither of which is this:

- `QaSeverity.P2` — "polish that never counts toward the required total"
  (`Inventory.schemas.ts:38-42`, `isRequiredSeverity` `:378-383`). This is a
  **judge-assigned** neutral band. The judge decides what is taste. Nothing stops
  a judge from calling a deliberate design choice P1 and failing the round on it.
- `quality-review-fix-loop`'s `waiver_policy` (`SKILL.md:31`) — an
  **author-declared** neutral band, but it lives in a skill's prose protocol, not
  in any schema, and does not exist in `beep qa` at all.

**Delta.** beep has no way for a rubric author to say *in advance*: "this
specific item is genuinely ambiguous; do not reward or penalize it, and here is
why." That is a different mechanism from severity and from a post-hoc waiver: it
is a pre-declared, justified, diffable neutral set.

**Do it better than Harvey.** Their block is prose inside `match_criteria`, and
map-task-census §9 flags the soft spot correctly: the judge prompt
(`evaluation/prompts/rubric_criterion.txt`) is a bare PASS/FAIL with **no special
handling** — the hedge is honored only because the model happens to read it.
Model it as schema:

```
required:             HashSet<CriterionItemId>
acceptableEitherWay:  HashSet<CriterionItemId>
ambiguityReason:      NonEmptyString   // required when the set is non-empty
```

so the neutral set is enforced by the scorer, not by judge goodwill.

**Also the mirror — the semantic precision criterion.** beep's
`crossCheckAgainstRound` (`JudgeCheck.ts:258-287`) is a **structural**
fabrication guard: cited path must exist, cited event id must exist. It cannot
catch the finding whose cited frame exists but does not show the claimed defect.
Over-reporting is currently unmeasured in `beep qa` — which matters because
`requiredCount == 0` is the exit gate, so an over-eager judge costs a fix round
every time. `forbiddenPatterns` proves beep already models "assert nothing
outside the set" deterministically
(`goals/skillopt-training-pilot/corpus/tasks/sfv4-null-return-001.json`); the
port is carrying it into the judged lane.

**Lands in.** `Inventory.schemas.ts` (neutral band on `QaCriterion`; a
`fabrication` verdict class), `JudgeCheck.ts` (extend cross-check from
existence to a closure test over the declared criterion set).

### 2.4 Rubric-authoring discipline / rubric as source under test

**Harvey.** `CONTRIBUTING.md:87-99` is a nine-line law, quoted in relevant part:

> Each criterion is pass/fail. The task receives `1.0` only when every criterion
> passes. … Scope criteria to the deliverable files the judge should read. Avoid
> "nice to have" padding. All-pass scoring treats every criterion as
> launch-critical. Do not add legacy `weight` fields.

Enforcement, not aspiration: `tests/test_task_integrity.py` parametrizes over
**every** `task.json` in the tree (2,010 files) asserting valid JSON, non-empty
criteria, unique criterion ids, and no `weight`; CI runs it on every PR
(`.github/workflows/validate-task-schema.yml`). And `validate_task_config` is
called by **both** `harness/run.py:53` and `evaluation/run_eval.py:100` — a task
that cannot be graded cannot be run. map-evaluation §2.1 calls that bidirectional
gate "the cheapest good idea in the whole repo" and I agree.

Two more authoring conventions worth naming, both from map-task-census §5:

- **Identity + reason, never bare identity.** `Identifies <X> … because <evidence>`
  — a lucky guess fails. 792 criteria across 154 tasks.
- **Methodology criteria at C-001.** Every analytic task leads with 1-3 criteria
  grading the *stated derivation* before any number is graded (e.g. `188` C-002/C-003,
  an inclusion gate with an explicit exception). The rubric refuses to grade an
  answer whose derivation is unstated.
- **Criterion ids are permanent keys.** Six tasks have non-contiguous ids —
  criteria deleted without renumbering (`041`, `091`, `102`, `122`, `133`).

**beep today — the verified gap.** beep lint-gates the judge's **output**
thoroughly and its **rubric** not at all.

- The 16 `QaLens` literals live in `Inventory.schemas.ts:74-91`.
- The same 16 are hand-written as prose in `judge-prompt.md:32-55` (8 static, 8
  motion).
- They currently agree exactly. **Nothing binds them.** `rg` for `judge-prompt`
  across the repo returns only the constant `JUDGE_PROMPT_TEMPLATE`
  (`JudgePack.ts:79`), its `dist/` copies, and a JSDoc inventory anchor — **no
  test reads the file.**

The failure modes are asymmetric and both bad:

- Lens added to `QaLens`, not to the prompt ⇒ the judge never uses it; the lens
  is silently dead.
- Lens named in the prompt, not in `QaLens` ⇒ every inventory citing it **fails
  `decodeQaInventory`** at ingest (`JudgeIngest.ts:120-126`) and the entire
  judged round — a capture, an extract, and a paid vision-judge pass — is
  discarded.

**A second, cheaper defect found while verifying.** `extractLastJsonBlock`
(`JudgeCheck.ts:357-394`) requires a fence: `FENCED_JSON` needs ```` ```json ````,
`FENCED_ANY` needs a bare ```` ``` ```` wrapper. A judge that emits correct,
schema-valid, **unfenced** JSON produces `O.none` and ingest hard-fails the
round. LAB's `Judge._parse_json` (`evaluation/judge.py:232-259`) has exactly this
stage plus a **balanced-brace scan from each `{`** as stage 2. That third rung is
~15 lines and turns a wasted round into a successful ingest. It is the single
highest value-per-line item in this whole report.

**Lands in.** New `beep lint judge-rubric` beside `lintReflectionArtifactsCommand`
(`Lint.command.ts:629`); `judge-prompt.md` becomes **generated** from `QaLens`
rather than hand-maintained (render in `JudgePack.ts`, template keeps only the
prose sections); `JudgeCheck.ts` gains the brace-scan rung.

### 2.5 Dual-judge

**Harvey.** `JUDGE_MODELS = ("claude-sonnet-4-6", "gpt-5.5")`
(`evaluation/run_eval.py:29`), cross-vendor by construction, grading one *saved*
trajectory twice. The genuinely good part is artifact atomicity
(`:178-179`, `:191-194`, `:221-224`): the aggregate is unlinked before grading,
each judge's output is renamed so the next cannot clobber it, and the aggregate
is written only after both succeed — enforced by
`tests/test_eval_integration.py:265-294`.

**The part not to port.** map-evaluation §7.3 documents that LAB's dual
arithmetic disagrees with its own renderer: the aggregate uses a **mean** across
judges (`run_eval.py:196-220`) while `report.py:53` marks a criterion `pass` only
on an **AND-merge**, so one task can render `Score 0.875` beside `Criteria Passed
7/8`. And `compare._comparison_scores` (`:134-140`) *sums* passed and total across
both judges, so an 8-criterion task reports `16/16`. Three reconciliation rules
for one concept.

**beep today.** NET-NEW. `QaInventory.judge` is singular
(`Inventory.schemas.ts:271-287`). Arranging cross-vendor is trivial here — the QA
judge already runs `gpt-5.6-sol` via the codex companion while the fixer is
Anthropic — but the cost is a full second vision pass per round.

**The beep-shaped improvement.** Do not run dual on every round. Run it **only on
rounds that report `requiredCount: 0`** — the clean round is the exit gate, so a
false negative there is the only judge error that ships a defect, and it is also
the cheapest round to re-judge (an all-clean inventory means the second judge is
confirming absence, not re-deriving 12 findings). Uniform dual doubles cost for
the rounds that were going to fail anyway.

Reconciliation rule, picked once and used in aggregate **and** render:
**a clean round is clean only if both judges report zero required findings.**
Any disagreement is a P1 by construction. That is a strict AND with no mean
anywhere, so §7.3 cannot recur.

---

## 3. Ranked opportunities

### #1 — `beep lint judge-rubric`: make the rubric source under test

**Rank rationale:** cheapest, highest certainty, prevents a *verified* class of
wasted judged round, and lands in an existing command family with an existing
precedent.

**Capability cites (exists):** `beep lint reflection-artifacts`
(`commands/Lint/ReflectionArtifact.ts`, registered `Lint.command.ts:629`) is the
precedent for lint-gating an authored artifact. `Inventory.schemas.ts:74-91`
holds the canonical lens domain. `JudgePack.ts:79` holds the template path.

**Delta:** no test reads `judge-prompt.md` (verified by rg). The lens list is
duplicated by hand.

**Scope:**
1. Render the lens section of `judge-prompt.md` from `QaLens.Options` in
   `JudgePack.ts` — the prompt keeps prose, the domain comes from the schema.
2. `beep lint judge-rubric` asserts: prompt placeholders all resolvable, lens
   parity, criterion ids unique and never reused, no banned legacy fields.
3. Bidirectional gate, LAB-style (`harness/run.py:53` + `run_eval.py:100`):
   `judge-pack` refuses to render a prompt the lint would reject, so an
   ungradeable round cannot be judged.
4. Bundle the `extractLastJsonBlock` brace-scan rung (§2.4) — ~15 lines,
   `JudgeCheck.ts:393`.

**Lands in:** `commands/Lint/`, `commands/Qa/JudgePack.ts`, `commands/Qa/JudgeCheck.ts`,
`.claude/skills/browser-qa-loop/resources/judge-prompt.md`.

### #2 — Criterion-scoped judge calls for `beep qa`

**Rank rationale:** the largest structural win. It simultaneously removes the
8 MiB budget cliff, makes verdicts independently attributable and re-runnable,
and creates the denominator that opportunities #3 and #4 need.

**Capability cites (exists):** `docgen quality-worker-eval` already runs
one-call-per-packet with an explicitly closed context
(`QualityWorkerEval.ts:607`, `:903`) — the pattern is proven in-repo.
`JudgePack.ts:10-13` already models coverage honesty (`dropped`).

**Delta:** `beep qa` sends one bundle for 16 lenses. No `QaCriterion` type exists.

**Do it better than Harvey:** make evidence scoping **required by schema**.
LAB left it optional and 29.5% of criteria — and 100% of firm-knowledge —
bypassed it, which made their own truncation-guard advice unactionable
(map-evaluation §5.3). Also skip their four-rung filename resolver
(`evaluation/scoring.py:135-265`) entirely: beep's evidence paths are
CLI-generated and deterministic, so the fuzzy-match and hidden-second-LLM rungs
(`:196-265`, hardcoded `claude-sonnet-4-6` at `:251`) solve a problem beep does
not have.

**Lands in:** `commands/Qa/Inventory.schemas.ts` (`QaCriterion`, per-criterion
verdicts), `commands/Qa/JudgePack.ts` (per-criterion bundles),
`commands/Qa/JudgeIngest.ts` (bounded fan-in).

### #3 — All-pass gate + criterion-pass diagnostic; delete the ignored `weights`

**Rank rationale:** the philosophy is already half-adopted; what is missing is
one lane's gate and one dead field that actively misleads authors.

**Capability cites (exists):** `Quality.rubric.ts:341-351` (tier is all-pass-shaped,
1-10 score is the diagnostic — the pairing already exists in beep);
`Inventory.schemas.ts:402-413` (`RequiredCountCoherenceCheck` — a schema-level
verdict/array coherence guard **LAB has no equivalent of**, and precisely the
defect class that produced their `0.875` vs `7/8` report).

**Delta:** `AgentEffectiveness` scores by `completion_frac * law_frac`
(`EvalScoring.ts:213`) with no all-pass gate, and ships an ignored
`weights` block (`AgentEffectiveness.schemas.ts:85-93`) that all 12 corpus tasks
populate.

**Scope:** add `allPass` to `AgentEffectivenessEvalScoreReport` (never redefine
`score` — additive metric-versioning, `evaluation/compare.py:313`); make `weights`
a **decode failure**, mirroring `tests/test_task_integrity.py:157-160`; publish
`p^n` alongside all-pass in any leaderboard so the two are never conflated
(map-task-census §2).

**Lands in:** `commands/AgentEffectiveness/AgentEffectiveness.schemas.ts`,
`commands/AgentEffectiveness/internal/EvalScoring.ts`,
`goals/skillopt-training-pilot/corpus/tasks/*.json`.

### #4 — Author-declared acceptable-either-way band + semantic precision criterion

**Rank rationale:** closes two real failure modes (taste-failure and
over-reporting), but depends on #2 shipping first — there is nowhere to put a
criterion-level neutral band until criteria exist.

**Capability cites (partial):** `QaSeverity.P2` (`Inventory.schemas.ts:38-42`) is
a judge-assigned neutral band; `quality-review-fix-loop`'s `waiver_policy`
(`SKILL.md:31`) is an author-declared one that lives only in prose;
`forbiddenPatterns` (`AgentEffectiveness.schemas.ts:69-72`) is a deterministic
precision criterion. **NET-NEW** as a schema-carried, justified, per-criterion
construct in a judged lane.

**Delta:** no author-declared neutral band in any schema; `crossCheckAgainstRound`
guards structure, not semantics.

**Scope:** `required` / `acceptableEitherWay` / `ambiguityReason` on `QaCriterion`
with the neutral set enforced by the scorer rather than judge prose (fixing
LAB's own soft spot, map-task-census §9); a closure verdict per criterion
("the inventory asserts no finding outside this set").

**Lands in:** `commands/Qa/Inventory.schemas.ts`, `commands/Qa/JudgeCheck.ts`.

### #5 — Dual-judge on clean rounds only

**Rank rationale:** lowest confidence, highest marginal cost, and the reference
implementation is the one part of LAB that is provably self-inconsistent. Worth
doing, worth doing last, worth doing differently.

**Capability cites:** NET-NEW. `QaInventory.judge` is singular
(`Inventory.schemas.ts:271-287`).

**Scope:** `JudgeProfile = LiteralKit(["single","dual"])`; dual triggers only when
the first judge returns `requiredCount: 0`; reconciliation is a strict AND —
disagreement is a P1. Port LAB's **artifact atomicity** verbatim
(`run_eval.py:178-179`, `:191-194`, `:221-224`) and their per-judge reasoning
prefixes (`report.py:47-49`) so disagreements stay readable. Do **not** port the
mean-vs-intersection arithmetic (map-evaluation §7.3) or the pooled
`compare` rollup (`:134-140`).

---

## 4. Schema-first sketch (design order: schema → `Context.Service` → impl)

Redeclaration, not a port of the Python. Uses `LiteralKit`, `S.Class`, and
`HashSet` per repo law; the judge is a `Context.Service`, criterion fan-out is a
bounded `Effect.forEach({ concurrency })`, and the salvage parser is an `S.Codec`
decode with a fallback branch rather than a try/except ladder.

```
QaVerdict          = LiteralKit(["pass", "fail"])
QaJudgeProfile     = LiteralKit(["single", "dual"])

EvidenceSelector   = { kind: QaEvidenceKind, glob: NonEmptyString,
                       eventRange?: [SequenceNumber, SequenceNumber] }

QaCriterion        = { id: QaCriterionId,                 // permanent key, never an index
                       lens: QaLens,
                       matchCriteria: NonEmptyString,     // the standard itself
                       evidence: NonEmptyArray<EvidenceSelector>,   // REQUIRED, unlike LAB
                       acceptableEitherWay: HashSet<QaCriterionItemId>,
                       ambiguityReason: Option<NonEmptyString> }    // required iff the set is non-empty

QaRubric           = { version: "qa-rubric/v1",
                       surface: NonEmptyString,
                       criteria: NonEmptyArray<QaCriterion> }

QaCriterionResult  = { id, verdict: QaVerdict, reasoning: NonEmptyString,
                       findings: ReadonlyArray<QaFinding> }

QaRoundResult      = { allPass: boolean,                  // the gate
                       nCriteria: Int, nPassed: Int,      // the diagnostics
                       profile: QaJudgeProfile,
                       results: NonEmptyArray<QaCriterionResult> }
```

`QaFinding`, `QaEvidenceRef`, `QaSeverity`, `QaLens` survive unchanged from
`Inventory.schemas.ts` — this is additive. `RequiredCountCoherenceCheck` gains a
sibling asserting `nPassed == count(results, verdict == "pass")` and
`allPass == (nPassed == nCriteria)`, so the §7.3 defect class is unrepresentable
in beep by construction.

---

## 5. Do-not-port list

Verified traps from map-evaluation §12, restated as beep guidance:

1. **Optional evidence scoping.** Make it required or the guard is decorative
   (§5.3).
2. **Two reconciliation rules for dual.** Pick one; use it in aggregate and
   render (§7.3).
3. **A truncation guard on one provider only.** LAB's is Anthropic-only
   (`evaluation/judge.py:114`); the other three surface as parse errors with no
   diagnosis.
4. **A hidden second model.** `_llm_match_deliverables` always calls
   `claude-sonnet-4-6` regardless of `--judge-model` (`evaluation/scoring.py:251`),
   so a "pure GPT-5.5 judge" run is not one. If beep ever adds a resolver, route
   it through the same model config as the judge.
5. **Judge provider table narrower than run provider table** (§3.1) — share one
   `LiteralKit` domain.
6. **Vestigial fields.** `sources` is documented, present on 219 criteria, all
   empty, read by nothing. beep's `weights` is the same disease (§3 above).
7. **`response.content[0].text`** (`evaluation/judge.py:123`) assumes the first
   content block is text — breaks the moment extended thinking is on. beep reads
   stdout, so this is only a hazard if a judge moves to a provider SDK.

---

## 6. UNVERIFIED / out of scope

- **Whether criterion-scoped judging actually improves beep's QA verdict
  quality.** The argument here is structural (token budget, cross-contamination,
  attributability) plus LAB's stated rationale (`docs/eval-strategies.md:67`).
  No A/B exists in either repo. LAB ships no scored-run artifacts at all —
  `results/` is gitignored (`docs/architecture.md:265`) — so their own baseline
  numbers come from the announcement post, not from anything inspectable.
- **Whether `ACCEPTABLE EITHER WAY` is honored by LAB's judge.** The prompt is a
  bare PASS/FAIL with no special handling; the hedge is enforced only by the
  model reading the prose (map-task-census §9). The schema-carried version
  proposed in §2.3 is untested in either repo.
- **The `p^n` figures** (10.19 expected all-pass at p=0.5) are expectations under
  an independence assumption, from map-task-census §2. Real correlated-error
  all-pass is lower on trend/distribution tasks and higher on small superlatives.
- **`QualityWorkerEval.ts` read structurally,** not line-by-line: the outline,
  the LiteralKit domains, `workerPrompt` (`:603-627`), the thread call (`:875`),
  and the sandbox note (`:903`). The 1,334-line file's runner and reporting paths
  were not fully read.
- **`Extract.ts` (907 lines) and `Record.ts` (540 lines)** were not read; claims
  about the QA loop's capture/extract phases come from
  `.claude/skills/browser-qa-loop/SKILL.md` and `JudgePack.ts`.
- **`tools/skillopt/` (Python trainer)** was inventoried, not read. Whether the
  trainer's reward shaping duplicates `EvalScoring.ts`'s formula is unchecked —
  if it does, the all-pass change in #3 has a second landing site.
- **`tasks/firm-knowledge/dms/`** — not read (hard rule).
