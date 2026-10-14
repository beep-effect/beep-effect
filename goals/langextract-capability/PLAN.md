# LangExtract Capability Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Packet Bootstrap | completed | Create the canonical packet from `goals/_template` and verify launcher/manifest basics. | Packet checks pass and P1 can launch. |
| P1 Parallel Research | completed | Run bounded read-only research agents and store reports in `research/reports/`. | All required reports exist with facts, evidence, inferences, recommendations, and do-not-do notes. |
| P2 Research Synthesis | completed | Synthesize reports into a decision-complete implementation proposal. | `research/synthesis.md` exists and proposal review returns zero required findings. |
| P3 Packet Finalization | completed | Rewrite packet docs around the accepted proposal. | `SPEC.md`, `PLAN.md`, `GOAL.md`, and manifest align with the proposal. |
| P4 Implement | in-progress | Implement provider-neutral `@beep/langextract` and any required `@beep/nlp` primitive promotions. | Package acceptance criteria and focused tests pass. |
| P5 Quality Review Fix Loop | pending | Run baseline quality, commit, reviewer/fixer rounds, and final verification. | Zero required blockers or explicit waivers. |
| P6 Yeet And PR Babysitting | pending | Publish the reviewed branch, open the PR, and close CI/review feedback. | PR has green checks and actionable feedback is closed. |

## P1 Research Lanes

Each lane is read-only and writes one report under `research/reports/`.

| Report | Focus |
| --- | --- |
| `repo-reuse-audit.md` | Repo export catalog, `@beep/file-processing`, provider drivers, existing helpers, duplicate risks. |
| `nlp-fit-audit.md` | `@beep/nlp` `Core`, `Handoff`, `Graph`, `Backend`, tests, consumer table, and promotion needs. |
| `effect-v3-reference.md` | The cloned Effect v3 port at `/home/elpresidank/YeeBois/ontology_research/ontology_ts_repos/effect-langextract`. |
| `effect-v4-migration.md` | `.repos/effect-v4`, v4 Schema, Context, Layer, Stream, and `effect/ai` differences. |
| `architecture-boundaries.md` | Foundation capability gate, provider-neutral scope, dependencies, exports, and package README policy. |
| `extraction-alignment.md` | Chunking, prompting, parsing, resolver/alignment, fuzzy matching, span invariants, and parity fixtures. |
| `testing-quality.md` | Fake language model, property tests, dtslint, docgen, export catalog, QRFL, yeet, and PR babysitting. |

## P2 Proposal Review Loop

1. Write `research/synthesis.md` from the research reports.
2. Run read-only proposal reviewers for quality, architecture, schema/domain,
   Effect law, errors, tests, observability, documentation/API, reuse, and
   evolution.
3. Store each inventory as
   `research/reports/proposal-review-round-<n>.md`.
4. Fix the proposal and repeat until zero required findings remain.
5. Escalate if the same blocker survives three rounds.

Result: `research/synthesis.md` is accepted for implementation. Round 1 is
stored at `research/reports/proposal-review-round-1.md` and reports zero
required findings.

## Accepted Implementation Direction

- Keep `@beep/langextract` provider-neutral and consume only injected
  `effect/ai/LanguageModel` services.
- Promote near-fit generic span/provenance primitives into `@beep/nlp` before
  exposing LangExtract output.
- Keep extraction targets, prompt/output contracts, parser state, alignment
  scoring, and orchestration local to `@beep/langextract`.
- Defer provider adapters, provider env/config, live smoke tests, CLI,
  rendering, visualization, and raw AI streaming.
- Document V1 offsets as JavaScript string indices unless a later standards
  decision changes the character offset contract.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Treat `@beep/nlp` as the preferred home for general NLP primitives.
- Treat provider adapters, provider config, CLI, rendering, and visualization as
  follow-up work unless research proves they belong outside the foundation
  package.
- Use deterministic fake language-model services for tests; live-provider proof
  is not required for V1.

## Verification Commands

```sh
test "$(wc -m < goals/langextract-capability/GOAL.md)" -le 4000
jq . goals/langextract-capability/ops/manifest.json
rg -n "langextract-capability|GOAL.md|agentLaunchers|packetAnchorDocument" goals/langextract-capability
git diff --check -- goals/langextract-capability
```
