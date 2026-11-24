---
title: "P6: corpus search scores BM25 over the granted documents only, and FTS doc ids carry the docket"
date: 2026-11-24
lane: "p6"
reversal: "Score over the whole corpus and filter afterwards, with digest-only doc ids"
---

Independent review of the P6 design. fts_terms.document_frequency and the corpus document_count and average_length are computed over the whole corpus (server/src/PracticeKg.fts.ts:145-177), and searchText scores first and filters by family afterwards (PracticeKg.queries.ts:193-211), so A's scores and ranking for a term move with how often B uses it and A can probe B's vocabulary. The FTS doc_id is 'document:' || digest (fts.ts:131-133), joined back on that spelling (queries.ts:206): after the (digest, docket) re-key, two matters' rows would share one doc_id, GROUP BY doc_id would double token_count and term_frequency, and the join would return both dockets. doc_id becomes 'document:' || digest || ':' || docket. The search query filters fts_docstats and fts_postings to the granted family keys in CTEs before it computes the corpus and per-term statistics, so BM25 is the score of the granted sub-corpus. Path 4 of the two-matter test asserts that A's scores and ordering are identical with and without B's documents in the bundle. One index serves every principal; a per-matter index was not chosen because a principal staffed on two matters must search both as one corpus.
