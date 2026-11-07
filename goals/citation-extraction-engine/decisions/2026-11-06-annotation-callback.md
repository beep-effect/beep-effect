---
title: "Preserve native annotator calls and deferred join failures"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert native callback capture and assembly integration together, preserving original corpora, default assembly and every unfinished acceptance requirement."
---

Assembly now captures the native-string annotator profile through an Effect service, preserves prepared callback arguments, defers non-string results until final join and stops on callback exceptions. Existing budget/Unicode/range capabilities snapshot receiving text without a new arena or registry. Eleven tests pass in 62.44s, including all unchecked source cases, actual Bun/Node markup traces, physical exits, exact capacity, callback capture/mutable-return controls and actual deadline labels. General host values, nested callbacks, final engine/boundary integration and every open law/fidelity/proof obligation remain required. See history/evidence/2026-11-06-annotation-callback.md.
