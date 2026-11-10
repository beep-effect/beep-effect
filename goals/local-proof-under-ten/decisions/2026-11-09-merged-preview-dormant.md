---
title: "yeet verify --merged stays supported and is marked dormant; quarantine residue is archived, nothing retired"
date: 2026-11-09
reversal: "Remove the dormancy note; restore archived quarantine entries from the archive if a reaped lease is needed."
---

`yeet verify --merged` (the merged-preview admission kind, weight 5, no grant since early October) stays supported and is documented as dormant (PERIL-13). The capability and its admission kind are kept; the scheduler's quarantine residue is summarized in status and archived before any reap (PERIL-10); nothing is retired. Removing the capability needs a new operator ruling. Rejected: retiring it (zero grants does not make the only merged-tree proof dead code).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D17).
