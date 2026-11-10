---
title: "Property Laws: census and the residual file split first; sharding stays a gated candidate"
date: 2026-11-09
reversal: "Open HOST-05 as its own lever by a new decision once Property Laws p95 is measured over 10 minutes after the census and the residual file split slice, and the operator rules that mergeable contexts bind."
---

D10 orders the file split first with a census tripwire; D26 records that #3030's test-level selection already does the split's job at test grain and keeps D10 binding for what follows. In this goal the oracle census lands first, then the file split wherever the census and its per-file collection and hook timings show module-scope or hook cost still dominating, with its outcome recorded either way. Sharding the repo-cli sweep (HOST-05, +6 to +10 runner-min per run for about 3.4 min off the mergeable tail) is not work here: no further Property Laws shard lands unless p95 stays over 10 minutes after the census and the split slice, and then only with a ruling that mergeable contexts bind (D5). Rejected: shard now (compute for a tail-only latency gain); stop Yeet waiting on Property Laws (a property red would no longer hold merges). Run floors and seeds are unchanged.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D10, D26).
