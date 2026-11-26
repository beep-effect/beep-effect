---
title: A tab is an error token only where it would act as indentation, never everywhere
date: 2026-11-25
reversal: Make every tab in leading whitespace or indicator separation an error token, or none of them, and drop afterEmptyBlockScalar.
governs:
  - src/internal/lexer.ts#createScanner
enforcedBy: []
---

YAML 1.2 §6.1 forbids tabs as indentation but allows them as separation (§6.2), so the lexer emits an `error` token for a tab only where it extends indentation. Outside flow context a leading tab run is indentation only while a block structure is open and the run is not before `{`/`[`; a tab-only blank line is separation unless an empty block scalar was just emitted (`foo: |\n\t\n`), which is why `afterEmptyBlockScalar` exists and is cleared at the next content. Inside flow context a tab before content is an error, before a closing indicator, a line break or EOF it is separation. A mixed space-then-tab run is an error only when its leading spaces match an open block scope, and blank lines are exempt.

After `-`, `?` and `:` (outside flow), a tab in the separation is an error when what follows is a nested block indicator (`-`, `?`) or any content (`?`); `scanBlockIndicator` consumes up to that tab and queues the error token behind the indicator. In a nested double-quoted scalar (`sCol > 0`) a tab right after a folded line break is consumed into an error span; at column 0 it is leading whitespace.

Rejected: rejecting every tab in leading whitespace, which fails valid separation and plain continuation lines; accepting every tab, which lexes tab-indented block structure the spec forbids.
