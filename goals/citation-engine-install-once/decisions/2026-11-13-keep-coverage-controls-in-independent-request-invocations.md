---
title: "Keep coverage controls in independent request invocations"
date: 2026-11-13
lane: "feat/citation-invocation-binding"
pullRequest: 3265
reversal: "Replace these invocation fixture calls with a Layer only if it preserves each call admission, ledger, timer and cleanup lifetime."
---

Review the new coverage fixture calls under the existing direct-invocation decision. Each control owns or deliberately shares one production CitationInvocation; sharing their owner through it.layer would change the cumulative-budget and closed-owner behavior being asserted. Keep the EV003 request-lifetime exceptions with the existing owner and exit rationale. Refresh the inventory with its writer, retaining only Citation rows changed by this wave and restoring unrelated positional churn. Replace the new Option payload assertion with assertSome rather than accepting EV006.
