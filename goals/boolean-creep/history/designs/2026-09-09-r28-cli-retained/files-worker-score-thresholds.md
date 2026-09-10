# Instance

- id: `files-worker-score-thresholds`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts:1389`
- symbol: `isWorkerDispositionCoherent.thresholdBands`
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

# Risk and sequencing

Land as one Tier 1 classifier. The risk is erasing the supported overlap or
moving strict versus inclusive comparisons; encode the existing inequalities
verbatim.
