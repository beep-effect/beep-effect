---
title: "Archive plans rewrite Markdown code-span citations and wholly removed directories"
date: 2026-11-08
lane: "fix/packet-archive-citation-rewrite"
pullRequest: 2979
reversal: "Revert #2979; plans return to exact removed-file link destinations, and later batches repair code-span citations by hand"
---

The knowledge doctor reads inline code spans as tracked paths, including inside link text, but the inbound-link rewriter repointed only Markdown link destinations. #2968 failed knowledge:semantic-delta with 54 findings, and batch 1 merged over 30 of the same class. Plans now record each reference's form and rewrite a Markdown code span to plain link text, using the doctor's own span parser and path normalizer. Code spans outside Markdown stay untouched, because there a backticked path may be program data such as a JSON string or generated prompt text. A span citing a directory the tombstone keeps nothing under gets a tree URL. Tombstones render Provides as plain text, because capability names are not paths. Findings already left by batch 1 stay as they are, since a later plan no longer sees those paths.
