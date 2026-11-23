---
title: "P2: QuoteKey normalizes the quote itself under its own QuoteNormalization version, separate from SourceTextIdentity.normalizationVersion"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Take an already normalized quote and a caller-supplied version string again, as the design module did, and bump quote-key/v1."
---

SourceTextIdentity.normalizationVersion is the version of the locator-only normalization contract of one capture; it is occurrence identity. Quote grouping needs a different thing: one fold that makes two spellings of a passage group together. They are two versions, so the design module's mintQuoteKey(normalizationVersion, normalizedQuote) is replaced by mintQuoteKey(quote, normalization) where QuoteNormalization is LiteralKit(["nfkc-dehyphenate/v1"]) and the function applies the fold. A caller can no longer mint a key over text it did not normalize. The preimage is (quote-key/v1, normalization literal, normalized quote). QuoteKey stays explicitly non-injective and is never an identity; L1-4 asserts that three repeated passages share one QuoteKey and have three OccurrenceIds.
