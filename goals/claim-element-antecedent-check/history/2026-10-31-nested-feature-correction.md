# Nested-feature correction — October 31

Review finding (PR #2411, `positive.main.ts`): every retained positive evaluation
marked a claim `nested` when its gold tree had any `part-of` edge. An ordinary
limitation attached to the claim root is a `part-of` edge, so all 538 selected
claims landed in `goldFeature.nested`, and that grouping matched the overall result.

Nesting now means containment below a top-level limitation: a `part-of` edge whose
parent is not the claim root. The replay records this definition, and
`research/summarize-positive.py` (summary schema v2) recomputes the flag from the
frozen gold fixtures. Retained per-claim results therefore summarize correctly
without being rewritten.

Under the corrected definition 79 of 538 selected claims are nested. The v22 and
v23 replays strictly match none of them, so nested lists are a measured gap rather
than a hidden one.

The frozen evaluations and their original summaries are unchanged. Corrected derived
summaries:

- [Per-evaluation corrected `goldFeature.nested`](2026-10-31-nested-feature-correction.json),
  beside each retained summary's original value
- [v22 summary, schema v2](2026-10-31-repair-v22-summary-v2.json)
- [v23 summary, schema v2](2026-10-31-repair-v23-summary-v2.json)
