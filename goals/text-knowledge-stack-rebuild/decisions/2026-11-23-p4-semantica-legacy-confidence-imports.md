---
title: "P4: semantica v1 ledger scalars import as legacy-unknown with side-car raw values"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Add a reader that proves a v1 scalar from the cached provider response and upgrades that claim to Present without rewriting stored bytes; drop legacyConfidence once no v1 rows remain."
---

Every ledger-evidence/v1 claim, top-level or nested in a batch, reads as Absent legacy-unknown without consulting the provider cache, because the old ledger wrote 1 whenever confidence was missing. The stored number is kept as a LegacyConfidenceImport in LedgerSnapshot.legacyConfidence, not on the current claim. New writes are ledger-evidence/v2 envelopes, read only after the raw payload bytes match the stored digest. Degraded batch ids stay the digest of the plain outcome encoding, so ids do not change. Pattern readings carry the producer pin Engine{wink-nlp, 0.0.0}. A fresh reading that differs from a stored v1 row fails with immutable-payload-conflict instead of overwriting it; re-appending the projected outcome is a no-op. hosted-batch-v1.json stays frozen beside the new v2 snapshot.
