---
title: "Double-classify paraphrase leads in law-practice/domain, then stop the pass at 23% yield"
date: 2026-11-23
lane: "goals/jsdoc-lead-single-source-p1"
reversal: "Restore the 59 leads from the W2 merge base and resume the pass in later waves with the same two-classifier route"
---

The lexical `restating-lead` rule finds leads that repeat their `$I.annote` description word for
word. A second class restates it in other words: an annotated schema whose lead is a paraphrase
of its annotation. Wave 2 ran a double-classification pass on that class for its first package,
`@beep/law-practice-domain`, and stops the pass there.

- **Candidates:** 254 exports in `packages/law-practice/domain` whose lead shares words with the
  annotation but is not flagged by the lexical rule.
- **Classifier A:** an Opus 5.5 medium Agent child, given only the rows (file, export, lead,
  annotation), labelled each row `delete` (the lead says nothing the annotation does not) or
  `keep`.
- **Classifier B:** Cursor `claude-opus-5-5-medium` in a separate session with no author context:
  `cursor-agent -p --trust --mode ask --sandbox enabled --model claude-opus-5-5-medium
  --output-format text <prompt>`. Cursor's sandbox failed to mount its tool environment
  ("Mount count limit reached"), so the session ran with no tools and the rows in the prompt;
  the sandbox stayed enabled.
- **Result:** A and B agreed on 240 of 254 rows; 59 rows are `delete` on both sides (23%
  yield). Only those 59 leads are removed. An earlier pairing of two Opus Agent children agreed
  on 64; it is superseded because the second classifier must be a separate provider session.
- **Stop:** the brief stops the pass when the first package yields under about 30%. At 23%, a
  paraphrase lead is more often a different sentence than a restatement, and the cost is two
  classifier sessions per package. Later waves remove lexical restatements only.

Paraphrase removals are reported apart from the lexical count: they do not move the
`restating-lead` total, which counts only lexical restatements.
