---
title: "Fleet economics: retain journals on retire, T3 via one roots.json row, fleet hosts read-only"
date: 2026-11-09
reversal: "Stop exporting journals on retire and drop the T3 row and the fleet read; the optional seat and host fields decode as absent."
---

Retiring a lane exports its attempt journals outside the reaped residue root before deletion, and a copy failure blocks the deletion (PERIL-11). T3 lanes are counted through one row in the fleet `roots.json`, with no new code path. Fleet hosts are read over the existing SSH routes, read-only. Attempt rows gain optional seat and host fields, so older rows still decode. Raw journals stay out of the public repository; only aggregates are published. Rejected: local retention only (fleet p95 stays unmeasured) and leaving it as is (85% of merged branches since 10-25 have no surviving journal). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D18).
