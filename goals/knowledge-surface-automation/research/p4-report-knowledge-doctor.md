# P4 report — `beep knowledge doctor --report` over the live corpus (FP-eyeball input)

Status: phase-0 evidence for Workstream C Stage 2 (design:
`research/p4-knowledge-doctor-design.md`, PR 1). Read-only: produced by
`bun run beep knowledge doctor --report --json` at tree `f6a8fe3001` on 2026-10-13. The
command exits 0, reads no baseline, writes nothing (`git status --porcelain` unchanged),
and gates nothing. Domain evaluators, causal grouping, the sealed baseline, leases, and
quality-lane wiring are later PRs (design sequencing PR 2–5).

## What shipped

- `KnowledgeDoctor.schemas.ts`: span classes, witness-bearing evaluation outcomes
  (`Resolved` must carry a non-empty witness array), the report schema, and four
  additive finding kinds.
- `KnowledgeDoctor.service.ts`: span extraction over the Stage-1 corpus, the ordered
  classification rule table (archival-only historical markers; a marker on a live
  surface is inert and reported), the `paths` and `commands` evaluators,
  `unknown-beep-option`, and `overlayWithout` plus the counterfactual harness.
- `Knowledge.command-surface.ts`: static flag derivation, checked against the runtime
  CLI. Flags derive for 401 of 405 commands with zero mismatches, and that check is a
  committed test. Options on the other 4 commands are counted as unchecked, never
  passed.
- `knowledge-doctor.test.ts`: 23 tests, green on Bun and Node, including the
  counterfactual harness and the adversarial fixtures. Together with the existing
  knowledge suites that is 151/151 on each runtime, with Stage-1 behaviour unchanged.

## Live corpus

| Spans by class | Count |
| --- | --- |
| verified | 11,122 |
| unclassified | 19,314 |
| generated-example | 0 |
| historical-with-commit | 0 |

| Findings by kind | Count |
| --- | --- |
| unclassified-reference-span (advisory) | 19,314 |
| broken-tracked-path | 530 (across 255 documents) |
| unknown-beep-command | 20 |
| unknown-beep-option | 13 |
| failed-assertion | 1 |

Unchecked options: 0. Generated and historical counts are zero because the corpus has
no `beep:generated` fences or historical markers yet.

## Candidate false positives

1. **An assertion documented in prose is executed (true FP class).** The single
   `failed-assertion` is this packet's own `SPEC.md`, which shows the assertion syntax
   inside an inline code span (`` `<!-- beep:assert path-exists <path> -->` ``). An
   assertion marker inside inline code is documentation, not a claim. Fix in PR 2:
   only a marker that is a whole HTML-comment line outside code spans and fences
   asserts. This needs an adversarial fixture, not a normalizer exception.
2. **Planned commands in design-stage packets.** Of the 20 unknown commands, 16 name
   commands that design or plan documents propose but that do not exist yet:
   `ai-sync` (6), `laws dual-arity` (5), `reuse` (2), `quality repo-exports-catalog` (2),
   and `graphiti` (1). These are claims about the future, not doc rot. Proposed
   classification for PR 2: a command span inside a packet whose lifecycle is not
   `completed-retained`, in a planning document (`SPEC.md`, `PLAN.md`), classifies as
   `planned`. That is a new span class, non-baselineable, and reported but never
   blocking. It needs a K-decision before code.
3. **`…`-tail spans are true positives.** `ai-metrics …` and `yeet gh …` (3) violate
   the ratified authoring note (write `<command>`, never `...`). The fix is a doc fix.
4. **`worktree add` is a true positive.** The real subcommand is `worktree new`
   (`goals/lane-bootstrap/SPEC.md`).
5. **The 13 unknown options are all true positives.** `yeet repair --pr` (5) and
   `yeet publish --start-pr-early` (7) were removed in the push-first refactor, and
   `qa extract --round` (1) no longer exists.
6. **Broken tracked paths (530) carry over Stage-1's live finding set.** They are
   spread over 255 documents, mostly `packages/` (146), `goals/` (132), and
   `scripts/` (69) targets, concentrated in older reports (for example
   `goals/standards-remediation`). Burn-down belongs to the sealed baseline (PR 4–5),
   not a doc sweep now.
7. **Unclassified spans (19,314) are the classification worklist (K9).** They are
   advisory only and concentrate in large research packets (`goals/boolean-creep`
   1,694; `goals/time-to-certainty` 1,182). They gate only through the Stage-1
   introduced-only delta.

## Deviations from the design (recorded)

- Historical-marker block scope is line-based (Stage-1 fence reader plus blank lines),
  not a Markdown AST, so the slice adds no mdast dependency. A loose list split by
  blank lines counts as several blocks.
- The counterfactual harness has three verdicts. `failed` is required where no flag
  spelling is shadowed. `rebound` means the span still resolves through a different
  real witness (for example `-v` falling back to the global `--version`). `vacuous`
  means the evaluator ignored the tree, and it must never occur.
- `Failed` can carry several failures, so one command with two bad options yields two
  findings.
- Running without `--report` fails on purpose until the sealed baseline exists.

## Asks for the verdict

1. Accept candidate 1 as a true FP class, to be fixed in PR 2 with a fixture.
2. Rule on candidate 2: add a `planned` span class (new K-decision), or treat planned
   commands as true positives to be rewritten.
3. Accept candidates 3–7 as true positives. Fix 3–5 with a small doc PR; 6–7 are the
   baseline and classification burn-down.
