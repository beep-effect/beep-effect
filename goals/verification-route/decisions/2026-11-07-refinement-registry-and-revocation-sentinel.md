---
title: "Refinement registry and revocation sentinel"
date: 2026-11-07
lane: "feat/verification-route-slice-2"
reversal: "Inline the removals into ROUTE_FOOTPRINTS and delete the sentinel file"
---

ROUTE_REFINEMENTS beside ROUTE_FOOTPRINTS; each row's kinds are derived from it so a refinement and its footprint effect cannot drift. Only enforced refinements not listed in the tracked standards/verification-route.sentinel.json skip a lane (routeLaneDecision); revoking is a one-line commit.
