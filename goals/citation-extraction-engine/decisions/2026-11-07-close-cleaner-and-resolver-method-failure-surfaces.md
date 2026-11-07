---
title: "Close cleaner and resolver method failure surfaces"
date: 2026-11-07
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the typed method translators/wrappers and restore preflight placement together while retaining source corpora, closed-method tests and all acceptance requirements."
---

Admitted cleaner methods and a captured registered-resolver boundary now expose CitationEngineFailure with R=never. Known resource/evidence categories and interruption are preserved; incidental private payloads are removed. Seven focused tests pass in 2.36s and twenty-two resolver/cleaner regressions in 4.64s; lint/types, declarations, blocking laws and scoped Fallow pass. Complete extraction translation, admitted public resolver/Engine/Layer and all exhaustive proof/accounting remain open. See history/evidence/2026-11-07-cleaner-resolver-boundaries.md.
