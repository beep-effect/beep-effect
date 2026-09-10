# R28 P2 design: files-worker-score-thresholds

Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Native P2 source/design proof is bound by `data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md` and the original bytes are archived by `data/r28-cli-retained-integration.json`. Independent replacement P3 design review remains pending; no prior review approval is transferred and no product implementation or test acceptance is claimed. Preserve the complete decoded API, public schema/method/test-kit exports, full payloads and encoded outputs described below. Raw request defaults, typed diagnostics and their ordering remain supported contracts; their D1 owners are not implementation targets of this returned-state migration.

# Instance

- id: `files-worker-score-thresholds`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus source SHA: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts:1389`
- symbol: `isWorkerDispositionCoherent`
- members: `couldMeetMatchThreshold`, `mustMeetMatchThreshold`,
  `couldMeetReviewThreshold`, `couldMissReviewThreshold`
- evidence: E4 at `MatchPerson.ts:1389-1400` plus the required
  reviewThreshold < matchThreshold check at lines 587-593.

# Current shape

Four locals classify one maximum worker score against two tolerance bands.
Review is always below match, so the two raw overlapping pair candidates miss
cross-relations. Explicit thresholds may be closer than twice the 0.000001
tolerance, allowing the bands to overlap.

# Cardinality gap

Four booleans represent 16 combinations and six are reachable across supported
threshold configurations: below review, review band, between bands,
overlapping review/match bands, match band, and above match. The overlapping
state exists when match-review is at most twice tolerance.

# Target schema

Define one private `WorkerScoreThresholdBand` LiteralKit with those six states.
Classify score once from ordered boundaries, including the close-threshold
overlap, then match it for dispositions. Do not create two independent
three-state literals or change tolerance inclusivity.

# Migration inventory

- `MatchPerson.ts:70,230` — retain exact tolerance and approximate score check.
- `MatchPerson.ts:587-593` — preserve supported strict review<match ordering.
- `MatchPerson.ts:1363-1405` — replace four locals with one classifier and
  exhaustive match while retaining face-count, quality, and aligner rules.
- `MatchPerson.ts:1461` caller keeps the same inconsistent-disposition error.
- Threshold defaults/flags in `Files.command.ts:365-417,667-732` and worker
  arguments in `MatchPerson.worker-service.ts:445-542` remain unchanged.
- Add focused synthetic score/tolerance boundaries to Files command tests.

# Guard-deletion accounting

Delete all four boolean locals and their negations/combinations. One literal
classification becomes the only threshold-state source. Keep independent face
quality, partial aligner, and disposition checks.

# Encoded-side impact

None. This state is transient validation logic. Worker scores, thresholds,
tolerance, report disposition, and errors remain unchanged.

# Test impact

Test every inclusive/exclusive boundary, ordinary gap, gap exactly 2t, smaller
overlap, and all six states against match/review/no-match dispositions. Retain
aggregate-score and report validation tests.

# Risk

Include this classifier in the ordered Tier 1E Files subsystem batch. The risk is erasing the supported overlap or
moving strict versus inclusive comparisons; encode the existing inequalities
verbatim.

R28 locator repair: the named Booleans are sibling local values inside `isWorkerDispositionCoherent`. The old dotted suffix was descriptive; no such nested object is declared. The existing complete finite law, lifecycle, numeric payloads and guard accounting remain unchanged.

Landing: use the ordered Tier 1E internal tooling subsystem batches, not singleton PRs per Tier 1 record. Include the six-state threshold classifier in the Files subsystem batch; keep its MatchPerson.ts edits serial with later Tier 2 reference-codec work and preserve the independent face-quality/aligner checks.
