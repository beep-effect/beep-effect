---
title: "Replay every original builtin find-citations input through the default engine"
date: 2026-11-07
kind: checkpoint
lane: "feat/citation-default-owners"
pullRequest: 2847
reversal: "Remove the new replay only if its projection is unsound; preserve original cases and report any failing source outcome without changing its expectation."
---

Add all 130 original builtin Tokenizer inputs from the canonical assertion capture to the default public engine replay. Thirteen ten-document shards per runtime cover the full set in hosted integration; focused tests run the first two cases. Compare independent expected citation kinds/components/metadata and original observed primary spans. Alternate tokenizers and unrepresented methods remain separate obligations; no case is promoted on scheduled tests. See history/evidence/2026-11-07-canonical-extraction-corpus.md.
