---
title: Block scalar headers carry what the reader needs, libyaml's extra indentation indicators, and the source's redundant ones on the fidelity path
date: 2026-11-26
reversal: Emit an indentation indicator only where YAML 1.2 §8.1.1.1 requires one, ignore explicitChomp, explicitIndent and preserveKeep, and compensate trailing blank runs in foldedOutputLines like interior ones.
governs:
  - src/internal/fold.ts#renderBlockLiteral
  - src/internal/fold.ts#renderBlockFolded
  - src/internal/fold.ts#blockChomp
  - src/internal/fold.ts#literalIndentIndicator
  - src/internal/fold.ts#needsLeadingIndentIndicator
  - src/internal/fold.ts#fidelityIndentIndicator
  - src/internal/fold.ts#foldedOutputLines
  - src/internal/stringifier.ts#renderString
enforcedBy: []
---
Chomping (YAML 1.2 §8.1.1.2) is derived from the value: `+` when it ends in two or more newlines or holds only newlines (a `|` with an empty body reads as the empty string, losing the newline), `-` when it ends in none, clip otherwise.
An indentation indicator (§8.1.1.1) is emitted when the first content line starts with a space, or the body opens with empty lines before content, since the reader could not detect the indent. `|` takes it after one leading empty line and `>` only after two, as libyaml's canonical emitter does: one blank leaves the next content line to establish the indent. A newline-only keep body as a block-map value gets `|2+` (K858), its empty body being ambiguous; as a sequence item it does not, since the `-` anchors the entry (JEF9).
On the fidelity path an explicit keep header, and an explicit indicator equal to the rendered indent, are re-emitted even when clip or auto-detection would read the same; canonical callers pass neither. An indicator outside 1-9 returns `None` and the caller falls back to escaped double quotes.
A folded body adds one empty line before a base-indent content line whose nearest previous content line is base-indent too, reversing §8.2.1: adjacent, it is the break that stops the fold to a space; across a blank run it compensates the kept break, and every run line is `""`, so placing it at the run's end is byte-identical. A more-indented line gets none, its break being kept, and a trailing blank run gets none, chomping mapping those breaks one to one.
Reason: every header must reparse to the same value, and the yaml-test-suite fixtures are libyaml output.
Rejected: the spec-minimal indicator set, which diverges from libyaml's canonical output; dropping redundant source headers, which loses byte fidelity; compensating the trailing blank run, which grows a keep scalar by one newline per round-trip.
