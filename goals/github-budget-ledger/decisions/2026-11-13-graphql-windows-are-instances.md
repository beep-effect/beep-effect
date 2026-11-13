---
title: "GraphQL windows are reset-scoped instances, even for one token"
date: 2026-11-13
lane: "fix/github-ledger-graphql-windows"
reversal: "Revert this change; v2 rollups are still on disk and raw rows recompute any hour within retention"
---

D2f supersedes the 2026-11-13 premise that GraphQL windows are per credential. After #3200 merged, the live ledger reported 108,330+ GraphQL points for 2026-11-13T05 and 184,766+ for T06, against a 5,000-point window. Raw rows show one process, with one token fingerprint and one operation, alternating between two GraphQL windows whose resets are 15 seconds apart: in T06 one window rose to about 3,500 and the other to about 940. A token can therefore read two concurrent GraphQL windows. The 11-12 split by credential matched that data by coincidence and is not a property of the API.

Every GraphQL lane is now one reset-scoped window instance. A known fingerprint splits into instances by transitive reset proximity within five seconds, separately for idle and busy readings, exactly as unknown sources already did. Distinct fingerprints still never merge, and an unknown instance attaches only when exactly one known instance co-observes it (D2e). GraphQL windows never cross a reset. An instance contributes its peak in-hour `used`, minus its peak before the hour, or from zero when the window began inside the hour, or from its first in-hour reading as a lower bound. The peak replaces the last reading because a window's count only rises, so a lower late reading is a lagging response. Known REST credentials keep one continuous lane across resets, because core is shared per user.

Latest transport readings, the in-process cache and the write throttles retain one entry per GraphQL window instance, keyed per credential, so reserve sees a depleted window even when the token read the healthier one last. GraphQL entries expire at their reset like unknown instances; known REST entries keep age-based retention.

Rollups move to github-ledger-rollup/v3 and summaries to github-ledger-summary/v3. v1 and v2 rollups are legacy: with raw rows they recompute, and without them they stay explicit legacy-unrecomputable hours. Older summaries decode absent. A checkout that still runs v2 code rewrites v2 rollups for hours that it holds raw rows for, and v3 readers recompute those hours, so v3 readers stay correct while a mixed fleet upgrades.

An independent per-window computation over the live raw rows matches the v3 report for 2026-11-13T05 (3,192) and T06 (4,529).
