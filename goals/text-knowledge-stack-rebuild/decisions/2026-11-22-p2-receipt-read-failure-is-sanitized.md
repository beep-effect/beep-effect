---
title: "P2: the receipt read functions fail with one sanitized CitationReceiptReadFailure; the codecs keep the reason as an issue message"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Give CitationReceiptReadFailure a LiteralKit reason per refusal (stale-cm1, dangling-reference, unmintable, not-a-receipt) and map the issue to it."
---

readCitationDocumentReceipt and readCitationMentionReceipt, the only decode path for a receipt from outside the process, map every refusal to CitationReceiptReadFailure, a tagged error with no fields. A schema issue over a receipt can quote source text, and every other citation boundary in the server is sanitized the same way (CitationMentionFailure, CitationDocumentFailure). The reason is not lost for in-process callers: CitationDocumentReceiptRead and CitationMentionReceiptRead fail with InvalidValue issues whose messages name the refusal (a stored cm1 that is not its own recomputation, a mention reference the receipt does not hold, a mention that cannot be minted under citation-mention/v2, a standalone v1 receipt with warnings), and CitationMentionMigration.test.ts asserts each message through the codec and the sanitized failure through the read function. No caller distinguishes the reasons today; the first consumer that must, adds them.
