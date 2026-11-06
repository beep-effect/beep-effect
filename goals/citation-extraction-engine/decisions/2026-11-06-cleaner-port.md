---
title: "Publish the existing owned cleaner execution port"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Move the cleaner contract back into the private pipeline and restore direct imports, preserving existing issuance, runtime behavior and sealed evidence."
---

Move the full existing lazy owned-value cleaner contract into the server use-case subpath as CitationCleaner. Default production Context and all source/test consumers use it directly, without aliases or a second implementation. Declared port failures stay separate from the five engine-boundary failures. Repair hosted duplicate timing/test controls without dropping assertions or weakening gates. Tokenizer/service/Layer and remaining acceptance stay open. See history/evidence/2026-11-06-cleaner-port.md.
