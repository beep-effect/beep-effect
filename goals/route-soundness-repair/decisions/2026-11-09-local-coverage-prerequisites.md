---
title: "COVE-02 and COVE-03 are prerequisites of the advisory ratchet; local coverage on Node 22.23.4 from one pin"
date: 2026-11-09
reversal: "Drop the shared pin and its drift test and let local coverage children use the repo .nvmrc runtime again; COVE-01 must then wait for a new ruling."
---

The bounded in-publish advisory ratchet (COVE-01) belongs to local-proof-under-ten and may land only after this goal's bare-coverage self-judge fix (COVE-02) and the Node 22.23.4 local coverage pin (COVE-03). Local coverage children and baseline writes run on Node 22.23.4 read from one shared pin with a drift test against check.yml, so a local judge cannot drift from the hosted producer runtime. Rejected: letting COVE-01 land first on the repo default runtime, which keeps the node#63785 class of local false reds.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D15).
