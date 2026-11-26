---
title: "P6: every app that composes a walled layer provides LawPrincipal and MatterAuthorityLive from configuration in the row that widens it, with empty grants by default"
date: 2026-11-24
lane: "p6"
reversal: "Keep LawPrincipal and MatterAuthority out of the composed layers' requirements and provide them inside the server"
---

Independent review of the P6 design, three findings. LawPracticeServerLive's only app host composes it with the language model and BunCrypto only (apps/practice-kg-mcp/src/claims.ts:66), so widening its requirement by LawPrincipal and MatterAuthority without changing the host would break the app's typecheck until the KG row. apps/practice-gateway is a second production host of PracticeKgToolkitLayer, loaded lazily (src/PracticeKgProvider.ts:22,52,76-81,202), and the first draft named only practice-kg-mcp. Rule: the row that first widens a composed layer's requirement also changes each host to provide MatterAuthorityLive and a LawPrincipal from its own configuration, and adds the host's check and tests to that row's gate: practice-kg-mcp in row 9 (claims) and row 14 (KG), practice-gateway in row 14. The default MatterAuthorityConfig is empty, so an unconfigured host starts and denies every walled path; the claims batch's extractCandidate path is not walled and keeps working. Both hosts are single-user processes and name their principal in their profile or settings. The operator's real grants are the row 14 HOLD. Amends 2026-11-24-p6-matter-authority-port-principal-and-scope-bindings (hosts).
