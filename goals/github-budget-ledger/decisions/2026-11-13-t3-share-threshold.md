---
title: "T3 share threshold: fire t3-snapshot-consumer above a 60% median share and 1,500 points/h"
date: 2026-11-13
lane: "goals/github-budget-ledger-final"
reversal: "Supersede with a decision that sets a new share or absolute floor, or open t3-snapshot-consumer directly by operator call."
---

The `t3-snapshot-consumer` gate (exploration MAP) fires when a 24 h window measured by the A19 method, run on the hub plus every reachable fleet host's `github ledger report --since 24h --json`, shows **both**:

1. The hourly **median** T3 share bound of the user identity's `graphql` key above **60%** of fleet GraphQL points. The bound is the residual `fleetUsed(hub) - hub est - hub gh - sum over hosts (est + gh)`, floored at 0, over `fleetUsed`.
2. The hourly **median** residual at or above **1,500 points/h**, 30% of one 5,000-point window.

**Measured at the time** (baseline `history/2026-11-13-hub-baseline.md`, 24 complete hours 2026-11-12T21Z to 2026-11-13T21Z, hub plus tbk-worker and dankserver): median share 45.6%, p90 66.4%, median residual 1,194 points/h. **The gate does not fire.**

**Why a share and an absolute floor.** The bound is an upper bound. It also holds raw agent `gh` and fleet hosts that were not reached, so a share threshold at or below today's 46% would fire on noise. The absolute floor covers the opposite failure. Once `github-state-worker` removes most `yeet monitor` spend (93% of the hub's attributed GraphQL points), T3's share rises mechanically while its spend stays the same. A large share of a small total is not a reason to patch the t3code fork. 1,500 points/h is about 25% above today's residual, so the gate fires only on real growth in T3 (or uncovered) spend.

**When to re-measure.** After `github-state-worker` lands (its after-number) and after `yeet-monitor-app-identity` 3b moves monitors to the App identity. Each re-measurement uses the same method and records the numbers in that goal's packet.
