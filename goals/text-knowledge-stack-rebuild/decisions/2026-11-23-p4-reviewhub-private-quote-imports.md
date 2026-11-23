---
title: "P4: preserve ReviewHub quote imports across selector retirement"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Replace the private versioned reader and explicit repair path together while preserving old JSONL bytes."
---

ReviewHub items.jsonl persists ReviewItem, including SourceRef arrays directly and inside QuestionFact. Freeze representative synthetic v1 rows before migration. A private frozen untagged quote reader preserves exact/prefix/suffix and all locators. Nonempty exact becomes QuoteSelector; empty exact becomes LegacyQuoteUnresolved with raw data and field path. Any unresolved nested quote yields LegacyReviewItemImported, displayed for repair and refused by executable writes/admission. Read old and versioned v2 rows; append only current v2 items and preserve raw old bytes. Migrate SourceRef, ReviewItem, QuestionFact, DocketQuestions and all measured consumers in commit 7 with ReviewFiles.test.ts reopened-store, mixed-version, byte-digest and no-op replay tests.
